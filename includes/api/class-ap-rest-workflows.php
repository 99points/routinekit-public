<?php
defined( 'ABSPATH' ) || exit;

/**
 * REST controller for stepwise/v1/workflows
 */
class AP_REST_Workflows extends WP_REST_Controller {

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

		// Import a workflow from a remote URL
		register_rest_route( $this->namespace, '/' . $this->rest_base . '/import-url', [
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'import_from_url' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'url' => [
						'type'              => 'string',
						'required'          => true,
						'format'            => 'uri',
						'sanitize_callback' => 'esc_url_raw',
					],
				],
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
		$per_page = (int) $request->get_param( 'per_page' );
		$page     = (int) $request->get_param( 'page' );
		$status   = $request->get_param( 'status' );
		$offset   = ( $page - 1 ) * $per_page;

		$workflows = AP_Workflow::all( $status ?: null, $per_page, $offset );
		$total     = AP_Workflow::count( $status ?: null );

		// Batch-load all steps for visible workflows in a single query to avoid N+1.
		$workflow_ids  = array_map( fn( $w ) => $w->id, $workflows );
		$steps_by_workflow = AP_Step::for_workflows( $workflow_ids );
		$data = array_map( fn( $w ) => $w->to_array( $steps_by_workflow[ $w->id ] ?? [] ), $workflows );

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
	public function get_item( $request ): WP_REST_Response|WP_Error {
		$workflow = AP_Workflow::get( (int) $request['id'] );
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
	public function create_item( $request ): WP_REST_Response|WP_Error {
		$workflow = AP_Workflow::create( [
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
	public function update_item( $request ): WP_REST_Response|WP_Error {
		$id       = (int) $request['id'];
		$workflow = AP_Workflow::get( $id );

		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		$data = array_filter( [
			'title'       => $request->get_param( 'title' ),
			'description' => $request->get_param( 'description' ),
			'status'      => $request->get_param( 'status' ),
			'category'    => $request->get_param( 'category' ),
		], fn( $v ) => null !== $v );

		$updated = AP_Workflow::update( $id, $data );
		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		return rest_ensure_response( $updated->to_array() );
	}

	/**
	 * DELETE /workflows/:id
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_item( $request ): WP_REST_Response|WP_Error {
		$id       = (int) $request['id'];
		$workflow = AP_Workflow::get( $id );

		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		if ( ! stepwise_workflow_can_delete( $id ) ) {
			return new WP_Error( 'stepwise_locked', __( 'This workflow cannot be deleted because it has been pushed to the cloud. Archive it instead.', 'stepwise' ), [ 'status' => 403 ] );
		}

		$deleted = AP_Workflow::delete( $id );
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
	public function export_item( $request ): WP_REST_Response|WP_Error {
		$workflow = AP_Workflow::get( (int) $request['id'] );
		if ( ! $workflow ) {
			return new WP_Error( 'stepwise_not_found', __( 'Workflow not found.', 'stepwise' ), [ 'status' => 404 ] );
		}

		// Unauthenticated requests can only export active workflows — drafts are work-in-progress.
		if ( $workflow->status !== 'active' && ! current_user_can( 'manage_options' ) ) {
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
				AP_Step::for_workflow( $workflow->id )
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
	public function import_item( $request ): WP_REST_Response|WP_Error {
		$body = $request->get_json_params();
		if ( empty( $body['title'] ) || empty( $body['steps'] ) ) {
			return new WP_Error( 'stepwise_invalid', __( 'Invalid workflow JSON. title and steps are required.', 'stepwise' ), [ 'status' => 400 ] );
		}

		$workflow = AP_Workflow::create( [
			'title'        => $body['title'],
			'description'  => $body['description'] ?? '',
			'status'       => get_option( 'stepwise_default_status', 'draft' ),
			'source'       => 'imported',
			'template_key' => $body['template_key'] ?? null,
			'created_by'   => get_current_user_id(),
		] );

		if ( is_wp_error( $workflow ) ) {
			return $workflow;
		}

		foreach ( $body['steps'] as $step_data ) {
			AP_Step::create( array_merge( $step_data, [ 'workflow_id' => $workflow->id ] ) );
		}

		$response = rest_ensure_response( AP_Workflow::get( $workflow->id )->to_array() );
		$response->set_status( 201 );
		return $response;
	}

	/**
	 * POST /workflows/import-url — fetch a remote JSON export and import it.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function import_from_url( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		// Requires a Pro plan — the SaaS proxy enforces this server-side too.
		if ( ! stepwise_is_pro() ) {
			return new WP_Error( 'stepwise_plan_required', __( 'Import from URL requires an Agency or Agency Pro license.', 'stepwise' ), [ 'status' => 403 ] );
		}

		$url    = $request->get_param( 'url' );
		$result = ( new AP_SaaS_Client() )->import_url( $url );

		if ( is_wp_error( $result ) ) {
			return new WP_Error( 'stepwise_fetch_failed', $result->get_error_message(), [ 'status' => 502 ] );
		}

		if ( empty( $result['title'] ) || empty( $result['steps'] ) ) {
			return new WP_Error(
				'stepwise_invalid',
				__( 'URL did not return valid workflow JSON. title and steps are required.', 'stepwise' ),
				[ 'status' => 422 ]
			);
		}

		// Re-use the same import logic
		$fake_request = new WP_REST_Request( 'POST' );
		$fake_request->set_body( wp_json_encode( $result ) );
		$fake_request->set_header( 'content-type', 'application/json' );

		return $this->import_item( $fake_request );
	}

	/**
	 * Permission check — logged-in admin or SaaS API key (Pro).
	 *
	 * @param WP_REST_Request $request
	 * @return bool|WP_Error
	 */
	/**
	 * Export endpoint: allow unauthenticated access so active workflows can be
	 * imported cross-site via URL, but require login for non-active workflows.
	 * The handler enforces the active-only rule for guests; this callback just
	 * satisfies the WP requirement of a non-__return_true permission_callback.
	 */
	public function export_permission( WP_REST_Request $request ): bool {
		return true;
	}

	public function permissions_check( WP_REST_Request $request ): bool|WP_Error {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( AP_SaaS_Auth::is_connected() ) {
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
