import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	SortableContext,
	verticalListSortingStrategy,
	arrayMove,
} from '@dnd-kit/sortable';

const restrictToVerticalAxis = ( { transform } ) => ( { ...transform, x: 0 } );
import RunnerProgress from './RunnerProgress';
import RunnerStep from './RunnerStep';
import RunnerLauncher from './RunnerLauncher';
import AuditTrail from './AuditTrail';
import '../store';

const { runnerPosition = 'right' } = window.alignpressData ?? {};
const RUNNER_CLOSED_KEY     = 'ap_runner_closed_id';
const RUNNER_DISMISSED_KEY  = 'ap_runner_dismissed_ids';

/**
 * Returns { panelStyle, onPointerDown } for a freely-draggable fixed panel.
 * Position is session-only — resets to CSS default on reload.
 * Uses stable refs for move/up handlers to avoid stale-closure issues.
 */
const useDragPanel = () => {
	const [ offset, setOffset ] = useState( null ); // { x, y } px from viewport top-left; null = CSS default
	const stateRef = useRef( { dragging: false, mx: 0, my: 0, px: 0, py: 0 } );

	// Stable move handler stored in a ref so add/remove always use the same function object.
	const moveRef = useRef( null );
	const upRef   = useRef( null );

	moveRef.current = ( e ) => {
		if ( ! stateRef.current.dragging ) return;
		const { mx, my, px, py } = stateRef.current;
		const x = Math.max( 0, Math.min( window.innerWidth  - 60, px + e.clientX - mx ) );
		const y = Math.max( 0, Math.min( window.innerHeight - 60, py + e.clientY - my ) );
		setOffset( { x, y } );
	};

	upRef.current = () => {
		stateRef.current.dragging = false;
		window.removeEventListener( 'pointermove', moveHandler );
		window.removeEventListener( 'pointerup',   upHandler );
	};

	// Wrap in stable functions so add/removeEventListener de-duplication works correctly.
	const moveHandler = useCallback( ( e ) => moveRef.current( e ), [] );
	const upHandler   = useCallback( ()  => upRef.current(),       [] );

	const onPointerDown = useCallback( ( e ) => {
		if ( e.button !== 0 ) return;
		// Let clicks on interactive children through untouched.
		if ( e.target.closest( 'button, a, input, select, textarea, [role="button"]' ) ) return;

		e.preventDefault(); // stop text selection while dragging

		const panel = e.currentTarget.closest( '.ap-runner' );
		const rect  = panel ? panel.getBoundingClientRect() : { left: 0, top: 0 };

		stateRef.current = {
			dragging: true,
			mx: e.clientX,
			my: e.clientY,
			px: rect.left,
			py: rect.top,
		};

		window.addEventListener( 'pointermove', moveHandler );
		window.addEventListener( 'pointerup',   upHandler );
	}, [ moveHandler, upHandler ] );

	// Clean up listeners if the component unmounts mid-drag.
	useEffect( () => () => {
		window.removeEventListener( 'pointermove', moveHandler );
		window.removeEventListener( 'pointerup',   upHandler );
	}, [ moveHandler, upHandler ] );

	const panelStyle = offset ? { left: offset.x, top: offset.y, right: 'unset' } : {};

	return { panelStyle, onPointerDown };
};

const Runner = () => {
	const [ isOpen, setIsOpen ]             = useState( true );
	const [ expandedIds, setExpandedIds ]   = useState( new Set() );
	const [ addingStep, setAddingStep ]     = useState( false );
	const [ newStepTitle, setNewStepTitle ] = useState( '' );
	const [ savingStep, setSavingStep ]     = useState( false );
	const [ stepError, setStepError ]       = useState( null );
	const [ localSteps, setLocalSteps ]     = useState( null ); // optimistic order during drag

	const { fetchActiveExecution, clearExecution, cancelExecution } = useDispatch( 'alignpress/execution' );
	const { reorderSteps } = useDispatch( 'alignpress/steps' );

	const activeExecution = useSelect( ( select ) => select( 'alignpress/execution' ).getActiveExecution() );
	const isLoading       = useSelect( ( select ) => select( 'alignpress/execution' ).isLoading() );

	const sensors = useSensors( useSensor( PointerSensor, { activationConstraint: { distance: 6 } } ) );
	const { panelStyle, onPointerDown: onHeaderPointerDown } = useDragPanel();

	useEffect( () => { fetchActiveExecution(); }, [] );

	// Restore closed state when execution first loads or a new run starts.
	useEffect( () => {
		if ( ! activeExecution ) return;
		if ( activeExecution.status === 'abandoned' ) { setIsOpen( true ); return; }
		const closedId = localStorage.getItem( RUNNER_CLOSED_KEY );
		setIsOpen( closedId !== String( activeExecution.id ) );
		setExpandedIds( new Set() );
		setLocalSteps( null );
	// Only re-run when the execution ID changes (new run) — NOT on step completions.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ activeExecution?.id ] );

	useEffect( () => {
		const onVisible = () => { if ( document.visibilityState === 'visible' ) fetchActiveExecution(); };
		document.addEventListener( 'visibilitychange', onVisible );
		return () => document.removeEventListener( 'visibilitychange', onVisible );
	}, [] );

	const toggleExpand = ( stepId ) => {
		setExpandedIds( ( prev ) => {
			const next = new Set( prev );
			next.has( stepId ) ? next.delete( stepId ) : next.add( stepId );
			return next;
		} );
	};

	const handleAddStep = async () => {
		if ( ! newStepTitle.trim() ) return;
		setSavingStep( true );
		setStepError( null );
		try {
			await apiFetch( {
				path:   `/alignpress/v1/workflows/${ activeExecution.workflow_id }/steps`,
				method: 'POST',
				data:   { title: newStepTitle.trim(), is_required: true },
			} );
			setNewStepTitle( '' );
			setAddingStep( false );
			await fetchActiveExecution();
		} catch ( err ) {
			setStepError( err.message ?? __( 'Could not add step.', 'alignpress' ) );
		} finally {
			setSavingStep( false );
		}
	};

	const handleDragEnd = async ( event ) => {
		const { active, over } = event;
		if ( ! over || active.id === over.id ) return;

		const steps = localSteps ?? activeExecution.steps;
		const oldIdx = steps.findIndex( ( s ) => s.id === active.id );
		const newIdx = steps.findIndex( ( s ) => s.id === over.id );
		const reordered = arrayMove( steps, oldIdx, newIdx );

		setLocalSteps( reordered );
		const order = reordered.map( ( s, i ) => ( { id: s.id, sort_order: ( i + 1 ) * 10 } ) );
		try {
			await reorderSteps( activeExecution.workflow_id, order );
			await fetchActiveExecution();
		} catch {
			setLocalSteps( null );
		}
	};

	if ( isLoading && ! activeExecution ) return null;

	if ( ! activeExecution ) {
		return <RunnerLauncher hasActive={ false } onClick={ () => {} } />;
	}

	const {
		id, workflow_title,
		steps: rawSteps = [],
		current_step_index = 0,
		total_steps = 0,
		completed_steps = 0,
		workflow_id,
	} = activeExecution;

	const steps       = localSteps ?? rawSteps;
	const completions = Object.fromEntries(
		rawSteps.filter( ( s ) => s.completion ).map( ( s ) => [ s.id, s.completion ] )
	);
	const isPushed    = !! activeExecution.workflow_pushed_at;
	const isSaas      = activeExecution.workflow_source === 'saas';
	const isCompleted = activeExecution.status === 'completed';
	const isAbandoned = activeExecution.status === 'abandoned';
	const posClass    = runnerPosition === 'left' ? 'ap-runner--left' : 'ap-runner--right';
	const progress    = `${ current_step_index + 1 }/${ total_steps }`;

	const handleClose = () => {
		localStorage.setItem( RUNNER_CLOSED_KEY, String( id ) );
		setIsOpen( false );
	};
	const handleAbort = () => {
		if ( window.confirm( __( 'Abandon this workflow run? Progress will be lost.', 'alignpress' ) ) ) {
			localStorage.removeItem( RUNNER_CLOSED_KEY );
			cancelExecution( id );
		}
	};
	const handleDismiss = () => {
		localStorage.removeItem( RUNNER_CLOSED_KEY );
		// Remember this execution ID so fetchActiveExecution ignores it if the
		// server returns it again within the 5-minute abandoned window.
		try {
			const dismissed = new Set( JSON.parse( localStorage.getItem( RUNNER_DISMISSED_KEY ) || '[]' ).map( String ) );
			dismissed.add( String( id ) );
			localStorage.setItem( RUNNER_DISMISSED_KEY, JSON.stringify( [ ...dismissed ] ) );
		} catch {}
		clearExecution();
		// Notify other components (CaptureToast) that the runner was dismissed.
		window.dispatchEvent( new CustomEvent( 'ap:execution:dismissed' ) );
	};

	return (
		<>
			{ isOpen && (
				<div className={ `ap-runner ${ posClass }` } style={ panelStyle } role="complementary" aria-label={ __( 'Workflow Runner', 'alignpress' ) }>

					<div className="ap-runner__header" onPointerDown={ onHeaderPointerDown }>
						<div className="ap-runner__header-left">
							<div className="ap-runner__brand">
								<svg className="ap-runner__logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
									<rect x="5" y="10" width="19" height="6.5" rx="2" fill="rgba(255,255,255,0.45)"/>
									<rect x="5" y="20.75" width="19" height="6.5" rx="2" fill="rgba(255,255,255,0.45)"/>
									<rect x="5" y="31.5" width="19" height="6.5" rx="2" fill="rgba(255,255,255,0.45)"/>
									<path d="M26 27 32 33 43 13" stroke="rgba(255,255,255,0.9)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
								</svg>
								<span className="ap-runner__eyebrow">ALIGNPRESS RUN</span>
							</div>
							<span className="ap-runner__title" title={ workflow_title }>{ workflow_title }</span>
						</div>
						<button
							type="button"
							className="ap-runner__close"
							onClick={ handleClose }
							aria-label={ __( 'Minimise runner', 'alignpress' ) }
							title={ __( 'Minimise', 'alignpress' ) }
						>
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
								<rect x="1" y="9" width="12" height="2" rx="1" fill="currentColor"/>
							</svg>
						</button>
					</div>

					{ ! isAbandoned && (
						<RunnerProgress current={ current_step_index + 1 } total={ total_steps } completed={ completed_steps } />
					) }

					{ isAbandoned ? (
						<div className="ap-runner__abandoned">
							<span className="ap-runner__abandoned-icon">⚠</span>
							<p className="ap-runner__abandoned-msg">
								{ __( 'Your run was stopped — either you started a new run or an admin reset the workflow.', 'alignpress' ) }
							</p>
							<button type="button" className="ap-runner__dismiss-btn" onClick={ handleDismiss }>
								{ __( 'Dismiss', 'alignpress' ) }
							</button>
						</div>

					) : isCompleted ? (
						<div className="ap-runner__complete">
							<span className="ap-runner__complete-icon">✓</span>
							<p className="ap-runner__complete-msg">{ __( 'Workflow complete!', 'alignpress' ) }</p>
							<AuditTrail executionId={ id } />
							<button type="button" className="ap-runner__dismiss-btn" onClick={ handleDismiss }>
								{ __( 'Dismiss', 'alignpress' ) }
							</button>
						</div>

					) : (
						<div className="ap-runner__body">
							<DndContext
								sensors={ sensors }
								collisionDetection={ closestCenter }
								modifiers={ [ restrictToVerticalAxis ] }
								onDragEnd={ handleDragEnd }
							>
								<SortableContext items={ steps.map( ( s ) => s.id ) } strategy={ verticalListSortingStrategy }>
									<ol className="ap-runner__step-list">
										{ steps.map( ( step, i ) => {
											const isCurrent  = i === current_step_index;
											const isExpanded = expandedIds.has( step.id );
											return (
												<RunnerStep
													key={ step.id }
													step={ step }
													executionId={ id }
													completion={ completions[ step.id ] ?? null }
													isCurrent={ isCurrent }
													isExpanded={ isExpanded }
													isPushed={ isPushed }
													isSaas={ isSaas }
													onToggle={ () => toggleExpand( step.id ) }
													onCompleted={ undefined }
												/>
											);
										} ) }
									</ol>
								</SortableContext>
							</DndContext>

							<div className="ap-runner__footer">
								{ ! isPushed && ! isSaas && (
									! addingStep ? (
										<button type="button" className="ap-runner__add-step-btn" onClick={ () => setAddingStep( true ) }>
											+ { __( 'Add step', 'alignpress' ) }
										</button>
									) : (
										<div className="ap-runner__add-step-form">
											<input
												type="text"
												className="ap-runner__add-step-input"
												value={ newStepTitle }
												onChange={ ( e ) => setNewStepTitle( e.target.value ) }
												placeholder={ __( 'Step title…', 'alignpress' ) }
												autoFocus
												onKeyDown={ ( e ) => {
													if ( e.key === 'Enter' ) handleAddStep();
													if ( e.key === 'Escape' ) { setAddingStep( false ); setNewStepTitle( '' ); }
												} }
											/>
											{ stepError && <p className="ap-runner__add-step-error">{ stepError }</p> }
											<div className="ap-runner__add-step-actions">
												<button type="button" className="ap-runner__add-step-save" onClick={ handleAddStep } disabled={ savingStep || ! newStepTitle.trim() }>
													{ savingStep ? __( 'Adding…', 'alignpress' ) : __( 'Add', 'alignpress' ) }
												</button>
												<button type="button" className="ap-runner__add-step-cancel" onClick={ () => { setAddingStep( false ); setNewStepTitle( '' ); setStepError( null ); } }>
													{ __( 'Cancel', 'alignpress' ) }
												</button>
											</div>
										</div>
									)
								) }

								<button type="button" className="ap-runner__abort" onClick={ handleAbort }>
									{ __( 'Abandon run', 'alignpress' ) }
								</button>
							</div>
						</div>
					) }
				</div>
			) }

			<RunnerLauncher
				hasActive={ ! isAbandoned && ! isCompleted }
				isOpen={ isOpen }
				onClick={ () => setIsOpen( ( o ) => ! o ) }
				progress={ ( ! isAbandoned && ! isCompleted ) ? progress : null }
			/>
		</>
	);
};

export default Runner;
