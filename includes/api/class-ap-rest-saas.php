<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * REST endpoints for SaaS integration (groups, templates, import-url).
 * Used by the WP plugin JS — proxies requests to the SaaS API.
 */
class Stepwise_REST_SaaS {

	protected string $namespace = STEPWISE_REST_NAMESPACE;

	public function register_routes(): void {
		// GET /stepwise/v1/saas/groups
		register_rest_route( $this->namespace, '/saas/groups', [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_groups' ],
			'permission_callback' => [ $this, 'edit_permission' ],
		] );

		// POST /stepwise/v1/saas/groups/{id}/assign
		register_rest_route( $this->namespace, '/saas/groups/(?P<id>[\d]+)/assign', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'assign_to_group' ],
			'permission_callback' => [ $this, 'edit_permission' ],
			'args'                => [
				'id'          => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
				'workflow_id' => [ 'type' => 'integer', 'required' => true ],
			],
		] );

		// POST /stepwise/v1/workflows/{id}/assign-groups — save group IDs locally, no SaaS push
		register_rest_route( $this->namespace, '/workflows/(?P<id>[\d]+)/assign-groups', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'save_workflow_groups' ],
			'permission_callback' => [ $this, 'edit_permission' ],
			'args'                => [
				'id'        => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
				'group_ids' => [ 'type' => 'array', 'required' => true, 'items' => [ 'type' => 'integer' ] ],
			],
		] );

		// GET /stepwise/v1/saas/templates — local bundled templates available to all editors; SaaS templates require Pro
		register_rest_route( $this->namespace, '/saas/templates', [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ $this, 'get_templates' ],
			'permission_callback' => [ $this, 'editor_permission' ],
		] );

		// POST /stepwise/v1/saas/import-url
		register_rest_route( $this->namespace, '/saas/import-url', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'import_url' ],
			'permission_callback' => [ $this, 'edit_permission' ],
			'args'                => [
				'url' => [ 'type' => 'string', 'required' => true, 'sanitize_callback' => 'esc_url_raw' ],
			],
		] );
	}

	public function get_groups() {
		if ( ! Stepwise_SaaS_Auth::is_connected() ) {
			return rest_ensure_response( [ 'groups' => [] ] );
		}

		$cached = get_transient( 'stepwise_saas_groups' );
		if ( $cached !== false ) {
			return rest_ensure_response( [ 'groups' => $cached ] );
		}

		$result = ( new Stepwise_SaaS_Client() )->get_groups();

		if ( is_wp_error( $result ) ) {
			return new WP_Error( 'stepwise_saas_error', $result->get_error_message(), [ 'status' => 502 ] );
		}

		$groups = $result['groups'] ?? [];
		set_transient( 'stepwise_saas_groups', $groups, 5 * MINUTE_IN_SECONDS );

		return rest_ensure_response( [ 'groups' => $groups ] );
	}

	public function assign_to_group( WP_REST_Request $request ) {
		if ( ! Stepwise_SaaS_Auth::is_connected() ) {
			return new WP_Error( 'stepwise_not_connected', __( 'Not connected to Stepwise Cloud.', 'stepwise' ), [ 'status' => 400 ] );
		}

		$group_id    = (int) $request['id'];
		$workflow_id = (int) $request->get_param( 'workflow_id' );

		global $wpdb;
		$workflow = $wpdb->get_row( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}stepwise_workflows WHERE id = %d LIMIT 1",
			$workflow_id
		) );

		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		$raw_steps = $wpdb->get_results( $wpdb->prepare(
			"SELECT * FROM {$wpdb->prefix}stepwise_steps WHERE workflow_id = %d ORDER BY sort_order ASC",
			$workflow_id
		), ARRAY_A );

		// Whitelist the fields the SaaS needs — never send captured_options (may contain sensitive setting values).
		$steps = array_map( static function ( $s ) {
			return [
				'title'             => $s['title'],
				'description'       => $s['description'],
				'deep_link'         => $s['deep_link'],
				'deep_link_type'    => $s['deep_link_type'],
				'is_required'       => $s['is_required'],
				'evidence_required' => $s['evidence_required'],
				'sort_order'        => $s['sort_order'],
			];
		}, $raw_steps );

		// Lock locally BEFORE pushing to the SaaS so the workflow is never in an
		// unlocked state after distribution. Roll back the lock if the SaaS call fails.
		$existing_group_ids = ! empty( $workflow->pushed_group_ids )
			? array_map( 'intval', json_decode( $workflow->pushed_group_ids, true ) ?? [] )
			: [];
		$merged_group_ids   = array_values( array_unique( array_merge( $existing_group_ids, [ $group_id ] ) ) );

		$locked = Stepwise_Workflow::update( $workflow_id, [
			'pushed_at'        => current_time( 'mysql' ),
			'pushed_group_ids' => wp_json_encode( $merged_group_ids ),
		] );
		if ( is_wp_error( $locked ) ) {
			return new WP_Error( 'stepwise_db_error', __( 'Could not lock workflow before pushing. Please try again.', 'stepwise' ), [ 'status' => 500 ] );
		}

		$result = ( new Stepwise_SaaS_Client() )->assign_workflow_to_group( $group_id, [
			'workflow_id'    => $workflow_id,
			'workflow_title' => $workflow->title,
			'category'       => $workflow->category ?? '',
			'steps'          => $steps,
			'version'        => 1,
		] );

		if ( is_wp_error( $result ) ) {
			// Roll back the local lock — the push did not reach the SaaS.
			Stepwise_Workflow::update( $workflow_id, [
				'pushed_at'        => $workflow->pushed_at ?? null,
				'pushed_group_ids' => $workflow->pushed_group_ids ?? null,
			] );
			return $result;
		}

		return rest_ensure_response( [
			'success'     => true,
			'assigned_to' => $result['assigned_to'] ?? 0,
		] );
	}

	/**
	 * POST /stepwise/v1/workflows/{id}/assign-groups
	 * Save group IDs to the workflow locally — no SaaS push happens here.
	 */
	public function save_workflow_groups( WP_REST_Request $request ) {
		$workflow_id = (int) $request['id'];
		$group_ids   = array_map( 'absint', (array) $request->get_param( 'group_ids' ) );

		$workflow = Stepwise_Workflow::get( $workflow_id );
		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		$result = Stepwise_Workflow::update( $workflow_id, [
			'pushed_group_ids' => wp_json_encode( array_values( array_unique( $group_ids ) ) ),
		] );

		if ( is_wp_error( $result ) ) {
			return new WP_Error( 'stepwise_db_error', __( 'Could not save group assignment.', 'stepwise' ), [ 'status' => 500 ] );
		}

		return rest_ensure_response( [ 'success' => true, 'group_ids' => $group_ids ] );
	}

	public function get_templates() {
		// Always include bundled local templates (free plan feature).
		$local     = Stepwise_Templates::get_available_with_steps();
		$saas      = [];

		if ( Stepwise_SaaS_Auth::is_connected() ) {
			$cached = get_transient( 'stepwise_saas_templates' );
			if ( $cached !== false ) {
				$saas = $cached;
			} else {
				$result = ( new Stepwise_SaaS_Client() )->get_templates();
				if ( is_wp_error( $result ) ) {
					// SaaS unreachable — log and fall back to local templates only.
					stepwise_log( 'SaaS templates fetch failed: ' . $result->get_error_message(), 'saas' );
				} else {
					$saas = $result['templates'] ?? [];
					set_transient( 'stepwise_saas_templates', $saas, 15 * MINUTE_IN_SECONDS );
				}
			}
		}

		return rest_ensure_response( [ 'templates' => array_values( array_merge( $local, $saas ) ) ] );
	}

	public function import_url( WP_REST_Request $request ) {
		if ( ! Stepwise_SaaS_Auth::is_connected() ) {
			return new WP_Error( 'stepwise_not_connected', __( 'Not connected to Stepwise Cloud.', 'stepwise' ), [ 'status' => 400 ] );
		}

		$url    = $request->get_param( 'url' );
		$result = ( new Stepwise_SaaS_Client() )->import_url( $url );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return rest_ensure_response( $result );
	}

	public function edit_permission(): bool {
		return current_user_can( 'manage_options' ) && Stepwise_SaaS_Auth::is_connected();
	}

	public function editor_permission(): bool {
		return current_user_can( 'manage_options' );
	}
}
