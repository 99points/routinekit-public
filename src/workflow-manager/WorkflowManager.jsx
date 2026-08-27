import { useEffect, useState } from 'react';
import { useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import WorkflowList from './WorkflowList';
import CreateWorkflowModal from './CreateWorkflowModal';
import ImportUrlModal from './ImportUrlModal';
import ImportJsonModal from './ImportJsonModal';
import TemplatePickerModal from './TemplatePickerModal';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import '../store';

const {
	captureEnabled  = false,
	adminUrl        = '',
	isPro           = false,
	atLimit         = false,
	upgradeUrl      = '#',
	canEdit         = false,
	canRun          = false,
	saasConnected   = false,
} = window.stepwiseData ?? {};

const FREE_LOCAL_LIMIT = 3;

// ── Connect Gate Modal ────────────────────────────────────────────────────────
const ConnectGateModal = ( { onClose, onContinue } ) => {
	const settingsUrl = adminUrl + 'admin.php?page=stepwise-settings#cloud';
	return (
		<Modal
			title={ __( 'You\'re on a roll.', 'stepwise' ) }
			onClose={ onClose }
			size="sm"
			footer={
				<>
					<Button variant="ghost" onClick={ onContinue }>
						{ __( 'Maybe later', 'stepwise' ) }
					</Button>
					<a href={ settingsUrl } className="stepwise-btn stepwise-btn--primary">
						{ __( 'Connect free →', 'stepwise' ) }
					</a>
				</>
			}
		>
			<div className="ap-gate-modal">
				<p className="ap-gate-modal__lead">
					{ __( 'Free local workflows are limited to 3. But here\'s the thing — connecting your free Stepwise account doesn\'t just remove that limit.', 'stepwise' ) }
				</p>
				<ul className="ap-gate-modal__perks">
					<li>
						<span className="ap-gate-modal__perk-icon">🌐</span>
						<span>{ __( 'Push any workflow to up to 3 sites in one click', 'stepwise' ) }</span>
					</li>
					<li>
						<span className="ap-gate-modal__perk-icon">♾️</span>
						<span>{ __( 'Unlimited workflows — build as many as you need', 'stepwise' ) }</span>
					</li>
					<li>
						<span className="ap-gate-modal__perk-icon">⚡</span>
						<span>{ __( 'Sync updates to all connected sites instantly', 'stepwise' ) }</span>
					</li>
				</ul>
				<p className="ap-gate-modal__sub">
					{ __( 'Takes 30 seconds. No credit card.', 'stepwise' ) }
				</p>
			</div>
		</Modal>
	);
};

// ── Switch Run Confirmation Modal ─────────────────────────────────────────────
const SwitchRunModal = ( { currentTitle, nextTitle, onConfirm, onCancel } ) => (
	<Modal
		title={ __( 'Switch active workflow?', 'stepwise' ) }
		onClose={ onCancel }
		size="sm"
		footer={
			<>
				<Button variant="ghost" onClick={ onCancel }>
					{ __( 'Keep current run', 'stepwise' ) }
				</Button>
				<Button variant="primary" onClick={ onConfirm }>
					{ __( 'Switch workflow', 'stepwise' ) }
				</Button>
			</>
		}
	>
		<p style={ { marginBottom: 12 } }>
			{ __( 'You have a run in progress:', 'stepwise' ) }{ ' ' }
			<strong>{ currentTitle }</strong>
		</p>
		<p style={ { marginBottom: 0 } }>
			{ __( 'Switching to', 'stepwise' ) }{ ' ' }
			<strong>{ nextTitle }</strong>{ ' ' }
			{ __( 'will pause your current run. Your progress is saved — click Run on it again to resume from where you left off.', 'stepwise' ) }
		</p>
	</Modal>
);

const WorkflowManager = () => {
	const [ showCreate, setShowCreate ]           = useState( false );
	const [ showImportUrl, setShowImportUrl ]     = useState( false );
	const [ showImportJson, setShowImportJson ]   = useState( false );
	const [ showTemplates, setShowTemplates ]     = useState( false );
	const [ showGate, setShowGate ]               = useState( false );
	const [ pendingRun, setPendingRun ]           = useState( null ); // { workflowId, workflowTitle }

	const { fetchWorkflows } = useDispatch( 'stepwise/workflows' );
	const { startExecution, fetchActiveExecution } = useDispatch( 'stepwise/execution' );

	const workflows      = useSelect( ( select ) => select( 'stepwise/workflows' ).getWorkflows() );
	const isLoading      = useSelect( ( select ) => select( 'stepwise/workflows' ).isLoading() );
	const activeExecution = useSelect( ( select ) => select( 'stepwise/execution' ).getActiveExecution() );

	useEffect( () => {
		fetchWorkflows();
		fetchActiveExecution();
	}, [] );

	const handleCreate = () => {
		if ( ! saasConnected && workflows.length >= FREE_LOCAL_LIMIT ) {
			setShowGate( true );
			return;
		}
		setShowCreate( true );
	};

	const handleStartRun = ( workflowId ) => {
		const isAlreadyRunning = activeExecution?.status === 'in_progress' && activeExecution?.workflow_id === workflowId;
		const conflictExists   = activeExecution?.status === 'in_progress' && activeExecution?.workflow_id !== workflowId;
		// A paused run for a different workflow doesn't need a modal — starting will auto-resume theirs and pause this one.

		if ( isAlreadyRunning ) return; // button is disabled in this case anyway

		if ( conflictExists ) {
			const wf = workflows.find( ( w ) => w.id === workflowId );
			setPendingRun( { workflowId, workflowTitle: wf?.title ?? __( 'this workflow', 'stepwise' ) } );
			return;
		}

		return startExecution( workflowId );
	};

	const confirmSwitch = () => {
		if ( ! pendingRun ) return;
		startExecution( pendingRun.workflowId );
		setPendingRun( null );
	};

	return (
		<div className="ap-workflow-manager">
			<div className="ap-workflow-manager__header">
				<h1 className="ap-page-title">{ __( 'Workflows', 'stepwise' ) }</h1>
				{ canEdit && (
					<div className="ap-workflow-manager__actions">
						<button
							type="button"
							className="stepwise-btn stepwise-btn--ghost stepwise-btn--sm"
							onClick={ () => {
								if ( ! saasConnected && workflows.length >= FREE_LOCAL_LIMIT ) {
									setShowGate( true );
									return;
								}
								setShowTemplates( true );
							} }
						>
							{ __( 'Templates', 'stepwise' ) }
						</button>
						{ isPro && saasConnected && (
							<button
								type="button"
								className="stepwise-btn stepwise-btn--ghost stepwise-btn--sm"
								onClick={ () => setShowImportUrl( true ) }
							>
								{ __( 'Import URL', 'stepwise' ) }
							</button>
						) }
						<button
							type="button"
							className="stepwise-btn stepwise-btn--ghost stepwise-btn--sm"
							onClick={ () => setShowImportJson( true ) }
						>
							{ __( 'Import JSON', 'stepwise' ) }
						</button>
						<Button
							variant="secondary"
							onClick={ handleCreate }
							disabled={ isLoading }
						>
							{ __( 'Add New Workflow', 'stepwise' ) }
						</Button>
					</div>
				) }
			</div>


			{ isLoading && (
				<div className="ap-loading">
					<span className="spinner is-active" />
					{ __( 'Loading workflows…', 'stepwise' ) }
				</div>
			) }

			{ ! isLoading && (
				<WorkflowList
					workflows={ workflows }
					onStartRun={ handleStartRun }
				/>
			) }

			{ /* Capture status bar */ }
			{ captureEnabled && (
				<div className="ap-capture-bar">
					<strong>{ __( 'Auto-capture is on.', 'stepwise' ) }</strong>
					{ ' ' }{ __( 'Stepwise is watching for setting changes on this site.', 'stepwise' ) }
					{ ' ' }
					<a href={ `${ adminUrl }admin.php?page=stepwise-capture` } className="ap-capture-bar__link">
						{ __( 'View uncaptured steps →', 'stepwise' ) }
					</a>
				</div>
			) }

			{ pendingRun && (
				<SwitchRunModal
					currentTitle={ activeExecution?.workflow_title ?? __( 'current workflow', 'stepwise' ) }
					nextTitle={ pendingRun.workflowTitle }
					onConfirm={ confirmSwitch }
					onCancel={ () => setPendingRun( null ) }
				/>
			) }

			{ showGate && (
				<ConnectGateModal
					onClose={ () => setShowGate( false ) }
					onContinue={ () => setShowGate( false ) }
				/>
			) }

			{ showCreate && (
				<CreateWorkflowModal onClose={ () => setShowCreate( false ) } />
			) }

			{ showImportUrl && (
				<ImportUrlModal onClose={ () => setShowImportUrl( false ) } />
			) }

			{ showImportJson && (
				<ImportJsonModal onClose={ () => setShowImportJson( false ) } />
			) }

			{ showTemplates && (
				<TemplatePickerModal onClose={ () => setShowTemplates( false ) } />
			) }
		</div>
	);
};

export default WorkflowManager;
