<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * REST controller for stepwise/v1/workflows
 */
class Stepwise_REST_Workflows extends WP_REST_Controller {

	protected $namespace = STEPWISE_REST_NAMESPACE;
	protected $rest_base = 'workflows';

	/**
	 * Register all routes.
	 */
	public function register_routes(): void {
		register_rest_route( $this->namespace, '/' . $this->rest_base, [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_items' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'status' => [
						'type'              => 'string',
						'enum'              => [ 'draft', 'active', 'archived' ],
						'sanitize_callback' => 'sanitize_text_field',
					],
					'per_page' => [
						'type'              => 'integer',
						'default'           => 50,
						'minimum'           => 1,
						'maximum'           => 100,
						'sanitize_callback' => 'absint',
					],
					'page' => [
						'type'              => 'integer',
						'default'           => 1,
						'minimum'           => 1,
						'sanitize_callback' => 'absint',
					],
				],
			],
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'create_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => $this->get_create_args(),
			],
		] );

		register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<id>[\d]+)', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [ 'id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ] ],
			],
			[
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => [ $this, 'update_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => array_merge(
					[ 'id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ] ],
					$this->get_create_args( false )
				),
			],
			[
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'delete_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [ 'id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ] ],
			],
		] );

		// Export a workflow as JSON — publicly readable so import-from-URL on another site works
		register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<id>[\d]+)/export', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'export_item' ],
				// Public read is intentional — active workflows are shareable across sites via import-from-URL.
				// Non-active workflows are blocked inside the handler for unauthenticated requests.
				'permission_callback' => [ $this, 'export_permission' ],
				'args'                => [ 'id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ] ],
			],
		] );

		// Import a workflow from JSON
		register_rest_route( $this->namespace, '/' . $this->rest_base . '/import', [
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'import_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			],
		] );

	}

	/**
	 * GET /workflows
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_items( $request ): WP_REST_Response {
		global $wpdb;

		$per_page = (int) $request->get_param( 'per_page' );
		$page     = (int) $request->get_param( 'page' );
		$status   = $request->get_param( 'status' );
		$offset   = ( $page - 1 ) * $per_page;

		$workflows = Stepwise_Workflow::all( $status ?: null, $per_page, $offset );
		$total     = Stepwise_Workflow::count( $status ?: null );

		// Batch-load all steps for visible workflows in a single query to avoid N+1.
		$workflow_ids      = array_map( fn( $w ) => $w->id, $workflows );
		$steps_by_workflow = Stepwise_Step::for_workflows( $workflow_ids );

		// Batch-load the latest step completions for the current user across all workflows.
		$completions_by_step = [];
		if ( ! empty( $workflow_ids ) ) {
			$user_id = get_current_user_id();
			$ids     = array_map( 'absint', $workflow_ids );

			// Step 1: get the most recent execution ID per workflow for this user.
			$placeholders = implode( ',', $ids );
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
			$exec_rows = $wpdb->get_results( $wpdb->prepare(
				"SELECT workflow_id, MAX(id) AS exec_id
				   FROM {$wpdb->prefix}stepwise_executions
				  WHERE workflow_id IN ($placeholders)
				    AND started_by = %d
				  GROUP BY workflow_id",
				$user_id
			) );

			if ( ! empty( $exec_rows ) ) {
				$exec_ids     = array_map( fn( $r ) => (int) $r->exec_id, $exec_rows );
				$exec_holders = implode( ',', $exec_ids );
				// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,PluginCheck.Security.DirectDB.UnescapedDBParameter -- $exec_holders is a comma-separated list of absint-cast integers, not user input
				$rows = $wpdb->get_results(
					"SELECT step_id, status, completed_at, evidence_url
					   FROM {$wpdb->prefix}stepwise_step_completions
					  WHERE execution_id IN ($exec_holders)"
				);
				foreach ( $rows ?: [] as $row ) {
					$completions_by_step[ (int) $row->step_id ] = [
						'status'       => $row->status,
						'completed_at' => $row->completed_at,
						'evidence_url' => $row->evidence_url,
					];
				}
			}
		}

		$data = array_map( function ( $w ) use ( $steps_by_workflow, $completions_by_step ) {
			$arr          = $w->to_array( $steps_by_workflow[ $w->id ] ?? [] );
			$arr['steps'] = array_map( function ( $step ) use ( $completions_by_step ) {
				$step['last_completion'] = $completions_by_step[ $step['id'] ] ?? null;
				return $step;
			}, $arr['steps'] );
			return $arr;
		}, $workflows );

		$response = rest_ensure_response( $data );
		$response->header( 'X-WP-Total',      $total );
		$response->header( 'X-WP-TotalPages', (int) ceil( $total / $per_page ) );

		return $response;
	}

	/**
	 * GET /workflows/:id
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_item( $request ) {
		$workflow = Stepwise_Workflow::get( (int) $request['id'] );
		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}
		return rest_ensure_response( $workflow->to_array() );
	}

	/**
	 * POST /workflows
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_item( $request ) {
		$workflow = Stepwise_Workflow::create( [
			'title'       => $request->get_param( 'title' ),
			'description' => $request->get_param( 'description' ) ?? '',
			'status'      => $request->get_param( 'status' ) ?? 'draft',
			'source'      => 'local',
			'created_by'  => get_current_user_id(),
		] );

		if ( is_wp_error( $workflow ) ) {
			return $workflow;
		}

		$response = rest_ensure_response( $workflow->to_array() );
		$response->set_status( 201 );
		return $response;
	}

	/**
	 * PATCH /workflows/:id
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_item( $request ) {
		$id       = (int) $request['id'];
		$workflow = Stepwise_Workflow::get( $id );

		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		$data = array_filter( [
			'title'       => $request->get_param( 'title' ),
			'description' => $request->get_param( 'description' ),
			'status'      => $request->get_param( 'status' ),
			'category'    => $request->get_param( 'category' ),
		], fn( $v ) => null !== $v );

		$updated = Stepwise_Workflow::update( $id, $data );
		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		// When archiving, pause any in-progress executions so they don't run headlessly.
		if ( isset( $data['status'] ) && $data['status'] === 'archived' ) {
			global $wpdb;
			$wpdb->update(
				$wpdb->prefix . 'stepwise_executions',
				[ 'status' => 'paused', 'paused_at' => current_time( 'mysql' ) ],
				[ 'workflow_id' => $id, 'status' => 'in_progress' ],
				[ '%s', '%s' ],
				[ '%d', '%s' ]
			);
		}

		return rest_ensure_response( $updated->to_array() );
	}

	/**
	 * DELETE /workflows/:id
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_item( $request ) {
		$id       = (int) $request['id'];
		$workflow = Stepwise_Workflow::get( $id );

		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		if ( ! stepwise_workflow_can_delete( $id ) ) {
			return new WP_Error( 'stepwise_locked', __( 'This workflow cannot be deleted because it has been pushed to the cloud. Archive it instead.', 'stepwise' ), [ 'status' => 403 ] );
		}

		$deleted = Stepwise_Workflow::delete( $id );
		if ( ! $deleted ) {
			return new WP_Error( 'stepwise_db_error', __( 'Could not delete workflow.', 'stepwise' ), [ 'status' => 500 ] );
		}

		return rest_ensure_response( [ 'deleted' => true, 'id' => $id ] );
	}

	/**
	 * GET /workflows/:id/export — return workflow as a downloadable JSON structure.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function export_item( $request ) {
		$workflow = Stepwise_Workflow::get( (int) $request['id'] );
		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		$export = [
			'template_key' => 'custom-' . $workflow->id,
			'title'        => $workflow->title,
			'description'  => $workflow->description,
			'version'      => '1.0',
			'exported_at'  => gmdate( 'c' ),
			'steps'        => array_map(
				fn( $s ) => array_intersect_key( $s->to_array(), array_flip( [
					'sort_order', 'title', 'description', 'deep_link', 'deep_link_type',
					'is_required', 'evidence_required',
				] ) ),
				Stepwise_Step::for_workflow( $workflow->id )
			),
		];

		return rest_ensure_response( $export );
	}

	/**
	 * POST /workflows/import — create a workflow from a JSON export payload.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function import_item( $request ) {
		$body = $request->get_json_params();
		if ( empty( $body['title'] ) || empty( $body['steps'] ) ) {
			return new WP_Error( 'stepwise_invalid', __( 'Invalid workflow JSON. title and steps are required.', 'stepwise' ), [ 'status' => 400 ] );
		}

		$workflow = Stepwise_Workflow::create( [
			'title'        => sanitize_text_field( $body['title'] ),
			'description'  => sanitize_textarea_field( $body['description'] ?? '' ),
			'status'       => get_option( 'stepwise_default_status', 'draft' ),
			'source'       => 'imported',
			'template_key' => isset( $body['template_key'] ) ? sanitize_text_field( $body['template_key'] ) : null,
			'created_by'   => get_current_user_id(),
		] );

		if ( is_wp_error( $workflow ) ) {
			return $workflow;
		}

		foreach ( $body['steps'] as $step_data ) {
			Stepwise_Step::create( [
				'workflow_id'       => $workflow->id,
				'title'             => sanitize_text_field( $step_data['title'] ?? '' ),
				'description'       => sanitize_textarea_field( $step_data['description'] ?? '' ),
				'deep_link'         => isset( $step_data['deep_link'] ) ? esc_url_raw( $step_data['deep_link'] ) : '',
				'deep_link_type'    => in_array( $step_data['deep_link_type'] ?? '', [ 'static', 'dynamic' ], true ) ? $step_data['deep_link_type'] : 'static',
				'is_required'       => ! empty( $step_data['is_required'] ),
				'evidence_required' => ! empty( $step_data['evidence_required'] ),
				'sort_order'        => absint( $step_data['sort_order'] ?? 0 ),
			] );
		}

		$response = rest_ensure_response( Stepwise_Workflow::get( $workflow->id )->to_array() );
		$response->set_status( 201 );
		return $response;
	}

	/**
	 * Permission check — logged-in admin or SaaS API key (Pro).
	 *
	 * @param WP_REST_Request $request
	 * @return bool|WP_Error
	 */
	/**
	 * Export endpoint: active workflows are publicly readable (intentional — cross-site import via URL).
	 * Draft/archived workflows require manage_options. Non-existent workflows return false (404 via WP core).
	 */
	public function export_permission( WP_REST_Request $request ) {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		$workflow = Stepwise_Workflow::get( (int) $request['id'] );
		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		if ( $workflow->status !== 'active' ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		return true;
	}


	public function permissions_check( WP_REST_Request $request ) {
		if ( stepwise_current_user_can_edit() ) {
			return true;
		}

		if ( Stepwise_SaaS_Auth::is_connected() ) {
			$key = $request->get_header( 'X-Stepwise-Key' );
			if ( ! empty( $key ) && $this->verify_saas_key( $key ) ) {
				return true;
			}
		}

		return new WP_Error( 'stepwise_forbidden', __( 'You do not have permission to access this resource.', 'stepwise' ), [ 'status' => 403 ] );
	}

	/**
	 * @param string $key
	 * @return bool
	 */
	private function verify_saas_key( string $key ): bool {
		$stored = get_option( 'stepwise_site_api_key', '' );
		return ! empty( $stored ) && hash_equals( $stored, $key );
	}

	/**
	 * Returns false for loopback, private RFC-1918, and link-local addresses.
	 * Prevents SSRF via the import-from-url endpoint.
	 *
	 * @param string $url
	 * @return bool
	 */
	private function is_public_url( string $url ): bool {
		$host = wp_parse_url( $url, PHP_URL_HOST );
		if ( ! $host ) {
			return false;
		}

		$host = trim( $host, '[]' ); // strip IPv6 brackets

		$ip = filter_var( $host, FILTER_VALIDATE_IP );
		if ( false !== $ip ) {
			return (bool) filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE );
		}

		$blocked = [ 'localhost', 'ip6-localhost', 'ip6-loopback' ];
		if ( in_array( strtolower( $host ), $blocked, true ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Endpoint arg schemas for create / update.
	 *
	 * @param bool $require_title
	 * @return array
	 */
	private function get_create_args( bool $require_title = true ): array {
		return [
			'title' => [
				'type'              => 'string',
				'required'          => $require_title,
				'minLength'         => 1,
				'maxLength'         => 255,
				'sanitize_callback' => 'sanitize_text_field',
			],
			'description' => [
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_textarea_field',
			],
			'status' => [
				'type'              => 'string',
				'enum'              => [ 'draft', 'active', 'archived' ],
				'sanitize_callback' => 'sanitize_text_field',
			],
			'category' => [
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			],
		];
	}
}
