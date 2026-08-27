<?php
/**
 * Plugin Name:       Stepwise — Site Configuration Checklists
 * Plugin URI:        https://wpstepwise.com
 * Description:       Stepwise lets you build reusable, step-by-step site configuration checklists and run them across client sites — saving hours of repetitive WordPress setup work.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Zeeshan Rasool
 * Author URI:        https://profiles.wordpress.org/codeleftover/
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       stepwise
 */

defined( 'ABSPATH' ) || exit;

require_once plugin_dir_path( __FILE__ ) . 'includes/helpers/constants.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/helpers/functions.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-stepwise-loader.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-stepwise-activator.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-stepwise-deactivator.php';

register_activation_hook( __FILE__,   [ 'Stepwise_Activator',   'activate'   ] );
register_deactivation_hook( __FILE__, [ 'Stepwise_Deactivator', 'deactivate' ] );

function stepwise_run(): void {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-stepwise.php';
	$plugin = new Stepwise();
	$plugin->init();
}
add_action( 'plugins_loaded', 'stepwise_run' );
add_action( 'plugins_loaded', [ 'Stepwise_Activator', 'maybe_run_migrations' ] );
