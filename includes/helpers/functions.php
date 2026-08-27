<?php
defined( 'ABSPATH' ) || exit;

/**
 * Check if the current site has an active Stepwise Pro license.
 *
 * @return bool
 */
function stepwise_is_pro(): bool {
	return in_array( get_option( 'stepwise_license_plan' ), STEPWISE_PRO_PLANS, true );
}

/**
 * Detect whether the current site is a staging / local / dev environment.
 *
 * Returns true when ANY of the following are true:
 *  - wp_get_environment_type() returns 'staging' or 'local'
 *  - The site URL hostname ends in .local, .test, .localhost, or .dev
 *  - The hostname is exactly 'localhost' or a loopback IP (127.x.x.x)
 *  - The URL scheme is not HTTPS (non-production sites often lack SSL)
 *
 * This is advisory — the manual staging-mode toggle always takes precedence.
 *
 * @return bool
 */
function stepwise_is_staging_env(): bool {
	$env_type = function_exists( 'wp_get_environment_type' ) ? wp_get_environment_type() : 'production';
	if ( in_array( $env_type, [ 'staging', 'local' ], true ) ) {
		return true;
	}

	$site_url = get_option( 'siteurl', '' );
	$host     = strtolower( (string) wp_parse_url( $site_url, PHP_URL_HOST ) );

	// Loopback / bare localhost
	if ( 'localhost' === $host || preg_match( '/^127\./', $host ) ) {
		return true;
	}

	// Common local TLDs
	foreach ( [ '.local', '.test', '.localhost', '.dev' ] as $tld ) {
		if ( str_ends_with( $host, $tld ) ) {
			return true;
		}
	}

	// Non-HTTPS is a weak signal but worth flagging
	$scheme = strtolower( (string) wp_parse_url( $site_url, PHP_URL_SCHEME ) );
	if ( 'https' !== $scheme ) {
		return true;
	}

	return false;
}

/**
 * Return true if staging mode is active — manual toggle only.
 * Auto-detection is advisory (used for the UI notice) but does not block sync.
 *
 * @return bool
 */
function stepwise_staging_mode_active(): bool {
	return (bool) get_option( 'stepwise_staging_mode', false );
}

/**
 * Get the number of non-archived workflows on this site (active + draft).
 * Free-plan limit applies to the total number of workflows a user can own, not just active ones.
 *
 * @return int
 */
function stepwise_get_active_workflow_count(): int {
	global $wpdb;
	return (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom table, count changes frequently
		"SELECT COUNT(*) FROM {$wpdb->prefix}stepwise_workflows WHERE status != 'archived'"
	);
}

/**
 * Always returns false — workflow limits have been removed on all plans.
 * Kept so callers don't need to be updated.
 *
 * @return bool
 */
function stepwise_at_workflow_limit(): bool {
	return false;
}

/**
 * Return the singleton SaaS client (any connected site, free or Pro).
 *
 * @return AP_SaaS_Client|null
 */
function stepwise_saas(): ?AP_SaaS_Client {
	if ( ! AP_SaaS_Auth::is_connected() ) {
		return null;
	}
	static $client = null;
	if ( null === $client ) {
		$client = new AP_SaaS_Client();
	}
	return $client;
}

/**
 * Check if the current user has permission to edit Stepwise workflows.
 * Reads the saved stepwise_roles_edit option and compares against user roles.
 *
 * @return bool
 */
function stepwise_current_user_can_edit(): bool {
	$allowed_roles = get_option( 'stepwise_roles_edit', [ 'administrator' ] );
	$user          = wp_get_current_user();
	if ( ! $user || ! $user->ID ) {
		return false;
	}
	return ! empty( array_intersect( (array) $user->roles, (array) $allowed_roles ) );
}

/**
 * Check if the current user has permission to run Stepwise workflows.
 * Reads the saved stepwise_roles_run option and compares against user roles.
 *
 * @return bool
 */
function stepwise_current_user_can_run(): bool {
	$allowed_roles = get_option( 'stepwise_roles_run', [ 'administrator' ] );
	$user          = wp_get_current_user();
	if ( ! $user || ! $user->ID ) {
		return false;
	}
	return ! empty( array_intersect( (array) $user->roles, (array) $allowed_roles ) );
}

/**
 * Check whether a workflow's steps are locked for editing.
 * Steps are locked once the workflow has been pushed to SaaS OR has ever been run.
 *
 * @param int $workflow_id
 * @return bool
 */
function stepwise_workflow_steps_locked( int $workflow_id ): bool {
	$workflow = AP_Workflow::get( $workflow_id );
	if ( ! $workflow ) {
		return false;
	}
	// Steps are locked only after the workflow has been pushed to the cloud.
	// Run history alone does not lock steps — users can refine steps between runs.
	return ! empty( $workflow->pushed_at );
}

/**
 * Check whether a workflow can be deleted.
 * Deletion is blocked once it has been pushed to SaaS or ever run.
 *
 * @param int $workflow_id
 * @return bool
 */
function stepwise_workflow_can_delete( int $workflow_id ): bool {
	return ! stepwise_workflow_steps_locked( $workflow_id );
}

/**
 * Flush all page caches after a license change.
 * Hooked onto 'stepwise_cache_flush'. Covers every major cache plugin
 * via their own canonical purge APIs — no need to enumerate them at call sites.
 */
function stepwise_flush_all_caches(): void {
	// WP object cache
	wp_cache_flush();

	// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- intentionally firing third-party cache plugin hooks
	do_action( 'litespeed_purge_all' );
	do_action( 'wphb_clear_page_cache' );
	do_action( 'cache_enabler_clear_complete_cache' );
	do_action( 'breeze_clear_all_cache' );
	do_action( 'rt_nginx_helper_purge_all' );
	do_action( 'cloudflare_purge_everything' );
	// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	if ( function_exists( 'wp_cache_clear_cache' ) ) {
		wp_cache_clear_cache();
	}
	if ( function_exists( 'w3tc_flush_all' ) ) {
		w3tc_flush_all();
	}
	if ( function_exists( 'rocket_clean_domain' ) ) {
		rocket_clean_domain();
	}
	if ( class_exists( 'autoptimizeCache' ) ) {
		autoptimizeCache::clearall();
	}
}
add_action( 'stepwise_cache_flush', 'stepwise_flush_all_caches' );

/**
 * Log debug messages when WP_DEBUG is enabled.
 *
 * @param mixed  $message
 * @param string $context
 */
function stepwise_log( $message, string $context = 'general' ): void {
	if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
		return;
	}
	if ( is_array( $message ) || is_object( $message ) ) {
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_print_r -- debug only, guarded by WP_DEBUG check above
		$message = print_r( $message, true );
	}
	// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- debug only, guarded by WP_DEBUG check above
	error_log( "[Stepwise:{$context}] {$message}" );
}
