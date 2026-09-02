<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * REST controller for routinekit/v1/capture
 *
 * Serves pending captures to the React toast component, and handles
 * adding captured changes to a workflow as steps.
 */
class Routinekit_REST_Capture extends WP_REST_Controller {

	protected $namespace = ROUTINEKIT_REST_NAMESPACE;

	/**
	 * Register routes.
	 */
	public function register_routes(): void {
		// GET /capture/pending — React toast polls this after each page load
		register_rest_route( $this->namespace, '/capture/pending', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_pending' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			],
		] );

		// POST /capture/add-to-workflow — convert captured changes into steps
		register_rest_route( $this->namespace, '/capture/add-to-workflow', [
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'add_to_workflow' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'workflow_id' => [
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					],
					'capture_ids' => [
						'required' => true,
						'type'     => 'array',
					],
					'step_title' => [
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					],
				],
			],
		] );

		// DELETE /capture/dismiss — dismiss without adding to workflow
		register_rest_route( $this->namespace, '/capture/dismiss', [
			[
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'dismiss' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'capture_ids' => [
						'required' => true,
						'type'     => 'array',
					],
				],
			],
		] );

		// POST /capture/manual — queue a manually triggered capture from the JS field watcher
		register_rest_route( $this->namespace, '/capture/manual', [
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'manual_capture' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'label'       => [ 'required' => true,  'type' => 'string',  'sanitize_callback' => 'sanitize_text_field' ],
					'field_key'   => [ 'required' => false, 'type' => 'string',  'sanitize_callback' => 'sanitize_text_field' ],
					'old_value'   => [ 'required' => false, 'type' => 'string',  'sanitize_callback' => 'sanitize_textarea_field' ],
					'new_value'   => [ 'required' => false, 'type' => 'string',  'sanitize_callback' => 'sanitize_textarea_field' ],
					'page_url'    => [ 'required' => false, 'type' => 'string',  'sanitize_callback' => 'esc_url_raw' ],
					'page_title'  => [ 'required' => false, 'type' => 'string',  'sanitize_callback' => 'sanitize_text_field' ],
					'instructions'=> [ 'required' => false, 'type' => 'string',  'sanitize_callback' => 'sanitize_textarea_field' ],
					'workflow_id' => [ 'required' => false, 'type' => 'integer', 'sanitize_callback' => 'absint' ],
				],
			],
		] );

		// GET /capture/all — list all pending captures for the capture review page
		register_rest_route( $this->namespace, '/capture/all', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_all' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			],
			// DELETE /capture/all — wipe entire capture buffer (Danger Zone)
			[
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'delete_all' ],
				'permission_callback' => static fn() => current_user_can( 'manage_options' ),
			],
		] );
	}

	/**
	 * GET /capture/pending
	 *
	 * Returns any pending captures for the current user, consuming the transient signal.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_pending( $request ): WP_REST_Response {
		$user_id     = get_current_user_id();
		$transient   = get_transient( 'routinekit_pending_captures_' . $user_id );

		// No signal — return empty early
		if ( false === $transient ) {
			return rest_ensure_response( [ 'changes' => [], 'count' => 0 ] );
		}

		global $wpdb;
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, option_name, option_label, old_value, new_value, page_url, captured_at
				 FROM {$wpdb->prefix}routinekit_capture_buffer
				 WHERE captured_by = %d AND status = 'pending'
				 ORDER BY captured_at DESC
				 LIMIT 50",
				$user_id
			),
			ARRAY_A
		);

		// Consume the transient so it doesn't fire again this page cycle
		delete_transient( 'routinekit_pending_captures_' . $user_id );

		return rest_ensure_response( [
			'changes' => $rows,
			'count'   => count( $rows ),
		] );
	}

	/**
	 * POST /capture/add-to-workflow
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function add_to_workflow( $request ) {
		global $wpdb;

		$workflow_id = (int) $request->get_param( 'workflow_id' );
		$capture_ids = array_map( 'absint', (array) $request->get_param( 'capture_ids' ) );
		$step_title  = $request->get_param( 'step_title' );
		$user_id     = get_current_user_id();

		$workflow = Routinekit_Workflow::get( $workflow_id );
		if ( ! $workflow ) {
			return new WP_Error( 'routinekit_not_found', __( 'Workflow not found.', 'routinekit' ), [ 'status' => 404 ] );
		}

		if ( empty( $capture_ids ) ) {
			return new WP_Error( 'routinekit_invalid', __( 'capture_ids cannot be empty.', 'routinekit' ), [ 'status' => 400 ] );
		}

		// Fetch the captures
		$placeholders = implode( ',', array_fill( 0, count( $capture_ids ), '%d' ) );
		$rows         = $wpdb->get_results( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}routinekit_capture_buffer WHERE id IN ($placeholders) AND captured_by = %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
				array_merge( $capture_ids, [ $user_id ] )
			),
			ARRAY_A
		);

		if ( empty( $rows ) ) {
			return new WP_Error( 'routinekit_not_found', __( 'No matching captures found.', 'routinekit' ), [ 'status' => 404 ] );
		}

		// Build a snapshot of captured options for the step
		$captured_options = [];
		foreach ( $rows as $row ) {
			$captured_options[] = [
				'option_name'  => $row['option_name'],
				'option_label' => $row['option_label'],
				'old_value'    => $row['old_value'],
				'new_value'    => $row['new_value'],
			];
		}

		// Auto-title from first change if not supplied
		if ( empty( $step_title ) ) {
			$step_title = $rows[0]['option_label'] ?: ucwords( str_replace( '_', ' ', $rows[0]['option_name'] ) );
			if ( count( $rows ) > 1 ) {
				$step_title .= ' ' . sprintf(
					/* translators: %d: number of additional captured option changes */
					__( '(+%d more)', 'routinekit' ),
					count( $rows ) - 1
				);
			}
		}

		// Deep-link defaults to the page where the changes were made.
		$deep_link = $this->to_admin_relative_deeplink( (string) ( $rows[0]['page_url'] ?? '' ) );

		$step = Routinekit_Step::create( [
			'workflow_id'      => $workflow_id,
			'title'            => $step_title,
			'deep_link'        => $deep_link,
			'captured_options' => $captured_options,
		] );

		if ( is_wp_error( $step ) ) {
			return $step;
		}

		// Mark captures as added
		$wpdb->query( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$wpdb->prepare(
				"UPDATE {$wpdb->prefix}routinekit_capture_buffer SET status = 'added' WHERE id IN ($placeholders)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
				$capture_ids
			)
		);

		return rest_ensure_response( [
			'success' => true,
			'step'    => $step->to_array(),
		] );
	}

	/**
	 * POST /capture/manual
	 *
	 * Queues a single capture row from the JS field watcher (floating button).
	 * Source is 'manual' to distinguish from PHP option hook captures.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function manual_capture( $request ) {
		global $wpdb;

		$label        = $request->get_param( 'label' );
		$field_key    = $request->get_param( 'field_key' ) ?: '_manual_';
		$old_value    = $request->get_param( 'old_value' ) ?? '';
		$new_value    = $request->get_param( 'new_value' ) ?? '';
		$page_url     = $request->get_param( 'page_url' ) ?? '';
		$instructions = (string) ( $request->get_param( 'instructions' ) ?? '' );
		$workflow_id  = (int) ( $request->get_param( 'workflow_id' ) ?? 0 );
		$user_id      = get_current_user_id();

		// The 'source' column is guaranteed present since the activator migration (v1.2.3).
		$table = $wpdb->prefix . 'routinekit_capture_buffer';

		$row = [
			'option_name'  => sanitize_key( $field_key ) ?: '_manual_',
			'option_label' => $label,
			'old_value'    => $old_value,
			'new_value'    => $new_value,
			'page_url'     => $page_url,
			'captured_by'  => $user_id,
			'status'       => 'pending',
			'source'       => 'manual',
		];
		$formats = [ '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s' ];

		$inserted = $wpdb->insert( $table, $row, $formats );

		if ( false === $inserted ) {
			return new WP_Error( 'routinekit_db_error', __( 'Could not save capture.', 'routinekit' ), [ 'status' => 500 ] );
		}

		$capture_id = $wpdb->insert_id;

		// If a workflow was selected, immediately create a step from this capture.
		if ( $workflow_id > 0 ) {
			$workflow = Routinekit_Workflow::get( $workflow_id );
			if ( $workflow ) {
				$deep_link = $this->to_admin_relative_deeplink( (string) $page_url );

				$step = Routinekit_Step::create( [
					'workflow_id'      => $workflow_id,
					'title'            => $label,
					'deep_link'        => $deep_link,
					'captured_options' => [
						[
							'option_name'  => $row['option_name'],
							'option_label' => $label,
							'old_value'    => $old_value,
							'new_value'    => $new_value,
						],
					],
				] );

				if ( ! is_wp_error( $step ) ) {
					// Mark capture as added only once the step is confirmed created.
					$wpdb->update(
						$table,
						[ 'status' => 'added' ],
						[ 'id' => $capture_id ],
						[ '%s' ],
						[ '%d' ]
					);
					return rest_ensure_response( [ 'success' => true, 'id' => $capture_id, 'step' => $step->to_array() ] );
				}
			}
		}

		// No workflow selected — queue to buffer for later review.
		set_transient( 'routinekit_pending_captures_' . $user_id, true, 5 * MINUTE_IN_SECONDS );

		return rest_ensure_response( [ 'success' => true, 'id' => $capture_id ] );
	}

	/**
	 * DELETE /capture/dismiss
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function dismiss( $request ): WP_REST_Response {
		global $wpdb;

		$capture_ids = array_values( array_filter( array_map( 'absint', (array) $request->get_param( 'capture_ids' ) ) ) );

		if ( empty( $capture_ids ) ) {
			return rest_ensure_response( [ 'dismissed' => true ] );
		}

		$user_id      = get_current_user_id();
		$placeholders = implode( ',', array_fill( 0, count( $capture_ids ), '%d' ) );

		$wpdb->query(
			$wpdb->prepare(
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				"UPDATE {$wpdb->prefix}routinekit_capture_buffer SET status = 'dismissed' WHERE id IN ($placeholders) AND captured_by = %d",
				array_merge( $capture_ids, [ $user_id ] )
			)
		);

		return rest_ensure_response( [ 'dismissed' => true ] );
	}

	/**
	 * GET /capture/all
	 *
	 * Returns all pending captures for the current user for the review page.
	 *
	 * @return WP_REST_Response
	 */
	public function get_all(): WP_REST_Response {
		global $wpdb;

		$user_id = get_current_user_id();

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, option_name, option_label, old_value, new_value, page_url, captured_at
				 FROM {$wpdb->prefix}routinekit_capture_buffer
				 WHERE captured_by = %d AND status = 'pending'
				 ORDER BY captured_at DESC
				 LIMIT 200",
				$user_id
			),
			ARRAY_A
		);

		return rest_ensure_response( [
			'changes' => $rows ?? [],
			'count'   => count( $rows ?? [] ),
		] );
	}

	/**
	 * DELETE /capture/all
	 *
	 * Truncates all unassigned rows from the capture buffer. Rows that have
	 * already been added to a workflow step (status = 'added') are left intact
	 * so existing step snapshots are not orphaned.
	 *
	 * @return WP_REST_Response
	 */
	public function delete_all(): WP_REST_Response {
		global $wpdb;

		$wpdb->query( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- static query, no user input
			"DELETE FROM {$wpdb->prefix}routinekit_capture_buffer WHERE status IN ('pending', 'dismissed')"
		);

		return rest_ensure_response( [ 'cleared' => true, 'rows_deleted' => $wpdb->rows_affected ] );
	}

	/**
	 * Reduce a captured page URL to an admin-relative deep link.
	 *
	 * Deep links are stored the same way the built-in library stores them —
	 * relative to wp-admin ("admin.php?page=x"), never root-relative. The UI
	 * composes the href as adminUrl + deep_link, so a root-relative value like
	 * "wordpress/wp-admin/admin.php" resolves against the wrong base and the
	 * first path segment is mistaken for a hostname.
	 *
	 * @param string $page_url Absolute URL or root-relative path.
	 * @return string Admin-relative deep link, or '' when there is nothing usable.
	 */
	private function to_admin_relative_deeplink( string $page_url ): string {
		if ( '' === $page_url ) {
			return '';
		}

		// Ignore URLs from another host — a captured referer could point anywhere,
		// and rewriting one into an admin-relative link would silently produce a
		// deep link to the wrong page on this site.
		$host = wp_parse_url( $page_url, PHP_URL_HOST );
		if ( $host && wp_parse_url( admin_url(), PHP_URL_HOST ) !== $host ) {
			return '';
		}

		$path  = wp_parse_url( $page_url, PHP_URL_PATH ) ?? '';
		$query = wp_parse_url( $page_url, PHP_URL_QUERY );

		// Only strip the admin base when the path is actually inside wp-admin;
		// anything else is not a settings page we can link to.
		$admin_path = wp_parse_url( admin_url(), PHP_URL_PATH );
		if ( ! $admin_path || 0 !== strpos( $path, $admin_path ) ) {
			return '';
		}

		$path = substr( $path, strlen( $admin_path ) );

		return $path . ( $query ? '?' . $query : '' );
	}

	/**
	 * Permission check.
	 *
	 * @return bool|WP_Error
	 */
	public function permissions_check() {
		if ( routinekit_current_user_can_edit() ) {
			return true;
		}
		return new WP_Error( 'routinekit_forbidden', __( 'You do not have permission to access this resource.', 'routinekit' ), [ 'status' => 403 ] );
	}
}
