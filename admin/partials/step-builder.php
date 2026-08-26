<?php
defined( 'ABSPATH' ) || exit;
// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- page-scoped local variable in a partial template
$workflow_id = isset( $_GET['workflow_id'] ) ? absint( $_GET['workflow_id'] ) : 0;
?>
<div class="wrap">
	<div
		id="alignpress-root"
		data-page="step-builder"
		data-workflow-id="<?php echo esc_attr( $workflow_id ); ?>"
	></div>
</div>
<div id="alignpress-runner-root"></div>
<div id="alignpress-capture-root"></div>
