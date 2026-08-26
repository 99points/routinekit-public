<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Haayal_Notes_Activator {

    public static function activate() {
        self::create_table();
        self::migrate_comment_types();
        self::set_default_settings();
        set_transient( 'haayal_activation_notice', 1, 60 * 60 );
    }

    public static function maybe_upgrade() {
        $installed_version = get_option( 'haayal_db_version', '0' );
        if ( version_compare( $installed_version, HAAYAL_NOTES_VERSION, '<' ) ) {
            self::activate();
            update_option( 'haayal_db_version', HAAYAL_NOTES_VERSION );
        }
    }

    public static function create_table() {
        global $wpdb;
        $table_name      = $wpdb->prefix . 'haayal_notes';
        $charset_collate = $wpdb->get_charset_collate();

        // Use direct query instead of dbDelta for reliability.
        $wpdb->query(
            "CREATE TABLE IF NOT EXISTS {$table_name} (
                id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
                parent_id bigint(20) unsigned NOT NULL DEFAULT 0,
                user_id bigint(20) unsigned NOT NULL,
                author_name varchar(255) DEFAULT '',
                page_url varchar(512) NOT NULL,
                page_title varchar(512) DEFAULT '',
                css_selector varchar(1024) DEFAULT '',
                pos_x float DEFAULT 0,
                pos_y float DEFAULT 0,
                content text NOT NULL,
                comment_type varchar(20) NOT NULL DEFAULT 'regular',
                is_private tinyint(1) NOT NULL DEFAULT 0,
                created_at datetime DEFAULT NULL,
                updated_at datetime DEFAULT NULL,
                PRIMARY KEY (id),
                KEY page_url (page_url(191)),
                KEY parent_id (parent_id),
                KEY user_id (user_id)
            ) {$charset_collate}"
        );

        // Add columns if upgrading from older version.
        $columns = $wpdb->get_col( "SHOW COLUMNS FROM {$table_name}", 0 );
        if ( is_array( $columns ) && ! in_array( 'comment_type', $columns, true ) ) {
            $wpdb->query(
                "ALTER TABLE {$table_name} ADD COLUMN comment_type varchar(20) NOT NULL DEFAULT 'regular' AFTER content"
            );
        }
        if ( is_array( $columns ) && ! in_array( 'page_title', $columns, true ) ) {
            $wpdb->query(
                "ALTER TABLE {$table_name} ADD COLUMN page_title varchar(512) DEFAULT '' AFTER page_url"
            );
        }
        if ( is_array( $columns ) && ! in_array( 'author_name', $columns, true ) ) {
            $wpdb->query(
                "ALTER TABLE {$table_name} ADD COLUMN author_name varchar(255) DEFAULT '' AFTER user_id"
            );
        }
        if ( is_array( $columns ) && ! in_array( 'is_private', $columns, true ) ) {
            $wpdb->query(
                "ALTER TABLE {$table_name} ADD COLUMN is_private tinyint(1) NOT NULL DEFAULT 0 AFTER comment_type"
            );
        }
        if ( is_array( $columns ) && ! in_array( 'banner_layout', $columns, true ) ) {
            $wpdb->query(
                "ALTER TABLE {$table_name} ADD COLUMN banner_layout varchar(20) NOT NULL DEFAULT 'full' AFTER is_private"
            );
        }
        if ( is_array( $columns ) && ! in_array( 'banner_position', $columns, true ) ) {
            $wpdb->query(
                "ALTER TABLE {$table_name} ADD COLUMN banner_position varchar(20) NOT NULL DEFAULT 'before' AFTER banner_layout"
            );
        }
    }

    private static function migrate_comment_types() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'haayal_notes';

        // Only run if old types still exist.
        $old_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table_name} WHERE comment_type IN ('regular','alert','attention')" );
        if ( $old_count > 0 ) {
            $wpdb->query( "UPDATE {$table_name} SET comment_type='pin' WHERE comment_type='regular'" );
            $wpdb->query( "UPDATE {$table_name} SET comment_type='open_warning' WHERE comment_type='alert'" );
            $wpdb->query( "UPDATE {$table_name} SET comment_type='open_tip' WHERE comment_type='attention'" );
        }
    }

    private static function set_default_settings() {
        if ( false === get_option( 'haayal_settings' ) ) {
            add_option( 'haayal_settings', array(
                'allowed_roles'          => array( 'administrator', 'editor' ),
                'allowed_users'          => array(),
                'markers_visible_default' => true,
            ) );
        }
    }
}
