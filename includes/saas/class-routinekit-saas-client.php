<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * HTTP client for all SaaS API communication.
 */
class Routinekit_SaaS_Client {

	/** @var string */
	private string $base_url;

	/** @var string Site API key received after connecting */
	private string $api_key;

	/** @var int Request timeout in seconds */
	private int $timeout = 15;

	public function __construct() {
		$this->base_url = rtrim( get_option( 'routinekit_saas_url', ROUTINEKIT_SAAS_DEFAULT_URL ), '/' );
		$this->api_key  = get_option( 'routinekit_site_api_key', '' );
	}

	/**
	 * Register this site with the SaaS using a license key.
	 * Returns ['api_key', 'site_id', 'team_name'] on success.
	 *
	 * @param string $license_key
	 * @return array|WP_Error
	 */
	public function connect_site( string $license_key ) {
		return $this->post_public( '/api/connect', [
			'license_key'    => $license_key,
			'site_url'       => get_site_url(),
			'site_name'      => get_bloginfo( 'name' ),
			'wp_version'     => get_bloginfo( 'version' ),
			'plugin_version' => ROUTINEKIT_VERSION,
		] );
	}

	/**
	 * Fetch pending workflow assignments from the SaaS.
	 *
	 * @return array|WP_Error
	 */
	public function get_assignments() {
		return $this->get( '/api/site/assignments' );
	}

	/**
	 * Mark an assignment as completed.
	 *
	 * @param int $assignment_id
	 * @return array|WP_Error
	 */
	public function complete_assignment( int $assignment_id ) {
		return $this->post( "/api/site/assignments/{$assignment_id}/complete", [] );
	}

	/**
	 * Get the groups this site belongs to.
	 * Returns ['groups' => [['id'=>1,'name'=>'Retail'],...]].
	 *
	 * @return array|WP_Error
	 */
	public function get_groups() {
		return $this->get( '/api/site/groups' );
	}

	/**
	 * Assign a workflow to a group — SaaS distributes to all other sites in the group.
	 *
	 * @param int   $group_id
	 * @param array $workflow_data  title, workflow_id, steps, version
	 * @return array|WP_Error
	 */
	public function assign_workflow_to_group( int $group_id, array $workflow_data ) {
		return $this->post( "/api/groups/{$group_id}/assign-workflow", $workflow_data );
	}

	/**
	 * Fetch workflow templates available for this site's plan.
	 *
	 * @return array|WP_Error
	 */
	public function get_templates() {
		return $this->get( '/api/templates' );
	}

	/**
	 * Proxy a remote workflow JSON URL through the SaaS (server-enforced Pro gate).
	 *
	 * @param string $url
	 * @return array|WP_Error
	 */
	public function import_url( string $url ) {
		return $this->post( '/api/import-url', [ 'url' => $url ] );
	}

	/**
	 * Deregister this site from the SaaS, freeing the license slot.
	 * Data (workflows, assignments, history) is preserved on the SaaS side for reconnect.
	 *
	 * @return array|WP_Error
	 */
	public function deregister_site() {
		return $this->delete( '/api/site' );
	}

	/**
	 * Send a heartbeat to update last_seen_at.
	 *
	 * @return array|WP_Error
	 */
	public function heartbeat() {
		return $this->post( '/api/site/heartbeat', [
			'wp_version'     => get_bloginfo( 'version' ),
			'plugin_version' => ROUTINEKIT_VERSION,
			'site_url'       => get_site_url(),
		] );
	}

	/**
	 * Verify the SaaS connection is alive.
	 *
	 * @return bool
	 */
	public function test_connection(): bool {
		$result = $this->heartbeat();
		return ! is_wp_error( $result );
	}

	// ── Step notes sync ───────────────────────────────────────────────────────

	/**
	 * Push a shared note to SaaS for fan-out to other sites in the group.
	 * SaaS returns ['saas_note_id' => '...'] which we store back on the local row.
	 *
	 * @param array $note_data
	 * @return array|WP_Error
	 */
	public function push_shared_note( array $note_data ) {
		$result = $this->post( '/api/step-notes', $note_data );
		if ( ! is_wp_error( $result ) && ! empty( $result['saas_note_id'] ) && ! empty( $note_data['local_note_id'] ) ) {
			global $wpdb;
			$wpdb->update(
				$wpdb->prefix . 'routinekit_step_notes',
				[ 'saas_note_id' => $result['saas_note_id'] ],
				[ 'id' => (int) $note_data['local_note_id'] ],
				[ '%s' ],
				[ '%d' ]
			);
		}
		return $result;
	}

	/**
	 * Notify SaaS to delete a shared note and fan-out the deletion.
	 *
	 * @param string $saas_note_id
	 * @return array|WP_Error
	 */
	public function delete_shared_note( string $saas_note_id ) {
		return $this->delete( "/api/step-notes/{$saas_note_id}" );
	}

	/**
	 * Update the screenshot URL on a shared note (called after upload or delete).
	 *
	 * @param string      $saas_note_id
	 * @param string|null $screenshot_url
	 * @return array|WP_Error
	 */
	public function update_shared_note_screenshot( string $saas_note_id, ?string $screenshot_url ) {
		return $this->patch( "/api/step-notes/{$saas_note_id}", [ 'screenshot_url' => $screenshot_url ] );
	}

	// ── Private HTTP helpers ──────────────────────────────────────────────────

	private function get( string $endpoint ) {
		$response = wp_remote_get( $this->base_url . $endpoint, [
			'headers' => $this->get_headers(),
			'timeout' => $this->timeout,
		] );
		return $this->handle_response( $response );
	}

	private function post( string $endpoint, array $body ) {
		$response = wp_remote_post( $this->base_url . $endpoint, [
			'headers' => $this->get_headers(),
			'body'    => wp_json_encode( $body ),
			'timeout' => $this->timeout,
		] );
		return $this->handle_response( $response );
	}

	private function delete( string $endpoint ) {
		$response = wp_remote_request( $this->base_url . $endpoint, [
			'method'  => 'DELETE',
			'headers' => $this->get_headers(),
			'timeout' => $this->timeout,
		] );
		return $this->handle_response( $response );
	}

	private function patch( string $endpoint, array $body ) {
		$response = wp_remote_request( $this->base_url . $endpoint, [
			'method'  => 'PATCH',
			'headers' => $this->get_headers(),
			'body'    => wp_json_encode( $body ),
			'timeout' => $this->timeout,
		] );
		return $this->handle_response( $response );
	}

	/** POST without auth header — used only for /api/connect */
	private function post_public( string $endpoint, array $body ) {
		$response = wp_remote_post( $this->base_url . $endpoint, [
			'headers' => [
				'Content-Type' => 'application/json',
				'Accept'       => 'application/json',
			],
			'body'    => wp_json_encode( $body ),
			'timeout' => $this->timeout,
		] );
		return $this->handle_response( $response );
	}

	private function get_headers() {
		return [
			'X-Stepwise-Key' => $this->api_key,
			'Content-Type'   => 'application/json',
			'Accept'         => 'application/json',
		];
	}

	private function handle_response( $response ) {
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		// 409 carries a structured body (e.g. url_mismatch) that callers need to inspect —
		// return it as a normal array so send_heartbeat() can read the status field.
		if ( $code >= 400 && 409 !== $code ) {
			$message = $body['error'] ?? $body['message'] ?? "SaaS error: HTTP {$code}";
			return new WP_Error( 'routinekit_saas_error', $message, [ 'status' => $code ] );
		}

		return $body ?? [];
	}
}
