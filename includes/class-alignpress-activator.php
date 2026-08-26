<?php
// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- intentional schema creation/migration on activation
defined( 'ABSPATH' ) || exit;

/**
 * Handles plugin activation: creates all DB tables and seeds default options.
 */
class AlignPress_Activator {

	/**
	 * Run on plugin activation.
	 */
	public static function activate(): void {
		self::create_tables();
		self::set_default_options();
		self::schedule_cron_events();
		update_option( 'alignpress_version',    ALIGNPRESS_VERSION );
		update_option( 'alignpress_db_version', ALIGNPRESS_DB_VERSION );
	}

	/**
	 * Run on every plugins_loaded to apply any column migrations that activation may have missed
	 * (e.g. columns added after the plugin was already installed).
	 * The DESC query is cheap; the ALTER only fires when the column is absent.
	 */
	public static function maybe_run_migrations(): void {
		// Transient key is versioned — bumping ALIGNPRESS_DB_VERSION auto-invalidates the cache.
		$transient = 'alignpress_migrations_' . ALIGNPRESS_DB_VERSION;
		if ( get_transient( $transient ) ) {
			return;
		}
		global $wpdb;
		$cols = $wpdb->get_col( "DESC {$wpdb->prefix}alignpress_workflows", 0 );
		if ( ! in_array( 'pushed_at', $cols, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_workflows ADD COLUMN pushed_at DATETIME DEFAULT NULL" );
		}
		if ( ! in_array( 'pushed_group_ids', $cols, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_workflows ADD COLUMN pushed_group_ids TEXT DEFAULT NULL" );
		}
		$exec_keys = $wpdb->get_col( "SHOW INDEX FROM {$wpdb->prefix}alignpress_executions", 2 );
		if ( ! in_array( 'started_by_status', $exec_keys, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_executions ADD INDEX started_by_status (started_by, status)" );
		}

		// v1.2.0 — step notes table for existing installs.
		$notes_table = $wpdb->prefix . 'alignpress_step_notes';
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$table_exists = $wpdb->get_var( "SHOW TABLES LIKE '{$notes_table}'" );
		if ( $table_exists !== $notes_table ) {
			$c = $wpdb->get_charset_collate();
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
			dbDelta( "CREATE TABLE {$notes_table} (
				id                      BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
				saas_note_id            VARCHAR(100) DEFAULT NULL,
				workflow_id             BIGINT(20) UNSIGNED NOT NULL,
				step_id                 BIGINT(20) UNSIGNED NOT NULL,
				user_id                 BIGINT(20) UNSIGNED DEFAULT NULL,
				user_display_name       VARCHAR(255) NOT NULL DEFAULT '',
				body                    TEXT NOT NULL,
				shared                  TINYINT(1) NOT NULL DEFAULT 0,
				screenshot_url          VARCHAR(500) DEFAULT NULL,
				screenshot_attachment_id BIGINT(20) UNSIGNED DEFAULT NULL,
				is_sideloaded           TINYINT(1) NOT NULL DEFAULT 0,
				source_site_label       VARCHAR(255) DEFAULT NULL,
				source_site_url         VARCHAR(500) DEFAULT NULL,
				created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				PRIMARY KEY  (id),
				UNIQUE KEY saas_note_id (saas_note_id),
				KEY workflow_id (workflow_id),
				KEY step_id (step_id),
				KEY user_id (user_id),
				KEY shared (shared)
			) $c;" );
		}

		// v1.2.3 — add source column to capture buffer to distinguish manual vs option_hook captures.
		$buf_cols = $wpdb->get_col( "DESC {$wpdb->prefix}alignpress_capture_buffer", 0 );
		if ( $buf_cols && ! in_array( 'source', $buf_cols, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_capture_buffer ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'option_hook' AFTER status" );
		}

		// v1.2.2 — add source_site_url to workflows for assigned workflow origin display.
		$wf_cols = $wpdb->get_col( "DESC {$wpdb->prefix}alignpress_workflows", 0 );
		if ( $wf_cols && ! in_array( 'source_site_url', $wf_cols, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_workflows ADD COLUMN source_site_url VARCHAR(500) DEFAULT NULL" );
		}

		// v1.2.1 — add source_site_url to step notes for domain display.
		$notes_cols = $wpdb->get_col( "DESC {$wpdb->prefix}alignpress_step_notes", 0 );
		if ( $notes_cols && ! in_array( 'source_site_url', $notes_cols, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_step_notes ADD COLUMN source_site_url VARCHAR(500) DEFAULT NULL AFTER source_site_label" );
		}

		set_transient( $transient, true, DAY_IN_SECONDS );
	}

	/**
	 * Schedule recurring cron events (idempotent — checks before scheduling).
	 */
	private static function schedule_cron_events(): void {
		if ( ! wp_next_scheduled( 'alignpress_cleanup_capture_buffer' ) ) {
			wp_schedule_event( time(), 'daily', 'alignpress_cleanup_capture_buffer' );
		}
	}

	/**
	 * Create all 6 plugin tables via dbDelta().
	 */
	private static function create_tables(): void {
		global $wpdb;
		$c = $wpdb->get_charset_collate();

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		// 1. Workflows
		dbDelta( "CREATE TABLE {$wpdb->prefix}alignpress_workflows (
			id               BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			title            VARCHAR(255) NOT NULL,
			description      TEXT,
			status           VARCHAR(20) NOT NULL DEFAULT 'draft',
			source           VARCHAR(20) NOT NULL DEFAULT 'local',
			saas_id          VARCHAR(100) DEFAULT NULL,
			template_key     VARCHAR(100) DEFAULT NULL,
			category         VARCHAR(100) DEFAULT NULL,
			run_count        INT UNSIGNED NOT NULL DEFAULT 0,
			created_by       BIGINT(20) UNSIGNED NOT NULL,
			created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			last_run_at      DATETIME DEFAULT NULL,
			pushed_at        DATETIME DEFAULT NULL,
			pushed_group_ids TEXT DEFAULT NULL,
			source_site_url  VARCHAR(500) DEFAULT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY saas_id (saas_id),
			KEY status (status),
			KEY source (source)
		) $c;" );

		// Runtime migrations: add columns/indexes to existing installs where they're missing.
		$cols = $wpdb->get_col( "DESC {$wpdb->prefix}alignpress_workflows", 0 );
		if ( ! in_array( 'pushed_at', $cols, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_workflows ADD COLUMN pushed_at DATETIME DEFAULT NULL" );
		}
		if ( ! in_array( 'pushed_group_ids', $cols, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_workflows ADD COLUMN pushed_group_ids TEXT DEFAULT NULL" );
		}

		// Add UNIQUE index on saas_id to prevent duplicate imports from concurrent admin_init calls.
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$existing_keys = $wpdb->get_col( "SHOW INDEX FROM {$wpdb->prefix}alignpress_workflows WHERE Key_name = 'saas_id'", 2 );
		if ( empty( $existing_keys ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_workflows ADD UNIQUE KEY saas_id (saas_id)" );
		}

		// 2. Steps
		dbDelta( "CREATE TABLE {$wpdb->prefix}alignpress_steps (
			id                BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			workflow_id       BIGINT(20) UNSIGNED NOT NULL,
			title             VARCHAR(255) NOT NULL,
			description       TEXT,
			deep_link         VARCHAR(500) DEFAULT NULL,
			deep_link_type    VARCHAR(20) NOT NULL DEFAULT 'static',
			is_required       TINYINT(1) NOT NULL DEFAULT 1,
			evidence_required TINYINT(1) NOT NULL DEFAULT 0,
			sort_order        INT(11) UNSIGNED NOT NULL DEFAULT 0,
			captured_options  TEXT DEFAULT NULL,
			created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY workflow_id (workflow_id)
		) $c;" );

		// 3. Executions
		dbDelta( "CREATE TABLE {$wpdb->prefix}alignpress_executions (
			id                    BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			workflow_id           BIGINT(20) UNSIGNED NOT NULL,
			saas_assignment_id    VARCHAR(100) DEFAULT NULL,
			status                VARCHAR(20) NOT NULL DEFAULT 'pending',
			started_by            BIGINT(20) UNSIGNED DEFAULT NULL,
			started_at            DATETIME DEFAULT NULL,
			completed_at          DATETIME DEFAULT NULL,
			created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY workflow_id (workflow_id),
			KEY status (status),
			KEY saas_assignment_id (saas_assignment_id),
			KEY started_by_status (started_by, status)
		) $c;" );

		// Runtime migration: add the composite index to existing installs.
		$existing_keys = $wpdb->get_col( "SHOW INDEX FROM {$wpdb->prefix}alignpress_executions", 2 );
		if ( ! in_array( 'started_by_status', $existing_keys, true ) ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}alignpress_executions ADD INDEX started_by_status (started_by, status)" );
		}

		// 4. Step completions
		dbDelta( "CREATE TABLE {$wpdb->prefix}alignpress_step_completions (
			id               BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			execution_id     BIGINT(20) UNSIGNED NOT NULL,
			step_id          BIGINT(20) UNSIGNED NOT NULL,
			status           VARCHAR(20) NOT NULL DEFAULT 'pending',
			completed_by     BIGINT(20) UNSIGNED DEFAULT NULL,
			completed_at     DATETIME DEFAULT NULL,
			notes            TEXT DEFAULT NULL,
			evidence_url     VARCHAR(500) DEFAULT NULL,
			skipped_reason   TEXT DEFAULT NULL,
			before_snapshot  LONGTEXT DEFAULT NULL,
			after_snapshot   LONGTEXT DEFAULT NULL,
			PRIMARY KEY  (id),
			KEY execution_id (execution_id),
			KEY step_id (step_id)
		) $c;" );

		// 5. Auto-capture buffer
		dbDelta( "CREATE TABLE {$wpdb->prefix}alignpress_capture_buffer (
			id             BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			option_name    VARCHAR(191) NOT NULL,
			option_label   VARCHAR(255) DEFAULT NULL,
			old_value      LONGTEXT,
			new_value      LONGTEXT,
			page_url       VARCHAR(500) DEFAULT NULL,
			captured_by    BIGINT(20) UNSIGNED NOT NULL,
			captured_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			status         VARCHAR(20) NOT NULL DEFAULT 'pending',
			source         VARCHAR(20) NOT NULL DEFAULT 'option_hook',
			PRIMARY KEY  (id),
			KEY status (status),
			KEY captured_by (captured_by)
		) $c;" );

		// 6. Step notes (threaded, per-step, optionally shared cross-site)
		dbDelta( "CREATE TABLE {$wpdb->prefix}alignpress_step_notes (
			id                      BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			saas_note_id            VARCHAR(100) DEFAULT NULL,
			workflow_id             BIGINT(20) UNSIGNED NOT NULL,
			step_id                 BIGINT(20) UNSIGNED NOT NULL,
			user_id                 BIGINT(20) UNSIGNED DEFAULT NULL,
			user_display_name       VARCHAR(255) NOT NULL DEFAULT '',
			body                    TEXT NOT NULL,
			shared                  TINYINT(1) NOT NULL DEFAULT 0,
			screenshot_url          VARCHAR(500) DEFAULT NULL,
			screenshot_attachment_id BIGINT(20) UNSIGNED DEFAULT NULL,
			is_sideloaded           TINYINT(1) NOT NULL DEFAULT 0,
			source_site_label       VARCHAR(255) DEFAULT NULL,
			created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY saas_note_id (saas_note_id),
			KEY workflow_id (workflow_id),
			KEY step_id (step_id),
			KEY user_id (user_id),
			KEY shared (shared)
		) $c;" );

		if ( $wpdb->last_error ) {
			alignpress_log( 'DB table creation error: ' . $wpdb->last_error, 'activator' );
		}
	}

	/**
	 * Write default option values on fresh install only.
	 */
	private static function set_default_options(): void {
		$defaults = [
			'alignpress_capture_enabled'      => '1',
			'alignpress_capture_scope'        => 'all_changes',
			'alignpress_capture_exclude'      => '[]',
			'alignpress_capture_retention'    => '7',
			'alignpress_capture_min_changes'  => '1',
			'alignpress_runner_position'      => 'right',
			'alignpress_launcher_enabled'     => '1',
			'alignpress_toast_enabled'        => '1',
			'alignpress_toast_autodismiss'    => '8',
		];

		foreach ( $defaults as $key => $value ) {
			if ( false === get_option( $key ) ) {
				add_option( $key, $value );
			}
		}
	}
}
