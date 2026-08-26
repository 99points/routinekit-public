<?php
/**
 * Plugin Name:       AlignPress
 * Plugin URI:        https://alignpress.app
 * Description:       AlignPress streamlines WordPress agency workflows by letting you capture and replay settings changes across unlimited client sites — saving hours of repetitive plugin and site configuration work.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Zeeshan Rasool
 * Author URI:        https://profiles.wordpress.org/codeleftover/
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       alignpress
 * Domain Path:       /languages
 */

defined( 'ABSPATH' ) || exit;

require_once plugin_dir_path( __FILE__ ) . 'includes/helpers/constants.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/helpers/functions.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-alignpress-loader.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-alignpress-activator.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/class-alignpress-deactivator.php';

register_activation_hook( __FILE__,   [ 'AlignPress_Activator',   'activate'   ] );
register_deactivation_hook( __FILE__, [ 'AlignPress_Deactivator', 'deactivate' ] );

function alignpress_run(): void {
	require_once plugin_dir_path( __FILE__ ) . 'includes/class-alignpress.php';
	$plugin = new AlignPress();
	$plugin->init();
}
add_action( 'plugins_loaded', 'alignpress_run' );
add_action( 'plugins_loaded', [ 'AlignPress_Activator', 'maybe_run_migrations' ] );
add_action( 'init', 'alignpress_load_textdomain' );

function alignpress_load_textdomain(): void {
	load_plugin_textdomain( 'alignpress', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' ); // phpcs:ignore PluginCheck.CodeAnalysis.DiscouragedFunctions.load_plugin_textdomainFound -- needed for bundled .pot files
}
