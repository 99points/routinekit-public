<?php
/**
 * AlignPress uninstall handler.
 *
 * Removes all plugin data from the database on uninstall.
 * Only runs when the user clicks "Delete" on the Plugins screen.
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

// Clear all scheduled cron events before removing data
wp_clear_scheduled_hook( 'alignpress_cleanup_capture_buffer' );
wp_clear_scheduled_hook( 'alignpress_saas_heartbeat' );

// Drop all custom tables
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- uninstall.php local variables
$tables = [
	'alignpress_workflows',
	'alignpress_steps',
	'alignpress_executions',
	'alignpress_step_completions',
	'alignpress_capture_buffer',
];

foreach ( $tables as $table ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- intentional DROP TABLE on uninstall
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}{$table}" );
}

// Remove all plugin options
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- uninstall.php local variables
$options = [
	'alignpress_version',
	'alignpress_db_version',
	// Capture
	'alignpress_capture_enabled',
	'alignpress_capture_scope',
	'alignpress_capture_exclude',
	'alignpress_capture_retention',
	'alignpress_capture_min_changes',
	// UI / Runner
	'alignpress_runner_position',
	'alignpress_launcher_enabled',
	'alignpress_toast_enabled',
	'alignpress_toast_autodismiss',
	// Playbook defaults
	'alignpress_default_status',
	'alignpress_default_category',
	'alignpress_show_run_button',
	// Access / roles
	'alignpress_roles_view',
	'alignpress_roles_run',
	'alignpress_roles_edit',
	// Email notifications
	'alignpress_notify_assigned',
	'alignpress_notify_completed',
	'alignpress_notify_skipped',
	'alignpress_notify_email',
	// SaaS / Cloud
	'alignpress_saas_url',
	'alignpress_site_token',
	'alignpress_site_nickname',
	'alignpress_site_id',
	'alignpress_site_api_key',
	'alignpress_saas_team',
	'alignpress_license_key',
	'alignpress_license_plan',
	'alignpress_last_sync',
	'alignpress_sync_queue',
	'alignpress_saas_site_key',
];

foreach ( $options as $option ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
	delete_option( $option );
}

// Remove dynamic per-workflow SaaS assignment options
// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- static query, no user input
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'alignpress_saas_assignment_%'" );

// Remove transients
// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- static query, no user input
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_alignpress_%' OR option_name LIKE '_transient_timeout_alignpress_%'" );
