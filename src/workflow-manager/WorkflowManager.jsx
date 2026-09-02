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
} = window.routinekitData ?? {};

const FREE_LOCAL_LIMIT = 3;

// ── Connect Gate Modal ────────────────────────────────────────────────────────
const ConnectGateModal = ( { onClose, onContinue } ) => {
	const settingsUrl = adminUrl + 'admin.php?page=routinekit-settings#cloud';
	return (
		<Modal
			title={ __( 'You\'re on a roll.', 'routinekit' ) }
			onClose={ onClose }
			size="sm"
			footer={
				<>
					<Button variant="ghost" onClick={ onContinue }>
						{ __( 'Maybe later', 'routinekit' ) }
					</Button>
					<a href={ settingsUrl } className="routinekit-btn routinekit-btn--primary">
						{ __( 'Connect free →', 'routinekit' ) }
					</a>
				</>
			}
		>
			<div className="ap-gate-modal">
				<p className="ap-gate-modal__lead">
					{ __( 'Connecting your free RoutineKit account unlocks cloud features — push workflows to client sites, track completions, and manage everything from one dashboard.', 'routinekit' ) }
				</p>
				<ul className="ap-gate-modal__perks">
					<li>
						<span className="ap-gate-modal__perk-icon">🌐</span>
						<span>{ __( 'Push any workflow to client sites in one click', 'routinekit' ) }</span>
					</li>
					<li>
						<span className="ap-gate-modal__perk-icon">♾️</span>
						<span>{ __( 'Unlimited workflows — build as many as you need', 'routinekit' ) }</span>
					</li>
					<li>
						<span className="ap-gate-modal__perk-icon">⚡</span>
						<span>{ __( 'Sync updates to all connected sites instantly', 'routinekit' ) }</span>
					</li>
				</ul>
				<p className="ap-gate-modal__sub">
					{ __( 'Takes 30 seconds. No credit card.', 'routinekit' ) }
				</p>
			</div>
		</Modal>
	);
};

// ── Switch Run Confirmation Modal ─────────────────────────────────────────────
const SwitchRunModal = ( { currentTitle, nextTitle, onConfirm, onCancel } ) => (
	<Modal
		title={ __( 'Switch active workflow?', 'routinekit' ) }
		onClose={ onCancel }
		size="sm"
		footer={
			<>
				<Button variant="ghost" onClick={ onCancel }>
					{ __( 'Keep current run', 'routinekit' ) }
				</Button>
				<Button variant="primary" onClick={ onConfirm }>
					{ __( 'Switch workflow', 'routinekit' ) }
				</Button>
			</>
		}
	>
		<p style={ { marginBottom: 12 } }>
			{ __( 'You have a run in progress:', 'routinekit' ) }{ ' ' }
			<strong>{ currentTitle }</strong>
		</p>
		<p style={ { marginBottom: 0 } }>
			{ __( 'Switching to', 'routinekit' ) }{ ' ' }
			<strong>{ nextTitle }</strong>{ ' ' }
			{ __( 'will pause your current run. Your progress is saved — click Run on it again to resume from where you left off.', 'routinekit' ) }
		</p>
	</Modal>
);

const WorkflowManager = () => {
	const [ showCreate, setShowCreate ]               = useState( false );
	const [ showImportUrl, setShowImportUrl ]         = useState( false );
	const [ showImportJson, setShowImportJson ]       = useState( false );
	const [ showImportMenu, setShowImportMenu ]       = useState( false );
	const [ showTemplates, setShowTemplates ]         = useState( false );
	const [ showGate, setShowGate ]                   = useState( false );
	const [ pendingRun, setPendingRun ]               = useState( null ); // { workflowId, workflowTitle }

	const { fetchWorkflows } = useDispatch( 'routinekit/workflows' );
	const { startExecution, fetchActiveExecution } = useDispatch( 'routinekit/execution' );

	const workflows      = useSelect( ( select ) => select( 'routinekit/workflows' ).getWorkflows() );
	const isLoading      = useSelect( ( select ) => select( 'routinekit/workflows' ).isLoading() );
	const activeExecution = useSelect( ( select ) => select( 'routinekit/execution' ).getActiveExecution() );

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
			setPendingRun( { workflowId, workflowTitle: wf?.title ?? __( 'this workflow', 'routinekit' ) } );
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
				<h1 className="ap-page-title">{ __( 'Workflows', 'routinekit' ) }</h1>
				{ canEdit && (
					<div className="ap-workflow-manager__actions">
						<button
							type="button"
							className="routinekit-btn routinekit-btn--ghost routinekit-btn--sm"
							onClick={ () => {
								if ( ! saasConnected && workflows.length >= FREE_LOCAL_LIMIT ) {
									setShowGate( true );
									return;
								}
								setShowTemplates( true );
							} }
						>
							{ __( 'Templates', 'routinekit' ) }
						</button>
						<div className="ap-import-dropdown" style={ { position: 'relative' } }>
							<button
								type="button"
								className="routinekit-btn routinekit-btn--ghost routinekit-btn--sm"
								onClick={ () => setShowImportMenu( ( v ) => ! v ) }
							>
								{ __( 'Import Workflow', 'routinekit' ) } ▾
							</button>
							{ showImportMenu && (
								<>
									<div
										className="ap-import-dropdown__backdrop"
										onClick={ () => setShowImportMenu( false ) }
									/>
									<div className="ap-import-dropdown__menu">
										<button
											type="button"
											className="ap-import-dropdown__item"
											onClick={ () => { setShowImportMenu( false ); setShowImportJson( true ); } }
										>
											{ __( 'Import JSON', 'routinekit' ) }
										</button>
										{ /* Import via URL — temporarily hidden */ }
									</div>
								</>
							) }
						</div>
						<Button
							variant="secondary"
							onClick={ handleCreate }
							disabled={ isLoading }
						>
							{ __( 'Add New Workflow', 'routinekit' ) }
						</Button>
					</div>
				) }
			</div>


			{ isLoading && (
				<div className="ap-loading">
					<span className="spinner is-active" />
					{ __( 'Loading workflows…', 'routinekit' ) }
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
					<strong>{ __( 'Auto-capture is on.', 'routinekit' ) }</strong>
					{ ' ' }{ __( 'RoutineKit is watching for setting changes on this site.', 'routinekit' ) }
					{ ' ' }
					<a href={ `${ adminUrl }admin.php?page=routinekit-capture` } className="ap-capture-bar__link">
						{ __( 'View uncaptured steps →', 'routinekit' ) }
					</a>
				</div>
			) }

			{ pendingRun && (
				<SwitchRunModal
					currentTitle={ activeExecution?.workflow_title ?? __( 'current workflow', 'routinekit' ) }
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
