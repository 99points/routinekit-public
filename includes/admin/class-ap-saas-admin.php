<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin-post handlers for SaaS connection/disconnection forms.
 * These are form-submit targets (action=alignpress_saas_activate / _deactivate).
 */
class AP_SaaS_Admin {

	/**
	 * Handle POST alignpress_saas_activate
	 */
	public function handle_activate(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Insufficient permissions.', 'alignpress' ) );
		}

		check_admin_referer( 'alignpress_saas_activate' );

		$key = sanitize_text_field( wp_unslash( $_POST['alignpress_api_key'] ?? '' ) );

		if ( empty( $key ) ) {
			$this->redirect_settings( 'saas_error', urlencode( __( 'API key is required.', 'alignpress' ) ) );
			return;
		}

		$result = AP_SaaS_Auth::connect( $key );

		if ( is_wp_error( $result ) ) {
			$this->redirect_settings( 'saas_error', urlencode( $result->get_error_message() ) );
			return;
		}

		$this->redirect_settings( 'saas_connected', '1' );
	}

	/**
	 * Handle POST alignpress_saas_deactivate
	 */
	public function handle_deactivate(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Insufficient permissions.', 'alignpress' ) );
		}

		check_admin_referer( 'alignpress_saas_deactivate' );

		AP_SaaS_Auth::disconnect();

		$this->redirect_settings( 'saas_disconnected', '1' );
	}

	/**
	 * @param string $key
	 * @param string $value
	 */
	private function redirect_settings( string $key, string $value ): void {
		wp_safe_redirect(
			add_query_arg(
				[ 'page' => 'alignpress-settings', $key => $value ],
				admin_url( 'admin.php' )
			) . '#cloud'
		);
		exit;
	}
}
