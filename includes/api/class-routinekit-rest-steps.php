<?php
defined( 'ABSPATH' ) || exit;

/**
 * REST controller for routinekit/v1/workflows/:id/steps
 */
class Routinekit_REST_Steps extends WP_REST_Controller {

	protected $namespace = ROUTINEKIT_REST_NAMESPACE;

	/**
	 * Register all routes.
	 */
	public function register_routes(): void {
		$base = 'workflows/(?P<workflow_id>[\d]+)/steps';

		register_rest_route( $this->namespace, '/' . $base, [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_items' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [ 'workflow_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ] ],
			],
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'create_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => array_merge(
					[ 'workflow_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ] ],
					$this->get_step_args()
				),
			],
		] );

		register_rest_route( $this->namespace, '/' . $base . '/(?P<id>[\d]+)', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			],
			[
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => [ $this, 'update_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => $this->get_step_args( false ),
			],
			[
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'delete_item' ],
				'permission_callback' => [ $this, 'permissions_check' ],
			],
		] );

		// Bulk reorder
		register_rest_route( $this->namespace, '/' . $base . '/reorder', [
			[
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => [ $this, 'reorder_items' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'workflow_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					'order'       => [
						'required' => true,
						'type'     => 'array',
					],
				],
			],
		] );
	}

	/**
	 * GET /workflows/:workflow_id/steps
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_items( $request ) {
		$workflow_id = (int) $request['workflow_id'];
		if ( ! Routinekit_Workflow::get( $workflow_id ) ) {
			return new WP_Error( 'routinekit_not_found', __( 'Workflow not found.', 'routinekit' ), [ 'status' => 404 ] );
		}

		$steps = Routinekit_Step::for_workflow( $workflow_id );
		return rest_ensure_response( array_map( fn( $s ) => $s->to_array(), $steps ) );
	}

	/**
	 * GET /workflows/:workflow_id/steps/:id
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_item( $request ) {
		$step = Routinekit_Step::get( (int) $request['id'] );
		if ( ! $step || $step->workflow_id !== (int) $request['workflow_id'] ) {
			return new WP_Error( 'routinekit_not_found', __( 'Step not found.', 'routinekit' ), [ 'status' => 404 ] );
		}
		return rest_ensure_response( $step->to_array() );
	}

	/**
	 * POST /workflows/:workflow_id/steps
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_item( $request ) {
		$workflow_id = (int) $request['workflow_id'];
		if ( ! Routinekit_Workflow::get( $workflow_id ) ) {
			return new WP_Error( 'routinekit_not_found', __( 'Workflow not found.', 'routinekit' ), [ 'status' => 404 ] );
		}
		if ( routinekit_workflow_steps_locked( $workflow_id ) ) {
			return new WP_Error( 'routinekit_locked', __( 'Steps cannot be added after a workflow has been pushed to the cloud.', 'routinekit' ), [ 'status' => 403 ] );
		}

		$step = Routinekit_Step::create( [
			'workflow_id'       => $workflow_id,
			'title'             => $request->get_param( 'title' ),
			'description'       => $request->get_param( 'description' ) ?? '',
			'deep_link'         => $request->get_param( 'deep_link' ),
			'deep_link_type'    => $request->get_param( 'deep_link_type' ) ?? 'static',
			'is_required'       => $request->get_param( 'is_required' ) ?? true,
			'evidence_required' => $request->get_param( 'evidence_required' ) ?? false,
			'sort_order'        => $request->get_param( 'sort_order' ),
		] );

		if ( is_wp_error( $step ) ) {
			return $step;
		}

		$response = rest_ensure_response( $step->to_array() );
		$response->set_status( 201 );
		return $response;
	}

	/**
	 * PATCH /workflows/:workflow_id/steps/:id
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_item( $request ) {
		$id   = (int) $request['id'];
		$step = Routinekit_Step::get( $id );

		if ( ! $step || $step->workflow_id !== (int) $request['workflow_id'] ) {
			return new WP_Error( 'routinekit_not_found', __( 'Step not found.', 'routinekit' ), [ 'status' => 404 ] );
		}
		if ( routinekit_workflow_steps_locked( $step->workflow_id ) ) {
			return new WP_Error( 'routinekit_locked', __( 'Steps cannot be edited after a workflow has been pushed to the cloud.', 'routinekit' ), [ 'status' => 403 ] );
		}

		$data = array_filter( [
			'title'             => $request->get_param( 'title' ),
			'description'       => $request->get_param( 'description' ),
			'deep_link'         => $request->get_param( 'deep_link' ),
			'deep_link_type'    => $request->get_param( 'deep_link_type' ),
			'is_required'       => $request->get_param( 'is_required' ),
			'evidence_required' => $request->get_param( 'evidence_required' ),
			'sort_order'        => $request->get_param( 'sort_order' ),
		], fn( $v ) => null !== $v );

		$updated = Routinekit_Step::update( $id, $data );
		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		return rest_ensure_response( $updated->to_array() );
	}

	/**
	 * DELETE /workflows/:workflow_id/steps/:id
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_item( $request ) {
		$id   = (int) $request['id'];
		$step = Routinekit_Step::get( $id );

		if ( ! $step || $step->workflow_id !== (int) $request['workflow_id'] ) {
			return new WP_Error( 'routinekit_not_found', __( 'Step not found.', 'routinekit' ), [ 'status' => 404 ] );
		}
		if ( routinekit_workflow_steps_locked( $step->workflow_id ) ) {
			return new WP_Error( 'routinekit_locked', __( 'Steps cannot be deleted after a workflow has been pushed to the cloud.', 'routinekit' ), [ 'status' => 403 ] );
		}

		Routinekit_Step::delete( $id );
		return rest_ensure_response( [ 'deleted' => true, 'id' => $id ] );
	}

	/**
	 * PATCH /workflows/:workflow_id/steps/reorder
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function reorder_items( $request ) {
		$workflow_id = (int) $request['workflow_id'];
		if ( ! Routinekit_Workflow::get( $workflow_id ) ) {
			return new WP_Error( 'routinekit_not_found', __( 'Workflow not found.', 'routinekit' ), [ 'status' => 404 ] );
		}
		if ( routinekit_workflow_steps_locked( $workflow_id ) ) {
			return new WP_Error( 'routinekit_locked', __( 'Steps cannot be reordered after a workflow has been pushed to the cloud.', 'routinekit' ), [ 'status' => 403 ] );
		}

		$order = $request->get_param( 'order' );
		if ( ! is_array( $order ) ) {
			return new WP_Error( 'routinekit_invalid', __( 'order must be an array of {id, sort_order} objects.', 'routinekit' ), [ 'status' => 400 ] );
		}

		// Verify every step in the payload belongs to this workflow.
		$workflow_step_ids = array_map(
			fn( $s ) => (int) $s->id,
			Routinekit_Step::for_workflow( $workflow_id )
		);
		foreach ( $order as $item ) {
			if ( ! in_array( (int) ( $item['id'] ?? 0 ), $workflow_step_ids, true ) ) {
				return new WP_Error( 'routinekit_forbidden', __( 'One or more steps do not belong to this workflow.', 'routinekit' ), [ 'status' => 403 ] );
			}
		}

		Routinekit_Step::reorder( $order );

		$steps = Routinekit_Step::for_workflow( $workflow_id );
		return rest_ensure_response( array_map( fn( $s ) => $s->to_array(), $steps ) );
	}

	/**
	 * Permission check — same dual-auth as the workflow controller.
	 *
	 * @param WP_REST_Request $request
	 * @return bool|WP_Error
	 */
	public function permissions_check( WP_REST_Request $request ) {
		if ( routinekit_current_user_can_edit() ) {
			return true;
		}
		return new WP_Error( 'routinekit_forbidden', __( 'You do not have permission to access this resource.', 'routinekit' ), [ 'status' => 403 ] );
	}

	/**
	 * Step argument schemas.
	 *
	 * @param bool $require_title
	 * @return array
	 */
	private function get_step_args( bool $require_title = true ): array {
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
			'deep_link' => [
				'type'              => 'string',
				'sanitize_callback' => 'esc_url',
			],
			'deep_link_type' => [
				'type'              => 'string',
				'enum'              => [ 'static', 'dynamic' ],
				'sanitize_callback' => 'sanitize_text_field',
			],
			'is_required' => [
				'type' => 'boolean',
			],
			'evidence_required' => [
				'type' => 'boolean',
			],
			'sort_order' => [
				'type'              => 'integer',
				'minimum'           => 0,
				'sanitize_callback' => 'absint',
			],
		];
	}
}
