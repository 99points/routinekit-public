<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables
defined( 'ABSPATH' ) || exit;

/**
 * REST endpoints for threaded step notes.
 *
 * GET    /alignpress/v1/steps/:step_id/notes
 * POST   /alignpress/v1/steps/:step_id/notes
 * DELETE /alignpress/v1/steps/:step_id/notes/:note_id
 * POST   /alignpress/v1/steps/:step_id/notes/:note_id/screenshot
 * DELETE /alignpress/v1/steps/:step_id/notes/:note_id/screenshot
 * POST   /alignpress/v1/sync/notes   — SaaS calls this to push shared notes in
 */
class AP_REST_Step_Notes {

	protected string $namespace = ALIGNPRESS_REST_NAMESPACE;

	public function register_routes(): void {

		// List + create notes for a step
		register_rest_route( $this->namespace, '/steps/(?P<step_id>[\d]+)/notes', [
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_notes' ],
				'permission_callback' => [ $this, 'run_permission' ],
				'args'                => [
					'step_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
				],
			],
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'create_note' ],
				'permission_callback' => [ $this, 'run_permission' ],
				'args'                => [
					'step_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					'body'    => [
						'required'          => false,
						'type'              => 'string',
						'default'           => '',
						'sanitize_callback' => 'sanitize_textarea_field',
					],
					'shared'  => [
						'type'    => 'boolean',
						'default' => false,
					],
				],
			],
		] );

		// Delete a note
		register_rest_route( $this->namespace, '/steps/(?P<step_id>[\d]+)/notes/(?P<note_id>[\d]+)', [
			[
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'delete_note' ],
				'permission_callback' => [ $this, 'run_permission' ],
				'args'                => [
					'step_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					'note_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
				],
			],
		] );

		// Upload screenshot to a note
		register_rest_route( $this->namespace, '/steps/(?P<step_id>[\d]+)/notes/(?P<note_id>[\d]+)/screenshot', [
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'upload_screenshot' ],
				'permission_callback' => [ $this, 'run_permission' ],
				'args'                => [
					'step_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					'note_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
				],
			],
			[
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'delete_screenshot' ],
				'permission_callback' => [ $this, 'run_permission' ],
				'args'                => [
					'step_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
					'note_id' => [ 'type' => 'integer', 'sanitize_callback' => 'absint' ],
				],
			],
		] );

		// SaaS → plugin inbound sync (shared notes from other sites)
		register_rest_route( $this->namespace, '/sync/notes', [
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'sync_inbound' ],
				'permission_callback' => [ $this, 'sync_permission' ],
			],
		] );

		// SaaS → plugin delete a sideloaded note
		register_rest_route( $this->namespace, '/sync/notes/(?P<saas_note_id>[a-zA-Z0-9\-_]+)', [
			[
				'methods'             => WP_REST_Server::DELETABLE,
				'callback'            => [ $this, 'sync_delete' ],
				'permission_callback' => [ $this, 'sync_permission' ],
			],
		] );
	}

	// ── GET /steps/:step_id/notes ─────────────────────────────────────────────

	public function get_notes( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$step_id = (int) $request['step_id'];
		$rows    = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}alignpress_step_notes
				 WHERE step_id = %d
				 ORDER BY created_at ASC",
				$step_id
			),
			ARRAY_A
		);

		return rest_ensure_response( array_map( [ $this, 'prepare_note' ], $rows ) );
	}

	// ── POST /steps/:step_id/notes ────────────────────────────────────────────

	public function create_note( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$step_id  = (int) $request['step_id'];
		$body     = (string) $request->get_param( 'body' );
		$shared   = (bool) $request->get_param( 'shared' );
		$user     = wp_get_current_user();

		// Gate sharing at Pro+
		if ( $shared && ! $this->user_can_share() ) {
			return new WP_Error(
				'alignpress_plan_required',
				__( 'Sharing notes to other sites requires a Pro plan.', 'alignpress' ),
				[ 'status' => 403 ]
			);
		}

		$step = AP_Step::get( $step_id );
		if ( ! $step ) {
			return new WP_Error( 'alignpress_not_found', __( 'Step not found.', 'alignpress' ), [ 'status' => 404 ] );
		}

		$wpdb->insert(
			$wpdb->prefix . 'alignpress_step_notes',
			[
				'workflow_id'       => $step->workflow_id,
				'step_id'           => $step_id,
				'user_id'           => $user->ID,
				'user_display_name' => $user->display_name,
				'body'              => $body,
				'shared'            => $shared ? 1 : 0,
				'is_sideloaded'     => 0,
				'source_site_label' => get_bloginfo( 'name' ),
				'source_site_url'   => get_site_url(),
			],
			[ '%d', '%d', '%d', '%s', '%s', '%d', '%d', '%s', '%s' ]
		);

		$note_id = (int) $wpdb->insert_id;
		$note    = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}alignpress_step_notes WHERE id = %d", $note_id ),
			ARRAY_A
		);

		// Push shared note to SaaS for fan-out to other sites
		if ( $shared && AP_SaaS_Auth::is_connected() ) {
			$this->push_note_to_saas( $note );
		}

		$response = rest_ensure_response( $this->prepare_note( $note ) );
		$response->set_status( 201 );
		return $response;
	}

	// ── DELETE /steps/:step_id/notes/:note_id ────────────────────────────────

	public function delete_note( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$note_id = (int) $request['note_id'];
		$note    = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}alignpress_step_notes WHERE id = %d", $note_id ),
			ARRAY_A
		);

		if ( ! $note ) {
			return new WP_Error( 'alignpress_not_found', __( 'Note not found.', 'alignpress' ), [ 'status' => 404 ] );
		}

		// Only the author (or admin) can delete; sideloaded notes are read-only
		if ( (int) $note['user_id'] !== get_current_user_id() && ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'alignpress_forbidden', __( 'You cannot delete this note.', 'alignpress' ), [ 'status' => 403 ] );
		}
		if ( (int) $note['is_sideloaded'] ) {
			return new WP_Error( 'alignpress_forbidden', __( 'Sideloaded notes can only be deleted by the originating site.', 'alignpress' ), [ 'status' => 403 ] );
		}

		// Delete screenshot attachment from media library
		if ( ! empty( $note['screenshot_attachment_id'] ) ) {
			wp_delete_attachment( (int) $note['screenshot_attachment_id'], true );
		}

		// Notify SaaS to remove from other sites
		if ( ! empty( $note['saas_note_id'] ) && AP_SaaS_Auth::is_connected() ) {
			( new AP_SaaS_Client() )->delete_shared_note( $note['saas_note_id'] );
		}

		$wpdb->delete( $wpdb->prefix . 'alignpress_step_notes', [ 'id' => $note_id ], [ '%d' ] );

		return rest_ensure_response( [ 'deleted' => true ] );
	}

	// ── POST /steps/:step_id/notes/:note_id/screenshot ───────────────────────

	public function upload_screenshot( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$note_id = (int) $request['note_id'];
		$note    = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}alignpress_step_notes WHERE id = %d", $note_id ),
			ARRAY_A
		);

		if ( ! $note ) {
			return new WP_Error( 'alignpress_not_found', __( 'Note not found.', 'alignpress' ), [ 'status' => 404 ] );
		}
		if ( (int) $note['user_id'] !== get_current_user_id() && ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'alignpress_forbidden', __( 'You cannot modify this note.', 'alignpress' ), [ 'status' => 403 ] );
		}
		if ( (int) $note['is_sideloaded'] ) {
			return new WP_Error( 'alignpress_forbidden', __( 'Cannot upload to a sideloaded note.', 'alignpress' ), [ 'status' => 403 ] );
		}

		$files = $request->get_file_params();
		if ( empty( $files['screenshot'] ) ) {
			return new WP_Error( 'alignpress_missing_file', __( 'Send file as multipart with key "screenshot".', 'alignpress' ), [ 'status' => 400 ] );
		}

		if ( ! function_exists( 'media_handle_upload' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/image.php';
			require_once ABSPATH . 'wp-admin/includes/media.php';
		}

		$allowed = [ 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ];
		$check   = wp_check_filetype_and_ext( $files['screenshot']['tmp_name'], $files['screenshot']['name'] );
		if ( ! $check['type'] || ! in_array( $check['type'], $allowed, true ) ) {
			return new WP_Error( 'alignpress_invalid_file', __( 'Screenshots must be JPEG, PNG, GIF, or WebP.', 'alignpress' ), [ 'status' => 415 ] );
		}
		if ( $files['screenshot']['size'] > 10 * MB_IN_BYTES ) {
			return new WP_Error( 'alignpress_file_too_large', __( 'Screenshot must be 10 MB or smaller.', 'alignpress' ), [ 'status' => 413 ] );
		}

		// Delete previous screenshot if one exists (1 per note limit)
		if ( ! empty( $note['screenshot_attachment_id'] ) ) {
			wp_delete_attachment( (int) $note['screenshot_attachment_id'], true );
		}

		$_FILES['screenshot'] = $files['screenshot'];
		$attachment_id        = media_handle_upload( 'screenshot', 0 );
		if ( is_wp_error( $attachment_id ) ) {
			return new WP_Error( 'alignpress_upload_failed', $attachment_id->get_error_message(), [ 'status' => 500 ] );
		}

		$screenshot_url = wp_get_attachment_url( $attachment_id );

		$wpdb->update(
			$wpdb->prefix . 'alignpress_step_notes',
			[
				'screenshot_url'          => $screenshot_url,
				'screenshot_attachment_id' => $attachment_id,
			],
			[ 'id' => $note_id ],
			[ '%s', '%d' ],
			[ '%d' ]
		);

		// Sync updated screenshot URL to SaaS if note is shared
		if ( ! empty( $note['saas_note_id'] ) && AP_SaaS_Auth::is_connected() ) {
			( new AP_SaaS_Client() )->update_shared_note_screenshot( $note['saas_note_id'], $screenshot_url );
		}

		return rest_ensure_response( [
			'attachment_id'  => $attachment_id,
			'screenshot_url' => $screenshot_url,
		] );
	}

	// ── DELETE /steps/:step_id/notes/:note_id/screenshot ─────────────────────

	public function delete_screenshot( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$note_id = (int) $request['note_id'];
		$note    = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}alignpress_step_notes WHERE id = %d", $note_id ),
			ARRAY_A
		);

		if ( ! $note ) {
			return new WP_Error( 'alignpress_not_found', __( 'Note not found.', 'alignpress' ), [ 'status' => 404 ] );
		}
		if ( (int) $note['user_id'] !== get_current_user_id() && ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'alignpress_forbidden', __( 'You cannot modify this note.', 'alignpress' ), [ 'status' => 403 ] );
		}

		if ( ! empty( $note['screenshot_attachment_id'] ) ) {
			wp_delete_attachment( (int) $note['screenshot_attachment_id'], true );
		}

		$wpdb->update(
			$wpdb->prefix . 'alignpress_step_notes',
			[ 'screenshot_url' => null, 'screenshot_attachment_id' => null ],
			[ 'id' => $note_id ],
			[ '%s', '%s' ],
			[ '%d' ]
		);

		// Notify SaaS to clear screenshot on other sites
		if ( ! empty( $note['saas_note_id'] ) && AP_SaaS_Auth::is_connected() ) {
			( new AP_SaaS_Client() )->update_shared_note_screenshot( $note['saas_note_id'], null );
		}

		return rest_ensure_response( [ 'deleted' => true ] );
	}

	// ── POST /sync/notes — SaaS pushes shared note in ────────────────────────

	public function sync_inbound( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$params       = $request->get_json_params();
		$saas_note_id   = sanitize_text_field( $params['saas_note_id'] ?? '' );
		$step_id        = absint( $params['step_id'] ?? 0 );
		$workflow_id    = absint( $params['workflow_id'] ?? 0 );
		$body           = sanitize_textarea_field( $params['body'] ?? '' );
		$author         = sanitize_text_field( $params['user_display_name'] ?? '' );
		$site_label     = sanitize_text_field( $params['source_site_label'] ?? '' );
		$site_url       = isset( $params['source_site_url'] ) ? esc_url_raw( $params['source_site_url'] ) : null;
		$screenshot_url = isset( $params['screenshot_url'] ) ? esc_url_raw( $params['screenshot_url'] ) : null;

		// A note must have at minimum a body OR a screenshot
		if ( ! $saas_note_id || ! $step_id || ( '' === $body && ! $screenshot_url ) ) {
			return new WP_Error( 'alignpress_invalid', __( 'Missing required fields.', 'alignpress' ), [ 'status' => 400 ] );
		}

		// Reject private/loopback screenshot URLs to prevent SSRF via sideload_image().
		if ( $screenshot_url && ! $this->is_public_url( $screenshot_url ) ) {
			$screenshot_url = null;
		}

		// Dedup: update if already exists, insert if new
		$existing = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}alignpress_step_notes WHERE saas_note_id = %s",
				$saas_note_id
			),
			ARRAY_A
		);

		if ( $existing ) {
			// Update body and screenshot URL (e.g. screenshot was added/removed after initial sync)
			$update_data   = [ 'body' => $body, 'screenshot_url' => $screenshot_url ];
			$update_format = [ '%s', '%s' ];

			// Sideload new screenshot if URL changed
			if ( $screenshot_url && $screenshot_url !== $existing['screenshot_url'] ) {
				$attachment_id = $this->sideload_image( $screenshot_url );
				if ( $attachment_id && ! is_wp_error( $attachment_id ) ) {
					// Delete old sideloaded attachment
					if ( ! empty( $existing['screenshot_attachment_id'] ) ) {
						wp_delete_attachment( (int) $existing['screenshot_attachment_id'], true );
					}
					$update_data['screenshot_url']           = wp_get_attachment_url( $attachment_id );
					$update_data['screenshot_attachment_id'] = $attachment_id;
					$update_format[]                         = '%d';
				}
			} elseif ( ! $screenshot_url && ! empty( $existing['screenshot_attachment_id'] ) ) {
				// Screenshot removed on source site
				wp_delete_attachment( (int) $existing['screenshot_attachment_id'], true );
				$update_data['screenshot_attachment_id'] = null;
				$update_format[]                         = '%s';
			}

			$wpdb->update(
				$wpdb->prefix . 'alignpress_step_notes',
				$update_data,
				[ 'id' => (int) $existing['id'] ],
				$update_format,
				[ '%d' ]
			);

			return rest_ensure_response( [ 'synced' => true, 'id' => (int) $existing['id'] ] );
		}

		// Insert new sideloaded note
		$local_screenshot_url    = null;
		$local_attachment_id     = null;
		if ( $screenshot_url ) {
			$attachment_id = $this->sideload_image( $screenshot_url );
			if ( $attachment_id && ! is_wp_error( $attachment_id ) ) {
				$local_screenshot_url = wp_get_attachment_url( $attachment_id );
				$local_attachment_id  = $attachment_id;
			} else {
				// Sideload failed — fall back to original URL so note still shows image
				$local_screenshot_url = $screenshot_url;
			}
		}

		$wpdb->insert(
			$wpdb->prefix . 'alignpress_step_notes',
			[
				'saas_note_id'            => $saas_note_id,
				'workflow_id'             => $workflow_id,
				'step_id'                 => $step_id,
				'user_id'                 => null,
				'user_display_name'       => $author,
				'body'                    => $body,
				'shared'                  => 1,
				'screenshot_url'          => $local_screenshot_url,
				'screenshot_attachment_id' => $local_attachment_id,
				'is_sideloaded'           => 1,
				'source_site_label'       => $site_label,
				'source_site_url'         => $site_url,
			],
			[ '%s', '%d', '%d', '%s', '%s', '%s', '%d', '%s', '%d', '%d', '%s', '%s' ]
		);

		return rest_ensure_response( [ 'synced' => true, 'id' => (int) $wpdb->insert_id ] );
	}

	// ── DELETE /sync/notes/:saas_note_id — SaaS removes a sideloaded note ───

	public function sync_delete( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		global $wpdb;

		$saas_note_id = sanitize_text_field( $request['saas_note_id'] );
		$note         = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}alignpress_step_notes WHERE saas_note_id = %s AND is_sideloaded = 1",
				$saas_note_id
			),
			ARRAY_A
		);

		if ( ! $note ) {
			return rest_ensure_response( [ 'deleted' => false, 'reason' => 'not_found' ] );
		}

		if ( ! empty( $note['screenshot_attachment_id'] ) ) {
			wp_delete_attachment( (int) $note['screenshot_attachment_id'], true );
		}

		$wpdb->delete( $wpdb->prefix . 'alignpress_step_notes', [ 'id' => (int) $note['id'] ], [ '%d' ] );

		return rest_ensure_response( [ 'deleted' => true ] );
	}

	// ── Attachment deleted hook ───────────────────────────────────────────────

	/**
	 * Fires when any WP media attachment is deleted.
	 * If it belonged to a note screenshot, null the URL so other sites get a
	 * clean "screenshot removed" state rather than a broken image.
	 *
	 * @param int $attachment_id
	 */
	public function on_attachment_deleted( int $attachment_id ): void {
		global $wpdb;

		$note = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}alignpress_step_notes WHERE screenshot_attachment_id = %d LIMIT 1",
				$attachment_id
			),
			ARRAY_A
		);

		if ( ! $note ) {
			return;
		}

		$wpdb->update(
			$wpdb->prefix . 'alignpress_step_notes',
			[ 'screenshot_url' => null, 'screenshot_attachment_id' => null ],
			[ 'id' => (int) $note['id'] ],
			[ '%s', '%s' ],
			[ '%d' ]
		);

		// Notify SaaS to clear screenshot on other sites
		if ( ! empty( $note['saas_note_id'] ) && AP_SaaS_Auth::is_connected() ) {
			( new AP_SaaS_Client() )->update_shared_note_screenshot( $note['saas_note_id'], null );
		}
	}

	// ── Permission callbacks ──────────────────────────────────────────────────

	public function run_permission(): bool|WP_Error {
		if ( alignpress_current_user_can_run() ) {
			return true;
		}
		return new WP_Error( 'alignpress_forbidden', __( 'You do not have permission.', 'alignpress' ), [ 'status' => 403 ] );
	}

	public function sync_permission(): bool|WP_Error {
		// SaaS calls this with the site's API key in the header
		$api_key = get_option( 'alignpress_site_api_key', '' );
		$header  = isset( $_SERVER['HTTP_X_ALIGNPRESS_KEY'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_ALIGNPRESS_KEY'] ) ) : '';
		if ( $api_key && hash_equals( $api_key, $header ) ) {
			return true;
		}
		return new WP_Error( 'alignpress_forbidden', __( 'Invalid sync key.', 'alignpress' ), [ 'status' => 403 ] );
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private function prepare_note( array $row ): array {
		return [
			'id'                => (int) $row['id'],
			'saas_note_id'      => $row['saas_note_id'],
			'step_id'           => (int) $row['step_id'],
			'user_id'           => $row['user_id'] ? (int) $row['user_id'] : null,
			'user_display_name' => $row['user_display_name'],
			'body'              => $row['body'],
			'shared'            => (bool) $row['shared'],
			'screenshot_url'    => $row['screenshot_url'],
			'is_sideloaded'     => (bool) $row['is_sideloaded'],
			'source_site_label' => $row['source_site_label'],
			'source_site_url'   => $row['source_site_url'] ?? null,
			'is_mine'           => ! (bool) $row['is_sideloaded'] && (int) $row['user_id'] === get_current_user_id(),
			'created_at'        => $row['created_at'],
		];
	}

	private function push_note_to_saas( array $note ): void {
		( new AP_SaaS_Client() )->push_shared_note( [
			'local_note_id'     => $note['id'],
			'workflow_id'       => $note['workflow_id'],
			'step_id'           => $note['step_id'],
			'body'              => $note['body'],
			'user_display_name' => $note['user_display_name'],
			'source_site_label' => $note['source_site_label'],
			'source_site_url'   => $note['source_site_url'] ?? get_site_url(),
			'screenshot_url'    => $note['screenshot_url'],
		] );
	}

	/**
	 * Sideload an image URL into the WP media library.
	 * Returns attachment ID or WP_Error.
	 *
	 * @param string $url
	 * @return int|WP_Error
	 */
	private function sideload_image( string $url ) {
		if ( ! function_exists( 'media_sideload_image' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/image.php';
			require_once ABSPATH . 'wp-admin/includes/media.php';
		}
		return media_sideload_image( $url, 0, null, 'id' );
	}

	private function user_can_share(): bool {
		return alignpress_is_pro();
	}

	/**
	 * Returns false for loopback, private RFC-1918, and link-local addresses.
	 * Guards sideload_image() against SSRF when screenshot URLs come from peer sites.
	 */
	private function is_public_url( string $url ): bool {
		$host = parse_url( $url, PHP_URL_HOST );
		if ( ! $host ) {
			return false;
		}

		$host = trim( $host, '[]' );

		$ip = filter_var( $host, FILTER_VALIDATE_IP );
		if ( false !== $ip ) {
			return (bool) filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE );
		}

		$blocked = [ 'localhost', 'ip6-localhost', 'ip6-loopback' ];
		return ! in_array( strtolower( $host ), $blocked, true );
	}
}
