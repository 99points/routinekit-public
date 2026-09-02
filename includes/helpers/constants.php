<?php
defined( 'ABSPATH' ) || exit;

define( 'ROUTINEKIT_VERSION',            '1.0.0' );
define( 'ROUTINEKIT_DB_VERSION',         '1.2.6' );
// __DIR__ is routinekit/includes/helpers/ — two dirname() calls reach plugin root.
define( 'ROUTINEKIT_PLUGIN_FILE',        dirname( dirname( __DIR__ ) ) . '/routinekit.php' );
define( 'ROUTINEKIT_PLUGIN_DIR',         dirname( dirname( __DIR__ ) ) . '/' );
define( 'ROUTINEKIT_PLUGIN_URL',         plugin_dir_url( ROUTINEKIT_PLUGIN_FILE ) );
define( 'ROUTINEKIT_TEMPLATES_DIR',      ROUTINEKIT_PLUGIN_DIR . 'templates/' );
define( 'ROUTINEKIT_FREE_WORKFLOW_LIMIT', 0 ); // Unused — no workflow limit on any plan. Kept for back-compat only.
// IMPORTANT: build-zip.sh MUST replace this with the production HTTPS URL before release.
// If this value reaches production unchanged, all SaaS features will silently fail.
define( 'ROUTINEKIT_SAAS_DEFAULT_URL',   'http://routinekit-saas.test' ); // Swapped to prod URL by build-zip.sh
define( 'ROUTINEKIT_REST_NAMESPACE',     'routinekit/v1' );
// All license plan slugs that unlock Pro features. Add new plans here — never in scattered in_array() calls.
define( 'ROUTINEKIT_PRO_PLANS',         [ 'agency', 'agency_pro' ] );
