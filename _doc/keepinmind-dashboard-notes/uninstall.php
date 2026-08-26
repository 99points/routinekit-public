<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

$settings = get_option( 'haayal_settings', array() );
$action   = isset( $settings['uninstall_action'] ) ? $settings['uninstall_action'] : 'keep';

if ( 'delete' === $action ) {
    global $wpdb;
    $wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}haayal_notes" );
    delete_option( 'haayal_settings' );
    delete_option( 'haayal_db_version' );
    delete_option( 'haayal_review_dismissed' );
}
