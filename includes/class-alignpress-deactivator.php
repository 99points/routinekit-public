<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * Handles plugin deactivation cleanup.
 */
class AlignPress_Deactivator {

	/**
	 * Run on plugin deactivation.
	 *
	 * Does not remove data — that happens in uninstall.php.
	 * Only clears scheduled events and transients.
	 */
	public static function deactivate(): void {
		wp_clear_scheduled_hook( 'alignpress_cleanup_capture_buffer' );
		wp_clear_scheduled_hook( 'alignpress_saas_heartbeat' );

		// Clear any pending capture transients for all users
		global $wpdb;
		$wpdb->query( // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- static query with no user input
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_alignpress_pending_captures_%' OR option_name LIKE '_transient_timeout_alignpress_pending_captures_%'"
		);
	}
}
