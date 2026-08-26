import { render } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import './store';

// Wire up the REST nonce so every apiFetch call sends X-WP-Nonce automatically.
if ( window.alignpressData?.nonce ) {
	apiFetch.use( apiFetch.createNonceMiddleware( window.alignpressData.nonce ) );
}

// Debug log — stores every apiFetch request/response for the on-page panel.
window.__apLogs = [];
apiFetch.use( ( options, next ) => {
	const entry = {
		id:      Date.now(),
		method:  options.method ?? 'GET',
		path:    options.path ?? options.url ?? '?',
		data:    options.data ?? null,
		status:  'pending',
		response: null,
		error:   null,
		ts:      new Date().toLocaleTimeString(),
	};
	window.__apLogs = [ entry, ...window.__apLogs ].slice( 0, 20 );
	window.__apLogsUpdated?.();

	return next( options ).then(
		( res ) => {
			entry.status   = 'ok';
			entry.response = res;
			window.__apLogsUpdated?.();
			return res;
		},
		( err ) => {
			entry.status = 'error';
			entry.error  = err?.message ?? String( err );
			if ( err?.data ) entry.error += ' | ' + JSON.stringify( err.data );
			window.__apLogsUpdated?.();
			throw err;
		}
	);
} );

const rootEl = document.getElementById( 'alignpress-root' );

if ( rootEl ) {
	const page       = rootEl.dataset.page ?? window.alignpressData?.currentPage ?? 'workflows';
	const workflowId = rootEl.dataset.workflowId
		? parseInt( rootEl.dataset.workflowId, 10 )
		: ( window.alignpressData?.workflowId ?? null );

	const mount = ( App ) => render( <App />, rootEl );

	if ( page === 'step-builder' && workflowId ) {
		import( './step-builder/StepBuilder' ).then( ( { default: StepBuilder } ) => {
			mount( () => <StepBuilder workflowId={ workflowId } /> );
		} );
	} else if ( page === 'settings' ) {
		import( './settings/Settings' ).then( ( { default: Settings } ) => {
			mount( Settings );
		} );
	} else if ( page === 'upgrade' ) {
		import( './upgrade/UpgradePage' ).then( ( { default: UpgradePage } ) => {
			mount( UpgradePage );
		} );
	} else if ( page === 'capture' ) {
		import( './capture/CapturePage' ).then( ( { default: CapturePage } ) => {
			mount( CapturePage );
		} );
	} else {
		import( './workflow-manager/WorkflowManager' ).then( ( { default: WorkflowManager } ) => {
			mount( WorkflowManager );
		} );
	}
}
