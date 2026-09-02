import { createReduxStore, register } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

const DEFAULT_STATE = {
	activeExecution: null,
	isLoading: false,
	isStarting: false,
	error: null,
};

const actions = {
	setActiveExecution: ( execution ) => ( { type: 'SET_ACTIVE_EXECUTION', execution } ),
	setLoading:         ( isLoading ) => ( { type: 'SET_LOADING', isLoading } ),
	setStarting:        ( isStarting ) => ( { type: 'SET_STARTING', isStarting } ),
	setError:           ( error )      => ( { type: 'SET_ERROR', error } ),

	fetchActiveExecution: () => async ( { dispatch } ) => {
		dispatch( actions.setLoading( true ) );
		try {
			const result = await apiFetch( { path: '/routinekit/v1/executions/active' } );
			// API returns { active: false } when no execution is running.
			let execution = ( result && result.active !== false ) ? result : null;
			// Ignore abandoned executions the user has already dismissed — the server
			// returns them for up to 5 minutes after cancellation.
			if ( execution && execution.status === 'abandoned' ) {
				try {
					const dismissed = new Set( JSON.parse( localStorage.getItem( 'routinekit_runner_dismissed_ids' ) || '[]' ).map( String ) );
					if ( dismissed.has( String( execution.id ) ) ) execution = null;
				} catch {}
			}
			dispatch( actions.setActiveExecution( execution ) );
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
		} finally {
			dispatch( actions.setLoading( false ) );
		}
	},

	startExecution: ( workflowId ) => async ( { dispatch } ) => {
		dispatch( actions.setStarting( true ) );
		dispatch( actions.setError( null ) );
		try {
			const execution = await apiFetch( {
				path: '/routinekit/v1/executions',
				method: 'POST',
				data: { workflow_id: workflowId },
			} );
			dispatch( actions.setActiveExecution( execution ) );
			return execution;
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
			return null;
		} finally {
			dispatch( actions.setStarting( false ) );
		}
	},

	completeStep: ( executionId, stepId, data = {} ) => async ( { dispatch } ) => {
		try {
			const execution = await apiFetch( {
				path: `/routinekit/v1/executions/${ executionId }/steps/${ stepId }`,
				method: 'PATCH',
				data: { status: 'completed', ...data },
			} );
			dispatch( actions.setActiveExecution( execution ) );
			return execution;
		} catch ( error ) {
			// eslint-disable-next-line no-console
			console.error( '[RoutineKit] completeStep failed:', error );
			dispatch( actions.setError( error.message ) );
			return null;
		}
	},

	skipStep: ( executionId, stepId, reason = '' ) => async ( { dispatch } ) => {
		try {
			const execution = await apiFetch( {
				path: `/routinekit/v1/executions/${ executionId }/steps/${ stepId }`,
				method: 'PATCH',
				data: { status: 'skipped', skipped_reason: reason },
			} );
			dispatch( actions.setActiveExecution( execution ) );
			return execution;
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
			return null;
		}
	},

	uncompleteStep: ( executionId, stepId ) => async ( { dispatch } ) => {
		try {
			const execution = await apiFetch( {
				path:   `/routinekit/v1/executions/${ executionId }/steps/${ stepId }`,
				method: 'DELETE',
			} );
			dispatch( actions.setActiveExecution( execution ) );
			return execution;
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
			return null;
		}
	},

	clearExecution: () => ( { type: 'SET_ACTIVE_EXECUTION', execution: null } ),

	cancelExecution: ( executionId ) => async ( { dispatch } ) => {
		try {
			await apiFetch( {
				path: `/routinekit/v1/executions/${ executionId }`,
				method: 'DELETE',
			} );
		} catch {
			// Treat as cancelled regardless — clear local state
		}
		dispatch( { type: 'SET_ACTIVE_EXECUTION', execution: null } );
	},
};

const reducer = ( state = DEFAULT_STATE, action ) => {
	switch ( action.type ) {
		case 'SET_ACTIVE_EXECUTION':
			return { ...state, activeExecution: action.execution };
		case 'SET_LOADING':
			return { ...state, isLoading: action.isLoading };
		case 'SET_STARTING':
			return { ...state, isStarting: action.isStarting };
		case 'SET_ERROR':
			return { ...state, error: action.error };
		default:
			return state;
	}
};

const selectors = {
	getActiveExecution: ( state ) => state.activeExecution,
	isLoading:          ( state ) => state.isLoading,
	isStarting:         ( state ) => state.isStarting,
	getError:           ( state ) => state.error,
};

const store = createReduxStore( 'routinekit/execution', { reducer, actions, selectors } );
register( store );

export default store;
