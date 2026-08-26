<?php
defined( 'ABSPATH' ) || exit;

/**
 * SaaS authentication — license key activation and site connection.
 */
class AP_SaaS_Auth {

	/**
	 * Connect this site to the SaaS using a license key.
	 * Stores api_key, site_id, and team_name in wp_options on success.
	 *
	 * @param string $license_key
	 * @return array|WP_Error
	 */
	public static function connect( string $license_key ): array|WP_Error {
		$client = new AP_SaaS_Client();
		$result = $client->connect_site( sanitize_text_field( $license_key ) );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( empty( $result['api_key'] ) ) {
			return new WP_Error( 'alignpress_saas_error', __( 'Invalid response from SaaS.', 'alignpress' ) );
		}

		update_option( 'alignpress_site_api_key',        sanitize_text_field( $result['api_key'] ) );
		update_option( 'alignpress_site_id',             sanitize_text_field( (string) ( $result['site_id'] ?? '' ) ) );
		update_option( 'alignpress_saas_team',           sanitize_text_field( $result['team_name'] ?? '' ) );
		update_option( 'alignpress_license_key',         sanitize_text_field( $license_key ) );
		// Store the URL this site connected with so clones can be detected locally before the heartbeat fires.
		update_option( 'alignpress_registered_site_url', get_site_url() );
		$plan = sanitize_text_field( $result['plan'] ?? 'free' );
		update_option( 'alignpress_license_plan', $plan );

		// Pro plans get 90-day capture retention; free stays at 7.
		$retention = in_array( $plan, ALIGNPRESS_PRO_PLANS, true ) ? 90 : 7;
		update_option( 'alignpress_capture_retention', $retention );

		// Delete individual option cache entries and the alloptions group so that
		// any persistent object cache (LiteSpeed, Redis, Memcached) re-reads from DB
		// on the next request rather than returning stale values.
		foreach ( [ 'alignpress_license_plan', 'alignpress_site_api_key', 'alignpress_site_id', 'alignpress_saas_team', 'alignpress_license_key' ] as $key ) {
			wp_cache_delete( $key, 'options' );
		}
		wp_cache_delete( 'alloptions', 'options' );
		wp_cache_delete( 'notoptions', 'options' );

		// Schedule hourly heartbeat now that we're connected.
		if ( ! wp_next_scheduled( 'alignpress_saas_heartbeat' ) ) {
			wp_schedule_event( time(), 'hourly', 'alignpress_saas_heartbeat' );
		}

		// Flush full page cache so the admin page HTML is regenerated with updated alignpressData.
		wp_cache_flush();
		do_action( 'alignpress_cache_flush' );

		return $result;
	}

	/**
	 * Disconnect this site from the SaaS.
	 * Notifies the SaaS to free the license slot while preserving site data for reconnect.
	 */
	public static function disconnect(): void {
		// Fire-and-forget — local cleanup always runs even if the API call fails.
		if ( self::is_connected() ) {
			( new AP_SaaS_Client() )->deregister_site();
		}

		delete_option( 'alignpress_site_api_key' );
		delete_option( 'alignpress_site_id' );
		delete_option( 'alignpress_saas_team' );
		delete_option( 'alignpress_license_key' );
		delete_option( 'alignpress_license_plan' );
		delete_option( 'alignpress_last_sync' );
		delete_option( 'alignpress_registered_site_url' );
		update_option( 'alignpress_capture_retention', 7 );

		wp_clear_scheduled_hook( 'alignpress_saas_heartbeat' );
	}

	/**
	 * Whether this site is currently connected to the SaaS.
	 */
	public static function is_connected(): bool {
		return ! empty( get_option( 'alignpress_site_api_key' ) );
	}
}
