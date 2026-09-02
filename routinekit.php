<?php
/**
 * Plugin Name:       RoutineKit — Reusable Configuration Checklists
 * Description:       RoutineKit lets you build reusable, step-by-step site configuration checklists and run them across client sites — saving hours of repetitive WordPress setup work.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Zeeshan Rasool
 * Author URI:        https://profiles.wordpress.org/codeleftover/
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       routinekit
 */

defined( 'ABSPATH' ) || exit;

require_once plugin_dir_path( __FILE__ ) . 'includes/helpers/constants.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/helpers/functions.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-routinekit-loader.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-routinekit-activator.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-routinekit-deactivator.php';

register_activation_hook( __FILE__,   [ 'Routinekit_Activator',   'activate'   ] );
register_deactivation_hook( __FILE__, [ 'Routinekit_Deactivator', 'deactivate' ] );

// No load_plugin_textdomain() call: WordPress.org has loaded translations for
// hosted plugins automatically since 4.6, and this plugin requires 6.0+.

function routinekit_run(): void {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-routinekit.php';
	$plugin = new Routinekit();
	$plugin->init();
}
add_action( 'plugins_loaded', 'routinekit_run' );
add_action( 'plugins_loaded', [ 'Routinekit_Activator', 'maybe_run_migrations' ] );
