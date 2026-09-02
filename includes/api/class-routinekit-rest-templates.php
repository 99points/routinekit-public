<?php
defined( 'ABSPATH' ) || exit;

/**
 * REST endpoints for bundled local starter templates.
 *
 * GET  /routinekit/v1/templates           — list available templates
 * POST /routinekit/v1/templates/:key/import — import a template as a workflow
 */
class Routinekit_REST_Templates {

	/** @var string */
	protected string $namespace = ROUTINEKIT_REST_NAMESPACE;

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
		return rest_ensure_response( Routinekit_Templates::get_available() );
	}

	/**
	 * POST /templates/:key/import — import a bundled template as a new workflow.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function import_item( WP_REST_Request $request ) {

		$key      = sanitize_file_name( $request['key'] );
		$workflow = Routinekit_Templates::import( $key );

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
	public function permissions_check( WP_REST_Request $request ) {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}
		return new WP_Error(
			'routinekit_forbidden',
			__( 'You do not have permission to access this resource.', 'routinekit' ),
			[ 'status' => 403 ]
		);
	}
}
