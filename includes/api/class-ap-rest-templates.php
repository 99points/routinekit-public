<?php
defined( 'ABSPATH' ) || exit;

/**
 * REST endpoints for bundled local starter templates.
 *
 * GET  /alignpress/v1/templates           — list available templates
 * POST /alignpress/v1/templates/:key/import — import a template as a workflow
 */
class AP_REST_Templates {

	/** @var string */
	protected string $namespace = ALIGNPRESS_REST_NAMESPACE;

	/**
	 * Register REST routes.
	 */
	public function register_routes(): void {
		register_rest_route( $this->namespace, '/templates', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_items' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			],
		] );

		register_rest_route( $this->namespace, '/templates/(?P<key>[a-z0-9_-]+)/import', [
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'import_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'key' => [
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_file_name',
					],
				],
			],
		] );
	}

	/**
	 * GET /templates — list all bundled templates.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_items( WP_REST_Request $request ): WP_REST_Response {
		return rest_ensure_response( AP_Templates::get_available() );
	}

	/**
	 * POST /templates/:key/import — import a bundled template as a new workflow.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function import_item( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		if ( ! alignpress_is_pro() && alignpress_at_workflow_limit() ) {
			return new WP_Error(
				'alignpress_limit_reached',
				sprintf(
					/* translators: %d: workflow limit */
					__( 'Free plan is limited to %d active workflows. Upgrade to Pro for unlimited workflows.', 'alignpress' ),
					ALIGNPRESS_FREE_WORKFLOW_LIMIT
				),
				[ 'status' => 403 ]
			);
		}

		$key      = sanitize_file_name( $request['key'] );
		$workflow = AP_Templates::import( $key );

		if ( is_wp_error( $workflow ) ) {
			$workflow->add_data( [ 'status' => 404 ] );
			return $workflow;
		}

		$response = rest_ensure_response( $workflow->to_array() );
		$response->set_status( 201 );
		return $response;
	}

	/**
	 * @param WP_REST_Request $request
	 * @return bool|WP_Error
	 */
	public function permissions_check( WP_REST_Request $request ): bool|WP_Error {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}
		return new WP_Error(
			'alignpress_forbidden',
			__( 'You do not have permission to access this resource.', 'alignpress' ),
			[ 'status' => 403 ]
		);
	}
}
