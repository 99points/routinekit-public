import { useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Badge from '../shared/Badge';
import PushToSaasModal from '../step-builder/PushToSaasModal';

const { adminUrl = '', isPro = false, saasConnected = false, canEdit = false, canRun = false } = window.alignpressData ?? {};
const currentUserId = parseInt( window.alignpressData?.currentUserId ?? 0, 10 );

const parseHostname = ( url ) => {
	try { return new URL( url ).hostname; } catch { return null; }
};

const timeAgo = ( dateStr ) => {
	if ( ! dateStr ) return '—';
	const diff = Date.now() - new Date( dateStr ).getTime();
	const days  = Math.floor( diff / 86400000 );
	const weeks = Math.floor( days / 7 );
	if ( days === 0 ) return __( 'Today', 'alignpress' );
	if ( days === 1 ) return __( '1 day ago', 'alignpress' );
	if ( days < 14 ) return `${ days } ${ __( 'days ago', 'alignpress' ) }`;
	if ( weeks < 8 ) return `${ weeks } ${ __( 'weeks ago', 'alignpress' ) }`;
	return new Date( dateStr ).toLocaleDateString();
};

const ProgressCell = ( { workflow } ) => {
	const steps      = workflow.steps ?? [];
	const total      = steps.length;
	const completed  = steps.filter( ( s ) => s.last_completion?.status === 'completed' ).length;
	const allDone    = total > 0 && completed === total;
	const neverRun   = ! workflow.last_run_at;

	if ( total === 0 || neverRun ) {
		return <span className="ap-progress-none">{ __( 'Not started', 'alignpress' ) }</span>;
	}

	const pct = total ? Math.round( ( completed / total ) * 100 ) : 0;

	return (
		<div className="ap-progress">
			<div className={ `ap-progress__label ${ allDone ? 'ap-progress__label--done' : '' }` }>
				{ completed } / { total }{ allDone && ' ✓' }
			</div>
			<div className="ap-progress__bar">
				<div
					className={ `ap-progress__fill ${ allDone ? 'ap-progress__fill--done' : '' }` }
					style={ { width: `${ pct }%` } }
				/>
			</div>
		</div>
	);
};

const WorkflowRow = ( { workflow, checked, onCheck, onStartRun } ) => {
	const [ isDeleting, setIsDeleting ]         = useState( false );
	const [ isDuplicating, setDuplicating ]     = useState( false );
	const [ runState, setRunState ]             = useState( 'idle' ); // idle | starting | started
	const [ showPushModal, setShowPushModal ]         = useState( false );

	const { deleteWorkflow, createWorkflow } = useDispatch( 'alignpress/workflows' );

	const activeExecution = useSelect( ( select ) => select( 'alignpress/execution' ).getActiveExecution() );
	const isThisWorkflowRunning = activeExecution?.workflow_id === workflow.id && activeExecution?.status === 'in_progress';

	const stepCount = workflow.steps?.length ?? 0;
	const editUrl   = `${ adminUrl }admin.php?page=alignpress&workflow_id=${ workflow.id }`;
	const exportUrl = `${ window.alignpressData?.restUrl ?? '' }workflows/${ workflow.id }/export`;

	const handleDelete = async () => {
		if ( ! window.confirm( __( 'Delete this workflow? This cannot be undone.', 'alignpress' ) ) ) return;
		setIsDeleting( true );
		await deleteWorkflow( workflow.id );
	};

	const handleDuplicate = async () => {
		setDuplicating( true );
		await createWorkflow( {
			title:       workflow.title + ' ' + __( '(Copy)', 'alignpress' ),
			description: workflow.description,
			status:      'draft',
		} );
		setDuplicating( false );
	};

	const handleExport = () => {
		window.open( exportUrl, '_blank' );
	};

	const hasCategory    = !! workflow.category;
	const isPushed    = !! workflow.pushed_at;

	const doRun = async () => {
		setRunState( 'starting' );
		await onStartRun( workflow.id );
		setRunState( 'started' );
		setTimeout( () => setRunState( 'idle' ), 2000 );
	};

	const handleRun = () => {
		if ( ! hasCategory ) {
			// eslint-disable-next-line no-alert
			alert( __( 'Please select a category for this workflow before running it.', 'alignpress' ) );
			return;
		}
		doRun();
	};

	const isActive      = workflow.status === 'active';
	const isRunnable    = isActive && stepCount > 0;
	const hasRunHistory = workflow.run_count > 0;
	const canDelete     = ! isPushed && ! hasRunHistory;

	return (
	<>
		<tr className={ `ap-workflow-row ap-workflow-row--${ workflow.status }` }>
			<td className="ap-col-check">
				<input type="checkbox" checked={ checked } onChange={ onCheck } />
			</td>

			<td className="ap-col-name ap-workflow-row__title">
				{ canEdit
					? <a href={ editUrl } className="ap-link-strong">{ workflow.title }</a>
					: <span className="ap-link-strong">{ workflow.title }</span>
				}
				{ workflow.source !== 'local' && (
					<span className="ap-workflow-row__source-wrap">
						<span className="ap-workflow-row__source">
							{ workflow.source === 'saas' ? __( 'Assigned', 'alignpress' ) : __( 'Imported', 'alignpress' ) }
						</span>
						{ workflow.source === 'saas' && workflow.source_site_url && (
							<span className="ap-workflow-row__source-domain">
								{ parseHostname( workflow.source_site_url ) }
							</span>
						) }
					</span>
				) }
				{ canEdit && (
					<div className="ap-workflow-row__actions">
						<a href={ editUrl }>{ __( 'Edit', 'alignpress' ) }</a>
						<span className="ap-row-sep">|</span>
						<button className="ap-row-action" onClick={ handleDuplicate } disabled={ isDuplicating }>
							{ isDuplicating ? '…' : __( 'Duplicate', 'alignpress' ) }
						</button>
						<span className="ap-row-sep">|</span>
						<button className="ap-row-action" onClick={ handleExport }>
							{ __( 'Export (JSON)', 'alignpress' ) }
						</button>
						{ canDelete && (
							<>
								<span className="ap-row-sep">|</span>
								<button className="ap-row-action ap-row-action--danger" onClick={ handleDelete } disabled={ isDeleting }>
									{ isDeleting ? __( 'Deleting…', 'alignpress' ) : __( 'Delete', 'alignpress' ) }
								</button>
							</>
						) }
						{ ! canDelete && (
							<>
								<span className="ap-row-sep">|</span>
								<span className="ap-row-action ap-row-action--muted" title={ __( 'Cannot delete — workflow has been pushed or run. Archive instead.', 'alignpress' ) }>
									{ __( 'Delete', 'alignpress' ) }
								</span>
							</>
						) }
					</div>
				) }
			</td>

			<td className="ap-col-steps">{ stepCount }</td>

			<td className="ap-col-lastrun">{ timeAgo( workflow.last_run_at ) }</td>

			<td className="ap-col-progress">
				<ProgressCell workflow={ workflow } />
			</td>

			<td className="ap-col-status">
				<Badge variant={ workflow.status }>
					{ workflow.status === 'active'   ? __( 'Active', 'alignpress' )
					: workflow.status === 'draft'    ? __( 'Draft', 'alignpress' )
					:                                  __( 'Archived', 'alignpress' ) }
				</Badge>
			</td>

			<td className="ap-col-action">
				{ canRun && isRunnable && (
					<button
						className={ `alignpress-btn alignpress-btn--sm alignpress-btn--run ${ runState === 'started' ? 'alignpress-btn--success' : isThisWorkflowRunning ? 'alignpress-btn--running' : 'alignpress-btn--primary' }` }
						onClick={ handleRun }
						disabled={ runState !== 'idle' || isThisWorkflowRunning }
						title={
							isThisWorkflowRunning ? __( 'This workflow is currently running', 'alignpress' )
							: ! hasCategory       ? __( 'Select a category before running', 'alignpress' )
							: undefined
						}
					>
						{ isThisWorkflowRunning && <span className="ap-btn-spinner" /> }
						{ ! isThisWorkflowRunning && runState === 'starting' && <span className="ap-btn-spinner" /> }
						{ ! isThisWorkflowRunning && runState === 'started' && '✓ ' }
						{ isThisWorkflowRunning     ? __( 'Running…', 'alignpress' )
						: runState === 'starting'   ? __( 'Starting…', 'alignpress' )
						: runState === 'started'    ? __( 'Started!', 'alignpress' )
						:                             `▶ ${ __( 'Run Workflow', 'alignpress' ) }` }
					</button>
				) }
				{ canEdit && ( ! isActive || stepCount === 0 ) && (
					<a href={ editUrl } className="alignpress-btn alignpress-btn--secondary alignpress-btn--sm">
						{ __( 'Edit Draft', 'alignpress' ) }
					</a>
				) }
			</td>
		</tr>
		{ showPushModal && createPortal(
			<PushToSaasModal
				workflowId={ workflow.id }
				pushedGroupIds={ workflow.pushed_group_ids ?? [] }
				onClose={ () => setShowPushModal( false ) }
				onPushed={ () => {} }
			/>,
			document.body
		) }
	</>
	);
};

WorkflowRow.propTypes = {
	workflow:   PropTypes.object.isRequired,
	checked:    PropTypes.bool.isRequired,
	onCheck:    PropTypes.func.isRequired,
	onStartRun: PropTypes.func.isRequired,
};

export default WorkflowRow;
