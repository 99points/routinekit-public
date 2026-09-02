<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin-post handlers for SaaS connection/disconnection forms.
 * These are form-submit targets (action=routinekit_saas_activate / _deactivate).
 */
class Routinekit_SaaS_Admin {

	/**
	 * Handle POST routinekit_saas_activate
	 */
	public function handle_activate(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Insufficient permissions.', 'routinekit' ) );
		}

		check_admin_referer( 'routinekit_saas_activate' );

		$key = sanitize_text_field( wp_unslash( $_POST['routinekit_api_key'] ?? '' ) );

		if ( empty( $key ) ) {
			$this->redirect_settings( 'saas_error', __( 'API key is required.', 'routinekit' ) );
			return;
		}

		$result = Routinekit_SaaS_Auth::connect( $key );

		if ( is_wp_error( $result ) ) {
			$this->redirect_settings( 'saas_error', $result->get_error_message() );
			return;
		}

		$this->redirect_settings( 'saas_connected', '1' );
	}

	/**
	 * Handle POST routinekit_saas_deactivate
	 */
	public function handle_deactivate(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Insufficient permissions.', 'routinekit' ) );
		}

		check_admin_referer( 'routinekit_saas_deactivate' );

		Routinekit_SaaS_Auth::disconnect();

		$this->redirect_settings( 'saas_disconnected', '1' );
	}

	/**
	 * @param string $key
	 * @param string $value
	 */
	private function redirect_settings( string $key, string $value ): void {
		wp_safe_redirect(
			add_query_arg(
				[ 'page' => 'routinekit-settings', $key => $value ],
				admin_url( 'admin.php' )
			) . '#cloud'
		);
		exit;
	}
}
