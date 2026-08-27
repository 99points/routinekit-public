import { createReduxStore, register } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

const DEFAULT_STATE = {
	workflows: [],
	isLoading: false,
	isSaving: false,
	error: null,
};

const actions = {
	setWorkflows: ( workflows ) => ( { type: 'SET_WORKFLOWS', workflows } ),
	setLoading:   ( isLoading ) => ( { type: 'SET_LOADING', isLoading } ),
	setSaving:    ( isSaving )  => ( { type: 'SET_SAVING', isSaving } ),
	setError:     ( error )     => ( { type: 'SET_ERROR', error } ),

	addWorkflow: ( workflow ) => ( { type: 'ADD_WORKFLOW', workflow } ),
	updateWorkflow: ( workflow ) => ( { type: 'UPDATE_WORKFLOW', workflow } ),
	removeWorkflow: ( id ) => ( { type: 'REMOVE_WORKFLOW', id } ),

	fetchWorkflows: () => async ( { dispatch } ) => {
		dispatch( actions.setLoading( true ) );
		dispatch( actions.setError( null ) );
		try {
			const workflows = await apiFetch( { path: '/stepwise/v1/workflows?per_page=100' } );
			dispatch( actions.setWorkflows( workflows ) );
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
		} finally {
			dispatch( actions.setLoading( false ) );
		}
	},

	createWorkflow: ( data ) => async ( { dispatch } ) => {
		dispatch( actions.setSaving( true ) );
		dispatch( actions.setError( null ) );
		try {
			const workflow = await apiFetch( {
				path: '/stepwise/v1/workflows',
				method: 'POST',
				data,
			} );
			dispatch( actions.addWorkflow( workflow ) );
			return workflow;
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
			return null;
		} finally {
			dispatch( actions.setSaving( false ) );
		}
	},

	saveWorkflow: ( id, data ) => async ( { dispatch } ) => {
		dispatch( actions.setSaving( true ) );
		dispatch( actions.setError( null ) );
		try {
			const workflow = await apiFetch( {
				path: `/stepwise/v1/workflows/${ id }`,
				method: 'PATCH',
				data,
			} );
			dispatch( actions.updateWorkflow( workflow ) );
			return workflow;
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
			return null;
		} finally {
			dispatch( actions.setSaving( false ) );
		}
	},

	deleteWorkflow: ( id ) => async ( { dispatch } ) => {
		try {
			await apiFetch( {
				path: `/stepwise/v1/workflows/${ id }`,
				method: 'DELETE',
			} );
			dispatch( actions.removeWorkflow( id ) );
			return true;
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
			return false;
		}
	},
};

const reducer = ( state = DEFAULT_STATE, action ) => {
	switch ( action.type ) {
		case 'SET_WORKFLOWS':
			return { ...state, workflows: action.workflows };
		case 'SET_LOADING':
			return { ...state, isLoading: action.isLoading };
		case 'SET_SAVING':
			return { ...state, isSaving: action.isSaving };
		case 'SET_ERROR':
			return { ...state, error: action.error };
		case 'ADD_WORKFLOW':
			return { ...state, workflows: [ action.workflow, ...state.workflows ] };
		case 'UPDATE_WORKFLOW':
			return {
				...state,
				workflows: state.workflows.map( ( w ) =>
					w.id === action.workflow.id ? action.workflow : w
				),
			};
		case 'REMOVE_WORKFLOW':
			return {
				...state,
				workflows: state.workflows.filter( ( w ) => w.id !== action.id ),
			};
		default:
			return state;
	}
};

const selectors = {
	getWorkflows:  ( state ) => state.workflows,
	isLoading:     ( state ) => state.isLoading,
	isSaving:      ( state ) => state.isSaving,
	getError:      ( state ) => state.error,
	getWorkflow:   ( state, id ) => state.workflows.find( ( w ) => w.id === id ) ?? null,
};

const store = createReduxStore( 'stepwise/workflows', { reducer, actions, selectors } );
register( store );

export default store;
