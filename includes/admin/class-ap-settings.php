<?php
defined( 'ABSPATH' ) || exit;

/**
 * Settings page — registers WP Settings API groups and a REST save endpoint.
 */
class AP_Settings {

	/**
	 * Register all plugin settings with the WP Settings API.
	 */
	public function register_settings(): void {
		// Auto-capture
		register_setting( 'stepwise_capture', 'stepwise_capture_enabled',     [ 'type' => 'boolean', 'default' => true,            'sanitize_callback' => 'rest_sanitize_boolean' ] );
		register_setting( 'stepwise_capture', 'stepwise_capture_scope',       [ 'type' => 'string',  'default' => 'all_changes',   'sanitize_callback' => [ $this, 'sanitize_capture_scope' ] ] );
		register_setting( 'stepwise_capture', 'stepwise_capture_exclude',     [ 'type' => 'string',  'default' => 'session_tokens, transient_*, _site_transient_*', 'sanitize_callback' => 'sanitize_text_field' ] );
		register_setting( 'stepwise_capture', 'stepwise_capture_retention',   [ 'type' => 'integer', 'default' => 30,              'sanitize_callback' => 'absint' ] );
		register_setting( 'stepwise_capture', 'stepwise_capture_min_changes', [ 'type' => 'integer', 'default' => 1,               'sanitize_callback' => 'absint' ] );

		// Notifications & Toast
		register_setting( 'stepwise_ui', 'stepwise_toast_enabled',     [ 'type' => 'boolean', 'default' => true,  'sanitize_callback' => 'rest_sanitize_boolean' ] );
		register_setting( 'stepwise_ui', 'stepwise_toast_autodismiss', [ 'type' => 'integer', 'default' => 0,     'sanitize_callback' => 'absint' ] );
		register_setting( 'stepwise_ui', 'stepwise_launcher_enabled',  [ 'type' => 'boolean', 'default' => true,  'sanitize_callback' => 'rest_sanitize_boolean' ] );
		register_setting( 'stepwise_ui', 'stepwise_runner_position',   [ 'type' => 'string',  'default' => 'right', 'sanitize_callback' => [ $this, 'sanitize_runner_position' ] ] );

		// Playbook defaults
		register_setting( 'stepwise_defaults', 'stepwise_default_status',   [ 'type' => 'string',  'default' => 'active', 'sanitize_callback' => [ $this, 'sanitize_default_status' ] ] );
		register_setting( 'stepwise_defaults', 'stepwise_default_category', [ 'type' => 'string',  'default' => '',       'sanitize_callback' => 'sanitize_text_field' ] );
		register_setting( 'stepwise_defaults', 'stepwise_show_run_button',  [ 'type' => 'boolean', 'default' => true,     'sanitize_callback' => 'rest_sanitize_boolean' ] );

		// Team & access
		register_setting( 'stepwise_access', 'stepwise_roles_view', [ 'type' => 'array', 'default' => [ 'administrator' ], 'sanitize_callback' => [ $this, 'sanitize_roles' ] ] );
		register_setting( 'stepwise_access', 'stepwise_roles_run',  [ 'type' => 'array', 'default' => [ 'administrator' ], 'sanitize_callback' => [ $this, 'sanitize_roles' ] ] );
		register_setting( 'stepwise_access', 'stepwise_roles_edit', [ 'type' => 'array', 'default' => [ 'administrator' ], 'sanitize_callback' => [ $this, 'sanitize_roles' ] ] );

		// Email notifications
		register_setting( 'stepwise_notifications', 'stepwise_notify_assigned',  [ 'type' => 'boolean', 'default' => true,  'sanitize_callback' => 'rest_sanitize_boolean' ] );
		register_setting( 'stepwise_notifications', 'stepwise_notify_completed', [ 'type' => 'boolean', 'default' => true,  'sanitize_callback' => 'rest_sanitize_boolean' ] );
		register_setting( 'stepwise_notifications', 'stepwise_notify_skipped',   [ 'type' => 'boolean', 'default' => false, 'sanitize_callback' => 'rest_sanitize_boolean' ] );
		register_setting( 'stepwise_notifications', 'stepwise_notify_email',     [ 'type' => 'string',  'default' => '',    'sanitize_callback' => 'sanitize_email' ] );

		// SaaS / cloud
		register_setting( 'stepwise_saas', 'stepwise_saas_url',       [ 'type' => 'string', 'default' => STEPWISE_SAAS_DEFAULT_URL, 'sanitize_callback' => 'esc_url_raw' ] );
		register_setting( 'stepwise_saas', 'stepwise_site_token',     [ 'type' => 'string', 'default' => '',                         'sanitize_callback' => 'sanitize_text_field' ] );
		register_setting( 'stepwise_saas', 'stepwise_site_nickname',  [ 'type' => 'string', 'default' => '',                         'sanitize_callback' => 'sanitize_text_field' ] );
		register_setting( 'stepwise_saas', 'stepwise_last_sync',      [ 'type' => 'string', 'default' => '',                         'sanitize_callback' => 'sanitize_text_field' ] );
	}

	/**
	 * Register the REST route for saving all settings in one call.
	 * Called on rest_api_init.
	 */
	public function register_rest_routes(): void {
		register_rest_route( STEPWISE_REST_NAMESPACE, '/settings', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'rest_save_settings' ],
			'permission_callback' => static fn() => current_user_can( 'manage_options' ),
		] );

		register_rest_route( STEPWISE_REST_NAMESPACE, '/reset', [
			'methods'             => WP_REST_Server::DELETABLE,
			'callback'            => [ $this, 'rest_reset_all' ],
			'permission_callback' => static fn() => current_user_can( 'manage_options' ),
		] );

		// POST /stepwise/v1/settings/saas/connect — activate a license key (used by Upgrade page)
		register_rest_route( STEPWISE_REST_NAMESPACE, '/settings/saas/connect', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'rest_saas_connect' ],
			'permission_callback' => static fn() => current_user_can( 'manage_options' ),
			'args'                => [
				'license_key' => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			],
		] );

		// POST /stepwise/v1/settings/saas/disconnect — disconnect the site
		register_rest_route( STEPWISE_REST_NAMESPACE, '/settings/saas/disconnect', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'rest_saas_disconnect' ],
			'permission_callback' => static fn() => current_user_can( 'manage_options' ),
		] );

		// POST /stepwise/v1/settings/saas/staging — toggle staging mode
		register_rest_route( STEPWISE_REST_NAMESPACE, '/settings/saas/staging', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ $this, 'rest_saas_staging' ],
			'permission_callback' => static fn() => current_user_can( 'manage_options' ),
			'args'                => [
				'enabled' => [ 'required' => true, 'type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean' ],
			],
		] );
	}

	/**
	 * Save all general settings via REST.
	 */
	public function rest_save_settings( WP_REST_Request $request ): WP_REST_Response {
		$map = [
			// capture
			'stepwise_capture_enabled'     => 'rest_sanitize_boolean',
			'stepwise_capture_scope'       => [ $this, 'sanitize_capture_scope' ],
			'stepwise_capture_exclude'     => 'sanitize_text_field',
			'stepwise_capture_retention'   => 'absint',
			'stepwise_capture_min_changes' => 'absint',
			// toast/ui
			'stepwise_toast_enabled'       => 'rest_sanitize_boolean',
			'stepwise_toast_autodismiss'   => 'absint',
			'stepwise_launcher_enabled'    => 'rest_sanitize_boolean',
			'stepwise_runner_position'     => [ $this, 'sanitize_runner_position' ],
			// defaults
			'stepwise_default_status'      => [ $this, 'sanitize_default_status' ],
			'stepwise_default_category'    => 'sanitize_text_field',
			'stepwise_show_run_button'     => 'rest_sanitize_boolean',
			// access
			'stepwise_roles_view'          => [ $this, 'sanitize_roles' ],
			'stepwise_roles_run'           => [ $this, 'sanitize_roles' ],
			'stepwise_roles_edit'          => [ $this, 'sanitize_roles' ],
			// notifications
			'stepwise_notify_assigned'     => 'rest_sanitize_boolean',
			'stepwise_notify_completed'    => 'rest_sanitize_boolean',
			'stepwise_notify_skipped'      => 'rest_sanitize_boolean',
			'stepwise_notify_email'        => 'sanitize_email',
		];

		foreach ( $map as $option => $sanitizer ) {
			$value = $request->get_param( $option );
			if ( null !== $value ) {
				update_option( $option, call_user_func( $sanitizer, $value ) );
			}
		}

		return new WP_REST_Response( [ 'success' => true ], 200 );
	}

	/**
	 * Nuke all plugin data (tables + options).
	 */
	public function rest_reset_all(): WP_REST_Response {
		global $wpdb;

		$tables = [
			$wpdb->prefix . 'stepwise_step_completions',
			$wpdb->prefix . 'stepwise_step_notes',
			$wpdb->prefix . 'stepwise_executions',
			$wpdb->prefix . 'stepwise_capture_buffer',
			$wpdb->prefix . 'stepwise_steps',
			$wpdb->prefix . 'stepwise_workflows',
		];

		foreach ( $tables as $table ) {
			$wpdb->query( "DROP TABLE IF EXISTS `$table`" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.DirectDatabaseQuery.SchemaChange -- intentional plugin table removal
		}

		$options = [
			'stepwise_capture_enabled', 'stepwise_capture_scope', 'stepwise_capture_exclude',
			'stepwise_capture_retention', 'stepwise_capture_min_changes',
			'stepwise_toast_enabled', 'stepwise_toast_autodismiss', 'stepwise_launcher_enabled',
			'stepwise_runner_position', 'stepwise_default_status', 'stepwise_default_category',
			'stepwise_show_run_button', 'stepwise_roles_view', 'stepwise_roles_run',
			'stepwise_roles_edit', 'stepwise_notify_assigned', 'stepwise_notify_completed',
			'stepwise_notify_skipped', 'stepwise_notify_email',
			'stepwise_saas_url', 'stepwise_site_token', 'stepwise_site_nickname',
			'stepwise_last_sync', 'stepwise_db_version',
			'stepwise_site_api_key', 'stepwise_site_id', 'stepwise_license_key',
			'stepwise_license_plan', 'stepwise_saas_team', 'stepwise_staging_mode',
		];

		foreach ( $options as $opt ) {
			delete_option( $opt );
		}

		return new WP_REST_Response( [ 'success' => true ], 200 );
	}

	/**
	 * POST /stepwise/v1/settings/saas/connect
	 */
	public function rest_saas_connect( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$license_key = $request->get_param( 'license_key' );
		$result      = AP_SaaS_Auth::connect( $license_key );

		if ( is_wp_error( $result ) ) {
			return new WP_Error( 'stepwise_connect_failed', $result->get_error_message(), [ 'status' => 400 ] );
		}

		return new WP_REST_Response( [
			'success'   => true,
			'plan'      => $result['plan'] ?? 'free',
			'team_name' => $result['team_name'] ?? '',
		], 200 );
	}

	/**
	 * POST /stepwise/v1/settings/saas/disconnect
	 */
	public function rest_saas_disconnect(): WP_REST_Response {
		AP_SaaS_Auth::disconnect();
		return new WP_REST_Response( [ 'success' => true ], 200 );
	}

	public function rest_saas_staging( WP_REST_Request $request ): WP_REST_Response {
		$enabled = (bool) $request->get_param( 'enabled' );
		update_option( 'stepwise_staging_mode', $enabled );
		return new WP_REST_Response( [ 'success' => true, 'staging_mode' => $enabled ], 200 );
	}

	// ── Sanitizers ──────────────────────────────────────────────────────────

	public function sanitize_capture_scope( $value ): string {
		return in_array( $value, [ 'all_changes', 'plugin_settings_only' ], true )
			? $value : 'all_changes';
	}

	public function sanitize_runner_position( $value ): string {
		return in_array( $value, [ 'left', 'right' ], true ) ? $value : 'right';
	}

	public function sanitize_default_status( $value ): string {
		return in_array( $value, [ 'active', 'draft' ], true ) ? $value : 'active';
	}

	public function sanitize_roles( $value ): array {
		$allowed = [ 'administrator', 'editor', 'author', 'contributor', 'subscriber' ];
		if ( ! is_array( $value ) ) {
			return [ 'administrator' ];
		}
		$roles = array_values( array_filter( $value, static fn( $r ) => in_array( $r, $allowed, true ) ) );
		// Administrator must always be present — enforce server-side regardless of what was sent.
		if ( ! in_array( 'administrator', $roles, true ) ) {
			$roles[] = 'administrator';
		}
		return $roles ?: [ 'administrator' ];
	}

	/** @return array<string,array<string,mixed>> */
	private function get_rest_args(): array {
		// Use validate_callback => '__return_true' on all args so WP REST does not
		// reject values that arrive as strings from form-encoded requests. Each
		// value is sanitized properly in rest_save_settings() before being stored.
		$bool   = [ 'type' => 'boolean', 'validate_callback' => '__return_true' ];
		$int    = [ 'type' => 'integer', 'validate_callback' => '__return_true' ];
		$string = [ 'type' => 'string',  'validate_callback' => '__return_true' ];
		$array  = [ 'type' => 'array',   'validate_callback' => '__return_true' ];
		return [
			'stepwise_capture_enabled'     => $bool,
			'stepwise_capture_scope'       => $string,
			'stepwise_capture_exclude'     => $string,
			'stepwise_capture_retention'   => $int,
			'stepwise_capture_min_changes' => $int,
			'stepwise_toast_enabled'       => $bool,
			'stepwise_toast_autodismiss'   => $int,
			'stepwise_launcher_enabled'    => $bool,
			'stepwise_runner_position'     => $string,
			'stepwise_default_status'      => $string,
			'stepwise_default_category'    => $string,
			'stepwise_show_run_button'     => $bool,
			'stepwise_roles_view'          => $array,
			'stepwise_roles_run'           => $array,
			'stepwise_roles_edit'          => $array,
			'stepwise_notify_assigned'     => $bool,
			'stepwise_notify_completed'    => $bool,
			'stepwise_notify_skipped'      => $bool,
			'stepwise_notify_email'        => $string,
		];
	}
}
