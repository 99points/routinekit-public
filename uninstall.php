<?php
/**
 * RoutineKit uninstall handler.
 *
 * Runs only when the user clicks "Delete" on the Plugins screen.
 *
 * Cron events are always cleared. Everything else — tables, options, transients —
 * is removed only when the user has opted in via the routinekit_uninstall_clear_data
 * setting (Settings → Danger Zone), which is off by default so that deleting the
 * plugin does not destroy a user's workflows.
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

// Always clear scheduled cron events — leaving orphaned events behind would make
// WP-Cron fire hooks that no longer have a listener. This is safe either way.
wp_clear_scheduled_hook( 'routinekit_cleanup_capture_buffer' );
wp_clear_scheduled_hook( 'routinekit_saas_heartbeat' );
wp_clear_scheduled_hook( 'stepwise_saas_heartbeat' ); // legacy — clears any pre-rebrand cron still in the DB

/*
 * Data removal is opt-in. By default a delete leaves workflows, steps, executions,
 * and settings intact, so a user who removes the plugin to troubleshoot (or who
 * reinstalls later) does not lose their authoring work. Users who want a clean
 * removal enable "Delete all data on uninstall" in Settings → Danger Zone.
 */
if ( ! get_option( 'routinekit_uninstall_clear_data', false ) ) {
	return;
}

// Drop all custom tables
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- uninstall.php local variables
$tables = [
	'routinekit_workflows',
	'routinekit_steps',
	'routinekit_executions',
	'routinekit_step_completions',
	'routinekit_capture_buffer',
	'routinekit_step_notes',
];

foreach ( $tables as $table ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- intentional DROP TABLE on uninstall
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}{$table}" );
}

// Remove all plugin options
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- uninstall.php local variables
$options = [
	'routinekit_version',
	'routinekit_db_version',
	// Capture
	'routinekit_capture_enabled',
	'routinekit_capture_scope',
	'routinekit_capture_exclude',
	'routinekit_capture_retention',
	'routinekit_capture_min_changes',
	// UI / Runner
	'routinekit_runner_position',
	'routinekit_launcher_enabled',
	'routinekit_toast_enabled',
	'routinekit_toast_autodismiss',
	// Playbook defaults
	'routinekit_default_status',
	'routinekit_default_category',
	'routinekit_show_run_button',
	// Access / roles
	'routinekit_roles_view',
	'routinekit_roles_run',
	'routinekit_roles_edit',
	// Email notifications
	'routinekit_notify_assigned',
	'routinekit_notify_completed',
	'routinekit_notify_skipped',
	'routinekit_notify_email',
	// SaaS / Cloud
	'routinekit_saas_url',
	'routinekit_site_token',
	'routinekit_site_nickname',
	'routinekit_site_id',
	'routinekit_site_api_key',
	'routinekit_saas_team',
	'routinekit_license_key',
	'routinekit_license_plan',
	'routinekit_last_sync',
	'routinekit_sync_queue',
	'routinekit_saas_site_key',
	'routinekit_staging_mode',
	'routinekit_registered_site_url',
	// The opt-in flag itself — removed last, along with everything it gated.
	'routinekit_uninstall_clear_data',
];

foreach ( $options as $option ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound
	delete_option( $option );
}

// Remove dynamic per-workflow SaaS assignment options
// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- static query, no user input
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'routinekit_saas_assignment_%'" );

// Remove transients
// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- static query, no user input
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_routinekit_%' OR option_name LIKE '_transient_timeout_routinekit_%'" );
