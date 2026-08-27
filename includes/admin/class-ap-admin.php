<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin menu, page shells, and script/style enqueuing.
 */
class AP_Admin {

	/**
	 * Grant the stepwise_run pseudo-capability to any user whose WP role
	 * is in the stepwise_roles_run option. Hooked onto 'user_has_cap'.
	 *
	 * @param array $allcaps All caps the user has.
	 * @param array $caps    Required caps for the current check.
	 * @param array $args    Extra args (0 = cap name, 1 = user ID).
	 * @return array
	 */
	public function grant_stepwise_caps( array $allcaps, array $caps, array $args ): array {
		if ( in_array( 'stepwise_run', $caps, true ) && stepwise_current_user_can_run() ) {
			$allcaps['stepwise_run'] = true;
		}
		return $allcaps;
	}

	/**
	 * Register top-level menu and all subpages.
	 * Main menu + Workflows use the custom stepwise_run cap so that
	 * non-admin runners can access the page. Settings/Upgrade stay manage_options.
	 */
	/**
	 * Add "Workflows" and "Upgrade to Pro" links on the Plugins list page.
	 */
	public function plugin_action_links( array $links ): array {
		$custom = [
			'workflows' => sprintf(
				'<a href="%s">%s</a>',
				esc_url( admin_url( 'admin.php?page=stepwise' ) ),
				esc_html__( 'Workflows', 'stepwise' )
			),
		];

		if ( ! stepwise_is_pro() ) {
			$custom['upgrade'] = sprintf(
				'<a href="%s" style="color:#d63638;font-weight:600;">%s</a>',
				esc_url( admin_url( 'admin.php?page=stepwise-upgrade' ) ),
				esc_html__( 'Upgrade to Pro', 'stepwise' )
			);
		}

		return array_merge( $custom, $links );
	}

	public function register_menus(): void {
		add_menu_page(
			__( 'Stepwise', 'stepwise' ),
			__( 'Stepwise', 'stepwise' ),
			'stepwise_run',
			'stepwise',
			[ $this, 'render_workflow_manager' ],
			'data:image/svg+xml;base64,' . base64_encode( '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="5" y="10" width="19" height="6.5" rx="2" fill="#a7aaad" opacity=".5"/><rect x="5" y="20.75" width="19" height="6.5" rx="2" fill="#a7aaad" opacity=".5"/><rect x="5" y="31.5" width="19" height="6.5" rx="2" fill="#a7aaad" opacity=".5"/><path d="M26 27 32 33 43 13" stroke="#a7aaad" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' ),
			30
		);

		add_submenu_page(
			'stepwise',
			__( 'Workflows', 'stepwise' ),
			__( 'Workflows', 'stepwise' ),
			'stepwise_run',
			'stepwise',
			[ $this, 'render_workflow_manager' ]
		);

		add_submenu_page(
			'stepwise',
			__( 'Settings', 'stepwise' ),
			__( 'Settings', 'stepwise' ),
			'manage_options',
			'stepwise-settings',
			[ $this, 'render_settings' ]
		);

		// Capture page — child of stepwise so the menu stays open; hidden via CSS not remove_submenu_page
		add_submenu_page(
			'stepwise',
			__( 'Captured Steps', 'stepwise' ),
			__( 'Captured Steps', 'stepwise' ),
			'stepwise_run',
			'stepwise-capture',
			[ $this, 'render_capture' ]
		);

		// Always register the upgrade page so direct URL visits don't hit WP's
		// "not allowed" wall. render_upgrade() redirects Pro users to the main page.
		add_submenu_page(
			'stepwise',
			__( 'Upgrade to Pro', 'stepwise' ),
			__( 'Upgrade to Pro', 'stepwise' ),
			'manage_options',
			'stepwise-upgrade',
			[ $this, 'render_upgrade' ]
		);
	}

	/**
	 * Return a cache-busting version string for a plugin asset file.
	 * Uses the file's last-modified timestamp so any change on disk
	 * immediately invalidates the browser cache without a plugin version bump.
	 *
	 * @param string $relative_path Path relative to STEPWISE_PLUGIN_DIR.
	 * @return string
	 */
	private function asset_version( string $relative_path ): string {
		$abs = STEPWISE_PLUGIN_DIR . $relative_path;
		return file_exists( $abs ) ? (string) filemtime( $abs ) : STEPWISE_VERSION;
	}

	/**
	 * Register the shared webpack runtime chunk. Must fire before either
	 * entry point is enqueued so both entries resolve chunks correctly.
	 */
	private function register_runtime(): void {
		if ( wp_script_is( 'stepwise-runtime', 'registered' ) ) {
			return;
		}
		$runtime_asset = STEPWISE_PLUGIN_DIR . 'assets/js/runtime.asset.php';
		$runtime       = file_exists( $runtime_asset ) ? require $runtime_asset : [ 'dependencies' => [], 'version' => null ];

		wp_register_script(
			'stepwise-runtime',
			STEPWISE_PLUGIN_URL . 'assets/js/runtime.js',
			$runtime['dependencies'],
			$runtime['version'] ?? $this->asset_version( 'assets/js/runtime.js' ),
			true
		);
	}

	/**
	 * Enqueue JS bundles on Stepwise admin pages.
	 *
	 * @param string $hook
	 */
	public function enqueue_scripts( string $hook ): void {
		if ( ! $this->is_stepwise_page( $hook ) ) {
			return;
		}

		$this->register_runtime();

		$asset_file = STEPWISE_PLUGIN_DIR . 'assets/js/stepwise-admin.asset.php';
		$deps       = file_exists( $asset_file ) ? require $asset_file : [ 'dependencies' => [], 'version' => null ];

		wp_enqueue_script(
			'stepwise-admin',
			STEPWISE_PLUGIN_URL . 'assets/js/stepwise-admin.js',
			array_merge( [ 'stepwise-runtime' ], $deps['dependencies'], [ 'wp-api-fetch', 'wp-data', 'wp-element', 'wp-i18n' ] ),
			$deps['version'] ?? $this->asset_version( 'assets/js/stepwise-admin.js' ),
			true
		);

		wp_localize_script( 'stepwise-admin', 'stepwiseData', array_merge(
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
		$capture_asset = STEPWISE_PLUGIN_DIR . 'assets/js/stepwise-capture.asset.php';
		$capture_deps  = file_exists( $capture_asset ) ? require $capture_asset : [ 'dependencies' => [], 'version' => null ];

		wp_enqueue_script(
			'stepwise-capture',
			STEPWISE_PLUGIN_URL . 'assets/js/stepwise-capture.js',
			array_merge( [ 'stepwise-runtime' ], $capture_deps['dependencies'] ),
			$capture_deps['version'] ?? $this->asset_version( 'assets/js/stepwise-capture.js' ),
			true
		);

		wp_localize_script( 'stepwise-capture', 'stepwiseData', $this->get_js_data() );

		// Capture watcher — floating "⊕ Capture Step" button on all admin pages.
		if ( (bool) get_option( 'stepwise_capture_enabled', true ) && current_user_can( 'manage_options' ) ) {
			wp_enqueue_script(
				'stepwise-html2canvas',
				STEPWISE_PLUGIN_URL . 'assets/js/html2canvas.min.js',
				[],
				'1.4.1',
				true
			);
			wp_enqueue_script(
				'stepwise-capture-watcher',
				STEPWISE_PLUGIN_URL . 'assets/js/capture-watcher.js',
				[ 'stepwise-html2canvas' ],
				$this->asset_version( 'assets/js/capture-watcher.js' ),
				true
			);

			// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- composed from trusted server vars, not user input
			$page_url = esc_url_raw( ( is_ssl() ? 'https' : 'http' ) . '://' . ( $_SERVER['HTTP_HOST'] ?? '' ) . ( $_SERVER['REQUEST_URI'] ?? '' ) );

			wp_localize_script( 'stepwise-capture-watcher', 'stepwiseCapture', [
				'restUrl'   => rest_url( STEPWISE_REST_NAMESPACE . '/' ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'pageUrl'   => $page_url,
				'pageTitle' => esc_html( get_admin_page_title() ?: '' ),
				'workflows' => $this->get_workflow_options(),
			] );
		}

		if ( file_exists( STEPWISE_PLUGIN_DIR . 'assets/css/stepwise.css' ) ) {
			wp_enqueue_style(
				'stepwise',
				STEPWISE_PLUGIN_URL . 'assets/css/stepwise.css',
				[],
				$this->asset_version( 'assets/css/stepwise.css' )
			);
		}

		if ( file_exists( STEPWISE_PLUGIN_DIR . 'admin/css/stepwise-admin.css' ) ) {
			wp_enqueue_style(
				'stepwise-admin',
				STEPWISE_PLUGIN_URL . 'admin/css/stepwise-admin.css',
				[],
				$this->asset_version( 'admin/css/stepwise-admin.css' )
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
			'restUrl'     => rest_url( STEPWISE_REST_NAMESPACE . '/' ),
			'isPro'        => stepwise_is_pro(),
			'licensePlan'  => get_option( 'stepwise_license_plan', 'free' ),
			'isConnected'  => AP_SaaS_Auth::is_connected(),
			'saasPlan'     => get_option( 'stepwise_license_plan', 'free' ),
			'version'     => STEPWISE_VERSION,
			// Current user's resolved permissions — computed server-side so JS
			// doesn't need to re-implement role logic.
			'canRun'       => stepwise_current_user_can_run(),
			'canEdit'      => stepwise_current_user_can_edit(),
			'currentUserId' => get_current_user_id(),
			'workflowLimit' => 0, // No workflow limit on any plan.
			'atLimit'     => false,
			'currentPage' => $this->get_current_page(),
			'workflowId'  => $workflow_id ?: null,
			'adminUrl'    => admin_url(),
			'upgradeUrl'  => stepwise_is_pro() ? null : admin_url( 'admin.php?page=stepwise-upgrade' ),

			// Auto-Capture
			'captureEnabled'    => (bool) get_option( 'stepwise_capture_enabled', true ),
			'captureScope'      => get_option( 'stepwise_capture_scope', 'all_changes' ),
			'captureExclude'    => $this->get_capture_exclude(),
			'captureRetention'  => (int) get_option( 'stepwise_capture_retention', 30 ),
			'captureMinChanges' => (int) get_option( 'stepwise_capture_min_changes', 1 ),

			// Toast & Runner
			'toastEnabled'      => (bool) get_option( 'stepwise_toast_enabled', true ),
			'captureAutodismiss' => (int) get_option( 'stepwise_toast_autodismiss', 0 ),
			'launcherEnabled'   => (bool) get_option( 'stepwise_launcher_enabled', true ),
			'runnerPosition'    => get_option( 'stepwise_runner_position', 'right' ),

			// Playbook defaults
			'defaultStatus'   => get_option( 'stepwise_default_status', 'active' ),
			'defaultCategory' => get_option( 'stepwise_default_category', '' ),
			'showRunButton'   => (bool) get_option( 'stepwise_show_run_button', true ),

			// Team & Access
			'rolesView' => get_option( 'stepwise_roles_view', [ 'administrator' ] ),
			'rolesRun'  => get_option( 'stepwise_roles_run',  [ 'administrator' ] ),
			'rolesEdit' => get_option( 'stepwise_roles_edit', [ 'administrator' ] ),

			// Email notifications (toggles — safe on all pages)
			'notifyAssigned'  => (bool) get_option( 'stepwise_notify_assigned', true ),
			'notifyCompleted' => (bool) get_option( 'stepwise_notify_completed', true ),
			'notifySkipped'   => (bool) get_option( 'stepwise_notify_skipped', false ),

			// Cloud / SaaS
			'saasUrl'              => rtrim( get_option( 'stepwise_saas_url', STEPWISE_SAAS_DEFAULT_URL ), '/' ),
			'saasConnected'        => AP_SaaS_Auth::is_connected(),
			'stagingMode'          => (bool) get_option( 'stepwise_staging_mode', false ),
			'stagingAutoDetected'  => stepwise_is_staging_env(),
			'lastSync'      => get_option( 'stepwise_last_sync', '' ),
			'deeplinks'     => ( new AP_Deeplinks() )->get_library( true ),
		];
	}

	/**
	 * Extra JS data that is only needed on the Stepwise Settings page.
	 * Kept separate so sensitive values (email address, SaaS nonces) are not
	 * broadcast to every admin page via the capture bundle.
	 *
	 * @return array
	 */
	private function get_settings_js_data(): array {
		return [
			'notifyEmail'         => get_option( 'stepwise_notify_email', '' ),
			'saasActivateNonce'   => wp_create_nonce( 'stepwise_saas_activate' ),
			'saasDeactivateNonce' => wp_create_nonce( 'stepwise_saas_deactivate' ),
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			'saasError'           => sanitize_text_field( wp_unslash( $_GET['saas_error'] ?? '' ) ),
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			'saasConnectedFlash'    => ! empty( $_GET['saas_connected'] ),
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended
			'saasDisconnectedFlash' => ! empty( $_GET['saas_disconnected'] ),
		];
	}

	/**
	 * Identify the current Stepwise sub-page for the React router.
	 *
	 * @return string
	 */
	private function get_current_page(): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page        = sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) );
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$workflow_id = isset( $_GET['workflow_id'] ) ? absint( $_GET['workflow_id'] ) : 0;

		if ( 'stepwise' === $page && $workflow_id ) {
			return 'step-builder';
		}

		$map = [
			'stepwise'          => 'workflows',
			'stepwise-settings' => 'settings',
			'stepwise-upgrade'  => 'upgrade',
			'stepwise-capture'  => 'capture',
		];
		return $map[ $page ] ?? 'workflows';
	}

	/**
	 * Determine whether the current admin page belongs to Stepwise.
	 *
	 * @param string $hook
	 * @return bool
	 */
	/** Return capture exclude as a plain string, guarding against a mis-stored JSON array. */
	private function get_capture_exclude(): string {
		$val = get_option( 'stepwise_capture_exclude', 'session_tokens, transient_*, _site_transient_*' );
		if ( is_array( $val ) ) {
			return implode( ', ', $val );
		}
		$decoded = json_decode( $val, true );
		if ( is_array( $decoded ) ) {
			// Fix the stored value so it doesn't happen again.
			$fixed = implode( ', ', $decoded );
			update_option( 'stepwise_capture_exclude', $fixed );
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
		$workflows = AP_Workflow::all( 'active', 50, 0 );
		return array_map( fn( $w ) => [ 'id' => $w->id, 'title' => $w->title ], $workflows );
	}

	private function is_stepwise_page( string $hook ): bool {
		$stepwise_hooks = [
			'toplevel_page_stepwise',
			'stepwise_page_stepwise-settings',
			'stepwise_page_stepwise-upgrade',
			'stepwise_page_stepwise-capture',
		];
		return in_array( $hook, $stepwise_hooks, true );
	}

	/**
	 * Output the React mount points for the capture toast and runner sidebar.
	 * Suppressed on Stepwise's own admin pages to avoid UI overlap.
	 */
	public function render_capture_mounts(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) );
		if ( str_starts_with( $page, 'stepwise' ) ) {
			return;
		}
		?>
		<div id="stepwise-runner-root"></div>
		<div id="stepwise-capture-root"></div>
		<?php
	}

	/**
	 * Remove third-party admin notices on Stepwise pages so they don't
	 * break the React UI layout. Re-adds our own notices after clearing.
	 */
	public function suppress_third_party_notices(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) );
		if ( 0 !== strpos( $page, 'stepwise' ) ) {
			return;
		}
		remove_all_actions( 'admin_notices' );
		remove_all_actions( 'all_admin_notices' );

		// Re-add only our own notices
		$notices = new AP_Notices();
		add_action( 'admin_notices', [ $notices, 'render' ] );
	}

	/**
	 * Output a JS confirm() intercept on the plugin Delete link when the site is connected.
	 * Runs only on plugins.php via the admin_footer-plugins.php hook.
	 */
	public function render_delete_warning_script(): void {
		if ( ! AP_SaaS_Auth::is_connected() ) {
			return;
		}
		$message = __( "You're connected to Stepwise Cloud.\n\nDisconnect first (Settings → Cloud) to free your license slot before deleting.\n\nDelete anyway without disconnecting?", 'stepwise' );
		?>
		<script>
		(function () {
			var row = document.querySelector('tr[data-plugin="stepwise/stepwise.php"]');
			if (!row) return;
			var deleteLink = row.querySelector('.delete a');
			if (!deleteLink) return;
			deleteLink.addEventListener('click', function (e) {
				if (!confirm(<?php echo wp_json_encode( $message ); ?>)) {
					e.preventDefault();
				}
			});
		})();
		</script>
		<?php
	}

	/** Output inline CSS to hide submenu links that should not be visible */
	public function hide_capture_submenu(): void {
		$css = '#adminmenu a[href="admin.php?page=stepwise-capture"]{display:none!important}';
		if ( stepwise_is_pro() ) {
			$css .= '#adminmenu a[href="admin.php?page=stepwise-upgrade"]{display:none!important}';
		}
		printf( '<style>%s</style>', wp_strip_all_tags( $css ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CSS is statically generated from plugin constants, no user input
	}

	/** Page shell callbacks — React mounts into #stepwise-root */

	public function render_workflow_manager(): void {
		if ( ! current_user_can( 'stepwise_run' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'stepwise' ) );
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$workflow_id = isset( $_GET['workflow_id'] ) ? absint( $_GET['workflow_id'] ) : 0;
		if ( $workflow_id ) {
			require_once STEPWISE_PLUGIN_DIR . 'admin/partials/step-builder.php';
		} else {
			require_once STEPWISE_PLUGIN_DIR . 'admin/partials/workflow-manager.php';
		}
	}

	public function render_settings(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'stepwise' ) );
		}
		require_once STEPWISE_PLUGIN_DIR . 'admin/partials/settings.php';
	}

	public function render_upgrade(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'stepwise' ) );
		}
		if ( stepwise_is_pro() ) {
			wp_safe_redirect( admin_url( 'admin.php?page=stepwise' ) );
			exit;
		}
		require_once STEPWISE_PLUGIN_DIR . 'admin/partials/upgrade.php';
	}

	public function render_capture(): void {
		if ( ! current_user_can( 'stepwise_run' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'stepwise' ) );
		}
		require_once STEPWISE_PLUGIN_DIR . 'admin/partials/capture.php';
	}
}
