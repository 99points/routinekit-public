<?php
defined( 'ABSPATH' ) || exit;

define( 'STEPWISE_VERSION',            '1.0.0' );
define( 'STEPWISE_DB_VERSION',         '1.2.5' );
// __DIR__ is stepwise/includes/helpers/ — two dirname() calls reach plugin root.
define( 'STEPWISE_PLUGIN_FILE',        dirname( dirname( __DIR__ ) ) . '/stepwise.php' );
define( 'STEPWISE_PLUGIN_DIR',         dirname( dirname( __DIR__ ) ) . '/' );
define( 'STEPWISE_PLUGIN_URL',         plugin_dir_url( STEPWISE_PLUGIN_FILE ) );
define( 'STEPWISE_TEMPLATES_DIR',      STEPWISE_PLUGIN_DIR . 'templates/' );
define( 'STEPWISE_FREE_WORKFLOW_LIMIT', 0 ); // Unused — no workflow limit on any plan. Kept for back-compat only.
// IMPORTANT: build-zip.sh MUST replace this with the production HTTPS URL before release.
// If this value reaches production unchanged, all SaaS features will silently fail.
define( 'STEPWISE_SAAS_DEFAULT_URL',   'http://stepwise-saas.test' ); // Swapped to prod URL by build-zip.sh
define( 'STEPWISE_REST_NAMESPACE',     'stepwise/v1' );
// All license plan slugs that unlock Pro features. Add new plans here — never in scattered in_array() calls.
define( 'STEPWISE_PRO_PLANS',         [ 'agency', 'agency_pro' ] );
