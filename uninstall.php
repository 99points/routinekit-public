<?php
/**
 * Stepwise uninstall handler.
 *
 * Removes all plugin data from the database on uninstall.
 * Only runs when the user clicks "Delete" on the Plugins screen.
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

// Clear all scheduled cron events before removing data
wp_clear_scheduled_hook( 'stepwise_cleanup_capture_buffer' );
wp_clear_scheduled_hook( 'stepwise_saas_heartbeat' );

// Drop all custom tables
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- uninstall.php local variables
$tables = [
	'stepwise_workflows',
	'stepwise_steps',
	'stepwise_executions',
	'stepwise_step_completions',
	'stepwise_capture_buffer',
];

foreach ( $tables as $table ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- intentional DROP TABLE on uninstall
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}{$table}" );
}

// Remove all plugin options
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- uninstall.php local variables
$options = [
	'stepwise_version',
	'stepwise_db_version',
	// Capture
	'stepwise_capture_enabled',
	'stepwise_capture_scope',
	'stepwise_capture_exclude',
	'stepwise_capture_retention',
	'stepwise_capture_min_changes',
	// UI / Runner
	'stepwise_runner_position',
	'stepwise_launcher_enabled',
	'stepwise_toast_enabled',
	'stepwise_toast_autodismiss',
	// Playbook defaults
	'stepwise_default_status',
	'stepwise_default_category',
	'stepwise_show_run_button',
	// Access / roles
	'stepwise_roles_view',
	'stepwise_roles_run',
	'stepwise_roles_edit',
	// Email notifications
	'stepwise_notify_assigned',
	'stepwise_notify_completed',
	'stepwise_notify_skipped',
	'stepwise_notify_email',
	// SaaS / Cloud
	'stepwise_saas_url',
	'stepwise_site_token',
	'stepwise_site_nickname',
	'stepwise_site_id',
	'stepwise_site_api_key',
	'stepwise_saas_team',
	'stepwise_license_key',
	'stepwise_license_plan',
	'stepwise_last_sync',
	'stepwise_sync_queue',
	'stepwise_saas_site_key',
];

foreach ( $options as $option ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
	delete_option( $option );
}

// Remove dynamic per-workflow SaaS assignment options
// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- static query, no user input
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'stepwise_saas_assignment_%'" );

// Remove transients
// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- static query, no user input
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_stepwise_%' OR option_name LIKE '_transient_timeout_stepwise_%'" );
