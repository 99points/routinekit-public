<?php
defined( 'ABSPATH' ) || exit;

/**
 * Deep-link library and URL resolver.
 *
 * Provides a curated list of admin deep-links and resolves URL templates
 * to full admin URLs for the Runner sidebar.
 */
class Stepwise_Deeplinks {

	/**
	 * Curated library of admin deep-links.
	 * Format: 'key' => [ label, url, plugin, plugin_file ]
	 * plugin_file is used to filter out links for inactive plugins.
	 *
	 * @var array[]
	 */
	private array $library = [
		// WordPress Core — always available
		'wp_general'         => [ 'label' => 'General Settings',         'url' => 'options-general.php',                             'plugin' => 'core', 'plugin_file' => null ],
		'wp_writing'         => [ 'label' => 'Writing Settings',          'url' => 'options-writing.php',                             'plugin' => 'core', 'plugin_file' => null ],
		'wp_reading'         => [ 'label' => 'Reading Settings',          'url' => 'options-reading.php',                             'plugin' => 'core', 'plugin_file' => null ],
		'wp_discussion'      => [ 'label' => 'Discussion Settings',       'url' => 'options-discussion.php',                          'plugin' => 'core', 'plugin_file' => null ],
		'wp_media'           => [ 'label' => 'Media Settings',            'url' => 'options-media.php',                               'plugin' => 'core', 'plugin_file' => null ],
		'wp_permalink'       => [ 'label' => 'Permalink Settings',        'url' => 'options-permalink.php',                           'plugin' => 'core', 'plugin_file' => null ],
		'wp_privacy'         => [ 'label' => 'Privacy Settings',          'url' => 'options-privacy.php',                             'plugin' => 'core', 'plugin_file' => null ],
		'wp_users'           => [ 'label' => 'Users',                     'url' => 'users.php',                                       'plugin' => 'core', 'plugin_file' => null ],
		'wp_plugins'         => [ 'label' => 'Plugins',                   'url' => 'plugins.php',                                     'plugin' => 'core', 'plugin_file' => null ],
		// WooCommerce
		'wc_general'         => [ 'label' => 'WooCommerce — General',     'url' => 'admin.php?page=wc-settings',                      'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php' ],
		'wc_products'        => [ 'label' => 'WooCommerce — Products',    'url' => 'admin.php?page=wc-settings&tab=products',          'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php' ],
		'wc_tax'             => [ 'label' => 'WooCommerce — Tax',         'url' => 'admin.php?page=wc-settings&tab=tax',               'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php' ],
		'wc_shipping'        => [ 'label' => 'WooCommerce — Shipping',    'url' => 'admin.php?page=wc-settings&tab=shipping',          'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php' ],
		'wc_payments'        => [ 'label' => 'WooCommerce — Payments',    'url' => 'admin.php?page=wc-settings&tab=checkout',          'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php' ],
		'wc_email'           => [ 'label' => 'WooCommerce — Emails',      'url' => 'admin.php?page=wc-settings&tab=email',             'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php' ],
		'wc_advanced'        => [ 'label' => 'WooCommerce — Advanced',    'url' => 'admin.php?page=wc-settings&tab=advanced',          'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php' ],
		// Contact Form 7
		'cf7_forms'          => [ 'label' => 'CF7 — All Forms',           'url' => 'admin.php?page=wpcf7',                             'plugin' => 'contact-form-7', 'plugin_file' => 'contact-form-7/wp-contact-form-7.php' ],
		'cf7_settings'       => [ 'label' => 'CF7 — Settings',            'url' => 'admin.php?page=wpcf7-integration',                 'plugin' => 'contact-form-7', 'plugin_file' => 'contact-form-7/wp-contact-form-7.php' ],
		// Yoast SEO
		'yoast_general'      => [ 'label' => 'Yoast — General',           'url' => 'admin.php?page=wpseo_dashboard',                   'plugin' => 'yoast-seo', 'plugin_file' => 'wordpress-seo/wp-seo.php' ],
		'yoast_search'       => [ 'label' => 'Yoast — Search Appearance', 'url' => 'admin.php?page=wpseo_titles',                      'plugin' => 'yoast-seo', 'plugin_file' => 'wordpress-seo/wp-seo.php' ],
		'yoast_social'       => [ 'label' => 'Yoast — Social',            'url' => 'admin.php?page=wpseo_social',                      'plugin' => 'yoast-seo', 'plugin_file' => 'wordpress-seo/wp-seo.php' ],
		// WPForms
		'wpforms_settings'   => [ 'label' => 'WPForms — Settings',        'url' => 'admin.php?page=wpforms-settings',                  'plugin' => 'wpforms', 'plugin_file' => 'wpforms-lite/wpforms.php' ],
		'wpforms_forms'      => [ 'label' => 'WPForms — All Forms',       'url' => 'admin.php?page=wpforms-overview',                  'plugin' => 'wpforms', 'plugin_file' => 'wpforms-lite/wpforms.php' ],
		// WP Mail SMTP
		'smtp_settings'      => [ 'label' => 'WP Mail SMTP — Settings',   'url' => 'admin.php?page=wp-mail-smtp',                      'plugin' => 'wp-mail-smtp', 'plugin_file' => 'wp-mail-smtp/wp_mail_smtp.php' ],
		// Rank Math
		'rankmath_general'   => [ 'label' => 'Rank Math — General',       'url' => 'admin.php?page=rank-math',                         'plugin' => 'rank-math', 'plugin_file' => 'seo-by-rank-math/rank-math.php' ],
		// Wordfence
		'wordfence_settings' => [ 'label' => 'Wordfence — Settings',      'url' => 'admin.php?page=WordfenceOptions',                  'plugin' => 'wordfence', 'plugin_file' => 'wordfence/wordfence.php' ],
		// UpdraftPlus
		'updraft_settings'   => [ 'label' => 'UpdraftPlus — Settings',    'url' => 'options-general.php?page=updraftplus',             'plugin' => 'updraftplus', 'plugin_file' => 'updraftplus/updraftplus.php' ],
	];

	/**
	 * Get the full deep-link library, filtered to active plugins.
	 *
	 * @param bool $active_only
	 * @return array[]
	 */
	public function get_library( bool $active_only = true ): array {
		$library = apply_filters( 'stepwise_deeplink_library', $this->library );

		if ( ! $active_only ) {
			return $library;
		}

		return array_filter(
			$library,
			fn( $item ) => 'core' === $item['plugin'] || $this->plugin_is_active( $item['plugin_file'] )
		);
	}

	/**
	 * Resolve a URL template, replacing dynamic tokens with real values,
	 * then return the full admin URL.
	 *
	 * @param string $url_template
	 * @return string
	 */
	public function resolve( string $url_template ): string {
		$tokens = [
			'{site_url}'    => get_site_url(),
			'{admin_url}'   => admin_url(),
			'{admin_email}' => get_option( 'admin_email' ),
		];

		$url = str_replace( array_keys( $tokens ), array_values( $tokens ), $url_template );
		return admin_url( $url );
	}

	/**
	 * Check whether a plugin is currently active.
	 *
	 * @param string|null $plugin_file  e.g. 'woocommerce/woocommerce.php'
	 * @return bool
	 */
	public function plugin_is_active( ?string $plugin_file ): bool {
		if ( null === $plugin_file ) {
			return false;
		}
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		return is_plugin_active( $plugin_file );
	}
}
