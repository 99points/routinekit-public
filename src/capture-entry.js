import { render } from '@wordpress/element';
import './store';

// Runner — injected into every wp-admin page, persists across navigation
const runnerRoot = document.getElementById( 'alignpress-runner-root' );
if ( runnerRoot ) {
	import( './runner/Runner' ).then( ( { default: Runner } ) => {
		render( <Runner />, runnerRoot );
	} );
}

