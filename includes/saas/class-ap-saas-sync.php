<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- custom plugin tables; WP object cache not applicable
defined( 'ABSPATH' ) || exit;

/**
 * Pulls SaaS workflow assignments and pushes completions back.
 */
class AP_SaaS_Sync {

	public function init(): void {
		add_action( 'stepwise_execution_completed', [ $this, 'push_completion' ] );
		add_action( 'admin_init',                     [ $this, 'maybe_pull_assignments' ] );
		add_action( 'stepwise_saas_heartbeat',      [ $this, 'send_heartbeat' ] );
	}

	/**
	 * Pull SaaS assignments on admin_init, cached for 15 minutes.
	 */
	public function maybe_pull_assignments(): void {
		if ( ! AP_SaaS_Auth::is_connected() ) {
			return;
		}

		// Local URL mismatch check — catches clones before the hourly heartbeat fires.
		// If staging mode is also set (inherited from a cloned production site), this
		// still runs and disconnects, preventing the clone from silently using live credentials.
		$registered_url = get_option( 'stepwise_registered_site_url', '' );
		if ( $registered_url && rtrim( get_site_url(), '/' ) !== rtrim( $registered_url, '/' ) ) {
			AP_SaaS_Auth::disconnect();
			set_transient( 'stepwise_url_mismatch_notice', 1, HOUR_IN_SECONDS );
			stepwise_log( 'Disconnected: local URL mismatch detected on admin_init — site was cloned or migrated.', 'saas' );
			return;
		}

		// Staging mode: don't pull assignments so live data isn't polluted.
		if ( stepwise_staging_mode_active() ) {
			return;
		}

		$cache_key = 'stepwise_assignments_check';
		if ( get_transient( $cache_key ) ) {
			return;
		}

		set_transient( $cache_key, true, 15 * MINUTE_IN_SECONDS );

		$client = new AP_SaaS_Client();
		$result = $client->get_assignments();

		if ( is_wp_error( $result ) || empty( $result['assignments'] ) ) {
			return;
		}

		foreach ( $result['assignments'] as $assignment ) {
			$this->handle_assignment( $assignment );
		}
	}

	/**
	 * Import or update a SaaS assignment as a local workflow + execution.
	 *
	 * @param array $assignment
	 */
	private function handle_assignment( array $assignment ): void {
		global $wpdb;

		$saas_workflow_id = (int) $assignment['workflow_id'];
		$assignment_id    = (int) $assignment['assignment_id'];
		$version          = (int) $assignment['version'];
		$steps            = $assignment['steps'] ?? [];
		$category         = sanitize_text_field( $assignment['category'] ?? '' );

		// Check if we already have this workflow locally (saas_id stores "saas:{workflow_id}")
		$saas_key    = "saas:{$saas_workflow_id}";
		$existing_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$wpdb->prefix}stepwise_workflows WHERE saas_id = %s LIMIT 1",
				$saas_key
			)
		);

		if ( ! $existing_id ) {
			// Create local workflow from snapshot
			$user_id          = get_current_user_id() ?: 1;
			$source_site_url  = isset( $assignment['source_site_url'] ) ? esc_url_raw( $assignment['source_site_url'] ) : null;
			$wpdb->insert(
				$wpdb->prefix . 'stepwise_workflows',
				[
					'title'           => sanitize_text_field( $assignment['workflow_title'] ),
					'status'          => 'active',
					'source'          => 'saas',
					'saas_id'         => $saas_key,
					'category'        => $category,
					'created_by'      => $user_id,
					'created_at'      => current_time( 'mysql' ),
					'updated_at'      => current_time( 'mysql' ),
					'source_site_url' => $source_site_url,
				]
			);
			$workflow_id = $wpdb->insert_id;

			// Import steps from snapshot
			foreach ( $steps as $i => $step ) {
				$wpdb->insert(
					$wpdb->prefix . 'stepwise_steps',
					[
						'workflow_id'       => $workflow_id,
						'title'             => sanitize_text_field( $step['title'] ?? '' ),
						'description'       => sanitize_textarea_field( $step['description'] ?? '' ),
						'deep_link'         => esc_url_raw( $step['deep_link'] ?? '' ),
						'deep_link_type'    => sanitize_text_field( $step['deep_link_type'] ?? 'static' ),
						'is_required'       => (int) ( $step['is_required'] ?? 1 ),
						'evidence_required' => (int) ( $step['evidence_required'] ?? 0 ),
						'sort_order'        => isset( $step['sort_order'] ) ? (int) $step['sort_order'] : ( $i + 1 ) * 10,
						'created_at'        => current_time( 'mysql' ),
					]
				);
			}
		} else {
			$workflow_id = $existing_id;

			// Sync category if it changed
			if ( $category ) {
				$wpdb->update(
					$wpdb->prefix . 'stepwise_workflows',
					[ 'category' => $category, 'updated_at' => current_time( 'mysql' ) ],
					[ 'id' => $workflow_id ]
				);
			}
		}

		// Record the assignment ID so we can report completion
		update_option( "stepwise_saas_assignment_{$workflow_id}", $assignment_id );
	}

	/**
	 * Push execution completion back to the SaaS.
	 *
	 * @param object $execution
	 */
	public function push_completion( $execution ): void {
		if ( ! AP_SaaS_Auth::is_connected() ) {
			return;
		}

		// Staging mode: don't push completions to live SaaS data.
		if ( stepwise_staging_mode_active() ) {
			return;
		}

		$assignment_id = (int) get_option( "stepwise_saas_assignment_{$execution->workflow_id}", 0 );
		if ( ! $assignment_id ) {
			return;
		}

		$client = new AP_SaaS_Client();
		$client->complete_assignment( $assignment_id );
	}

	/**
	 * Send heartbeat to SaaS and refresh the local plan cache from the response.
	 * If the SaaS reports a URL mismatch (this site was cloned from another),
	 * auto-disconnect and surface an admin notice so the admin can reconnect fresh.
	 */
	public function send_heartbeat(): void {
		if ( ! AP_SaaS_Auth::is_connected() ) {
			return;
		}

		// Staging mode suppresses all SaaS sync without disconnecting.
		if ( stepwise_staging_mode_active() ) {
			return;
		}

		$result = ( new AP_SaaS_Client() )->heartbeat();

		if ( is_wp_error( $result ) ) {
			return;
		}

		// SaaS detected this site's URL doesn't match the registered URL — it's a clone.
		if ( isset( $result['status'] ) && $result['status'] === 'url_mismatch' ) {
			AP_SaaS_Auth::disconnect();
			set_transient( 'stepwise_url_mismatch_notice', 1, HOUR_IN_SECONDS );
			stepwise_log( 'Disconnected: SaaS reported URL mismatch — site was cloned or migrated.', 'saas' );
			return;
		}

		if ( isset( $result['plan'] ) ) {
			$plan = sanitize_text_field( $result['plan'] );
			update_option( 'stepwise_license_plan', $plan );
		}
	}
}
