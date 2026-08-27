<?php
defined( 'ABSPATH' ) || exit;

/**
 * Core plugin class. Wires together all components via the loader.
 */
class Stepwise {

	/** @var Stepwise_Loader */
	protected Stepwise_Loader $loader;

	public function __construct() {
		$this->loader = new Stepwise_Loader();
	}

	/**
	 * Bootstrap all plugin components.
	 */
	public function init(): void {
		$this->load_dependencies();
		$this->define_admin_hooks();
		$this->define_api_hooks();
		$this->define_capture_hooks();
		$this->loader->run();
	}

	/**
	 * Require all class files. Autoloading is done here to keep the
	 * dependency graph explicit and easy to audit.
	 */
	private function load_dependencies(): void {
		$includes = STEPWISE_PLUGIN_DIR . 'includes/';

		require_once $includes . 'class-stepwise-loader.php';

		// Core models
		require_once $includes . 'core/class-ap-workflow.php';
		require_once $includes . 'core/class-ap-step.php';
		require_once $includes . 'core/class-ap-execution.php';
		require_once $includes . 'core/class-ap-capture.php';
		require_once $includes . 'core/class-ap-deeplinks.php';
		require_once $includes . 'core/class-ap-templates.php';

		// Admin
		require_once $includes . 'admin/class-ap-admin.php';
		require_once $includes . 'admin/class-ap-settings.php';
		require_once $includes . 'admin/class-ap-notices.php';
		require_once $includes . 'admin/class-ap-saas-admin.php';

		// REST API
		require_once $includes . 'api/class-ap-rest-workflows.php';
		require_once $includes . 'api/class-ap-rest-steps.php';
		require_once $includes . 'api/class-ap-rest-executions.php';
		require_once $includes . 'api/class-ap-rest-capture.php';
		require_once $includes . 'api/class-ap-rest-evidence.php';
		require_once $includes . 'api/class-ap-rest-saas.php';
		require_once $includes . 'api/class-ap-rest-templates.php';
		require_once $includes . 'api/class-ap-rest-step-notes.php';

		// SaaS (Pro)
		require_once $includes . 'saas/class-ap-saas-client.php';
		require_once $includes . 'saas/class-ap-saas-sync.php';
		require_once $includes . 'saas/class-ap-saas-auth.php';
	}

	/**
	 * Register all admin-facing hooks.
	 */
	private function define_admin_hooks(): void {
		$admin = new AP_Admin();

		$this->loader->add_filter( 'user_has_cap',          $admin, 'grant_stepwise_caps', 10, 3 );
		$this->loader->add_filter( 'plugin_action_links_' . plugin_basename( STEPWISE_PLUGIN_FILE ), $admin, 'plugin_action_links' );
		$this->loader->add_action( 'admin_menu',            $admin, 'register_menus' );
		$this->loader->add_action( 'admin_head',            $admin, 'hide_capture_submenu' );
		$this->loader->add_action( 'admin_head',            $admin, 'suppress_third_party_notices', 99 );
		$this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_scripts' );
		$this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_styles' );
		$this->loader->add_action( 'admin_footer',          $admin, 'render_capture_mounts' );
		$this->loader->add_action( 'admin_footer-plugins.php', $admin, 'render_delete_warning_script' );

		$notices = new AP_Notices();
		$this->loader->add_action( 'admin_notices', $notices, 'render' );

		$this->loader->add_action( 'admin_init', $this, 'register_privacy_policy_content' );
		$this->loader->add_action( 'admin_init', $this, 'maybe_run_migrations' );

		$settings = new AP_Settings();
		$this->loader->add_action( 'admin_init',    $settings, 'register_settings' );
		$this->loader->add_action( 'rest_api_init', $settings, 'register_rest_routes' );

		$saas_admin = new AP_SaaS_Admin();
		$this->loader->add_action( 'admin_post_stepwise_saas_activate',   $saas_admin, 'handle_activate' );
		$this->loader->add_action( 'admin_post_stepwise_saas_deactivate', $saas_admin, 'handle_deactivate' );

		if ( AP_SaaS_Auth::is_connected() ) {
			$saas_sync = new AP_SaaS_Sync();
			$saas_sync->init();
		}
	}

	/**
	 * Register all REST API routes.
	 */
	private function define_api_hooks(): void {
		$rest_workflows   = new AP_REST_Workflows();
		$rest_steps       = new AP_REST_Steps();
		$rest_executions  = new AP_REST_Executions();
		$rest_capture     = new AP_REST_Capture();
		$rest_evidence    = new AP_REST_Evidence();
		$rest_saas        = new AP_REST_SaaS();
		$rest_templates   = new AP_REST_Templates();
		$rest_step_notes  = new AP_REST_Step_Notes();

		$this->loader->add_action( 'rest_api_init', $rest_workflows,   'register_routes' );
		$this->loader->add_action( 'rest_api_init', $rest_steps,       'register_routes' );
		$this->loader->add_action( 'rest_api_init', $rest_executions,  'register_routes' );
		$this->loader->add_action( 'rest_api_init', $rest_capture,     'register_routes' );
		$this->loader->add_action( 'rest_api_init', $rest_evidence,    'register_routes' );
		$this->loader->add_action( 'rest_api_init', $rest_saas,        'register_routes' );
		$this->loader->add_action( 'rest_api_init', $rest_templates,   'register_routes' );
		$this->loader->add_action( 'rest_api_init', $rest_step_notes,  'register_routes' );

		// When a media attachment is deleted, null out any note screenshot that referenced it
		$this->loader->add_action( 'delete_attachment', $rest_step_notes, 'on_attachment_deleted' );
	}

	/**
	 * Register auto-capture hooks (fires on every admin page load).
	 */
	private function define_capture_hooks(): void {
		$capture = new AP_Capture();
		// Priority 1 — must register before options.php calls update_option()
		// which fires on the same 'init' hook at default priority 10.
		$this->loader->add_action( 'init',                             $capture, 'init',           1 );
		$this->loader->add_action( 'stepwise_cleanup_capture_buffer',  $capture, 'cleanup_buffer'    );
	}

	/**
	 * Register privacy policy content for WordPress's built-in Privacy Policy page tool.
	 */
	public function maybe_run_migrations(): void {
		global $wpdb;

		// Add pushed_at column if missing (introduced in 1.1.0).
		if ( get_transient( 'stepwise_migration_pushed_at_done' ) ) {
			return;
		}
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- migration on custom table
		$cols = $wpdb->get_col( "DESC {$wpdb->prefix}stepwise_workflows", 0 );
		if ( ! in_array( 'pushed_at', $cols, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}stepwise_workflows ADD COLUMN pushed_at DATETIME DEFAULT NULL" );
		}
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
		set_transient( 'stepwise_migration_pushed_at_done', true, WEEK_IN_SECONDS );
	}

	public function register_privacy_policy_content(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}

		$content = '<h2>' . esc_html__( 'Stepwise', 'stepwise' ) . '</h2>'
			. '<p>' . esc_html__( 'Stepwise captures wp_options changes during admin sessions to help build workflow steps (Auto-Capture). This data is stored only in your own database and is never sent to external servers on the free plan.', 'stepwise' ) . '</p>'
			. '<p>' . esc_html__( 'Data stored locally: option name, old value, new value, admin page URL, and the user ID of the person who made the change. Retained for a configurable period (default 7 days) and deleted automatically.', 'stepwise' ) . '</p>'
			. '<p>' . esc_html__( 'Execution audit trails store: which user ran a workflow, which steps were completed or skipped, timestamps, and any uploaded evidence files.', 'stepwise' ) . '</p>'
			. '<p>' . wp_kses(
				sprintf(
					/* translators: %s: URL to Stepwise privacy policy */
					__( 'If you connect to Stepwise Cloud (Pro), see the <a href="%s">Stepwise Cloud Privacy Policy</a>.', 'stepwise' ),
					'https://wpstepwise.com/privacy'
				),
				[ 'a' => [ 'href' => [] ] ]
			) . '</p>';

		wp_add_privacy_policy_content( 'Stepwise', $content );
	}
}
