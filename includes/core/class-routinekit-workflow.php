<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * Workflow CRUD model.
 *
 * Wraps all database operations for the routinekit_workflows table.
 */
class Routinekit_Workflow {

	/** @var int */
	public int $id;

	/** @var string */
	public string $title;

	/** @var string */
	public string $description;

	/** @var string draft|active|archived */
	public string $status;

	/** @var string local|saas|imported */
	public string $source;

	/** @var string|null */
	public ?string $saas_id;

	/** @var string|null */
	public ?string $template_key;

	/** @var int */
	public int $created_by;

	/** @var string */
	public string $created_at;

	/** @var string */
	public string $updated_at;

	/** @var string|null */
	public ?string $last_run_at;

	/** @var string|null */
	public ?string $pushed_at;
	public ?string $source_site_url;

	/** @var int[] */
	public array $pushed_group_ids = [];

	/** @var string|null */
	public ?string $category;

	/** @var int */
	public int $run_count = 0;

	/**
	 * Fetch a single workflow by ID.
	 *
	 * @param int $id
	 * @return static|null
	 */
	public static function get( int $id ): ?Routinekit_Workflow {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}routinekit_workflows WHERE id = %d LIMIT 1",
				$id
			)
		);
		if ( ! $row ) {
			return null;
		}
		return static::from_row( $row );
	}

	/**
	 * Fetch all workflows, optionally filtered by status.
	 *
	 * @param string|null $status
	 * @param int         $limit
	 * @param int         $offset
	 * @return static[]
	 */
	public static function all( ?string $status = null, int $limit = 100, int $offset = 0 ): array {
		global $wpdb;

		if ( $status ) {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT * FROM {$wpdb->prefix}routinekit_workflows
					 WHERE status = %s
					 ORDER BY updated_at DESC
					 LIMIT %d OFFSET %d",
					$status,
					$limit,
					$offset
				)
			);
		} else {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT * FROM {$wpdb->prefix}routinekit_workflows
					 ORDER BY updated_at DESC
					 LIMIT %d OFFSET %d",
					$limit,
					$offset
				)
			);
		}

		return array_map( [ static::class, 'from_row' ], $rows ?: [] );
	}

	/**
	 * Create a new workflow row.
	 *
	 * @param array $data
	 * @return static|WP_Error
	 */
	public static function create( array $data ) {
		global $wpdb;

		$insert = [
			'title'       => sanitize_text_field( $data['title'] ?? '' ),
			'description' => sanitize_textarea_field( $data['description'] ?? '' ),
			'status'      => in_array( $data['status'] ?? '', [ 'draft', 'active', 'archived' ], true )
				? $data['status']
				: 'draft',
			'source'      => in_array( $data['source'] ?? '', [ 'local', 'saas', 'imported' ], true )
				? $data['source']
				: 'local',
			'saas_id'     => isset( $data['saas_id'] ) ? sanitize_text_field( $data['saas_id'] ) : null,
			'template_key'=> isset( $data['template_key'] ) ? sanitize_text_field( $data['template_key'] ) : null,
			'category'    => isset( $data['category'] ) ? sanitize_text_field( $data['category'] ) : null,
			'created_by'  => absint( $data['created_by'] ?? get_current_user_id() ),
		];

		if ( empty( $insert['title'] ) ) {
			return new WP_Error( 'routinekit_invalid', __( 'Workflow title is required.', 'routinekit' ) );
		}

		$result = $wpdb->insert(
			$wpdb->prefix . 'routinekit_workflows',
			$insert,
			[ '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%d' ]
		);

		if ( false === $result ) {
			routinekit_log( 'Workflow insert failed: ' . $wpdb->last_error, 'workflow' );
			return new WP_Error( 'routinekit_db_error', __( 'Could not create workflow.', 'routinekit' ) );
		}

		return static::get( (int) $wpdb->insert_id );
	}

	/**
	 * Update an existing workflow.
	 *
	 * @param int   $id
	 * @param array $data
	 * @return static|WP_Error
	 */
	public static function update( int $id, array $data ) {
		global $wpdb;

		$allowed_fields = [ 'title', 'description', 'status', 'saas_id', 'last_run_at', 'pushed_at', 'pushed_group_ids', 'category' ];
		$update         = [];
		$formats        = [];

		if ( isset( $data['title'] ) ) {
			$update['title'] = sanitize_text_field( $data['title'] );
			$formats[]       = '%s';
		}
		if ( isset( $data['description'] ) ) {
			$update['description'] = sanitize_textarea_field( $data['description'] );
			$formats[]             = '%s';
		}
		if ( isset( $data['status'] ) && in_array( $data['status'], [ 'draft', 'active', 'archived' ], true ) ) {
			$update['status'] = $data['status'];
			$formats[]        = '%s';
		}
		if ( isset( $data['last_run_at'] ) ) {
			$update['last_run_at'] = $data['last_run_at'];
			$formats[]             = '%s';
		}
		if ( isset( $data['pushed_at'] ) ) {
			$update['pushed_at'] = $data['pushed_at'];
			$formats[]           = '%s';
		}
		if ( isset( $data['pushed_group_ids'] ) ) {
			$update['pushed_group_ids'] = $data['pushed_group_ids'];
			$formats[]                  = '%s';
		}
		if ( array_key_exists( 'category', $data ) ) {
			$update['category'] = $data['category'] ? sanitize_text_field( $data['category'] ) : null;
			$formats[]          = '%s';
		}

		if ( empty( $update ) ) {
			return static::get( $id ) ?? new WP_Error( 'routinekit_not_found', __( 'Workflow not found.', 'routinekit' ) );
		}

		$result = $wpdb->update(
			$wpdb->prefix . 'routinekit_workflows',
			$update,
			[ 'id' => $id ],
			$formats,
			[ '%d' ]
		);

		if ( false === $result ) {
			return new WP_Error( 'routinekit_db_error', __( 'Could not update workflow.', 'routinekit' ) );
		}

		do_action( 'routinekit_workflow_saved', $id );

		return static::get( $id );
	}

	/**
	 * Delete a workflow and its steps.
	 *
	 * @param int $id
	 * @return bool
	 */
	public static function delete( int $id ): bool {
		global $wpdb;

		$execution_ids = $wpdb->get_col( $wpdb->prepare(
			"SELECT id FROM {$wpdb->prefix}routinekit_executions WHERE workflow_id = %d",
			$id
		) );

		if ( $execution_ids ) {
			$placeholders = implode( ',', array_fill( 0, count( $execution_ids ), '%d' ) );
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}routinekit_step_completions WHERE execution_id IN ($placeholders)", $execution_ids ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		}

		$wpdb->delete( $wpdb->prefix . 'routinekit_executions',  [ 'workflow_id' => $id ], [ '%d' ] );
		$wpdb->delete( $wpdb->prefix . 'routinekit_step_notes', [ 'workflow_id' => $id ], [ '%d' ] );
		$wpdb->delete( $wpdb->prefix . 'routinekit_steps',      [ 'workflow_id' => $id ], [ '%d' ] );
		$deleted = $wpdb->delete( $wpdb->prefix . 'routinekit_workflows', [ 'id' => $id ], [ '%d' ] );

		return (bool) $deleted;
	}

	/**
	 * Count all workflows, optionally by status.
	 *
	 * @param string|null $status
	 * @return int
	 */
	public static function count( ?string $status = null ): int {
		global $wpdb;
		if ( $status ) {
			return (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM {$wpdb->prefix}routinekit_workflows WHERE status = %s",
					$status
				)
			);
		}
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}routinekit_workflows" );
	}

	/**
	 * Hydrate an instance from a DB row object.
	 *
	 * @param object $row
	 * @return static
	 */
	public static function from_row( object $row ): Routinekit_Workflow {
		$instance               = new static();
		$instance->id           = (int) $row->id;
		$instance->title        = $row->title;
		$instance->description  = $row->description ?? '';
		$instance->status       = $row->status;
		$instance->source       = $row->source;
		$instance->saas_id      = $row->saas_id;
		$instance->template_key = $row->template_key;
		$instance->created_by   = (int) $row->created_by;
		$instance->created_at   = $row->created_at;
		$instance->updated_at   = $row->updated_at;
		$instance->last_run_at  = $row->last_run_at ?? null;
		$instance->pushed_at        = $row->pushed_at ?? null;
		$instance->pushed_group_ids = ! empty( $row->pushed_group_ids )
			? array_map( 'intval', json_decode( $row->pushed_group_ids, true ) ?? [] )
			: [];
		$instance->category         = $row->category ?? null;
		$instance->run_count        = (int) ( $row->run_count ?? 0 );
		$instance->source_site_url  = $row->source_site_url ?? null;
		return $instance;
	}

	/**
	 * Serialize the workflow to an array (for REST responses and SaaS sync).
	 *
	 * @param Routinekit_Step[]|null $preloaded_steps Pass pre-fetched steps to avoid an extra query per workflow.
	 *                                         null triggers a single per-workflow fetch (fine for single-item responses).
	 * @return array
	 */
	public function to_array( ?array $preloaded_steps = null ): array {
		$steps = $preloaded_steps ?? Routinekit_Step::for_workflow( $this->id );
		return [
			'id'           => $this->id,
			'title'        => $this->title,
			'description'  => $this->description,
			'status'       => $this->status,
			'source'       => $this->source,
			'saas_id'      => $this->saas_id,
			'template_key' => $this->template_key,
			'category'     => $this->category,
			'run_count'    => $this->run_count,
			'created_by'   => $this->created_by,
			'created_at'   => $this->created_at,
			'updated_at'   => $this->updated_at,
			'last_run_at'       => $this->last_run_at,
			'pushed_at'         => $this->pushed_at,
			'pushed_group_ids'  => $this->pushed_group_ids,
			'source_site_url'   => $this->source_site_url,
			'steps'             => array_map( fn( $s ) => $s->to_array(), $steps ),
		];
	}
}
