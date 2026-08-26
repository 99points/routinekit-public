import { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import RunnerNotes from './RunnerNotes';

const isSafeUrl = ( url ) => /^https?:\/\//i.test( url );

const RunnerStep = ( { step, executionId, completion, isCurrent, isExpanded, isPushed, isSaas, onToggle, onCompleted } ) => {
	const [ skipReason, setSkipReason ]   = useState( '' );
	const [ showSkip, setShowSkip ]       = useState( false );
	const [ completing, setCompleting ]   = useState( false );
	const [ skipping, setSkipping ]       = useState( false );
	const [ reopening, setReopening ]     = useState( false );

	const { completeStep, skipStep, uncompleteStep } = useDispatch( 'alignpress/execution' );

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
			{ /* Row header — always visible */ }
			<div className="ap-runner-step__row">
				{ ! isPushed && ! isSaas && (
					<span
						className="ap-runner-step__drag"
						{ ...attributes }
						{ ...listeners }
						title={ __( 'Drag to reorder', 'alignpress' ) }
					>
						⋮⋮
					</span>
				) }

				{ /* Todo circle — marks complete / shows done state */ }
				{ ! isSkipped && (
					<button
						type="button"
						className={ `ap-runner-step__check${ isCompleted ? ' is-done' : '' }${ completing ? ' is-completing' : '' }` }
						onClick={ isCompleted ? handleReopen : handleComplete }
						disabled={ completing || reopening }
						title={ isCompleted ? __( 'Reopen step', 'alignpress' ) : __( 'Mark complete', 'alignpress' ) }
						aria-label={ isCompleted ? __( 'Reopen step', 'alignpress' ) : __( 'Mark complete', 'alignpress' ) }
					>
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
							<path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
					</button>
				) }
				{ isSkipped && (
					<span className="ap-runner-step__check is-skipped" aria-label={ __( 'Skipped', 'alignpress' ) }>–</span>
				) }

				<span className="ap-runner-step__title" onClick={ onToggle }>{ step.title }</span>

				{ isCurrent && ! isDone && (
					<span className="ap-runner-step__badge ap-runner-step__badge--active" aria-hidden="true">●</span>
				) }

				<span className="ap-runner-step__chevron" aria-hidden="true" onClick={ onToggle }>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path d="M3.5 5.5L7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
					</svg>
				</span>
			</div>

			{ /* Expanded body */ }
			{ isExpanded && (
				<div className="ap-runner-step__body">
					{ step.description && (
						<p className="ap-runner-step__instructions">{ step.description }</p>
					) }

					{ step.deep_link && isSafeUrl( step.deep_link ) && ! isDone && (
						<a href={ step.deep_link } className="ap-runner-step__deeplink" target="_blank" rel="noopener noreferrer">
							{ __( 'Go to settings →', 'alignpress' ) }
						</a>
					) }

					<RunnerNotes stepId={ step.id } isSaas={ isSaas } />

					{ isSkipped && completion?.skipped_reason && (
						<p className="ap-runner-step__skipped-reason">
							{ __( 'Skipped:', 'alignpress' ) } { completion.skipped_reason }
						</p>
					) }

					{ ! isDone && (
						<>
							{ ! showSkip ? (
								! step.is_required && (
									<div className="ap-runner-step__actions">
										<button type="button" className="ap-runner-step__skip-btn" onClick={ () => setShowSkip( true ) }>
											{ __( 'Skip', 'alignpress' ) }
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
										placeholder={ __( 'Reason for skipping (optional)…', 'alignpress' ) }
										autoFocus
									/>
									<div className="ap-runner-step__skip-actions">
										<button type="button" className="ap-runner-step__skip-confirm" onClick={ handleSkip } disabled={ skipping }>
											{ skipping ? __( 'Skipping…', 'alignpress' ) : __( 'Confirm skip', 'alignpress' ) }
										</button>
										<button type="button" className="ap-runner-step__skip-cancel" onClick={ () => setShowSkip( false ) }>
											{ __( 'Cancel', 'alignpress' ) }
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
};

RunnerStep.defaultProps = {
	completion:  null,
	isCurrent:   false,
	isExpanded:  false,
	isPushed:    false,
	isSaas:      false,
	onCompleted: null,
};

export default RunnerStep;
