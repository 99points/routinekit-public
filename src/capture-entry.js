import { render } from '@wordpress/element';
import './store';

// Runner — injected into every wp-admin page, persists across navigation
const runnerRoot = document.getElementById( 'alignpress-runner-root' );
if ( runnerRoot ) {
	import( './runner/Runner' ).then( ( { default: Runner } ) => {
		render( <Runner />, runnerRoot );
	} );
}

// Capture toast — shown when pending captures exist
const captureRoot = document.getElementById( 'alignpress-capture-root' );
if ( captureRoot ) {
	import( './capture/CaptureToast' ).then( ( { default: CaptureToast } ) => {
		render( <CaptureToast />, captureRoot );
	} );
}
