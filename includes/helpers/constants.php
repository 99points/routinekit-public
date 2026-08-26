<?php
defined( 'ABSPATH' ) || exit;

define( 'ALIGNPRESS_VERSION',            '1.0.0' );
define( 'ALIGNPRESS_DB_VERSION',         '1.2.3' );
// __DIR__ is alignpress/includes/helpers/ — two dirname() calls reach plugin root.
define( 'ALIGNPRESS_PLUGIN_FILE',        dirname( dirname( __DIR__ ) ) . '/alignpress.php' );
define( 'ALIGNPRESS_PLUGIN_DIR',         dirname( dirname( __DIR__ ) ) . '/' );
define( 'ALIGNPRESS_PLUGIN_URL',         plugin_dir_url( ALIGNPRESS_PLUGIN_FILE ) );
define( 'ALIGNPRESS_TEMPLATES_DIR',      ALIGNPRESS_PLUGIN_DIR . 'templates/' );
define( 'ALIGNPRESS_FREE_WORKFLOW_LIMIT', 0 ); // Unused — no workflow limit on any plan. Kept for back-compat only.
define( 'ALIGNPRESS_SAAS_DEFAULT_URL',   'http://alignpress-saas.test' ); // Swapped to prod URL by build-zip.sh
define( 'ALIGNPRESS_REST_NAMESPACE',     'alignpress/v1' );
// All license plan slugs that unlock Pro features. Add new plans here — never in scattered in_array() calls.
define( 'ALIGNPRESS_PRO_PLANS',         [ 'agency', 'agency_pro' ] );
