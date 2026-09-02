import { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import RunnerNotes from './RunnerNotes';
import { resolveDeepLink } from '../shared/deeplink';

const RunnerStep = ( { step, executionId, completion, isCurrent, isExpanded, isPushed, isSaas, onToggle, onCompleted, onDelete } ) => {
	const [ skipReason, setSkipReason ]   = useState( '' );
	const [ showSkip, setShowSkip ]       = useState( false );
	const [ completing, setCompleting ]   = useState( false );
	const [ skipping, setSkipping ]       = useState( false );
	const [ reopening, setReopening ]     = useState( false );
	const [ deleting, setDeleting ]       = useState( false );

	const { completeStep, skipStep, uncompleteStep } = useDispatch( 'routinekit/execution' );

	const handleDelete = async () => {
		if ( ! window.confirm( __( 'Delete this step? This cannot be undone.', 'routinekit' ) ) ) return;
		setDeleting( true );
		await onDelete();
	};

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: step.id, disabled: isPushed || isSaas } );

	const style = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const isCompleted = completion?.status === 'completed';
	const isSkipped   = completion?.status === 'skipped';
	const isDone      = isCompleted || isSkipped;

	const handleComplete = async () => {
		setCompleting( true );
		await completeStep( executionId, step.id );
		setCompleting( false );
		onCompleted?.();
	};

	const handleSkip = async () => {
		if ( ! skipReason.trim() && step.is_required ) return;
		setSkipping( true );
		await skipStep( executionId, step.id, skipReason );
		setSkipping( false );
		setShowSkip( false );
		onCompleted?.();
	};

	const handleReopen = async () => {
		setReopening( true );
		await uncompleteStep( executionId, step.id );
		setReopening( false );
	};

	// Status badge
	return (
		<li
			ref={ setNodeRef }
			style={ style }
			className={ `ap-runner-step ${ isDone ? 'ap-runner-step--done' : '' } ${ isCurrent ? 'ap-runner-step--current' : '' } ${ isExpanded ? 'ap-runner-step--expanded' : '' }` }
		>
			{ /* Row header — always visible; entire row toggles expand */ }
			<div className="ap-runner-step__row" onClick={ onToggle }>
				{ ! isPushed && ! isSaas && (
					<span
						className="ap-runner-step__drag"
						{ ...attributes }
						{ ...listeners }
						title={ __( 'Drag to reorder', 'routinekit' ) }
						onClick={ ( e ) => e.stopPropagation() }
					>
						⋮⋮
					</span>
				) }

				{ /* Todo circle — marks complete / shows done state */ }
				{ ! isSkipped && (
					<button
						type="button"
						className={ `ap-runner-step__check${ isCompleted ? ' is-done' : '' }${ completing ? ' is-completing' : '' }` }
						onClick={ ( e ) => { e.stopPropagation(); isCompleted ? handleReopen() : handleComplete(); } }
						disabled={ completing || reopening }
						title={ isCompleted ? __( 'Reopen step', 'routinekit' ) : __( 'Mark complete', 'routinekit' ) }
						aria-label={ isCompleted ? __( 'Reopen step', 'routinekit' ) : __( 'Mark complete', 'routinekit' ) }
					>
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
							<path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
					</button>
				) }
				{ isSkipped && (
					<span className="ap-runner-step__check is-skipped" aria-label={ __( 'Skipped', 'routinekit' ) }>–</span>
				) }

				<span className="ap-runner-step__title">{ step.title }</span>

				{ isCurrent && ! isDone && (
					<span className="ap-runner-step__badge ap-runner-step__badge--active" aria-hidden="true">●</span>
				) }

				<span className="ap-runner-step__chevron" aria-hidden="true">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path d="M3.5 5.5L7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
					</svg>
				</span>
			</div>

			{ /* Expanded body */ }
			{ isExpanded && (
				<div className="ap-runner-step__body">
					{ !! resolveDeepLink( step.deep_link ) && ! isDone && (
						<a href={ resolveDeepLink( step.deep_link ) } className="ap-runner-step__deeplink" target="_blank" rel="noopener noreferrer">
							{ __( 'Go to settings →', 'routinekit' ) }
						</a>
					) }

					<RunnerNotes stepId={ step.id } isSaas={ isSaas || isPushed } />

					{ ! isPushed && ! isSaas && (
						<button
							type="button"
							className="ap-runner-step__delete-btn"
							onClick={ handleDelete }
							disabled={ deleting }
						>
							{ deleting ? __( 'Deleting…', 'routinekit' ) : __( 'Delete step', 'routinekit' ) }
						</button>
					) }

					{ isSkipped && completion?.skipped_reason && (
						<p className="ap-runner-step__skipped-reason">
							{ __( 'Skipped:', 'routinekit' ) } { completion.skipped_reason }
						</p>
					) }

					{ ! isDone && (
						<>
							{ ! showSkip ? (
								! step.is_required && (
									<div className="ap-runner-step__actions">
										<button type="button" className="ap-runner-step__skip-btn" onClick={ () => setShowSkip( true ) }>
											{ __( 'Skip', 'routinekit' ) }
										</button>
									</div>
								)
							) : (
								<div className="ap-runner-step__skip">
									<input
										type="text"
										className="ap-runner-step__skip-input"
										value={ skipReason }
										onChange={ ( e ) => setSkipReason( e.target.value ) }
										placeholder={ __( 'Reason for skipping (optional)…', 'routinekit' ) }
										autoFocus
									/>
									<div className="ap-runner-step__skip-actions">
										<button type="button" className="ap-runner-step__skip-confirm" onClick={ handleSkip } disabled={ skipping }>
											{ skipping ? __( 'Skipping…', 'routinekit' ) : __( 'Confirm skip', 'routinekit' ) }
										</button>
										<button type="button" className="ap-runner-step__skip-cancel" onClick={ () => setShowSkip( false ) }>
											{ __( 'Cancel', 'routinekit' ) }
										</button>
									</div>
								</div>
							) }
						</>
					) }
				</div>
			) }
		</li>
	);
};

RunnerStep.propTypes = {
	step:        PropTypes.object.isRequired,
	executionId: PropTypes.number.isRequired,
	completion:  PropTypes.object,
	isCurrent:   PropTypes.bool,
	isExpanded:  PropTypes.bool,
	isPushed:    PropTypes.bool,
	isSaas:      PropTypes.bool,
	onToggle:    PropTypes.func.isRequired,
	onCompleted: PropTypes.func,
	onDelete:    PropTypes.func,
};

RunnerStep.defaultProps = {
	completion:  null,
	isCurrent:   false,
	isExpanded:  false,
	isPushed:    false,
	isSaas:      false,
	onCompleted: null,
	onDelete:    null,
};

export default RunnerStep;
