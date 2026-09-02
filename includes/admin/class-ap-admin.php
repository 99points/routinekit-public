<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin menu, page shells, and script/style enqueuing.
 */
class Routinekit_Admin {

	/**
	 * Grant the routinekit_run pseudo-capability to any user whose WP role
	 * is in the routinekit_roles_run option. Hooked onto 'user_has_cap'.
	 *
	 * @param array $allcaps All caps the user has.
	 * @param array $caps    Required caps for the current check.
	 * @param array $args    Extra args (0 = cap name, 1 = user ID).
	 * @return array
	 */
	public function grant_routinekit_caps( array $allcaps, array $caps, array $args ): array {
		if ( in_array( 'routinekit_run', $caps, true ) && routinekit_current_user_can_run() ) {
			$allcaps['routinekit_run'] = true;
		}
		return $allcaps;
	}

	/**
	 * Register top-level menu and all subpages.
	 * Main menu + Workflows use the custom routinekit_run cap so that
	 * non-admin runners can access the page. Settings/Upgrade stay manage_options.
	 */
	/**
	 * Add "Workflows" and "Upgrade to Pro" links on the Plugins list page.
	 */
	public function plugin_action_links( array $links ): array {
		$custom = [
			'workflows' => sprintf(
				'<a href="%s">%s</a>',
				esc_url( admin_url( 'admin.php?page=routinekit' ) ),
				esc_html__( 'Workflows', 'routinekit' )
			),
		];

		if ( ! routinekit_is_pro() ) {
			$custom['upgrade'] = sprintf(
				'<a href="%s" style="color:#d63638;font-weight:600;">%s</a>',
				esc_url( admin_url( 'admin.php?page=routinekit-upgrade' ) ),
				esc_html__( 'Upgrade to Pro', 'routinekit' )
			);
		}

		return array_merge( $custom, $links );
	}

	/**
	 * Hook suffixes returned by add_menu_page / add_submenu_page.
	 * Captured at menu-registration time so enqueue_scripts doesn't rely on
	 * hardcoded guesses that vary across WordPress versions and hosting setups.
	 *
	 * @var string[]
	 */
	private array $page_hooks = [];

	public function register_menus(): void {
		$hook = add_menu_page(
			__( 'RoutineKit', 'routinekit' ),
			__( 'RoutineKit', 'routinekit' ),
			'routinekit_run',
			'routinekit',
			[ $this, 'render_workflow_manager' ],
			'data:image/svg+xml;base64,' . base64_encode( '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="5" y="10" width="19" height="6.5" rx="2" fill="#a7aaad" opacity=".5"/><rect x="5" y="20.75" width="19" height="6.5" rx="2" fill="#a7aaad" opacity=".5"/><rect x="5" y="31.5" width="19" height="6.5" rx="2" fill="#a7aaad" opacity=".5"/><path d="M26 27 32 33 43 13" stroke="#a7aaad" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' ),
			30
		);
		$this->page_hooks[] = $hook;

		$this->page_hooks[] = add_submenu_page(
			'routinekit',
			__( 'Workflows', 'routinekit' ),
			__( 'Workflows', 'routinekit' ),
			'routinekit_run',
			'routinekit',
			[ $this, 'render_workflow_manager' ]
		);

		$this->page_hooks[] = add_submenu_page(
			'routinekit',
			__( 'Settings', 'routinekit' ),
			__( 'Settings', 'routinekit' ),
			'manage_options',
			'routinekit-settings',
			[ $this, 'render_settings' ]
		);

		// Capture page — child of routinekit so the menu stays open; hidden via CSS not remove_submenu_page
		$this->page_hooks[] = add_submenu_page(
			'routinekit',
			__( 'Captured Steps', 'routinekit' ),
			__( 'Captured Steps', 'routinekit' ),
			'routinekit_run',
			'routinekit-capture',
			[ $this, 'render_capture' ]
		);

		// Always register the upgrade page so direct URL visits don't hit WP's
		// "not allowed" wall. render_upgrade() redirects Pro users to the main page.
		$this->page_hooks[] = add_submenu_page(
			'routinekit',
			__( 'Upgrade to Pro', 'routinekit' ),
			__( 'Upgrade to Pro', 'routinekit' ),
			'manage_options',
			'routinekit-upgrade',
			[ $this, 'render_upgrade' ]
		);
	}

	/**
	 * Return a cache-busting version string for a plugin asset file.
	 * Uses the file's last-modified timestamp so any change on disk
	 * immediately invalidates the browser cache without a plugin version bump.
	 *
	 * @param string $relative_path Path relative to ROUTINEKIT_PLUGIN_DIR.
	 * @return string
	 */
	private function asset_version( string $relative_path ): string {
		$abs = ROUTINEKIT_PLUGIN_DIR . $relative_path;
		return file_exists( $abs ) ? (string) filemtime( $abs ) : ROUTINEKIT_VERSION;
	}

	/**
	 * Drop dependency handles that this WordPress install doesn't know about.
	 *
	 * @wordpress/scripts writes the dependency list against the WP version it was
	 * built with, so a bundle built on a newer WP can list handles an older site
	 * has never registered (e.g. 'react-jsx-runtime', added in WP 6.6). When any
	 * dependency is unregistered, WP_Dependencies::all_deps() silently refuses to
	 * print the script *and everything that depends on it* — no error, no notice,
	 * just a blank page. Filtering here means a missing handle costs us that one
	 * polyfill instead of the whole app.
	 *
	 * @param string[] $handles
	 * @return string[]
	 */
	private function filter_registered_deps( array $handles ): array {
		return array_values( array_filter(
			$handles,
			fn( $handle ) => wp_script_is( $handle, 'registered' )
		) );
	}

	/**
	 * Register the shared webpack runtime chunk. Must fire before either
	 * entry point is enqueued so both entries resolve chunks correctly.
	 */
	private function register_runtime(): void {
		if ( wp_script_is( 'routinekit-runtime', 'registered' ) ) {
			return;
		}
		$runtime_asset = ROUTINEKIT_PLUGIN_DIR . 'assets/js/runtime.asset.php';
		$runtime       = file_exists( $runtime_asset ) ? require $runtime_asset : [ 'dependencies' => [], 'version' => null ];

		// Split-chunk URLs resolve themselves: the bundle is built with
		// output.publicPath 'auto', so the runtime derives them from its own
		// <script> tag. Nothing to inject from here.
		wp_register_script(
			'routinekit-runtime',
			ROUTINEKIT_PLUGIN_URL . 'assets/js/runtime.js',
			$this->filter_registered_deps( $runtime['dependencies'] ),
			$runtime['version'] ?? $this->asset_version( 'assets/js/runtime.js' ),
			true
		);
	}

	/**
	 * Enqueue JS bundles on RoutineKit admin pages.
	 *
	 * @param string $hook
	 */
	public function enqueue_scripts( string $hook ): void {
		if ( ! $this->is_routinekit_page( $hook ) ) {
			return;
		}

		$this->register_runtime();

		$asset_file = ROUTINEKIT_PLUGIN_DIR . 'assets/js/routinekit-admin.asset.php';
		$deps       = file_exists( $asset_file ) ? require $asset_file : [ 'dependencies' => [], 'version' => null ];

		wp_enqueue_script(
			'routinekit-admin',
			ROUTINEKIT_PLUGIN_URL . 'assets/js/routinekit-admin.js',
			$this->filter_registered_deps( array_merge(
				[ 'routinekit-runtime' ],
				$deps['dependencies'],
				[ 'wp-api-fetch', 'wp-data', 'wp-element', 'wp-i18n' ]
			) ),
			$deps['version'] ?? $this->asset_version( 'assets/js/routinekit-admin.js' ),
			true
		);

		wp_localize_script( 'routinekit-admin', 'routinekitData', array_merge(
			$this->get_js_data(),
			$this->get_settings_js_data()
		) );
	}

	/**
	 * Enqueue stylesheets and the capture/runner bundle on all wp-admin pages.
	 *
	 * @param string $hook
	 */
	public function enqueue_styles( string $hook ): void {
		$this->register_runtime();

		// Runner capture script loads on ALL admin pages so the sidebar persists
		$capture_asset = ROUTINEKIT_PLUGIN_DIR . 'assets/js/routinekit-capture.asset.php';
		$capture_deps  = file_exists( $capture_asset ) ? require $capture_asset : [ 'dependencies' => [], 'version' => null ];

		wp_enqueue_script(
			'routinekit-capture',
			ROUTINEKIT_PLUGIN_URL . 'assets/js/routinekit-capture.js',
			$this->filter_registered_deps( array_merge( [ 'routinekit-runtime' ], $capture_deps['dependencies'] ) ),
			$capture_deps['version'] ?? $this->asset_version( 'assets/js/routinekit-capture.js' ),
			true
		);

		wp_localize_script( 'routinekit-capture', 'routinekitData', $this->get_js_data() );

		// Capture watcher — floating "⊕ Capture Step" button on all admin pages.
		if ( (bool) get_option( 'routinekit_capture_enabled', true ) && current_user_can( 'manage_options' ) ) {
			wp_enqueue_script(
				'routinekit-html2canvas',
				ROUTINEKIT_PLUGIN_URL . 'assets/js/html2canvas.min.js',
				[],
				'1.4.1',
				true
			);
			wp_enqueue_script(
				'routinekit-capture-watcher',
				ROUTINEKIT_PLUGIN_URL . 'assets/js/capture-watcher.js',
				[ 'routinekit-html2canvas' ],
				$this->asset_version( 'assets/js/capture-watcher.js' ),
				true
			);

			// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized,WordPress.Security.ValidatedSanitizedInput.MissingUnslash -- composed from trusted server vars, not user input
			$page_url = esc_url_raw( ( is_ssl() ? 'https' : 'http' ) . '://' . wp_unslash( $_SERVER['HTTP_HOST'] ?? '' ) . wp_unslash( $_SERVER['REQUEST_URI'] ?? '' ) );

			wp_localize_script( 'routinekit-capture-watcher', 'routinekitCapture', [
				'restUrl'   => rest_url( ROUTINEKIT_REST_NAMESPACE . '/' ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'pageUrl'   => $page_url,
				'pageTitle' => esc_html( get_admin_page_title() ?: '' ),
				'workflows' => $this->get_workflow_options(),
			] );
		}

		if ( file_exists( ROUTINEKIT_PLUGIN_DIR . 'assets/css/routinekit.css' ) ) {
			wp_enqueue_style(
				'routinekit',
				ROUTINEKIT_PLUGIN_URL . 'assets/css/routinekit.css',
				[],
				$this->asset_version( 'assets/css/routinekit.css' )
			);
		}

		if ( file_exists( ROUTINEKIT_PLUGIN_DIR . 'admin/css/routinekit-admin.css' ) ) {
			wp_enqueue_style(
				'routinekit-admin',
				ROUTINEKIT_PLUGIN_URL . 'admin/css/routinekit-admin.css',
				[],
				$this->asset_version( 'admin/css/routinekit-admin.css' )
			);
		}

	}

	/**
	 * Build the data object passed to every React app.
	 *
	 * @return array
	 */
	private function get_js_data(): array {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$workflow_id = isset( $_GET['workflow_id'] ) ? absint( $_GET['workflow_id'] ) : 0;

		return [
			'nonce'       => wp_create_nonce( 'wp_rest' ),
			'restUrl'     => rest_url( ROUTINEKIT_REST_NAMESPACE . '/' ),
			'isPro'        => routinekit_is_pro(),
			'licensePlan'  => get_option( 'routinekit_license_plan', 'free' ),
			'isConnected'  => Routinekit_SaaS_Auth::is_connected(),
			'saasPlan'     => get_option( 'routinekit_license_plan', 'free' ),
			'version'     => ROUTINEKIT_VERSION,
			// Current user's resolved permissions — computed server-side so JS
			// doesn't need to re-implement role logic.
			'canRun'       => routinekit_current_user_can_run(),
			'canEdit'      => routinekit_current_user_can_edit(),
			'currentUserId' => get_current_user_id(),
			'workflowLimit' => 0, // No workflow limit on any plan.
			'atLimit'     => false,
			'currentPage' => $this->get_current_page(),
			'workflowId'  => $workflow_id ?: null,
			'adminUrl'    => admin_url(),
			'pluginUrl'   => ROUTINEKIT_PLUGIN_URL,
			'upgradeUrl'  => routinekit_is_pro() ? null : admin_url( 'admin.php?page=routinekit-upgrade' ),

			// Auto-Capture
			'captureEnabled'    => (bool) get_option( 'routinekit_capture_enabled', true ),
			'captureScope'      => get_option( 'routinekit_capture_scope', 'all_changes' ),
			'captureExclude'    => $this->get_capture_exclude(),
			'captureRetention'  => (int) get_option( 'routinekit_capture_retention', 30 ),
			'captureMinChanges' => (int) get_option( 'routinekit_capture_min_changes', 1 ),

			// Toast & Runner
			'toastEnabled'      => (bool) get_option( 'routinekit_toast_enabled', true ),
			'captureAutodismiss' => (int) get_option( 'routinekit_toast_autodismiss', 0 ),
			'launcherEnabled'   => (bool) get_option( 'routinekit_launcher_enabled', true ),
			'runnerPosition'    => get_option( 'routinekit_runner_position', 'right' ),

			// Playbook defaults
			'defaultStatus'   => get_option( 'routinekit_default_status', 'active' ),
			'defaultCategory' => get_option( 'routinekit_default_category', 'general' ),
			'showRunButton'   => (bool) get_option( 'routinekit_show_run_button', true ),

			// Team & Access
			'rolesView' => get_option( 'routinekit_roles_view', [ 'administrator' ] ),
			'rolesRun'  => get_option( 'routinekit_roles_run',  [ 'administrator' ] ),
			'rolesEdit' => get_option( 'routinekit_roles_edit', [ 'administrator' ] ),

			// Email notifications (toggles — safe on all pages)
			'notifyAssigned'  => (bool) get_option( 'routinekit_notify_assigned', true ),
			'notifyCompleted' => (bool) get_option( 'routinekit_notify_completed', true ),
			'notifySkipped'   => (bool) get_option( 'routinekit_notify_skipped', false ),

			// Cloud / SaaS
			'saasUrl'              => rtrim( get_option( 'routinekit_saas_url', ROUTINEKIT_SAAS_DEFAULT_URL ), '/' ),
			'saasConnected'        => Routinekit_SaaS_Auth::is_connected(),
			'stagingMode'          => (bool) get_option( 'routinekit_staging_mode', false ),
			'stagingAutoDetected'  => routinekit_is_staging_env(),
			'lastSync'      => get_option( 'routinekit_last_sync', '' ),
			'deeplinks'     => ( new Routinekit_Deeplinks() )->get_library( true ),

			// Uninstall behaviour (Danger Zone) — false means a delete keeps data.
			'uninstallClearData' => (bool) get_option( 'routinekit_uninstall_clear_data', false ),
		];
	}

	/**
	 * Extra JS data that is only needed on the RoutineKit Settings page.
	 * Kept separate so sensitive values (email address, SaaS nonces) are not
	 * broadcast to every admin page via the capture bundle.
	 *
	 * @return array
	 */
	private function get_settings_js_data(): array {
		return [
			'notifyEmail'         => get_option( 'routinekit_notify_email', '' ),
			'saasActivateNonce'   => wp_create_nonce( 'routinekit_saas_activate' ),
			'saasDeactivateNonce' => wp_create_nonce( 'routinekit_saas_deactivate' ),
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			'saasError'           => sanitize_text_field( wp_unslash( $_GET['saas_error'] ?? '' ) ),
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			'saasConnectedFlash'    => ! empty( $_GET['saas_connected'] ),
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			'saasDisconnectedFlash' => ! empty( $_GET['saas_disconnected'] ),
		];
	}

	/**
	 * Identify the current RoutineKit sub-page for the React router.
	 *
	 * @return string
	 */
	private function get_current_page(): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page        = sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) );
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$workflow_id = isset( $_GET['workflow_id'] ) ? absint( $_GET['workflow_id'] ) : 0;

		if ( 'routinekit' === $page && $workflow_id ) {
			return 'step-builder';
		}

		$map = [
			'routinekit'          => 'workflows',
			'routinekit-settings' => 'settings',
			'routinekit-upgrade'  => 'upgrade',
			'routinekit-capture'  => 'capture',
		];
		return $map[ $page ] ?? 'workflows';
	}

	/**
	 * Determine whether the current admin page belongs to RoutineKit.
	 *
	 * @param string $hook
	 * @return bool
	 */
	/** Return capture exclude as a plain string, guarding against a mis-stored JSON array. */
	private function get_capture_exclude(): string {
		$val = get_option( 'routinekit_capture_exclude', 'session_tokens, transient_*, _site_transient_*' );
		if ( is_array( $val ) ) {
			return implode( ', ', $val );
		}
		$decoded = json_decode( $val, true );
		if ( is_array( $decoded ) ) {
			// Fix the stored value so it doesn't happen again.
			$fixed = implode( ', ', $decoded );
			update_option( 'routinekit_capture_exclude', $fixed );
			return $fixed;
		}
		return (string) $val;
	}

	/**
	 * Return a minimal list of active workflows for the capture watcher dropdown.
	 *
	 * @return array<array{id: int, title: string}>
	 */
	private function get_workflow_options(): array {
		$workflows = Routinekit_Workflow::all( 'active', 50, 0 );
		return array_map( fn( $w ) => [ 'id' => $w->id, 'title' => $w->title ], $workflows );
	}

	private function is_routinekit_page( string $hook ): bool {
		// Also match by page query var as a fallback in case page_hooks wasn't
		// populated (e.g. capability check failed during register_menus).
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) );
		if ( 0 === strpos( $page, 'routinekit' ) ) {
			return true;
		}
		return in_array( $hook, array_filter( $this->page_hooks ), true );
	}

	/**
	 * Output the React mount points for the capture toast and runner sidebar.
	 * Suppressed on RoutineKit's own admin pages to avoid UI overlap.
	 */
	public function render_capture_mounts(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) );
		if ( 0 === strpos( $page, 'routinekit' ) ) {
			return;
		}
		?>
		<div id="routinekit-runner-root"></div>
		<div id="routinekit-capture-root"></div>
		<?php
	}

	/**
	 * Remove third-party admin notices on RoutineKit pages so they don't
	 * break the React UI layout. Re-adds our own notices after clearing.
	 */
	public function suppress_third_party_notices(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) );
		if ( 0 !== strpos( $page, 'routinekit' ) ) {
			return;
		}
		remove_all_actions( 'admin_notices' );
		remove_all_actions( 'all_admin_notices' );

		// Re-add only our own notices
		$notices = new Routinekit_Notices();
		add_action( 'admin_notices', [ $notices, 'render' ] );
	}

	/**
	 * Enqueue an inline JS confirm() intercept on the plugin Delete link when the
	 * site is connected. Hooked onto admin_enqueue_scripts; only registers on
	 * plugins.php so the handle — and its inline script — are scoped to that page.
	 *
	 * @param string $hook Current admin page hook suffix.
	 */
	public function enqueue_delete_warning_script( string $hook ): void {
		if ( 'plugins.php' !== $hook || ! Routinekit_SaaS_Auth::is_connected() ) {
			return;
		}

		// Src-less handle: exists purely so wp_add_inline_script() has something to
		// attach to. WP_Scripts::do_item() skips the <script src> for an empty src
		// but still prints the attached inline code.
		wp_register_script( 'routinekit-delete-warning', '', [], ROUTINEKIT_VERSION, true );
		wp_enqueue_script( 'routinekit-delete-warning' );

		$message = __( "You're connected to RoutineKit Cloud.\n\nDisconnect first (Settings → Cloud) to free your license slot before deleting.\n\nDelete anyway without disconnecting?", 'routinekit' );
		$js      = sprintf(
			'(function(){var r=document.querySelector(\'tr[data-plugin="routinekit/routinekit.php"]\');if(!r)return;var d=r.querySelector(\'.delete a\');if(!d)return;d.addEventListener(\'click\',function(e){if(!confirm(%s))e.preventDefault();});})()',
			wp_json_encode( $message )
		);
		wp_add_inline_script( 'routinekit-delete-warning', $js );
	}

	/**
	 * Enqueue inline CSS that hides submenu links which should not be visible.
	 * Hooked onto admin_enqueue_scripts so the CSS goes through the proper WP
	 * enqueue API instead of being printed directly into <head>.
	 */
	public function enqueue_menu_css(): void {
		// Src-less handle: exists purely so wp_add_inline_style() has something to
		// attach to. WP_Styles::do_item() skips the <link> for an empty src but
		// still prints the attached inline CSS.
		wp_register_style( 'routinekit-menu-css', '', [], ROUTINEKIT_VERSION );
		wp_enqueue_style( 'routinekit-menu-css' );

		$css = '#adminmenu a[href="admin.php?page=routinekit-capture"]{display:none!important}';
		if ( routinekit_is_pro() ) {
			$css .= '#adminmenu a[href="admin.php?page=routinekit-upgrade"]{display:none!important}';
		}
		wp_add_inline_style( 'routinekit-menu-css', $css );
	}

	/** Page shell callbacks — React mounts into #routinekit-root */

	public function render_workflow_manager(): void {
		if ( ! current_user_can( 'routinekit_run' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'routinekit' ) );
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$workflow_id = isset( $_GET['workflow_id'] ) ? absint( $_GET['workflow_id'] ) : 0;
		if ( $workflow_id ) {
			require_once ROUTINEKIT_PLUGIN_DIR . 'admin/partials/step-builder.php';
		} else {
			require_once ROUTINEKIT_PLUGIN_DIR . 'admin/partials/workflow-manager.php';
		}
	}

	public function render_settings(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'routinekit' ) );
		}
		require_once ROUTINEKIT_PLUGIN_DIR . 'admin/partials/settings.php';
	}

	public function render_upgrade(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'routinekit' ) );
		}
		if ( routinekit_is_pro() ) {
			wp_safe_redirect( admin_url( 'admin.php?page=routinekit' ) );
			exit;
		}
		require_once ROUTINEKIT_PLUGIN_DIR . 'admin/partials/upgrade.php';
	}

	public function render_capture(): void {
		if ( ! current_user_can( 'routinekit_run' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'routinekit' ) );
		}
		require_once ROUTINEKIT_PLUGIN_DIR . 'admin/partials/capture.php';
	}
}
