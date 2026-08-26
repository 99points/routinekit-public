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
} = window.alignpressData ?? {};

const FREE_LOCAL_LIMIT = 3;

// ── Connect Gate Modal ────────────────────────────────────────────────────────
const ConnectGateModal = ( { onClose, onContinue } ) => {
	const settingsUrl = adminUrl + 'admin.php?page=alignpress-settings#cloud';
	return (
		<Modal
			title={ __( 'You\'re on a roll.', 'alignpress' ) }
			onClose={ onClose }
			size="sm"
			footer={
				<>
					<Button variant="ghost" onClick={ onContinue }>
						{ __( 'Maybe later', 'alignpress' ) }
					</Button>
					<a href={ settingsUrl } className="alignpress-btn alignpress-btn--primary">
						{ __( 'Connect free →', 'alignpress' ) }
					</a>
				</>
			}
		>
			<div className="ap-gate-modal">
				<p className="ap-gate-modal__lead">
					{ __( 'Free local workflows are limited to 3. But here\'s the thing — connecting your free AlignPress account doesn\'t just remove that limit.', 'alignpress' ) }
				</p>
				<ul className="ap-gate-modal__perks">
					<li>
						<span className="ap-gate-modal__perk-icon">🌐</span>
						<span>{ __( 'Push any workflow to up to 3 sites in one click', 'alignpress' ) }</span>
					</li>
					<li>
						<span className="ap-gate-modal__perk-icon">♾️</span>
						<span>{ __( 'Unlimited workflows — build as many as you need', 'alignpress' ) }</span>
					</li>
					<li>
						<span className="ap-gate-modal__perk-icon">⚡</span>
						<span>{ __( 'Sync updates to all connected sites instantly', 'alignpress' ) }</span>
					</li>
				</ul>
				<p className="ap-gate-modal__sub">
					{ __( 'Takes 30 seconds. No credit card.', 'alignpress' ) }
				</p>
			</div>
		</Modal>
	);
};

const WorkflowManager = () => {
	const [ showCreate, setShowCreate ]           = useState( false );
	const [ showImportUrl, setShowImportUrl ]     = useState( false );
	const [ showImportJson, setShowImportJson ]   = useState( false );
	const [ showTemplates, setShowTemplates ]     = useState( false );
	const [ showGate, setShowGate ]               = useState( false );

	const { fetchWorkflows } = useDispatch( 'alignpress/workflows' );
	const { startExecution, fetchActiveExecution } = useDispatch( 'alignpress/execution' );

	const workflows = useSelect( ( select ) => select( 'alignpress/workflows' ).getWorkflows() );
	const isLoading = useSelect( ( select ) => select( 'alignpress/workflows' ).isLoading() );

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

	return (
		<div className="ap-workflow-manager">
			<div className="ap-workflow-manager__header">
				<h1 className="ap-page-title">{ __( 'Workflows', 'alignpress' ) }</h1>
				{ canEdit && (
					<div className="ap-workflow-manager__actions">
						<button
							type="button"
							className="alignpress-btn alignpress-btn--ghost alignpress-btn--sm"
							onClick={ () => {
								if ( ! saasConnected && workflows.length >= FREE_LOCAL_LIMIT ) {
									setShowGate( true );
									return;
								}
								setShowTemplates( true );
							} }
						>
							{ __( 'Templates', 'alignpress' ) }
						</button>
						{ isPro && saasConnected && (
							<button
								type="button"
								className="alignpress-btn alignpress-btn--ghost alignpress-btn--sm"
								onClick={ () => setShowImportUrl( true ) }
							>
								{ __( 'Import URL', 'alignpress' ) }
							</button>
						) }
						<button
							type="button"
							className="alignpress-btn alignpress-btn--ghost alignpress-btn--sm"
							onClick={ () => setShowImportJson( true ) }
						>
							{ __( 'Import JSON', 'alignpress' ) }
						</button>
						<Button
							variant="secondary"
							onClick={ handleCreate }
							disabled={ isLoading }
						>
							{ __( 'Add New Workflow', 'alignpress' ) }
						</Button>
					</div>
				) }
			</div>


			{ isLoading && (
				<div className="ap-loading">
					<span className="spinner is-active" />
					{ __( 'Loading workflows…', 'alignpress' ) }
				</div>
			) }

			{ ! isLoading && (
				<WorkflowList
					workflows={ workflows }
					onStartRun={ ( workflowId ) => startExecution( workflowId ) }
				/>
			) }

			{ /* Capture status bar */ }
			{ captureEnabled && (
				<div className="ap-capture-bar">
					<strong>{ __( 'Auto-capture is on.', 'alignpress' ) }</strong>
					{ ' ' }{ __( 'AlignPress is watching for setting changes on this site.', 'alignpress' ) }
					{ ' ' }
					<a href={ `${ adminUrl }admin.php?page=alignpress-capture` } className="ap-capture-bar__link">
						{ __( 'View uncaptured steps →', 'alignpress' ) }
					</a>
				</div>
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
