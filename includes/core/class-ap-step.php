<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * Step CRUD model.
 *
 * Wraps all database operations for the stepwise_steps table.
 */
class Stepwise_Step {

	/** @var int */
	public int $id;

	/** @var int */
	public int $workflow_id;

	/** @var string */
	public string $title;

	/** @var string */
	public string $description;

	/** @var string|null */
	public ?string $deep_link;

	/** @var string static|dynamic */
	public string $deep_link_type;

	/** @var bool */
	public bool $is_required;

	/** @var bool */
	public bool $evidence_required;

	/** @var int */
	public int $sort_order;

	/** @var string|null JSON snapshot of captured wp_options */
	public ?string $captured_options;

	/** @var string */
	public string $created_at;

	/**
	 * Fetch a single step by ID.
	 *
	 * @param int $id
	 * @return static|null
	 */
	public static function get( int $id ): ?Stepwise_Step {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}stepwise_steps WHERE id = %d LIMIT 1",
				$id
			)
		);
		return $row ? static::from_row( $row ) : null;
	}

	/**
	 * Fetch all steps for a workflow, ordered by sort_order.
	 *
	 * @param int $workflow_id
	 * @return static[]
	 */
	public static function for_workflow( int $workflow_id ): array {
		global $wpdb;
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}stepwise_steps
				 WHERE workflow_id = %d
				 ORDER BY sort_order ASC, id ASC",
				$workflow_id
			)
		);
		return array_map( [ static::class, 'from_row' ], $rows ?: [] );
	}

	/**
	 * Batch-fetch steps for multiple workflows in a single query.
	 * Returns an array keyed by workflow_id, each value being an array of Stepwise_Step objects.
	 *
	 * @param int[] $workflow_ids
	 * @return array<int, static[]>
	 */
	public static function for_workflows( array $workflow_ids ): array {
		if ( empty( $workflow_ids ) ) {
			return [];
		}
		global $wpdb;
		$ids          = array_map( 'absint', $workflow_ids );
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$rows         = $wpdb->get_results( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}stepwise_steps WHERE workflow_id IN ($placeholders) ORDER BY sort_order ASC, id ASC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
				...$ids
			)
		);
		$grouped = [];
		foreach ( $rows ?: [] as $row ) {
			$grouped[ (int) $row->workflow_id ][] = static::from_row( $row );
		}
		return $grouped;
	}

	/**
	 * Create a new step.
	 *
	 * @param array $data
	 * @return static|WP_Error
	 */
	public static function create( array $data ) {
		global $wpdb;

		$workflow_id = absint( $data['workflow_id'] ?? 0 );
		if ( ! $workflow_id ) {
			return new WP_Error( 'stepwise_invalid', __( 'workflow_id is required.', 'stepwise' ) );
		}

		$title = sanitize_text_field( $data['title'] ?? '' );
		if ( empty( $title ) ) {
			return new WP_Error( 'stepwise_invalid', __( 'Step title is required.', 'stepwise' ) );
		}

		// Default sort_order to end of list
		if ( ! isset( $data['sort_order'] ) ) {
			$max = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT MAX(sort_order) FROM {$wpdb->prefix}stepwise_steps WHERE workflow_id = %d",
					$workflow_id
				)
			);
			$data['sort_order'] = $max + 10;
		}

		$insert = [
			'workflow_id'       => $workflow_id,
			'title'             => $title,
			'description'       => sanitize_textarea_field( $data['description'] ?? '' ),
			'deep_link'         => isset( $data['deep_link'] ) ? esc_url( $data['deep_link'] ) : null,
			'deep_link_type'    => in_array( $data['deep_link_type'] ?? '', [ 'static', 'dynamic' ], true )
				? $data['deep_link_type']
				: 'static',
			'is_required'       => isset( $data['is_required'] ) ? (int) (bool) $data['is_required'] : 1,
			'evidence_required' => isset( $data['evidence_required'] ) ? (int) (bool) $data['evidence_required'] : 0,
			'sort_order'        => absint( $data['sort_order'] ),
			'captured_options'  => isset( $data['captured_options'] )
				? wp_json_encode( $data['captured_options'] )
				: null,
		];

		$result = $wpdb->insert(
			$wpdb->prefix . 'stepwise_steps',
			$insert,
			[ '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%d', '%s' ]
		);

		if ( false === $result ) {
			stepwise_log( 'Step insert failed: ' . $wpdb->last_error, 'step' );
			return new WP_Error( 'stepwise_db_error', __( 'Could not create step.', 'stepwise' ) );
		}

		return static::get( (int) $wpdb->insert_id );
	}

	/**
	 * Update an existing step.
	 *
	 * @param int   $id
	 * @param array $data
	 * @return static|WP_Error
	 */
	public static function update( int $id, array $data ) {
		global $wpdb;

		$update  = [];
		$formats = [];

		if ( isset( $data['title'] ) ) {
			$update['title'] = sanitize_text_field( $data['title'] );
			$formats[]       = '%s';
		}
		if ( isset( $data['description'] ) ) {
			$update['description'] = sanitize_textarea_field( $data['description'] );
			$formats[]             = '%s';
		}
		if ( isset( $data['deep_link'] ) ) {
			$update['deep_link'] = esc_url( $data['deep_link'] );
			$formats[]           = '%s';
		}
		if ( isset( $data['deep_link_type'] ) && in_array( $data['deep_link_type'], [ 'static', 'dynamic' ], true ) ) {
			$update['deep_link_type'] = $data['deep_link_type'];
			$formats[]                = '%s';
		}
		if ( isset( $data['is_required'] ) ) {
			$update['is_required'] = (int) (bool) $data['is_required'];
			$formats[]             = '%d';
		}
		if ( isset( $data['evidence_required'] ) ) {
			$update['evidence_required'] = (int) (bool) $data['evidence_required'];
			$formats[]                   = '%d';
		}
		if ( isset( $data['sort_order'] ) ) {
			$update['sort_order'] = absint( $data['sort_order'] );
			$formats[]            = '%d';
		}

		if ( empty( $update ) ) {
			return static::get( $id ) ?? new WP_Error( 'stepwise_not_found', __( 'Step not found.', 'stepwise' ) );
		}

		$result = $wpdb->update(
			$wpdb->prefix . 'stepwise_steps',
			$update,
			[ 'id' => $id ],
			$formats,
			[ '%d' ]
		);

		if ( false === $result ) {
			return new WP_Error( 'stepwise_db_error', __( 'Could not update step.', 'stepwise' ) );
		}

		return static::get( $id );
	}

	/**
	 * Bulk-update sort_order for a set of steps.
	 * Expects [ ['id' => int, 'sort_order' => int], … ]
	 *
	 * @param array $order_map
	 * @return bool
	 */
	public static function reorder( array $order_map ): bool {
		global $wpdb;
		foreach ( $order_map as $item ) {
			$wpdb->update(
				$wpdb->prefix . 'stepwise_steps',
				[ 'sort_order' => absint( $item['sort_order'] ) ],
				[ 'id'         => absint( $item['id'] ) ],
				[ '%d' ],
				[ '%d' ]
			);
		}
		return true;
	}

	/**
	 * Delete a step by ID.
	 *
	 * @param int $id
	 * @return bool
	 */
	public static function delete( int $id ): bool {
		global $wpdb;
		return (bool) $wpdb->delete( $wpdb->prefix . 'stepwise_steps', [ 'id' => $id ], [ '%d' ] );
	}

	/**
	 * Hydrate an instance from a DB row object.
	 *
	 * @param object $row
	 * @return static
	 */
	public static function from_row( object $row ): Stepwise_Step {
		$instance                  = new static();
		$instance->id              = (int) $row->id;
		$instance->workflow_id     = (int) $row->workflow_id;
		$instance->title           = $row->title;
		$instance->description     = $row->description ?? '';
		$instance->deep_link       = $row->deep_link;
		$instance->deep_link_type  = $row->deep_link_type;
		$instance->is_required     = (bool) $row->is_required;
		$instance->evidence_required = (bool) $row->evidence_required;
		$instance->sort_order      = (int) $row->sort_order;
		$instance->captured_options = $row->captured_options;
		$instance->created_at      = $row->created_at;
		return $instance;
	}

	/**
	 * Serialize the step to an array.
	 *
	 * @return array
	 */
	public function to_array(): array {
		return [
			'id'                => $this->id,
			'workflow_id'       => $this->workflow_id,
			'title'             => $this->title,
			'description'       => $this->description,
			'deep_link'         => $this->deep_link,
			'deep_link_type'    => $this->deep_link_type,
			'is_required'       => $this->is_required,
			'evidence_required' => $this->evidence_required,
			'sort_order'        => $this->sort_order,
			'captured_options'  => $this->captured_options
				? json_decode( $this->captured_options, true )
				: null,
			'created_at'        => $this->created_at,
		];
	}
}
