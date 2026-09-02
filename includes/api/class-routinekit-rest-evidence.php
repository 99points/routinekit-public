<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * REST endpoint for evidence file uploads.
 * POST /routinekit/v1/executions/:execution_id/steps/:step_id/evidence
 *
 * Accepts a multipart file upload, saves it to the WP media library,
 * and stores the attachment URL on the step_completion row.
 */
class Routinekit_REST_Evidence {

	/** @var string */
	protected string $namespace = ROUTINEKIT_REST_NAMESPACE;

	/**
	 * Register REST routes.
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/executions/(?P<execution_id>[\d]+)/steps/(?P<step_id>[\d]+)/evidence',
			[
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'upload_evidence' ],
					'permission_callback' => [ $this, 'permissions_check' ],
					'args'                => [
						'execution_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
						'step_id'      => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					],
				],
				[
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => [ $this, 'delete_evidence' ],
					'permission_callback' => [ $this, 'permissions_check' ],
					'args'                => [
						'execution_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
						'step_id'      => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					],
				],
			]
		);
	}

	/**
	 * POST — upload an evidence file and attach to the step completion.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function upload_evidence( WP_REST_Request $request ) {
		$execution_id = (int) $request['execution_id'];
		$step_id      = (int) $request['step_id'];

		$completion = $this->get_completion( $execution_id, $step_id );
		if ( ! $completion ) {
			return new WP_Error(
				'routinekit_not_found',
				__( 'Step completion not found.', 'routinekit' ),
				[ 'status' => 404 ]
			);
		}

		$files = $request->get_file_params();
		if ( empty( $files['evidence'] ) ) {
			return new WP_Error(
				'routinekit_missing_file',
				__( 'No file uploaded. Send the file as multipart/form-data with key "evidence".', 'routinekit' ),
				[ 'status' => 400 ]
			);
		}

		if ( ! function_exists( 'wp_handle_upload' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		if ( ! function_exists( 'wp_generate_attachment_metadata' ) ) {
			require_once ABSPATH . 'wp-admin/includes/image.php';
		}
		if ( ! function_exists( 'media_handle_upload' ) ) {
			require_once ABSPATH . 'wp-admin/includes/media.php';
		}

		// Validate MIME type against actual file content, not the browser-supplied type.
		$allowed_types = [ 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf' ];
		$check         = wp_check_filetype_and_ext(
			$files['evidence']['tmp_name'],
			$files['evidence']['name']
		);
		if ( ! $check['type'] || ! in_array( $check['type'], $allowed_types, true ) ) {
			return new WP_Error(
				'routinekit_invalid_file',
				__( 'Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, PDF.', 'routinekit' ),
				[ 'status' => 415 ]
			);
		}

		// Size limit: 10 MB.
		if ( $files['evidence']['size'] > 10 * MB_IN_BYTES ) {
			return new WP_Error(
				'routinekit_file_too_large',
				__( 'Evidence file must be 10 MB or smaller.', 'routinekit' ),
				[ 'status' => 413 ]
			);
		}

		$_FILES['evidence'] = $files['evidence'];
		$attachment_id      = media_handle_upload( 'evidence', 0 );

		if ( is_wp_error( $attachment_id ) ) {
			return new WP_Error(
				'routinekit_upload_failed',
				$attachment_id->get_error_message(),
				[ 'status' => 500 ]
			);
		}

		$evidence_url = wp_get_attachment_url( $attachment_id );
		$this->update_completion_evidence( $completion->id, $evidence_url );

		return rest_ensure_response( [
			'attachment_id' => $attachment_id,
			'evidence_url'  => $evidence_url,
		] );
	}

	/**
	 * DELETE — remove evidence from a step completion.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_evidence( WP_REST_Request $request ) {
		$execution_id = (int) $request['execution_id'];
		$step_id      = (int) $request['step_id'];

		$completion = $this->get_completion( $execution_id, $step_id );
		if ( ! $completion ) {
			return new WP_Error(
				'routinekit_not_found',
				__( 'Step completion not found.', 'routinekit' ),
				[ 'status' => 404 ]
			);
		}

		$this->update_completion_evidence( $completion->id, null );
		return rest_ensure_response( [ 'deleted' => true ] );
	}

	/**
	 * @param WP_REST_Request $request
	 * @return bool|WP_Error
	 */
	public function permissions_check( WP_REST_Request $request ) {
		if ( routinekit_current_user_can_run() ) {
			return true;
		}
		return new WP_Error(
			'routinekit_forbidden',
			__( 'You do not have permission to upload evidence.', 'routinekit' ),
			[ 'status' => 403 ]
		);
	}

	/**
	 * Fetch a step_completion row by execution and step.
	 *
	 * @param int $execution_id
	 * @param int $step_id
	 * @return object|null
	 */
	private function get_completion( int $execution_id, int $step_id ): ?object {
		global $wpdb;

		// Admins can manage any execution; other runners are scoped to their own.
		if ( current_user_can( 'manage_options' ) ) {
			return $wpdb->get_row(
				$wpdb->prepare(
					"SELECT * FROM {$wpdb->prefix}routinekit_step_completions
					 WHERE execution_id = %d AND step_id = %d
					 LIMIT 1",
					$execution_id,
					$step_id
				)
			);
		}

		return $wpdb->get_row(
			$wpdb->prepare(
				"SELECT sc.* FROM {$wpdb->prefix}routinekit_step_completions sc
				 INNER JOIN {$wpdb->prefix}routinekit_executions e ON e.id = sc.execution_id
				 WHERE sc.execution_id = %d AND sc.step_id = %d AND e.started_by = %d
				 LIMIT 1",
				$execution_id,
				$step_id,
				get_current_user_id()
			)
		);
	}

	/**
	 * Write evidence_url back to the step_completion row.
	 *
	 * @param int         $completion_id
	 * @param string|null $url
	 */
	private function update_completion_evidence( int $completion_id, ?string $url ): void {
		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'routinekit_step_completions',
			[ 'evidence_url' => $url ],
			[ 'id' => $completion_id ],
			[ '%s' ],
			[ '%d' ]
		);
	}
}
