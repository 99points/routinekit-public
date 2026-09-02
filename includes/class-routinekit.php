<?php
defined( 'ABSPATH' ) || exit;

/**
 * Core plugin class. Wires together all components via the loader.
 */
class Routinekit {

	/** @var Routinekit_Loader */
	protected Routinekit_Loader $loader;

	public function __construct() {
		$this->loader = new Routinekit_Loader();
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
		$includes = ROUTINEKIT_PLUGIN_DIR . 'includes/';

		require_once $includes . 'class-routinekit-loader.php';

		// Core models
		require_once $includes . 'core/class-routinekit-workflow.php';
		require_once $includes . 'core/class-routinekit-step.php';
		require_once $includes . 'core/class-routinekit-execution.php';
		require_once $includes . 'core/class-routinekit-capture.php';
		require_once $includes . 'core/class-routinekit-deeplinks.php';
		require_once $includes . 'core/class-routinekit-templates.php';

		// Admin
		require_once $includes . 'admin/class-routinekit-admin.php';
		require_once $includes . 'admin/class-routinekit-settings.php';
		require_once $includes . 'admin/class-routinekit-notices.php';
		require_once $includes . 'admin/class-routinekit-saas-admin.php';

		// REST API
		require_once $includes . 'api/class-routinekit-rest-workflows.php';
		require_once $includes . 'api/class-routinekit-rest-steps.php';
		require_once $includes . 'api/class-routinekit-rest-executions.php';
		require_once $includes . 'api/class-routinekit-rest-capture.php';
		require_once $includes . 'api/class-routinekit-rest-evidence.php';
		require_once $includes . 'api/class-routinekit-rest-saas.php';
		require_once $includes . 'api/class-routinekit-rest-templates.php';
		require_once $includes . 'api/class-routinekit-rest-step-notes.php';

		// SaaS (Pro)
		require_once $includes . 'saas/class-routinekit-saas-client.php';
		require_once $includes . 'saas/class-routinekit-saas-sync.php';
		require_once $includes . 'saas/class-routinekit-saas-auth.php';
	}

	/**
	 * Register all admin-facing hooks.
	 */
	private function define_admin_hooks(): void {
		$admin = new Routinekit_Admin();

		$this->loader->add_filter( 'user_has_cap',          $admin, 'grant_routinekit_caps', 10, 3 );
		$this->loader->add_filter( 'plugin_action_links_' . plugin_basename( ROUTINEKIT_PLUGIN_FILE ), $admin, 'plugin_action_links' );
		$this->loader->add_action( 'admin_menu',            $admin, 'register_menus' );
		$this->loader->add_action( 'admin_head',            $admin, 'suppress_third_party_notices', 99 );
		$this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_scripts' );
		$this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_styles' );
		$this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_menu_css' );
		$this->loader->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_delete_warning_script' );
		$this->loader->add_action( 'admin_footer',          $admin, 'render_capture_mounts' );

		$notices = new Routinekit_Notices();
		$this->loader->add_action( 'admin_notices', $notices, 'render' );

		$this->loader->add_action( 'admin_init', $this, 'register_privacy_policy_content' );
		$this->loader->add_action( 'admin_init', $this, 'maybe_run_migrations' );

		$settings = new Routinekit_Settings();
		$this->loader->add_action( 'admin_init',    $settings, 'register_settings' );
		$this->loader->add_action( 'rest_api_init', $settings, 'register_rest_routes' );

		$saas_admin = new Routinekit_SaaS_Admin();
		$this->loader->add_action( 'admin_post_routinekit_saas_activate',   $saas_admin, 'handle_activate' );
		$this->loader->add_action( 'admin_post_routinekit_saas_deactivate', $saas_admin, 'handle_deactivate' );

		if ( Routinekit_SaaS_Auth::is_connected() ) {
			$saas_sync = new Routinekit_SaaS_Sync();
			$saas_sync->init();
		}
	}

	/**
	 * Register all REST API routes.
	 */
	private function define_api_hooks(): void {
		$rest_workflows   = new Routinekit_REST_Workflows();
		$rest_steps       = new Routinekit_REST_Steps();
		$rest_executions  = new Routinekit_REST_Executions();
		$rest_capture     = new Routinekit_REST_Capture();
		$rest_evidence    = new Routinekit_REST_Evidence();
		$rest_saas        = new Routinekit_REST_SaaS();
		$rest_templates   = new Routinekit_REST_Templates();
		$rest_step_notes  = new Routinekit_REST_Step_Notes();

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
		$capture = new Routinekit_Capture();
		// Priority 1 — must register before options.php calls update_option()
		// which fires on the same 'init' hook at default priority 10.
		$this->loader->add_action( 'init',                               $capture, 'init',           1 );
		$this->loader->add_action( 'routinekit_cleanup_capture_buffer',  $capture, 'cleanup_buffer'    );
	}

	/**
	 * Register privacy policy content for WordPress's built-in Privacy Policy page tool.
	 */
	public function maybe_run_migrations(): void {
		global $wpdb;

		// Add pushed_at column if missing (introduced in 1.1.0).
		if ( get_transient( 'routinekit_migration_pushed_at_done' ) ) {
			return;
		}
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- migration on custom table
		$cols = $wpdb->get_col( "DESC {$wpdb->prefix}routinekit_workflows", 0 );
		if ( ! in_array( 'pushed_at', $cols, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}routinekit_workflows ADD COLUMN pushed_at DATETIME DEFAULT NULL" );
		}
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
		set_transient( 'routinekit_migration_pushed_at_done', true, WEEK_IN_SECONDS );
	}

	public function register_privacy_policy_content(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}

		$content = '<h2>' . esc_html__( 'RoutineKit', 'routinekit' ) . '</h2>'
			. '<p>' . esc_html__( 'RoutineKit captures wp_options changes during admin sessions to help build workflow steps (Auto-Capture). This data is stored only in your own database and is never sent to external servers on the free plan.', 'routinekit' ) . '</p>'
			. '<p>' . esc_html__( 'Data stored locally: option name, old value, new value, admin page URL, and the user ID of the person who made the change. Retained for a configurable period (default 7 days) and deleted automatically.', 'routinekit' ) . '</p>'
			. '<p>' . esc_html__( 'Execution audit trails store: which user ran a workflow, which steps were completed or skipped, timestamps, and any uploaded evidence files.', 'routinekit' ) . '</p>'
			. '<p>' . wp_kses(
				sprintf(
					/* translators: %s: URL to RoutineKit privacy policy */
					__( 'If you connect to RoutineKit Cloud (Pro), see the <a href="%s">RoutineKit Cloud Privacy Policy</a>.', 'routinekit' ),
					'https://wpstepwise.com/privacy'
				),
				[ 'a' => [ 'href' => [] ] ]
			) . '</p>';

		wp_add_privacy_policy_content( 'RoutineKit', $content );
	}
}
