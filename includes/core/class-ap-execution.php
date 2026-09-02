<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * Execution/run tracking model.
 *
 * An execution represents one instance of a workflow being run on a site.
 */
class Routinekit_Execution {

	/** @var int */
	public int $id;

	/** @var int */
	public int $workflow_id;

	/** @var string|null */
	public ?string $saas_assignment_id;

	/** @var string pending|in_progress|completed|skipped */
	public string $status;

	/** @var int|null */
	public ?int $started_by;

	/** @var string|null */
	public ?string $started_at;

	/** @var string|null */
	public ?string $completed_at;

	/** @var int|null */
	public ?int $paused_by;

	/** @var string|null */
	public ?string $paused_at;

	/** @var string */
	public string $created_at;

	/**
	 * Fetch a single execution by ID.
	 *
	 * @param int $id
	 * @return static|null
	 */
	public static function get( int $id ): ?Routinekit_Execution {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}routinekit_executions WHERE id = %d LIMIT 1",
				$id
			)
		);
		return $row ? static::from_row( $row ) : null;
	}

	/**
	 * Fetch all executions for a workflow.
	 *
	 * @param int $workflow_id
	 * @return static[]
	 */
	public static function for_workflow( int $workflow_id ): array {
		global $wpdb;
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}routinekit_executions
				 WHERE workflow_id = %d
				 ORDER BY created_at DESC",
				$workflow_id
			)
		);
		return array_map( [ static::class, 'from_row' ], $rows ?: [] );
	}

	/**
	 * Get the most recent in-progress execution for any workflow.
	 * Used by the Runner to restore state across page navigations.
	 *
	 * @return static|null
	 */
	public static function get_active(): ?Routinekit_Execution {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}routinekit_executions
				 WHERE started_by = %d
				   AND (
				     status = 'in_progress'
				     OR status = 'paused'
				     OR ( status = 'abandoned' AND completed_at >= %s )
				   )
				 ORDER BY
				   CASE status
				     WHEN 'in_progress' THEN 0
				     WHEN 'paused'      THEN 1
				     WHEN 'abandoned'   THEN 2
				   END ASC,
				   id DESC
				 LIMIT 1",
				get_current_user_id(),
				gmdate( 'Y-m-d H:i:s', time() - 300 )
			)
		);
		return $row ? static::from_row( $row ) : null;
	}

	/**
	 * Start a new execution of a workflow.
	 *
	 * @param int $workflow_id
	 * @return static|WP_Error
	 */
	public static function start( int $workflow_id ) {
		global $wpdb;

		$workflow = Routinekit_Workflow::get( $workflow_id );
		if ( ! $workflow ) {
			return new WP_Error( 'routinekit_not_found', __( 'Workflow not found.', 'routinekit' ) );
		}

		if ( 'active' !== $workflow->status ) {
			return new WP_Error(
				'routinekit_workflow_not_active',
				__( 'This workflow is in draft and cannot be run.', 'routinekit' ),
				[ 'status' => 403 ]
			);
		}

		$user_id = get_current_user_id();
		$now     = current_time( 'mysql' );

		// Pause any currently in_progress execution for this user (different workflow).
		// We do NOT touch completed_at — the run isn't finished, just paused.
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$wpdb->prefix}routinekit_executions
				 SET status = 'paused', paused_by = %d, paused_at = %s
				 WHERE status = 'in_progress'
				   AND started_by = %d
				   AND workflow_id != %d",
				$user_id,
				$now,
				$user_id,
				$workflow_id
			)
		);

		// Resume a paused execution for the same workflow if one exists.
		$paused = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}routinekit_executions
				 WHERE workflow_id = %d
				   AND started_by = %d
				   AND status = 'paused'
				 ORDER BY id DESC
				 LIMIT 1",
				$workflow_id,
				$user_id
			)
		);

		if ( $paused ) {
			$wpdb->update(
				$wpdb->prefix . 'routinekit_executions',
				[ 'status' => 'in_progress', 'paused_by' => null, 'paused_at' => null ],
				[ 'id' => (int) $paused->id ],
				[ '%s', '%d', '%s' ],
				[ '%d' ]
			);
			return static::get( (int) $paused->id );
		}

		// No paused run to resume — start fresh.
		$result = $wpdb->insert(
			$wpdb->prefix . 'routinekit_executions',
			[
				'workflow_id' => $workflow_id,
				'status'      => 'in_progress',
				'started_by'  => $user_id,
				'started_at'  => $now,
			],
			[ '%d', '%s', '%d', '%s' ]
		);

		if ( false === $result ) {
			return new WP_Error( 'routinekit_db_error', __( 'Could not start execution.', 'routinekit' ) );
		}

		$execution_id = (int) $wpdb->insert_id;

		// Seed step_completions rows for every step in the workflow.
		$steps = Routinekit_Step::for_workflow( $workflow_id );
		foreach ( $steps as $step ) {
			$wpdb->insert(
				$wpdb->prefix . 'routinekit_step_completions',
				[
					'execution_id' => $execution_id,
					'step_id'      => $step->id,
					'status'       => 'pending',
				],
				[ '%d', '%d', '%s' ]
			);
		}

		// Update workflow's last_run_at and increment run_count.
		Routinekit_Workflow::update( $workflow_id, [ 'last_run_at' => $now ] );
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$wpdb->prefix}routinekit_workflows SET run_count = run_count + 1 WHERE id = %d",
				$workflow_id
			)
		);

		return static::get( $execution_id );
	}

	/**
	 * Cancel (abandon) an in-progress execution.
	 *
	 * @param int $execution_id
	 * @return bool
	 */
	public static function cancel( int $execution_id ): bool {
		global $wpdb;
		$result = $wpdb->update(
			$wpdb->prefix . 'routinekit_executions',
			[ 'status' => 'abandoned', 'completed_at' => current_time( 'mysql' ) ],
			[ 'id' => $execution_id ],
			[ '%s', '%s' ],
			[ '%d' ]
		);
		return false !== $result;
	}

	/**
	 * Complete a step within an execution.
	 *
	 * @param int    $execution_id
	 * @param int    $step_id
	 * @param string $status       completed|skipped
	 * @param array  $extra        notes, skipped_reason, evidence_url, before_snapshot, after_snapshot
	 * @return bool
	 */
	public static function complete_step( int $execution_id, int $step_id, string $status = 'completed', array $extra = [] ): bool {
		global $wpdb;

		$valid_statuses = [ 'completed', 'skipped' ];
		if ( ! in_array( $status, $valid_statuses, true ) ) {
			$status = 'completed';
		}

		$update = [
			'status'       => $status,
			'completed_by' => get_current_user_id(),
			'completed_at' => current_time( 'mysql' ),
		];
		$formats = [ '%s', '%d', '%s' ];

		if ( isset( $extra['notes'] ) ) {
			$update['notes'] = sanitize_textarea_field( $extra['notes'] );
			$formats[]       = '%s';
		}
		if ( isset( $extra['skipped_reason'] ) ) {
			$update['skipped_reason'] = sanitize_textarea_field( $extra['skipped_reason'] );
			$formats[]                = '%s';
		}
		if ( isset( $extra['evidence_url'] ) ) {
			$update['evidence_url'] = esc_url_raw( $extra['evidence_url'] );
			$formats[]              = '%s';
		}
		if ( isset( $extra['before_snapshot'] ) ) {
			$update['before_snapshot'] = wp_json_encode( $extra['before_snapshot'] );
			$formats[]                 = '%s';
		}
		if ( isset( $extra['after_snapshot'] ) ) {
			$update['after_snapshot'] = wp_json_encode( $extra['after_snapshot'] );
			$formats[]                = '%s';
		}

		$result = $wpdb->update(
			$wpdb->prefix . 'routinekit_step_completions',
			$update,
			[ 'execution_id' => $execution_id, 'step_id' => $step_id ],
			$formats,
			[ '%d', '%d' ]
		);

		// No row existed (step wasn't seeded at execution start) — insert it now.
		if ( 0 === $result ) {
			$insert = array_merge(
				$update,
				[ 'execution_id' => $execution_id, 'step_id' => $step_id ]
			);
			$insert_formats = array_merge( $formats, [ '%d', '%d' ] );
			$result = $wpdb->insert(
				$wpdb->prefix . 'routinekit_step_completions',
				$insert,
				$insert_formats
			);
		}

		// Check if all required steps are done — auto-complete the execution
		static::maybe_complete_execution( $execution_id );

		return false !== $result;
	}

	/**
	 * Mark an entire execution as complete if all required steps are done.
	 *
	 * @param int $execution_id
	 */
	private static function maybe_complete_execution( int $execution_id ): void {
		global $wpdb;

		$pending = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}routinekit_step_completions sc
				 JOIN {$wpdb->prefix}routinekit_steps s ON sc.step_id = s.id
				 WHERE sc.execution_id = %d
				   AND sc.status = 'pending'
				   AND s.is_required = 1",
				$execution_id
			)
		);

		if ( 0 === $pending ) {
			$wpdb->update(
				$wpdb->prefix . 'routinekit_executions',
				[
					'status'       => 'completed',
					'completed_at' => current_time( 'mysql' ),
				],
				[ 'id' => $execution_id ],
				[ '%s', '%s' ],
				[ '%d' ]
			);

			$execution = static::get( $execution_id );
			if ( $execution ) {
				do_action( 'routinekit_execution_completed', $execution );
			}
		}
	}

	/**
	 * Create an execution from a SaaS assignment payload.
	 *
	 * @param array $assignment
	 * @return static|WP_Error
	 */
	public static function create_from_saas_assignment( array $assignment ) {
		global $wpdb;

		$workflow_id       = absint( $assignment['workflow_id'] ?? 0 );
		$saas_assignment_id = sanitize_text_field( $assignment['id'] ?? '' );

		if ( ! $workflow_id || ! $saas_assignment_id ) {
			return new WP_Error( 'routinekit_invalid', __( 'Invalid SaaS assignment payload.', 'routinekit' ) );
		}

		// Don't duplicate if already received
		$exists = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$wpdb->prefix}routinekit_executions WHERE saas_assignment_id = %s LIMIT 1",
				$saas_assignment_id
			)
		);
		if ( $exists ) {
			return static::get( (int) $exists );
		}

		$result = $wpdb->insert(
			$wpdb->prefix . 'routinekit_executions',
			[
				'workflow_id'        => $workflow_id,
				'saas_assignment_id' => $saas_assignment_id,
				'status'             => 'pending',
			],
			[ '%d', '%s', '%s' ]
		);

		if ( false === $result ) {
			return new WP_Error( 'routinekit_db_error', __( 'Could not create execution from assignment.', 'routinekit' ) );
		}

		return static::get( (int) $wpdb->insert_id );
	}

	/**
	 * Hydrate from a DB row.
	 *
	 * @param object $row
	 * @return static
	 */
	public static function from_row( object $row ): Routinekit_Execution {
		$instance                     = new static();
		$instance->id                 = (int) $row->id;
		$instance->workflow_id        = (int) $row->workflow_id;
		$instance->saas_assignment_id = $row->saas_assignment_id;
		$instance->status             = $row->status;
		$instance->started_by         = $row->started_by ? (int) $row->started_by : null;
		$instance->started_at         = $row->started_at;
		$instance->completed_at       = $row->completed_at;
		$instance->paused_by          = isset( $row->paused_by ) && $row->paused_by ? (int) $row->paused_by : null;
		$instance->paused_at          = $row->paused_at ?? null;
		$instance->created_at         = $row->created_at;
		return $instance;
	}

	/**
	 * Serialize to array.
	 *
	 * @return array
	 */
	public function to_array(): array {
		return [
			'id'                 => $this->id,
			'workflow_id'        => $this->workflow_id,
			'saas_assignment_id' => $this->saas_assignment_id,
			'status'             => $this->status,
			'started_by'         => $this->started_by,
			'started_at'         => $this->started_at,
			'completed_at'       => $this->completed_at,
			'paused_by'          => $this->paused_by,
			'paused_at'          => $this->paused_at,
			'created_at'         => $this->created_at,
		];
	}
}
