<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin notices — workflow limit warnings and upgrade prompts.
 */
class AP_Notices {

	/**
	 * Render any queued admin notices.
	 */
	public function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Only show on Stepwise pages
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = sanitize_text_field( wp_unslash( $_GET['page'] ?? '' ) );
		if ( 0 !== strpos( $page, 'stepwise' ) ) {
			return;
		}

		if ( get_transient( 'stepwise_url_mismatch_notice' ) ) {
			delete_transient( 'stepwise_url_mismatch_notice' );
			$this->render_url_mismatch_notice();
		}
	}

	/**
	 * Show a one-time notice when the site was auto-disconnected due to a URL mismatch
	 * (i.e. this site was cloned or migrated from another site that was already connected).
	 */
	private function render_url_mismatch_notice(): void {
		$connect_url = esc_url( admin_url( 'admin.php?page=stepwise-settings' ) ) . '#cloud';
		?>
		<div class="notice notice-warning">
			<p>
				<?php
				printf(
					wp_kses(
						/* translators: 1: settings link */
						__( '<strong>Stepwise Cloud disconnected.</strong> This site\'s URL doesn\'t match the registered URL — it looks like this site was cloned or migrated (e.g. copied to a staging subdomain). Your Cloud connection has been cleared to prevent data from mixing with the original site. If this is a staging copy, you can leave it disconnected. If this is a new or migrated site, <a href="%s">reconnect with your license key →</a> (it will count as a separate site).', 'stepwise' ),
						[ 'strong' => [], 'a' => [ 'href' => [] ] ]
					),
					esc_url( $connect_url )
				);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Show the free-tier limit banner.
	 */
	private function render_limit_notice(): void {
		$upgrade_url = esc_url( admin_url( 'admin.php?page=stepwise-upgrade' ) );
		?>
		<div class="notice notice-warning">
			<p>
				<?php
				printf(
					wp_kses(
						/* translators: 1: workflow limit count, 2: URL of the upgrade page */
						__( 'You have reached the <strong>%1$d active workflow</strong> limit on the free plan. <a href="%2$s">Upgrade to Pro</a> for unlimited workflows.', 'stepwise' ),
						[ 'strong' => [], 'a' => [ 'href' => [] ] ]
					),
					absint( STEPWISE_FREE_WORKFLOW_LIMIT ),
					esc_url( $upgrade_url )
				);
				?>
			</p>
		</div>
		<?php
	}
}
