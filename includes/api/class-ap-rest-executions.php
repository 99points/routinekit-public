<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * REST controller for alignpress/v1/executions
 */
class AP_REST_Executions extends WP_REST_Controller {

	protected $namespace = ALIGNPRESS_REST_NAMESPACE;
	protected $rest_base = 'executions';

	/**
	 * Register routes.
	 */
	public function register_routes(): void {
		// GET current active execution (Runner uses this to restore state)
		register_rest_route( $this->namespace, '/executions/active', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_active' ],
				'permission_callback' => [ $this, 'run_permissions_check' ],
			],
		] );

		// GET /executions?workflow_id=X — list past executions for a workflow (admin only)
		register_rest_route( $this->namespace, '/executions', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_list' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [
					'workflow_id' => [
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					],
				],
			],
			// POST /executions — start a new execution
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'start_execution' ],
				'permission_callback' => [ $this, 'run_permissions_check' ],
				'args'                => [
					'workflow_id' => [
						'required'          => true,
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					],
				],
			],
		] );

		// GET + DELETE /executions/:id
		register_rest_route( $this->namespace, '/executions/(?P<id>[\d]+)', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_item' ],
				'permission_callback' => [ $this, 'run_permissions_check' ],
				'args'                => [ 'id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ] ],
			],
			[
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'cancel_item' ],
				'permission_callback' => [ $this, 'run_permissions_check' ],
				'args'                => [ 'id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ] ],
			],
		] );

		// GET /executions/:id/audit — admin-only, requires manage_options
		register_rest_route( $this->namespace, '/executions/(?P<id>[\d]+)/audit', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_audit' ],
				'permission_callback' => [ $this, 'permissions_check' ],
				'args'                => [ 'id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ] ],
			],
		] );

		// PATCH + DELETE /executions/:id/steps/:step_id
		register_rest_route( $this->namespace, '/executions/(?P<id>[\d]+)/steps/(?P<step_id>[\d]+)', [
			[
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => [ $this, 'complete_step' ],
				'permission_callback' => [ $this, 'run_permissions_check' ],
				'args'                => [
					'id'      => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					'step_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					'status'  => [
						'type'              => 'string',
						'enum'              => [ 'completed', 'skipped' ],
						'sanitize_callback' => 'sanitize_text_field',
					],
					'notes' => [
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_textarea_field',
					],
					'skipped_reason' => [
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_textarea_field',
					],
				],
			],
			[
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'uncomplete_step' ],
				'permission_callback' => [ $this, 'run_permissions_check' ],
				'args'                => [
					'id'      => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					'step_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
				],
			],
		] );
	}

	/**
	 * GET /executions/active
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_active( $request ): WP_REST_Response {
		$execution = AP_Execution::get_active();

		if ( ! $execution ) {
			return rest_ensure_response( [ 'active' => false ] );
		}

		return rest_ensure_response( $this->prepare_execution( $execution ) );
	}

	/**
	 * GET /executions?workflow_id=X
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function get_list( WP_REST_Request $request ): WP_REST_Response {
		$workflow_id = (int) $request->get_param( 'workflow_id' );
		$executions  = AP_Execution::for_workflow( $workflow_id );

		$items = array_map( function ( AP_Execution $e ) {
			$user = $e->started_by ? get_userdata( $e->started_by ) : null;
			return [
				'id'           => $e->id,
				'workflow_id'  => $e->workflow_id,
				'status'       => $e->status,
				'started_by'   => $user ? $user->display_name : __( 'Unknown', 'alignpress' ),
				'started_at'   => $e->started_at,
				'completed_at' => $e->completed_at,
				'created_at'   => $e->created_at,
			];
		}, $executions );

		return rest_ensure_response( $items );
	}

	/**
	 * POST /executions — start a run.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function start_execution( $request ): WP_REST_Response|WP_Error {
		$execution = AP_Execution::start( (int) $request->get_param( 'workflow_id' ) );

		if ( is_wp_error( $execution ) ) {
			return $execution;
		}

		$response = rest_ensure_response( $this->prepare_execution( $execution ) );
		$response->set_status( 201 );
		return $response;
	}

	/**
	 * GET /executions/:id
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_item( $request ): WP_REST_Response|WP_Error {
		$execution = AP_Execution::get( (int) $request['id'] );
		if ( ! $execution ) {
			return new WP_Error( 'alignpress_not_found', __( 'Execution not found.', 'alignpress' ), [ 'status' => 404 ] );
		}
		return rest_ensure_response( $this->prepare_execution( $execution ) );
	}

	/**
	 * DELETE /executions/:id — abandon/cancel an in-progress execution.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function cancel_item( $request ): WP_REST_Response|WP_Error {
		$id        = (int) $request['id'];
		$execution = AP_Execution::get( $id );
		if ( ! $execution ) {
			return new WP_Error( 'alignpress_not_found', __( 'Execution not found.', 'alignpress' ), [ 'status' => 404 ] );
		}
		if ( (int) $execution->started_by !== get_current_user_id() ) {
			return new WP_Error( 'alignpress_forbidden', __( 'You do not have permission to cancel this execution.', 'alignpress' ), [ 'status' => 403 ] );
		}
		AP_Execution::cancel( $id );
		return rest_ensure_response( [ 'cancelled' => true, 'id' => $id ] );
	}

	/**
	 * PATCH /executions/:id/steps/:step_id
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function complete_step( $request ): WP_REST_Response|WP_Error {
		$execution_id = (int) $request['id'];
		$step_id      = (int) $request['step_id'];
		$status       = $request->get_param( 'status' ) ?? 'completed';

		$execution = AP_Execution::get( $execution_id );
		if ( ! $execution ) {
			return new WP_Error( 'alignpress_not_found', __( 'Execution not found.', 'alignpress' ), [ 'status' => 404 ] );
		}

		$extra = array_filter( [
			'notes'          => $request->get_param( 'notes' ),
			'skipped_reason' => $request->get_param( 'skipped_reason' ),
			'evidence_url'   => $request->get_param( 'evidence_url' ),
		], fn( $v ) => null !== $v );

		// Auto-snapshot current wp_options values for captured steps
		$step = AP_Step::get( $step_id );
		if ( $step && ! empty( $step->captured_options ) && 'completed' === $status ) {
			$option_names = array_keys( (array) json_decode( $step->captured_options, true ) );
			$snapshot     = [];
			foreach ( $option_names as $name ) {
				$snapshot[ $name ] = get_option( $name );
			}
			$extra['after_snapshot'] = $snapshot;
		}

		AP_Execution::complete_step( $execution_id, $step_id, $status, $extra );

		// Reload to reflect any auto-completion of the execution
		return rest_ensure_response( $this->prepare_execution( AP_Execution::get( $execution_id ) ) );
	}

	/**
	 * DELETE /executions/:id/steps/:step_id — reopen a completed or skipped step.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function uncomplete_step( $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$execution_id = (int) $request['id'];
		$step_id      = (int) $request['step_id'];

		$execution = AP_Execution::get( $execution_id );
		if ( ! $execution ) {
			return new WP_Error( 'alignpress_not_found', __( 'Execution not found.', 'alignpress' ), [ 'status' => 404 ] );
		}
		if ( 'completed' === $execution->status ) {
			return new WP_Error( 'alignpress_locked', __( 'Cannot reopen a step on a completed execution.', 'alignpress' ), [ 'status' => 409 ] );
		}

		// Reset to pending rather than deleting — complete_step uses UPDATE so the row must exist.
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->update(
			$wpdb->prefix . 'alignpress_step_completions',
			[
				'status'         => 'pending',
				'completed_by'   => null,
				'completed_at'   => null,
				'notes'          => null,
				'skipped_reason' => null,
				'evidence_url'   => null,
			],
			[ 'execution_id' => $execution_id, 'step_id' => $step_id ],
			[ '%s', '%s', '%s', '%s', '%s', '%s' ],
			[ '%d', '%d' ]
		);
		// phpcs:enable

		return rest_ensure_response( $this->prepare_execution( AP_Execution::get( $execution_id ) ) );
	}

	/**
	 * GET /executions/:id/audit
	 * Returns a timestamped, user-attributed log of every step completion.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_audit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$execution = AP_Execution::get( (int) $request['id'] );
		if ( ! $execution ) {
			return new WP_Error( 'alignpress_not_found', __( 'Execution not found.', 'alignpress' ), [ 'status' => 404 ] );
		}

		$workflow  = AP_Workflow::get( $execution->workflow_id );
		$all_steps = AP_Step::for_workflow( $execution->workflow_id );
		$steps_map = [];
		foreach ( $all_steps as $s ) {
			$steps_map[ $s->id ] = $s;
		}

		$completions = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT sc.*, u.display_name AS user_name
				 FROM {$wpdb->prefix}alignpress_step_completions sc
				 LEFT JOIN {$wpdb->users} u ON sc.completed_by = u.ID
				 WHERE sc.execution_id = %d
				 ORDER BY sc.completed_at ASC",
				$execution->id
			),
			ARRAY_A
		);

		$log = [];
		foreach ( $completions as $c ) {
			$step   = $steps_map[ (int) $c['step_id'] ] ?? null;
			$log[] = [
				'step_id'        => (int) $c['step_id'],
				'step_title'     => $step ? $step->title : '',
				'status'         => $c['status'],
				'completed_by'   => $c['user_name'] ?? __( 'Unknown', 'alignpress' ),
				'completed_at'   => $c['completed_at'],
				'notes'          => $c['notes'],
				'evidence_url'   => $c['evidence_url'],
				'skipped_reason' => $c['skipped_reason'],
				'before_snapshot'=> ! empty( $c['before_snapshot'] )
					? json_decode( $c['before_snapshot'], true )
					: null,
				'after_snapshot' => ! empty( $c['after_snapshot'] )
					? json_decode( $c['after_snapshot'], true )
					: null,
			];
		}

		return rest_ensure_response( [
			'execution_id'   => $execution->id,
			'workflow_title' => $workflow ? $workflow->title : '',
			'started_at'     => $execution->started_at,
			'completed_at'   => $execution->completed_at,
			'log'            => $log,
		] );
	}

	/**
	 * Permission check for run-level operations (start, complete steps, cancel).
	 * Allows any role listed in alignpress_roles_run.
	 *
	 * @return bool|WP_Error
	 */
	public function run_permissions_check(): bool|WP_Error {
		if ( alignpress_current_user_can_run() ) {
			return true;
		}
		return new WP_Error( 'alignpress_forbidden', __( 'You do not have permission to run workflows.', 'alignpress' ), [ 'status' => 403 ] );
	}

	/**
	 * Permission check for admin-only operations (audit log, etc).
	 *
	 * @return bool|WP_Error
	 */
	public function permissions_check(): bool|WP_Error {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}
		return new WP_Error( 'alignpress_forbidden', __( 'You do not have permission to access this resource.', 'alignpress' ), [ 'status' => 403 ] );
	}

	/**
	 * Build a rich execution response that includes workflow + step data
	 * for the Runner sidebar.
	 *
	 * @param AP_Execution $execution
	 * @return array
	 */
	private function prepare_execution( AP_Execution $execution ): array {
		global $wpdb;

		$data      = $execution->to_array();
		$workflow  = AP_Workflow::get( $execution->workflow_id );
		$all_steps = AP_Step::for_workflow( $execution->workflow_id );

		// Fetch step completion rows
		$completions = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}alignpress_step_completions WHERE execution_id = %d",
				$execution->id
			),
			ARRAY_A
		);
		$completion_map = [];
		foreach ( $completions as $c ) {
			$completion_map[ (int) $c['step_id'] ] = $c;
		}

		// Find current step (first pending required step)
		$current_step       = null;
		$current_step_index = 0;
		$completed_count    = 0;

		foreach ( $all_steps as $index => $step ) {
			$comp   = $completion_map[ $step->id ] ?? null;
			$status = $comp['status'] ?? 'pending';

			if ( 'pending' === $status && ! $current_step && $step->is_required ) {
				$current_step       = $step;
				$current_step_index = $index;
			}
			if ( 'completed' === $status ) {
				$completed_count++;
			}
		}

		// Fall back to next optional pending step if all required steps done
		if ( ! $current_step ) {
			foreach ( $all_steps as $index => $step ) {
				$comp   = $completion_map[ $step->id ] ?? null;
				$status = $comp['status'] ?? 'pending';
				if ( 'pending' === $status ) {
					$current_step       = $step;
					$current_step_index = $index;
					break;
				}
			}
		}

		$data['workflow_title']       = $workflow ? $workflow->title : '';
		$data['workflow_pushed_at']   = $workflow ? $workflow->pushed_at : null;
		$data['workflow_source']      = $workflow ? $workflow->source : 'local';
		$data['total_steps']          = count( $all_steps );
		$data['completed_steps']      = $completed_count;
		$data['current_step_index']   = $current_step_index;
		$data['current_step']         = $current_step ? array_merge(
			$current_step->to_array(),
			[ 'completion' => $completion_map[ $current_step->id ] ?? null ]
		) : null;
		$data['steps']                = array_map( function ( $step ) use ( $completion_map ) {
			return array_merge(
				$step->to_array(),
				[ 'completion' => $completion_map[ $step->id ] ?? null ]
			);
		}, $all_steps );

		return $data;
	}
}
