import { useEffect, useState } from 'react';
import { useSelect, useDispatch } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import StepList from './StepList';
import AddStepForm from './AddStepForm';
import CapturedStepsPanel from './CapturedStepsPanel';
import RunHistory from './RunHistory';
import Button from '../shared/Button';
import Badge from '../shared/Badge';
import Toggle from '../shared/Toggle';
import Modal from '../shared/Modal';
import SavedToast from '../shared/SavedToast';
import PushToSaasModal from './PushToSaasModal';
import '../store';

const CATEGORIES = [
	'', 'Content & Blog', 'SEO', 'WooCommerce', 'Email / SMTP', 'Analytics & Tracking',
	'Forms', 'Performance', 'Security', 'Backup', 'Membership & Users',
	'Social Media', 'Advertising', 'General',
];

const {
	canEdit       = false,
	saasConnected = false,
	isPro         = false,
	upgradeUrl    = '#',
} = window.stepwiseData ?? {};

// ── SaaS Connect CTA (shown in sidebar when not connected) ───────────────────
const SaasConnectCta = () => {
	const settingsUrl = ( window.stepwiseData?.adminUrl ?? '' ) + 'admin.php?page=stepwise-settings#cloud';

	return (
		<div className="ap-saas-cta">
			<div className="ap-saas-cta__icon">⚡</div>
			<div className="ap-saas-cta__body">
				<strong className="ap-saas-cta__heading">
					{ __( 'Run this on multiple sites', 'stepwise' ) }
				</strong>
				<p className="ap-saas-cta__text">
					{ __( 'Connect your free Stepwise account and push this workflow to up to 3 sites instantly — no re-building required.', 'stepwise' ) }
				</p>
				<a href={ settingsUrl } className="ap-saas-cta__btn">
					{ __( 'Connect free →', 'stepwise' ) }
				</a>
			</div>
		</div>
	);
};

// ── Workflow Setup Checklist ─────────────────────────────────────────────────
const WorkflowChecklist = ( { workflow, steps } ) => {
	const [ dismissed, setDismissed ] = useState(
		() => !! localStorage.getItem( `ap_checklist_dismissed_${ workflow.id }` )
	);

	if ( dismissed ) return null;

	const isPushed     = !! workflow.pushed_at;
	const hasSteps     = steps.length > 0;
	const isActive     = workflow.status === 'active';
	const hasRunBefore = workflow.run_count > 0;
	const isAssigned   = ( workflow.pushed_group_ids ?? [] ).length > 0;

	const proItems = [
		{
			label:  __( 'Activate the workflow', 'stepwise' ),
			detail: __( 'Set status to Active so it can be run.', 'stepwise' ),
			done:   isActive,
		},
		{
			label:  __( 'Run the workflow', 'stepwise' ),
			detail: __( 'Hit Run — the runner appears on every admin page while it\'s active.', 'stepwise' ),
			done:   hasRunBefore,
		},
		{
			label:  __( 'Add steps as you go', 'stepwise' ),
			detail: __( 'Document each task from the runner. Steps stay editable until you push to cloud.', 'stepwise' ),
			done:   hasSteps,
		},
		{
			label:  __( 'Push to Cloud', 'stepwise' ),
			detail: __( 'When steps are finalised — locks them and uploads to your cloud.', 'stepwise' ),
			done:   isPushed,
			divider: true,
		},
		{
			label:  __( 'Assign to a group', 'stepwise' ),
			detail: __( 'Distribute to all sites in a group.', 'stepwise' ),
			done:   isAssigned,
		},
	];

	const freeItems = [
		{
			label:  __( 'Activate the workflow', 'stepwise' ),
			detail: __( 'Set status to Active so it can be run.', 'stepwise' ),
			done:   isActive,
		},
		{
			label:  __( 'Run the workflow', 'stepwise' ),
			detail: __( 'Hit Run — the runner appears on every admin page while it\'s active.', 'stepwise' ),
			done:   hasRunBefore,
		},
		{
			label:  __( 'Add steps as you go', 'stepwise' ),
			detail: __( 'Document each task from the runner sidebar.', 'stepwise' ),
			done:   hasSteps,
		},
	];

	const items       = saasConnected ? proItems : freeItems;
	const doneCount   = items.filter( ( i ) => i.done ).length;
	const allDone     = doneCount === items.length;

	const handleDismiss = () => {
		localStorage.setItem( `ap_checklist_dismissed_${ workflow.id }`, '1' );
		setDismissed( true );
	};

	return (
		<div className={ `ap-wf-checklist ${ allDone ? 'ap-wf-checklist--complete' : '' }` }>
			<div className="ap-wf-checklist__head">
				<div className="ap-wf-checklist__head-left">
					<span className="ap-wf-checklist__eyebrow">
						{ allDone
							? __( 'Workflow ready', 'stepwise' )
							: sprintf( __( '%1$d of %2$d complete', 'stepwise' ), doneCount, items.length ) }
					</span>
					<h3 className="ap-wf-checklist__title">
						{ allDone
							? __( 'You\'re all set — this workflow is live.', 'stepwise' )
							: __( 'Get this workflow ready to run', 'stepwise' ) }
					</h3>
				</div>
				<button className="ap-wf-checklist__dismiss" onClick={ handleDismiss } aria-label={ __( 'Dismiss', 'stepwise' ) }>
					✕
				</button>
			</div>

			<div className="ap-wf-checklist__track">
				<div className="ap-wf-checklist__bar">
					<div className="ap-wf-checklist__bar-fill" style={ { width: `${ ( doneCount / items.length ) * 100 }%` } } />
				</div>
			</div>

			<ol className="ap-wf-checklist__steps">
				{ items.map( ( item, i ) => (
					<li key={ i } className={ `ap-wf-checklist__step ${ item.done ? 'is-done' : '' } ${ item.divider ? 'ap-wf-checklist__step--divider' : '' }` }>
						<span className="ap-wf-checklist__dot">
							{ item.done ? '✓' : i + 1 }
						</span>
						<div className="ap-wf-checklist__step-body">
							<span className="ap-wf-checklist__step-label">{ item.label }</span>
							<span className="ap-wf-checklist__step-detail">{ item.detail }</span>
						</div>
					</li>
				) ) }
			</ol>
		</div>
	);
};

// ── Group Assignment Panel (pro + saas connected only) ──────────────────────
const GroupAssignPanel = ( { workflowId, pushedGroupIds = [], category = '' } ) => {
	const [ groups, setGroups ]           = useState( [] );
	const [ loading, setLoading ]         = useState( true );
	const [ pushing, setPushing ]         = useState( null );
	const [ assignedIds, setAssignedIds ] = useState( pushedGroupIds.map( Number ) );
	const [ error, setError ]             = useState( null );

	const { fetchWorkflows } = useDispatch( 'stepwise/workflows' );

	useEffect( () => {
		apiFetch( { path: '/stepwise/v1/saas/groups' } )
			.then( ( res ) => setGroups( res.groups ?? [] ) )
			.catch( () => setError( __( 'Could not load groups.', 'stepwise' ) ) )
			.finally( () => setLoading( false ) );
	}, [] );

	const handleAssign = async ( groupId ) => {
		if ( ! category ) {
			alert( __( 'Please select a category in Playbook Settings before assigning to a group.', 'stepwise' ) );
			return;
		}
		if ( ! window.confirm( __( 'Push this workflow to all sites in the selected group? Steps will be locked and cannot be edited after pushing.', 'stepwise' ) ) ) {
			return;
		}
		setPushing( groupId );
		setError( null );
		try {
			await apiFetch( {
				path:   `/stepwise/v1/saas/groups/${ groupId }/assign`,
				method: 'POST',
				data:   { workflow_id: workflowId },
			} );
			setAssignedIds( ( prev ) => [ ...prev, Number( groupId ) ] );
			await fetchWorkflows();
		} catch ( e ) {
			setError( e.message ?? __( 'Assignment failed.', 'stepwise' ) );
		} finally {
			setPushing( null );
		}
	};

	if ( loading ) return null;
	if ( ! groups.length ) return (
		<div className="ap-sidebar-panel">
			<div className="ap-sidebar-panel__body">
				<p className="ap-sidebar-panel__empty" style={ { fontSize: '12px', color: '#888' } }>
					{ __( 'This site has not been added to any groups yet. Groups are created and managed from your Stepwise Cloud dashboard — add this site to a group there first.', 'stepwise' ) }
				</p>
			</div>
		</div>
	);

	return (
		<div className="ap-sidebar-panel">
			<div className="ap-sidebar-panel__toggle" style={ { cursor: 'default' } }>
				<span className="ap-sidebar-panel__title">{ __( 'Assign to Group', 'stepwise' ) }</span>
			</div>
			<div className="ap-sidebar-panel__body">
				<p style={ { fontSize: '12px', color: '#666', marginBottom: '8px' } }>
					{ __( 'Push this workflow to every site in a group. Groups are created and managed from your Stepwise Cloud dashboard.', 'stepwise' ) }
				</p>
				{ error && <p style={ { fontSize: '12px', color: '#dc2626', marginBottom: '8px' } }>{ error }</p> }
				{ groups.map( ( group ) => {
					const isAssigned = assignedIds.includes( Number( group.id ) );
					const isBusy     = pushing === group.id;
					return (
						<div key={ group.id } style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } }>
							<span style={ { fontSize: '13px', fontWeight: 500 } }>{ group.name }</span>
							{ isAssigned ? (
								<span style={ { fontSize: '12px', fontWeight: 500, color: '#16a34a' } }>
									{ __( 'Assigned ✓', 'stepwise' ) }
								</span>
							) : (
								<Button
									variant="secondary"
									size="sm"
									onClick={ () => handleAssign( group.id ) }
									disabled={ isBusy || pushing !== null }
								>
									{ isBusy ? __( 'Assigning…', 'stepwise' ) : __( 'Assign', 'stepwise' ) }
								</Button>
							) }
						</div>
					);
				} ) }
			</div>
		</div>
	);
};

const PlaybookSettingsPanel = ( { workflow, workflowId } ) => {
	const [ open, setOpen ]             = useState( true );
	const [ status, setStatus ]         = useState( workflow.status === 'active' );
	const [ category, setCategory ]     = useState( workflow.category ?? '' );
	const [ saving, setSaving ]         = useState( false );
	const [ showConfirm, setShowConfirm ] = useState( false );

	const { saveWorkflow } = useDispatch( 'stepwise/workflows' );


	const handleStatusToggle = ( val ) => {
		if ( ! val && status ) {
			// active → draft: show confirmation first
			setShowConfirm( true );
			return;
		}
		confirmStatusChange( val );
	};

	const confirmStatusChange = async ( val = false ) => {
		setShowConfirm( false );
		setStatus( val );
		setSaving( true );
		await saveWorkflow( workflowId, { status: val ? 'active' : 'draft', category } );
		setSaving( false );
	};

	const handleCategoryChange = async ( val ) => {
		setCategory( val );
		setSaving( true );
		await saveWorkflow( workflowId, { category: val } );
		setSaving( false );
	};

	const fmt = ( dateStr ) => {
		if ( ! dateStr ) return __( '—', 'stepwise' );
		return new Date( dateStr ).toLocaleDateString( undefined, { year: 'numeric', month: 'long', day: 'numeric' } );
	};

	return (
		<div className="ap-sidebar-panel">
			<button
				className="ap-sidebar-panel__toggle"
				onClick={ () => setOpen( o => ! o ) }
				aria-expanded={ open }
			>
				<span className="ap-sidebar-panel__title">{ __( 'Playbook Settings', 'stepwise' ) }</span>
				<span className="ap-sidebar-panel__chevron">{ open ? '∧' : '∨' }</span>
			</button>

			{ open && (
				<div className="ap-sidebar-panel__body">
					<div className="ap-sidebar-panel__row">
						<span className="ap-sidebar-panel__label">{ __( 'STATUS', 'stepwise' ) }</span>
						{ canEdit ? (
							<Toggle
								id={ `workflow-status-${ workflowId }` }
								checked={ status }
								onChange={ handleStatusToggle }
								label={ status ? __( 'Active', 'stepwise' ) : __( 'Draft', 'stepwise' ) }
							/>
						) : (
							<span className={ `stepwise-badge stepwise-badge--${ status ? 'active' : 'draft' }` }>
								{ status ? __( 'Active', 'stepwise' ) : __( 'Draft', 'stepwise' ) }
							</span>
						) }
					</div>

					<div className="ap-sidebar-panel__row ap-sidebar-panel__row--stack">
						<span className="ap-sidebar-panel__label">{ __( 'CATEGORY', 'stepwise' ) }</span>
						{ canEdit ? (
							<select
								className="stepwise-select"
								value={ category }
								onChange={ ( e ) => handleCategoryChange( e.target.value ) }
								disabled={ saving }
							>
								{ CATEGORIES.map( ( c ) => (
									<option key={ c } value={ c }>{ c || __( '— None —', 'stepwise' ) }</option>
								) ) }
							</select>
						) : (
							<span className="ap-sidebar-panel__value">{ category || __( '— None —', 'stepwise' ) }</span>
						) }
					</div>

					<div className="ap-sidebar-panel__row ap-sidebar-panel__row--stack">
						<span className="ap-sidebar-panel__label">{ __( 'CREATED', 'stepwise' ) }</span>
						<span className="ap-sidebar-panel__value">{ fmt( workflow.created_at ) }</span>
					</div>

					<div className="ap-sidebar-panel__row ap-sidebar-panel__row--stack">
						<span className="ap-sidebar-panel__label">{ __( 'LAST MODIFIED', 'stepwise' ) }</span>
						<span className="ap-sidebar-panel__value">{ fmt( workflow.updated_at ) }</span>
					</div>

					<div className="ap-sidebar-panel__row ap-sidebar-panel__row--stack">
						<span className="ap-sidebar-panel__label">{ __( 'TIMES RUN', 'stepwise' ) }</span>
						<span className="ap-sidebar-panel__value">
							{ workflow.run_count > 0
								? sprintf(
									/* translators: %d: number of times run */
									__( '%d times', 'stepwise' ),
									workflow.run_count
								)
								: __( 'Never', 'stepwise' )
							}
						</span>
					</div>
				</div>
			) }

			{ showConfirm && (
				<Modal
					title={ __( 'Deactivate Workflow?', 'stepwise' ) }
					onClose={ () => setShowConfirm( false ) }
					size="sm"
					footer={
						<>
							<Button variant="ghost" onClick={ () => setShowConfirm( false ) }>
								{ __( 'Cancel', 'stepwise' ) }
							</Button>
							<Button variant="danger" onClick={ () => confirmStatusChange( false ) }>
								{ __( 'Yes, Deactivate', 'stepwise' ) }
							</Button>
						</>
					}
				>
					<p>{ __( 'Setting this workflow to Draft will:', 'stepwise' ) }</p>
					<ul className="ap-confirm-list">
						<li>{ __( 'Hide it from the Run Workflow list', 'stepwise' ) }</li>
						<li>{ __( 'Prevent anyone from starting a new run', 'stepwise' ) }</li>
						<li>{ __( 'Any run currently in progress will be allowed to finish', 'stepwise' ) }</li>
					</ul>
				</Modal>
			) }
		</div>
	);
};

const StepBuilder = ( { workflowId } ) => {
	const [ editingWorkflow, setEditingWorkflow ] = useState( false );
	const [ titleDraft, setTitleDraft ]           = useState( '' );
	const [ descDraft, setDescDraft ]             = useState( '' );
	const [ activeTab, setActiveTab ]             = useState( 'steps' );
	const [ showPushModal, setShowPushModal ]     = useState( false );

	const { fetchWorkflows, saveWorkflow } = useDispatch( 'stepwise/workflows' );
	const { fetchSteps }                   = useDispatch( 'stepwise/steps' );

	const workflow = useSelect( ( select ) => select( 'stepwise/workflows' ).getWorkflow( workflowId ) );
	const steps    = useSelect( ( select ) => select( 'stepwise/steps' ).getSteps( workflowId ) );
	const isSaving = useSelect( ( select ) => select( 'stepwise/workflows' ).isSaving() );

	useEffect( () => {
		fetchWorkflows();
		fetchSteps( workflowId );
	}, [ workflowId ] );

	useEffect( () => {
		if ( workflow ) {
			setTitleDraft( workflow.title );
			setDescDraft( workflow.description ?? '' );
		}
	}, [ workflow ] );

	if ( ! workflow ) {
		return <div className="ap-loading"><span className="spinner is-active" /></div>;
	}

	const stepsLocked = !! workflow.pushed_at;
	const isPushed    = !! workflow.pushed_at;

	const handleOpenPushModal = () => {
		if ( ! workflow.category ) {
			// eslint-disable-next-line no-alert
			alert( __( 'Please select a category in Playbook Settings before pushing to the cloud.', 'stepwise' ) );
			return;
		}
		setShowPushModal( true );
	};

	const handleSaveWorkflow = async () => {
		await saveWorkflow( workflowId, { title: titleDraft, description: descDraft } );
		setEditingWorkflow( false );
	};

	const backUrl = `${ window.stepwiseData?.adminUrl ?? '' }admin.php?page=stepwise`;

	return (
		<div className="ap-step-builder">
			<div className="ap-step-builder__header">
				<a href={ backUrl } className="ap-back-link">
					← { __( 'All Workflows', 'stepwise' ) }
				</a>

				<div className="ap-step-builder__title-row">
					{ editingWorkflow ? (
						<div className="ap-step-builder__title-edit">
							<input
								type="text"
								className="stepwise-input stepwise-input--title"
								value={ titleDraft }
								onChange={ ( e ) => setTitleDraft( e.target.value ) }
								autoFocus
							/>
							<textarea
								className="stepwise-input ap-textarea"
								value={ descDraft }
								onChange={ ( e ) => setDescDraft( e.target.value ) }
								placeholder={ __( 'Description (optional)', 'stepwise' ) }
								rows={ 2 }
							/>
							<div className="ap-step-builder__title-actions">
								<Button variant="primary" size="sm" onClick={ handleSaveWorkflow } disabled={ isSaving }>
									{ isSaving ? __( 'Saving…', 'stepwise' ) : __( 'Save', 'stepwise' ) }
								</Button>
								<Button variant="ghost" size="sm" onClick={ () => setEditingWorkflow( false ) }>
									{ __( 'Cancel', 'stepwise' ) }
								</Button>
							</div>
						</div>
					) : (
						<div className="ap-step-builder__title-display">
							<div className="ap-step-builder__title-left">
								<h1 className="ap-page-title">{ workflow.title }</h1>
								{ workflow.description && (
									<p className="ap-page-subtitle">{ workflow.description }</p>
								) }
							</div>
							<div className="ap-step-builder__title-right">
								<Badge variant={ workflow.status }>{ workflow.status }</Badge>
								{ isPushed && (
									<span className="ap-pushed-badge">
										{ __( '✓ Pushed to Cloud', 'stepwise' ) }
									</span>
								) }
								{ canEdit && saasConnected && (
									<Button variant={ isPushed ? 'secondary' : 'primary' } size="sm" onClick={ handleOpenPushModal }>
										{ isPushed ? __( 'Assign to Group', 'stepwise' ) : __( 'Push to Cloud', 'stepwise' ) }
									</Button>
								) }
								{ canEdit && (
									<Button variant="ghost" size="sm" onClick={ () => setEditingWorkflow( true ) }>
										{ __( 'Edit', 'stepwise' ) }
									</Button>
								) }
							</div>
						</div>
					) }
				</div>

				<div className="ap-step-builder__tabs">
					<button
						className={ `ap-workflow-tab ${ activeTab === 'steps' ? 'is-active' : '' }` }
						onClick={ () => setActiveTab( 'steps' ) }
					>
						{ __( 'Steps', 'stepwise' ) }
						<span className="ap-workflow-tab__count">{ steps.length }</span>
					</button>
					{ canEdit && (
						<button
							className={ `ap-workflow-tab ${ activeTab === 'history' ? 'is-active' : '' }` }
							onClick={ () => setActiveTab( 'history' ) }
						>
							{ __( 'Run History', 'stepwise' ) }
						</button>
					) }
				</div>
			</div>

			{ activeTab === 'steps' && (
				<div className="ap-step-builder__body">
					<div className="ap-step-builder__main">
					{ canEdit && (
						<WorkflowChecklist workflow={ workflow } steps={ steps } />
					) }
						<div className="ap-step-builder__steps-header">
							<h2>{ __( 'Steps', 'stepwise' ) }</h2>
							<span className="ap-step-count">
								{ steps.length } { steps.length === 1
									? __( 'step', 'stepwise' )
									: __( 'steps', 'stepwise' ) }
							</span>
						</div>

						{ stepsLocked && (
							<div className="ap-steps-locked-notice">
								{ __( 'Steps are locked — this workflow has been pushed to the cloud.', 'stepwise' ) }
							</div>
						) }
						<StepList workflowId={ workflowId } steps={ steps } canEdit={ canEdit && ! stepsLocked } />
						{ canEdit && ! stepsLocked && <AddStepForm workflowId={ workflowId } /> }
					</div>

					<aside className="ap-step-builder__sidebar">
						<PlaybookSettingsPanel workflow={ workflow } workflowId={ workflowId } />
						{ saasConnected && canEdit && (
							<GroupAssignPanel workflowId={ workflowId } pushedGroupIds={ workflow.pushed_group_ids ?? [] } category={ workflow.category ?? '' } />
						) }
						{ ! saasConnected && <SaasConnectCta /> }
						<CapturedStepsPanel workflowId={ workflowId } />
					</aside>
				</div>
			) }

			{ activeTab === 'history' && canEdit && (
				<RunHistory workflowId={ workflowId } workflowTitle={ workflow.title } />
			) }

			<SavedToast />

			{ showPushModal && (
				<PushToSaasModal
					workflowId={ workflowId }
					pushedGroupIds={ workflow.pushed_group_ids ?? [] }
					onClose={ () => setShowPushModal( false ) }
					onPushed={ () => {} }
				/>
			) }
		</div>
	);
};

export default StepBuilder;
