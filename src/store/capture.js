import { createReduxStore, register } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

const DEFAULT_STATE = {
	pendingChanges: [],
	isVisible: false,
	isAdding: false,
};

const actions = {
	setPendingChanges: ( changes )   => ( { type: 'SET_PENDING_CHANGES', changes } ),
	setVisible:        ( isVisible ) => ( { type: 'SET_VISIBLE', isVisible } ),
	setAdding:         ( isAdding )  => ( { type: 'SET_ADDING', isAdding } ),
	clearChanges:      ()            => ( { type: 'SET_PENDING_CHANGES', changes: [] } ),

	fetchPendingCaptures: () => async ( { dispatch } ) => {
		try {
			const data = await apiFetch( { path: '/alignpress/v1/capture/all' } );
			if ( data?.changes?.length > 0 ) {
				dispatch( actions.setPendingChanges( data.changes ) );
				dispatch( actions.setVisible( true ) );
			}
		} catch {
			// Capture fetch failures are silent — don't disrupt wp-admin
		}
	},

	addToWorkflow: ( workflowId, captureIds, stepTitle ) => async ( { dispatch, select } ) => {
		dispatch( actions.setAdding( true ) );
		try {
			const result = await apiFetch( {
				path: '/alignpress/v1/capture/add-to-workflow',
				method: 'POST',
				data: {
					workflow_id: workflowId,
					capture_ids: captureIds,
					step_title: stepTitle,
				},
			} );
			// Remove only the captures that were just added, not the entire list.
			const addedSet  = new Set( captureIds.map( Number ) );
			const current   = select( 'alignpress/capture' ).getPendingChanges();
			const remaining = current.filter( ( c ) => ! addedSet.has( Number( c.id ) ) );
			dispatch( actions.setPendingChanges( remaining ) );
			if ( remaining.length === 0 ) {
				dispatch( actions.setVisible( false ) );
			}
			return result;
		} catch ( error ) {
			return null;
		} finally {
			dispatch( actions.setAdding( false ) );
		}
	},

	dismiss: ( captureIds ) => async ( { dispatch } ) => {
		try {
			await apiFetch( {
				path: '/alignpress/v1/capture/dismiss',
				method: 'DELETE',
				data: { capture_ids: captureIds },
			} );
		} catch {
			// Dismiss failures are silent
		}
		dispatch( actions.clearChanges() );
		dispatch( actions.setVisible( false ) );
	},
};

const reducer = ( state = DEFAULT_STATE, action ) => {
	switch ( action.type ) {
		case 'SET_PENDING_CHANGES':
			return { ...state, pendingChanges: action.changes };
		case 'SET_VISIBLE':
			return { ...state, isVisible: action.isVisible };
		case 'SET_ADDING':
			return { ...state, isAdding: action.isAdding };
		default:
			return state;
	}
};

const selectors = {
	getPendingChanges: ( state ) => state.pendingChanges,
	isVisible:         ( state ) => state.isVisible,
	isAdding:          ( state ) => state.isAdding,
};

const store = createReduxStore( 'alignpress/capture', { reducer, actions, selectors } );
register( store );

export default store;
