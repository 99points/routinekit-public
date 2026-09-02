import { useState, useEffect } from 'react';
import { useSelect, useDispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import AddToWorkflowModal from './AddToWorkflowModal';
import '../store';

const { captureAutodismiss = 8, captureEnabled = true } = window.routinekitData ?? {};

const CLOSED_KEY = 'routinekit_toast_closed_ids';

const getClosedIds = () => {
	try { return new Set( JSON.parse( localStorage.getItem( CLOSED_KEY ) || '[]' ).map( String ) ); }
	catch { return new Set(); }
};

const saveClosedIds = ( ids ) => {
	localStorage.setItem( CLOSED_KEY, JSON.stringify( [ ...ids ].map( String ) ) );
};

const CaptureToast = () => {
	const [ changes, setChanges ]     = useState( [] );
	const [ visible, setVisible ]     = useState( false );
	const [ showModal, setShowModal ] = useState( false );

	const { fetchActiveExecution }  = useDispatch( 'routinekit/execution' );
	const activeExecution = useSelect( ( select ) => select( 'routinekit/execution' ).getActiveExecution() );
	const hasActiveRun    = !! activeExecution && activeExecution.status === 'in_progress';

	// On mount: fetch execution state, then fetch captures only if a run is active.
	useEffect( () => {
		if ( ! captureEnabled ) return;
		fetchActiveExecution().then( () => {
			const exec = window.wp?.data?.select( 'routinekit/execution' )?.getActiveExecution();
			if ( ! exec || exec.status !== 'in_progress' ) return;
			apiFetch( { path: '/routinekit/v1/capture/all' } )
				.then( ( data ) => {
					if ( data?.changes?.length > 0 ) {
						const closedIds  = getClosedIds();
						const newChanges = data.changes.filter( ( c ) => ! closedIds.has( String( c.id ) ) );
						if ( newChanges.length > 0 ) {
							setChanges( newChanges );
							setVisible( true );
						}
					}
				} )
				.catch( () => {} );
		} );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Hide immediately when the run ends.
	useEffect( () => {
		if ( ! hasActiveRun ) setVisible( false );
	}, [ hasActiveRun ] );

	// Auto-dismiss.
	useEffect( () => {
		if ( ! visible || showModal || ! captureAutodismiss ) return;
		const timer = setTimeout( () => setVisible( false ), captureAutodismiss * 1000 );
		return () => clearTimeout( timer );
	}, [ visible, showModal ] );

	if ( ! visible || changes.length === 0 ) return null;

	const count = changes.length;

	const handleClose = () => {
		const closedIds = getClosedIds();
		changes.forEach( ( c ) => closedIds.add( String( c.id ) ) );
		saveClosedIds( closedIds );
		setVisible( false );
	};

	const handleDismiss = () => {
		apiFetch( {
			path:   '/routinekit/v1/capture/dismiss',
			method: 'DELETE',
			data:   { capture_ids: changes.map( ( c ) => c.id ) },
		} ).catch( () => {} );
		const closedIds = getClosedIds();
		changes.forEach( ( c ) => closedIds.delete( String( c.id ) ) );
		saveClosedIds( closedIds );
		setVisible( false );
	};

	return (
		<>
			<div className="ap-capture-toast" role="alert" aria-live="polite">
				<button
					type="button"
					className="ap-capture-toast__close"
					onClick={ handleClose }
					aria-label={ __( 'Close', 'routinekit' ) }
				>
					&times;
				</button>
				<div className="ap-capture-toast__body">
					<strong>
						{ count } { count === 1
							? __( 'setting changed', 'routinekit' )
							: __( 'settings changed', 'routinekit' ) }
					</strong>
					<span className="ap-capture-toast__sub">
						{ __( 'Add to workflow?', 'routinekit' ) }
					</span>
				</div>
				<div className="ap-capture-toast__actions">
					<button
						type="button"
						className="routinekit-btn routinekit-btn--primary routinekit-btn--sm"
						onClick={ () => setShowModal( true ) }
					>
						{ __( 'Add to Workflow', 'routinekit' ) }
					</button>
					<button
						type="button"
						className="routinekit-btn routinekit-btn--ghost routinekit-btn--sm"
						onClick={ handleDismiss }
					>
						{ __( 'Dismiss', 'routinekit' ) }
					</button>
				</div>
			</div>

			{ showModal && (
				<AddToWorkflowModal
					changes={ changes }
					onClose={ () => {
						setShowModal( false );
						setVisible( false );
					} }
				/>
			) }
		</>
	);
};

export default CaptureToast;
