<?php
/**
 * Plugin Name: KeepInMind Dashboard Notes
 * Description: Place contextual notes on any WordPress admin page. Leave notes directly in the dashboard.
 * Version: 0.8.4.3
 * Author: Elchanan Levavi
 * Author URI: https://ha-ayal.co.il
 * Plugin URI: https://wordpress.org/plugins/keepinmind-dashboard-notes/
 * Text Domain: keepinmind-dashboard-notes
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: GPL-3.0 or later
 * https://www.gnu.org/licenses/gpl-3.0.txt
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'HAAYAL_NOTES_VERSION', '1.6.0' );
define( 'HAAYAL_NOTES_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'HAAYAL_NOTES_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'HAAYAL_NOTES_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

require_once HAAYAL_NOTES_PLUGIN_DIR . 'includes/class-haayal-notes-activator.php';
require_once HAAYAL_NOTES_PLUGIN_DIR . 'includes/class-haayal-notes-deactivator.php';
require_once HAAYAL_NOTES_PLUGIN_DIR . 'includes/class-haayal-notes-db.php';
require_once HAAYAL_NOTES_PLUGIN_DIR . 'includes/class-haayal-notes-permissions.php';
require_once HAAYAL_NOTES_PLUGIN_DIR . 'includes/class-haayal-notes-rest-controller.php';
require_once HAAYAL_NOTES_PLUGIN_DIR . 'includes/class-haayal-notes-admin.php';
require_once HAAYAL_NOTES_PLUGIN_DIR . 'includes/class-haayal-notes-loader.php';
require_once HAAYAL_NOTES_PLUGIN_DIR . 'includes/class-haayal-notes-notices.php';

register_activation_hook( __FILE__, array( 'Haayal_Notes_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Haayal_Notes_Deactivator', 'deactivate' ) );

add_action( 'rest_api_init', function () {
    $controller = new Haayal_Notes_REST_Controller();
    $controller->register_routes();
} );

$haayal_notes_admin = new Haayal_Notes_Admin();
$haayal_notes_admin->init();

add_action( 'admin_init', array( 'Haayal_Notes_Activator', 'maybe_upgrade' ) );

$haayal_notes_loader = new Haayal_Notes_Loader();
$haayal_notes_loader->init();

$haayal_notes_notices = new Haayal_Notes_Notices();
$haayal_notes_notices->init();
