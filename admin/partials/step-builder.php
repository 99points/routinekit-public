<?php
defined( 'ABSPATH' ) || exit;
// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- page-scoped local variable in a partial template
$workflow_id = isset( $_GET['workflow_id'] ) ? absint( $_GET['workflow_id'] ) : 0;
?>
<div class="wrap">
	<div
		id="stepwise-root"
		data-page="step-builder"
		data-workflow-id="<?php echo esc_attr( $workflow_id ); ?>"
	></div>
</div>
<div id="stepwise-runner-root"></div>
<div id="stepwise-capture-root"></div>
