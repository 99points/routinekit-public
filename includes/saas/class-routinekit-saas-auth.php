<?php
defined( 'ABSPATH' ) || exit;

/**
 * SaaS authentication — license key activation and site connection.
 */
class Routinekit_SaaS_Auth {

	/**
	 * Connect this site to the SaaS using a license key.
	 * Stores api_key, site_id, and team_name in wp_options on success.
	 *
	 * @param string $license_key
	 * @return array|WP_Error
	 */
	public static function connect( string $license_key ) {
		$client = new Routinekit_SaaS_Client();
		$result = $client->connect_site( sanitize_text_field( $license_key ) );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		if ( empty( $result['api_key'] ) ) {
			return new WP_Error( 'routinekit_saas_error', __( 'Invalid response from SaaS.', 'routinekit' ) );
		}

		update_option( 'routinekit_site_api_key',        sanitize_text_field( $result['api_key'] ) );
		update_option( 'routinekit_site_id',             sanitize_text_field( (string) ( $result['site_id'] ?? '' ) ) );
		update_option( 'routinekit_saas_team',           sanitize_text_field( $result['team_name'] ?? '' ) );
		update_option( 'routinekit_license_key',         sanitize_text_field( $license_key ) );
		// Store the URL this site connected with so clones can be detected locally before the heartbeat fires.
		update_option( 'routinekit_registered_site_url', get_site_url() );
		$plan = sanitize_text_field( $result['plan'] ?? 'free' );
		update_option( 'routinekit_license_plan', $plan );

		// Delete individual option cache entries and the alloptions group so that
		// any persistent object cache (LiteSpeed, Redis, Memcached) re-reads from DB
		// on the next request rather than returning stale values.
		foreach ( [ 'routinekit_license_plan', 'routinekit_site_api_key', 'routinekit_site_id', 'routinekit_saas_team', 'routinekit_license_key' ] as $key ) {
			wp_cache_delete( $key, 'options' );
		}
		wp_cache_delete( 'alloptions', 'options' );
		wp_cache_delete( 'notoptions', 'options' );

		// Schedule hourly heartbeat now that we're connected.
		if ( ! wp_next_scheduled( 'routinekit_saas_heartbeat' ) ) {
			wp_schedule_event( time(), 'hourly', 'routinekit_saas_heartbeat' );
		}

		// Flush full page cache so the admin page HTML is regenerated with updated routinekitData.
		wp_cache_flush();
		do_action( 'routinekit_cache_flush' );

		return $result;
	}

	/**
	 * Disconnect this site from the SaaS.
	 * Notifies the SaaS to free the license slot while preserving site data for reconnect.
	 */
	public static function disconnect(): void {
		// Fire-and-forget — local cleanup always runs even if the API call fails.
		if ( self::is_connected() ) {
			( new Routinekit_SaaS_Client() )->deregister_site();
		}

		delete_option( 'routinekit_site_api_key' );
		delete_option( 'routinekit_site_id' );
		delete_option( 'routinekit_saas_team' );
		delete_option( 'routinekit_license_key' );
		delete_option( 'routinekit_license_plan' );
		delete_option( 'routinekit_last_sync' );
		delete_option( 'routinekit_registered_site_url' );

		wp_clear_scheduled_hook( 'routinekit_saas_heartbeat' );
	}

	/**
	 * Whether this site is currently connected to the SaaS.
	 */
	public static function is_connected(): bool {
		return ! empty( get_option( 'routinekit_site_api_key' ) );
	}
}
