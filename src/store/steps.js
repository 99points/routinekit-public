import { createReduxStore, register } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

const DEFAULT_STATE = {
	// keyed by workflow_id
	byWorkflow: {},
	isLoading: false,
	isSaving: false,
	error: null,
};

const actions = {
	setSteps:     ( workflowId, steps ) => ( { type: 'SET_STEPS', workflowId, steps } ),
	setLoading:   ( isLoading ) => ( { type: 'SET_LOADING', isLoading } ),
	setSaving:    ( isSaving )  => ( { type: 'SET_SAVING', isSaving } ),
	setError:     ( error )     => ( { type: 'SET_ERROR', error } ),
	addStep:      ( workflowId, step ) => ( { type: 'ADD_STEP', workflowId, step } ),
	updateStep:   ( workflowId, step ) => ( { type: 'UPDATE_STEP', workflowId, step } ),
	removeStep:   ( workflowId, stepId ) => ( { type: 'REMOVE_STEP', workflowId, stepId } ),

	fetchSteps: ( workflowId ) => async ( { dispatch } ) => {
		dispatch( actions.setLoading( true ) );
		try {
			const steps = await apiFetch( {
				path: `/alignpress/v1/workflows/${ workflowId }/steps`,
			} );
			dispatch( actions.setSteps( workflowId, steps ) );
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
		} finally {
			dispatch( actions.setLoading( false ) );
		}
	},

	createStep: ( workflowId, data ) => async ( { dispatch } ) => {
		dispatch( actions.setSaving( true ) );
		try {
			const step = await apiFetch( {
				path: `/alignpress/v1/workflows/${ workflowId }/steps`,
				method: 'POST',
				data,
			} );
			dispatch( actions.addStep( workflowId, step ) );
			return step;
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
			return null;
		} finally {
			dispatch( actions.setSaving( false ) );
		}
	},

	saveStep: ( workflowId, stepId, data ) => async ( { dispatch } ) => {
		dispatch( actions.setSaving( true ) );
		try {
			const step = await apiFetch( {
				path: `/alignpress/v1/workflows/${ workflowId }/steps/${ stepId }`,
				method: 'PATCH',
				data,
			} );
			dispatch( actions.updateStep( workflowId, step ) );
			return step;
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
			return null;
		} finally {
			dispatch( actions.setSaving( false ) );
		}
	},

	deleteStep: ( workflowId, stepId ) => async ( { dispatch } ) => {
		try {
			await apiFetch( {
				path: `/alignpress/v1/workflows/${ workflowId }/steps/${ stepId }`,
				method: 'DELETE',
			} );
			dispatch( actions.removeStep( workflowId, stepId ) );
			return true;
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
			return false;
		}
	},

	reorderSteps: ( workflowId, order ) => async ( { dispatch } ) => {
		try {
			const steps = await apiFetch( {
				path: `/alignpress/v1/workflows/${ workflowId }/steps/reorder`,
				method: 'PATCH',
				data: { order },
			} );
			dispatch( actions.setSteps( workflowId, steps ) );
		} catch ( error ) {
			dispatch( actions.setError( error.message ) );
		}
	},
};

const reducer = ( state = DEFAULT_STATE, action ) => {
	switch ( action.type ) {
		case 'SET_STEPS':
			return {
				...state,
				byWorkflow: { ...state.byWorkflow, [ action.workflowId ]: action.steps },
			};
		case 'SET_LOADING':
			return { ...state, isLoading: action.isLoading };
		case 'SET_SAVING':
			return { ...state, isSaving: action.isSaving };
		case 'SET_ERROR':
			return { ...state, error: action.error };
		case 'ADD_STEP': {
			const existing = state.byWorkflow[ action.workflowId ] ?? [];
			return {
				...state,
				byWorkflow: {
					...state.byWorkflow,
					[ action.workflowId ]: [ ...existing, action.step ],
				},
			};
		}
		case 'UPDATE_STEP': {
			const existing = state.byWorkflow[ action.workflowId ] ?? [];
			return {
				...state,
				byWorkflow: {
					...state.byWorkflow,
					[ action.workflowId ]: existing.map( ( s ) =>
						s.id === action.step.id ? action.step : s
					),
				},
			};
		}
		case 'REMOVE_STEP': {
			const existing = state.byWorkflow[ action.workflowId ] ?? [];
			return {
				...state,
				byWorkflow: {
					...state.byWorkflow,
					[ action.workflowId ]: existing.filter( ( s ) => s.id !== action.stepId ),
				},
			};
		}
		default:
			return state;
	}
};

const selectors = {
	getSteps:    ( state, workflowId ) => state.byWorkflow[ workflowId ] ?? [],
	isLoading:   ( state ) => state.isLoading,
	isSaving:    ( state ) => state.isSaving,
	getError:    ( state ) => state.error,
};

const store = createReduxStore( 'alignpress/steps', { reducer, actions, selectors } );
register( store );

export default store;
