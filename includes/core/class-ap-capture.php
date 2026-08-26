<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * Auto-capture engine.
 *
 * Detects meaningful wp_options changes during settings form submissions
 * and buffers them so the user can add them to a workflow.
 */
class AP_Capture {

	/**
	 * Substrings that, if present in an option name, mean it should be ignored.
	 *
	 * @var string[]
	 */
	private array $noise_patterns = [
		'_transient_',
		'_site_transient_',
		'cron',
		'session_tokens',
		'rewrite_rules',
		'widget_',
		'sidebars_widgets',
		'recently_activated',
		'auto_updater',
		'wp_user_roles',
		'recovery_mode',
		'_wc_session_',
		'woocommerce_queue_flush_rewrite_rules',
		'wc_notices',
		'elementor_log_',
		'elementor_remote_info_',
		'_cache_',
		'_queue_',
		'_lock_',
		'heartbeat',
	];

	/**
	 * Exact option names to always ignore.
	 *
	 * @var string[]
	 */
	private array $noise_exact = [
		'active_plugins',
		'auth_key',
		'secure_auth_key',
		'logged_in_key',
		'nonce_key',
		'db_version',
		'initial_db_version',
	];

	/**
	 * Human-readable labels for well-known option keys.
	 *
	 * @var array<string,string>
	 */
	private array $option_labels = [
		// WordPress Core
		'blogname'                        => 'Site Title',
		'blogdescription'                 => 'Tagline',
		'admin_email'                     => 'Admin Email Address',
		'siteurl'                         => 'WordPress Address (URL)',
		'home'                            => 'Site Address (URL)',
		'default_role'                    => 'Default User Role',
		'timezone_string'                 => 'Timezone',
		'date_format'                     => 'Date Format',
		'time_format'                     => 'Time Format',
		'posts_per_page'                  => 'Blog Posts Per Page',
		'default_comment_status'          => 'Default Comment Status',
		// WooCommerce
		'woocommerce_store_address'       => 'WooCommerce — Store Address',
		'woocommerce_store_city'          => 'WooCommerce — Store City',
		'woocommerce_default_country'     => 'WooCommerce — Store Country',
		'woocommerce_currency'            => 'WooCommerce — Currency',
		'woocommerce_price_thousand_sep'  => 'WooCommerce — Thousand Separator',
		'woocommerce_tax_based_on'        => 'WooCommerce — Tax Based On',
		'woocommerce_calc_taxes'          => 'WooCommerce — Enable Taxes',
		'woocommerce_email_from_name'     => 'WooCommerce — Email From Name',
		'woocommerce_email_from_address'  => 'WooCommerce — Email From Address',
		// Contact Form 7
		'wpcf7'                           => 'Contact Form 7 — Settings',
		// Yoast SEO
		'wpseo'                           => 'Yoast SEO — General Settings',
		'wpseo_titles'                    => 'Yoast SEO — Title Settings',
		'wpseo_social'                    => 'Yoast SEO — Social Settings',
	];

	/** @var bool Whether this request qualifies for capture. */
	private bool $capture_active = false;

	/** @var array[] Changes detected during this request. */
	private array $session_buffer = [];

	/**
	 * Delete capture buffer rows older than the configured retention period.
	 * Hooked onto the alignpress_cleanup_capture_buffer cron event.
	 */
	public function cleanup_buffer(): void {
		global $wpdb;
		$days = (int) get_option( 'alignpress_capture_retention', 7 );
		if ( $days < 1 ) {
			return;
		}
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}alignpress_capture_buffer
				 WHERE captured_at < DATE_SUB( NOW(), INTERVAL %d DAY )",
				$days
			)
		);
	}

	/**
	 * Register hooks. Called via admin_init.
	 */
	public function init(): void {
		if ( ! get_option( 'alignpress_capture_enabled', true ) ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Determine capture eligibility immediately — options are saved before
		// admin_init fires, so we must decide here rather than in a callback.
		$this->maybe_start_capture();

		if ( $this->capture_active ) {
			add_action( 'updated_option', [ $this, 'handle_option_update' ], 10, 3 );
			add_action( 'added_option',   [ $this, 'handle_option_add' ],    10, 2 );
			add_action( 'shutdown',       [ $this, 'flush_buffer' ] );
		}
	}

	/**
	 * Activate capture only on genuine settings form submissions (POST).
	 */
	public function maybe_start_capture(): void {
		if ( ! isset( $_SERVER['REQUEST_METHOD'] ) || 'POST' !== $_SERVER['REQUEST_METHOD'] ) {
			return;
		}

		$page   = sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) );  // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only, used only to decide capture eligibility
		$action = sanitize_text_field( wp_unslash( $_POST['action'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- observing third-party form submissions; nonce belongs to the submitting form

		$is_settings_submission = (
			isset( $_POST['option_page'] ) || // phpcs:ignore WordPress.Security.NonceVerification.Missing -- same as above
			false !== strpos( $page, 'settings' ) ||
			'update' === $action
		);

		if ( $is_settings_submission ) {
			$this->capture_active = true;
		}
	}

	/**
	 * Handle the updated_option action.
	 *
	 * @param string $option
	 * @param mixed  $old_value
	 * @param mixed  $new_value
	 */
	public function handle_option_update( string $option, $old_value, $new_value ): void {
		if ( ! $this->capture_active ) {
			return;
		}
		if ( $this->is_noise( $option ) ) {
			return;
		}
		// phpcs:ignore WordPress.PHP.StrictComparisons.LooseComparison
		if ( $old_value == $new_value ) {
			return;
		}

		// Use the HTTP referer as page_url so the deep link points to the settings page
		// the user was on, not the form handler (options.php) that processed the POST.
		$page_url = '';
		if ( ! empty( $_SERVER['HTTP_REFERER'] ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- sanitized below
			$page_url = esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) );
		} elseif ( ! empty( $_SERVER['REQUEST_URI'] ) ) {
			$page_url = esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) );
		}

		$this->session_buffer[] = [
			'option_name'  => $option,
			'option_label' => $this->get_option_label( $option ),
			'old_value'    => maybe_serialize( $old_value ),
			'new_value'    => maybe_serialize( $new_value ),
			'page_url'     => $page_url,
			'captured_by'  => get_current_user_id(),
		];
	}

	/**
	 * Handle the added_option action (new options set for the first time).
	 *
	 * @param string $option
	 * @param mixed  $value
	 */
	public function handle_option_add( string $option, $value ): void {
		if ( ! $this->capture_active ) {
			return;
		}
		if ( $this->is_noise( $option ) ) {
			return;
		}
		$this->handle_option_update( $option, null, $value );
	}

	/**
	 * Flush the session buffer to the DB at the end of the request.
	 */
	public function flush_buffer(): void {
		if ( empty( $this->session_buffer ) ) {
			return;
		}

		$min = (int) get_option( 'alignpress_capture_min_changes', 1 );
		if ( count( $this->session_buffer ) < $min ) {
			return;
		}

		global $wpdb;
		$table = $wpdb->prefix . 'alignpress_capture_buffer';

		foreach ( $this->session_buffer as $change ) {
			$wpdb->insert(
				$table,
				[
					'option_name'  => sanitize_key( $change['option_name'] ),
					'option_label' => sanitize_text_field( $change['option_label'] ),
					'old_value'    => $change['old_value'],
					'new_value'    => $change['new_value'],
					'page_url'     => $change['page_url'],
					'captured_by'  => (int) $change['captured_by'],
					'status'       => 'pending',
				],
				[ '%s', '%s', '%s', '%s', '%s', '%d', '%s' ]
			);
		}

		// Signal the React capture toast via a short-lived transient
		set_transient(
			'alignpress_pending_captures_' . get_current_user_id(),
			count( $this->session_buffer ),
			300
		);
	}

	/**
	 * Decide whether an option name is noise and should be skipped.
	 *
	 * @param string $option
	 * @return bool
	 */
	private function is_noise( string $option ): bool {
		if ( in_array( $option, $this->noise_exact, true ) ) {
			return true;
		}
		foreach ( $this->noise_patterns as $pattern ) {
			if ( false !== strpos( $option, $pattern ) ) {
				return true;
			}
		}
		$raw = get_option( 'alignpress_capture_exclude', '' );
		if ( is_array( $raw ) ) {
			$exclusions = $raw;
		} else {
			$decoded    = json_decode( $raw, true );
			$exclusions = is_array( $decoded )
				? $decoded
				: array_filter( array_map( 'trim', explode( ',', (string) $raw ) ) );
		}
		foreach ( $exclusions as $pattern ) {
			if ( '' === $pattern ) {
				continue;
			}
			if ( str_contains( $pattern, '*' ) ) {
				if ( fnmatch( $pattern, $option ) ) {
					return true;
				}
			} elseif ( $option === $pattern ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Return a human-readable label for an option name.
	 * Falls back to converting snake_case to Title Case.
	 *
	 * @param string $option_name
	 * @return string
	 */
	public function get_option_label( string $option_name ): string {
		if ( isset( $this->option_labels[ $option_name ] ) ) {
			return $this->option_labels[ $option_name ];
		}
		return ucwords( str_replace( [ '_', '-' ], ' ', $option_name ) );
	}
}
