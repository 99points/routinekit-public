import { useState, useEffect, useCallback } from 'react';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import Toggle from '../shared/Toggle';
import Button from '../shared/Button';

const data = () => window.routinekitData ?? {};

const CATEGORIES = [
	'', 'Content & Blog', 'SEO', 'WooCommerce', 'Email / SMTP', 'Analytics & Tracking',
	'Forms', 'Performance', 'Security', 'Backup', 'Membership & Users',
	'Social Media', 'Advertising', 'General',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const Section = ( { title, description, children, danger = false } ) => (
	<div className={ `ap-settings-section${ danger ? ' ap-settings-section--danger' : '' }` }>
		<div className="ap-settings-section__header">
			<h2 className="ap-settings-section__title">{ title }</h2>
			{ description && (
				<p className="ap-settings-section__desc">{ description }</p>
			) }
		</div>
		<div className="ap-settings-section__body">{ children }</div>
	</div>
);

const Row = ( { label, description, children } ) => (
	<div className="ap-settings-row">
		<div className="ap-settings-row__label">
			<span className="ap-settings-row__label-text">{ label }</span>
			{ description && (
				<span className="ap-settings-row__label-desc">{ description }</span>
			) }
		</div>
		<div className="ap-settings-row__control">{ children }</div>
	</div>
);

const useSettings = ( initial ) => {
	const [ values, setValues ] = useState( initial );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );
	const [ error, setError ] = useState( null );

	const set = useCallback( ( key, val ) => {
		setValues( ( prev ) => ( { ...prev, [ key ]: val } ) );
		setSaved( false );
	}, [] );

	const save = useCallback( async ( payload ) => {
		setSaving( true );
		setError( null );
		try {
			await apiFetch( {
				path: '/routinekit/v1/settings',
				method: 'POST',
				data: payload ?? values,
			} );
			setSaved( true );
			setTimeout( () => setSaved( false ), 3000 );
		} catch ( e ) {
			setError( e.message ?? __( 'Save failed.', 'routinekit' ) );
		} finally {
			setSaving( false );
		}
	}, [ values ] );

	return { values, set, save, saving, saved, error };
};

// ---------------------------------------------------------------------------
// General tab — all main sections
// ---------------------------------------------------------------------------

const GeneralTab = () => {
	const d = data();
	const { values, set, save, saving, saved, error } = useSettings( {
		// Auto-Capture
		routinekit_capture_enabled:     d.captureEnabled     ?? true,
		routinekit_capture_scope:        d.captureScope       ?? 'all_changes',
		routinekit_capture_exclude:      d.captureExclude     ?? 'session_tokens, transient_*, _site_transient_*',
		routinekit_capture_retention:    d.captureRetention   ?? 30,
		routinekit_capture_min_changes:  d.captureMinChanges  ?? 1,
		// Notifications & Toast
		routinekit_toast_enabled:        d.toastEnabled       ?? true,
		routinekit_toast_autodismiss:    d.captureAutodismiss ?? 0,
		routinekit_launcher_enabled:     d.launcherEnabled    ?? true,
		// Workflow Defaults
		routinekit_default_status:       d.defaultStatus      ?? 'active',
		routinekit_default_category:     d.defaultCategory    ?? '',
		routinekit_show_run_button:      d.showRunButton      ?? true,
		// Team & Access
		routinekit_roles_view:           d.rolesView          ?? [ 'administrator' ],
		routinekit_roles_run:            d.rolesRun           ?? [ 'administrator' ],
		routinekit_roles_edit:           d.rolesEdit          ?? [ 'administrator' ],
		// Email Notifications
		routinekit_notify_assigned:      d.notifyAssigned     ?? true,
		routinekit_notify_completed:     d.notifyCompleted    ?? true,
		routinekit_notify_skipped:       d.notifySkipped      ?? false,
		routinekit_notify_email:         d.notifyEmail        ?? '',
	} );

	const allRoles = [
		{ value: 'administrator', label: __( 'Administrator', 'routinekit' ) },
		{ value: 'editor',        label: __( 'Editor',        'routinekit' ) },
		{ value: 'author',        label: __( 'Author',        'routinekit' ) },
		{ value: 'contributor',   label: __( 'Contributor',   'routinekit' ) },
	];

	const toggleRole = ( key, role ) => {
		const current = values[ key ] ?? [];
		const next = current.includes( role )
			? current.filter( ( r ) => r !== role )
			: [ ...current, role ];
		set( key, next );
	};

	const RoleCheckboxes = ( { settingKey, locked = null } ) => (
		<div className="ap-role-list">
			{ allRoles.map( ( role ) => {
				const isLocked = locked === role.value;
				return (
					<label key={ role.value } className={ `ap-role-check${ isLocked ? ' ap-role-check--locked' : '' }` }>
						<input
							type="checkbox"
							checked={ isLocked || ( values[ settingKey ] ?? [] ).includes( role.value ) }
							disabled={ isLocked }
							onChange={ () => ! isLocked && toggleRole( settingKey, role.value ) }
						/>
						{ role.label }
						{ isLocked && <span className="ap-role-check__only">{ __( 'only', 'routinekit' ) }</span> }
					</label>
				);
			} ) }
		</div>
	);

	return (
		<div className="ap-settings-general">
			{ /* ── Auto-Capture ── */ }
			<Section
				title={ __( 'Auto-Capture', 'routinekit' ) }
				description={ __( 'Automatically detect and record WordPress option changes as workflow steps.', 'routinekit' ) }
			>
				<Row
					label={ __( 'Enable Auto-Capture', 'routinekit' ) }
					description={ __( 'Monitor this site for setting changes in real time.', 'routinekit' ) }
				>
					<Toggle
						id="routinekit_capture_enabled"
						checked={ !! values.routinekit_capture_enabled }
						onChange={ ( v ) => set( 'routinekit_capture_enabled', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Capture Scope', 'routinekit' ) }
					description={ __( 'Which option changes should be recorded.', 'routinekit' ) }
				>
					<select
						className="routinekit-select"
						value={ values.routinekit_capture_scope }
						onChange={ ( e ) => set( 'routinekit_capture_scope', e.target.value ) }
					>
						<option value="all_changes">{ __( 'All option changes', 'routinekit' ) }</option>
						<option value="plugin_settings_only">{ __( 'Plugin settings pages only', 'routinekit' ) }</option>
					</select>
				</Row>

				<Row
					label={ __( 'Exclude options', 'routinekit' ) }
					description={ __( 'Comma-separated option names to always ignore. Wildcards (*) supported.', 'routinekit' ) }
				>
					<input
						type="text"
						className="routinekit-input routinekit-input--wide"
						value={ values.routinekit_capture_exclude }
						onChange={ ( e ) => set( 'routinekit_capture_exclude', e.target.value ) }
						placeholder="session_tokens, transient_*, _site_transient_*"
					/>
				</Row>

				<Row
					label={ __( 'Capture retention', 'routinekit' ) }
					description={ __( 'How long to keep unassigned captured steps before auto-deleting.', 'routinekit' ) }
				>
					<select
						className="routinekit-select"
						value={ values.routinekit_capture_retention }
						onChange={ ( e ) => set( 'routinekit_capture_retention', Number( e.target.value ) ) }
					>
						{ [ 3, 7, 14, 30, 90 ].map( ( d ) => (
							<option key={ d } value={ d }>{ d } { __( 'days', 'routinekit' ) }</option>
						) ) }
					</select>
				</Row>
			</Section>

			{ /* ── Notifications & Toast ── */ }
			<Section
				title={ __( 'Notifications & Toast', 'routinekit' ) }
				description={ __( 'Control when and how the floating notification appears.', 'routinekit' ) }
			>
				<Row
					label={ __( 'Show toast notifications', 'routinekit' ) }
					description={ __( 'Display a floating prompt when changes are detected.', 'routinekit' ) }
				>
					<Toggle
						id="routinekit_toast_enabled"
						checked={ !! values.routinekit_toast_enabled }
						onChange={ ( v ) => set( 'routinekit_toast_enabled', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Minimum changes to trigger toast', 'routinekit' ) }
					description={ __( 'Only show the toast when this many or more options changed.', 'routinekit' ) }
				>
					<div className="ap-inline-field">
						<select
							className="routinekit-select routinekit-select--sm"
							value={ values.routinekit_capture_min_changes }
							onChange={ ( e ) => set( 'routinekit_capture_min_changes', Number( e.target.value ) ) }
						>
							{ [ 1, 2, 3, 5, 10 ].map( ( n ) => (
								<option key={ n } value={ n }>{ n }</option>
							) ) }
						</select>
						<span className="ap-inline-field__suffix">{ __( 'changes', 'routinekit' ) }</span>
					</div>
				</Row>

				<Row
					label={ __( 'Toast auto-dismiss', 'routinekit' ) }
					description={ __( 'Automatically hide the toast after a period of inactivity.', 'routinekit' ) }
				>
					<select
						className="routinekit-select"
						value={ values.routinekit_toast_autodismiss }
						onChange={ ( e ) => set( 'routinekit_toast_autodismiss', Number( e.target.value ) ) }
					>
						<option value={ 0 }>{ __( 'Never (manual dismiss)', 'routinekit' ) }</option>
						<option value={ 5 }>{ __( '5 seconds', 'routinekit' ) }</option>
						<option value={ 8 }>{ __( '8 seconds', 'routinekit' ) }</option>
						<option value={ 15 }>{ __( '15 seconds', 'routinekit' ) }</option>
						<option value={ 30 }>{ __( '30 seconds', 'routinekit' ) }</option>
					</select>
				</Row>

				<Row
					label={ __( 'Persistent launcher button', 'routinekit' ) }
					description={ __( 'Show the RoutineKit floating button on every admin page.', 'routinekit' ) }
				>
					<Toggle
						id="routinekit_launcher_enabled"
						checked={ !! values.routinekit_launcher_enabled }
						onChange={ ( v ) => set( 'routinekit_launcher_enabled', v ) }
					/>
					{ values.routinekit_launcher_enabled && (
						<p className="ap-settings-row__hint">
							{ __( 'This is the ▶ RoutineKit button visible in the bottom-right corner.', 'routinekit' ) }
						</p>
					) }
				</Row>
			</Section>

			{ /* ── Workflow Defaults ── */ }
			<Section
				title={ __( 'Workflow Defaults', 'routinekit' ) }
				description={ __( 'Default values applied when creating a new workflow.', 'routinekit' ) }
			>
				<Row
					label={ __( 'Default status', 'routinekit' ) }
					description={ __( 'New workflows start as Active or Draft.', 'routinekit' ) }
				>
					<div className="ap-radio-group">
						{ [ { value: 'active', label: __( 'Active', 'routinekit' ) }, { value: 'draft', label: __( 'Draft', 'routinekit' ) } ].map( ( opt ) => (
							<label key={ opt.value } className="ap-radio-label">
								<input
									type="radio"
									name="routinekit_default_status"
									value={ opt.value }
									checked={ values.routinekit_default_status === opt.value }
									onChange={ () => set( 'routinekit_default_status', opt.value ) }
								/>
								{ opt.label }
							</label>
						) ) }
					</div>
				</Row>

				<Row
					label={ __( 'Default category', 'routinekit' ) }
					description={ __( 'Pre-fill the category field on new workflows.', 'routinekit' ) }
				>
					<select
						className="routinekit-select"
						value={ values.routinekit_default_category }
						onChange={ ( e ) => set( 'routinekit_default_category', e.target.value ) }
					>
						{ CATEGORIES.map( ( c ) => (
							<option key={ c } value={ c }>{ c || __( '— None —', 'routinekit' ) }</option>
						) ) }
					</select>
				</Row>

				<Row
					label={ __( 'Show "Run" button in list table', 'routinekit' ) }
					description={ __( 'Display the Run Workflow button in the workflows table.', 'routinekit' ) }
				>
					<Toggle
						id="routinekit_show_run_button"
						checked={ !! values.routinekit_show_run_button }
						onChange={ ( v ) => set( 'routinekit_show_run_button', v ) }
					/>
				</Row>
			</Section>

			{ /* ── Team & Access ── */ }
			<Section
				title={ __( 'Team & Access', 'routinekit' ) }
				description={ __( 'Control which WordPress user roles can view and run workflows on this site.', 'routinekit' ) }
			>
				<Row
					label={ __( 'Roles that can view workflows', 'routinekit' ) }
					description={ __( 'These roles will see the RoutineKit menu item.', 'routinekit' ) }
				>
					<RoleCheckboxes settingKey="routinekit_roles_view" />
				</Row>

				<Row
					label={ __( 'Roles that can run workflows', 'routinekit' ) }
					description={ __( 'Restrict who can execute a workflow on this site.', 'routinekit' ) }
				>
					<RoleCheckboxes settingKey="routinekit_roles_run" />
				</Row>

				<Row
					label={ __( 'Roles that can edit workflows', 'routinekit' ) }
					description={ __( 'Who can create, edit, and delete workflows on this site.', 'routinekit' ) }
				>
					<RoleCheckboxes settingKey="routinekit_roles_edit" locked="administrator" />
				</Row>
			</Section>

			{ /* ── Email Notifications ── */ }
			<Section
				title={ __( 'Email Notifications', 'routinekit' ) }
				description={ __( 'Send email alerts for key workflow events on this site.', 'routinekit' ) }
			>
				<Row
					label={ __( 'Notify when workflow assigned', 'routinekit' ) }
					description={ __( 'Email admin when a new workflow is pushed to this site from the agency dashboard.', 'routinekit' ) }
				>
					<Toggle
						id="routinekit_notify_assigned"
						checked={ !! values.routinekit_notify_assigned }
						onChange={ ( v ) => set( 'routinekit_notify_assigned', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Notify when workflow completed', 'routinekit' ) }
					description={ __( 'Email admin when a user finishes all steps of a workflow.', 'routinekit' ) }
				>
					<Toggle
						id="routinekit_notify_completed"
						checked={ !! values.routinekit_notify_completed }
						onChange={ ( v ) => set( 'routinekit_notify_completed', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Notify when step skipped', 'routinekit' ) }
					description={ __( 'Email when a required step is skipped with a reason.', 'routinekit' ) }
				>
					<Toggle
						id="routinekit_notify_skipped"
						checked={ !! values.routinekit_notify_skipped }
						onChange={ ( v ) => set( 'routinekit_notify_skipped', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Notification email address', 'routinekit' ) }
					description={ __( 'Where these emails are sent. Defaults to the site admin email.', 'routinekit' ) }
				>
					<input
						type="email"
						className="routinekit-input"
						value={ values.routinekit_notify_email }
						onChange={ ( e ) => set( 'routinekit_notify_email', e.target.value ) }
						placeholder={ __( 'admin@clientsite.com', 'routinekit' ) }
					/>
				</Row>
			</Section>

			{ /* ── License & Pro Features ── */ }
			<LicenseSection />

			{ /* ── Save bar ── */ }
			<div className="ap-settings-save-bar">
				{ error && <span className="ap-settings-save-bar__error">{ error }</span> }
				<Button
					variant="primary"
					disabled={ saving }
					onClick={ () => save( values ) }
				>
					{ saving ? __( 'Saving…', 'routinekit' ) : __( 'Save Settings', 'routinekit' ) }
				</Button>
				{ saved && <span className="ap-settings-save-bar__saved">{ __( '✓ Saved', 'routinekit' ) }</span> }
				<span className="ap-settings-save-bar__version">
					RoutineKit v{ data().version ?? '1.0.0' } ·{ ' ' }
					<a href="https://wpstepwise.com/docs" target="_blank" rel="noreferrer">{ __( 'Documentation', 'routinekit' ) }</a>
					{ ' · ' }
					<a href="https://wpstepwise.com/support" target="_blank" rel="noreferrer">{ __( 'Support', 'routinekit' ) }</a>
				</span>
			</div>
		</div>
	);
};

// ---------------------------------------------------------------------------
// License & Pro Features (embedded in General tab)
// ---------------------------------------------------------------------------

const LicenseSection = () => {
	const d = data();
	const isPro = !! d.isPro;

	const planLabel = ( () => {
		const plan = d.licensePlan ?? '';
		if ( plan === 'agency_pro' ) return 'AGENCY PRO';
		if ( plan === 'agency' )     return 'AGENCY';
		return isPro ? 'PRO' : 'FREE PLAN';
	} )();

	return (
		<Section
			title={ __( 'License & Pro Features', 'routinekit' ) }
			description={ __( 'Unlock multi-site management, template library, team sharing, and more.', 'routinekit' ) }
		>
			<div className="ap-license-header">
				<span className={ `ap-plan-badge ${ isPro ? 'ap-plan-badge--pro' : 'ap-plan-badge--free' }` }>
					{ planLabel }
				</span>
				{ d.saasConnected && (
					<span className="ap-license-header__sub">
						{ __( 'Your site is connected to RoutineKit Cloud.', 'routinekit' ) }
					</span>
				) }
			</div>

			<div className="ap-plan-cards">
				{ /* Free */ }
				<div className={ `ap-plan-card${ ! isPro ? ' ap-plan-card--active' : '' }` }>
					<h3 className="ap-plan-card__name">{ __( 'Free', 'routinekit' ) }</h3>
					<ul className="ap-plan-card__features">
						<li>{ __( 'Unlimited workflows', 'routinekit' ) }</li>
						<li>{ __( 'Up to 3 connected sites', 'routinekit' ) }</li>
						<li>{ __( 'RoutineKit Cloud dashboard', 'routinekit' ) }</li>
						<li>{ __( 'Auto-capture', 'routinekit' ) }</li>
						<li>{ __( 'JSON export', 'routinekit' ) }</li>
						<li className="ap-plan-card__feature--locked">{ __( 'Multiple site groups', 'routinekit' ) }</li>
						<li className="ap-plan-card__feature--locked">{ __( 'Cloud template library', 'routinekit' ) }</li>
						<li className="ap-plan-card__feature--locked">{ __( 'Team members', 'routinekit' ) }</li>
					</ul>
				</div>

				{ /* Agency */ }
				<div className={ `ap-plan-card ap-plan-card--pro${ isPro && d.licensePlan === 'agency' ? ' ap-plan-card--active' : '' }` }>
					<div className="ap-plan-card__badge">AGENCY</div>
					<h3 className="ap-plan-card__name">{ __( '$149 / year', 'routinekit' ) }</h3>
					<p style={ { fontSize: '11px', color: '#6366f1', fontWeight: 500, marginTop: '-4px', marginBottom: '10px' } }>
						{ __( 'Up to 50 sites — just $0.25/site/mo', 'routinekit' ) }
					</p>
					<ul className="ap-plan-card__features">
						<li>{ __( 'Up to 50 connected sites', 'routinekit' ) }</li>
						<li>{ __( 'Multiple site groups & fleet push', 'routinekit' ) }</li>
						<li>{ __( 'Cloud workflow template library', 'routinekit' ) }</li>
						<li>{ __( 'Import from URL', 'routinekit' ) }</li>
						<li>{ __( 'Team members', 'routinekit' ) }</li>
						<li>{ __( 'Auto-capture', 'routinekit' ) }</li>
					</ul>
					{ ! isPro && (
						<Button variant="primary" onClick={ () => { window.location.href = d.upgradeUrl ?? '#'; } }>
							{ __( 'Get Agency →', 'routinekit' ) }
						</Button>
					) }
				</div>

				{ /* Agency Pro */ }
				<div className={ `ap-plan-card ap-plan-card--pro${ isPro && d.licensePlan === 'agency_pro' ? ' ap-plan-card--active' : '' }` }>
					<div className="ap-plan-card__badge" style={ { background: '#4f46e5' } }>AGENCY PRO</div>
					<h3 className="ap-plan-card__name">{ __( '$249 / year', 'routinekit' ) }</h3>
					<p style={ { fontSize: '11px', color: '#6366f1', fontWeight: 500, marginTop: '-4px', marginBottom: '10px' } }>
						{ __( 'Unlimited sites — $0.21/site/mo at 100, less as you grow', 'routinekit' ) }
					</p>
					<ul className="ap-plan-card__features">
						<li>{ __( 'Everything in Agency', 'routinekit' ) }</li>
						<li><strong>{ __( 'Unlimited connected sites', 'routinekit' ) }</strong></li>
						<li><strong>{ __( 'Priority email support', 'routinekit' ) }</strong></li>
						<li>{ __( 'Early access to new features', 'routinekit' ) }</li>
					</ul>
					{ ! isPro && (
						<Button variant="primary" onClick={ () => { window.location.href = d.upgradeUrl ?? '#'; } }>
							{ __( 'Get Agency Pro →', 'routinekit' ) }
						</Button>
					) }
					{ isPro && d.licensePlan === 'agency' && (
						<Button variant="secondary" onClick={ () => { window.location.href = d.upgradeUrl ?? '#'; } }>
							{ __( 'Upgrade to Agency Pro →', 'routinekit' ) }
						</Button>
					) }
				</div>
			</div>
		</Section>
	);
};

// ---------------------------------------------------------------------------
// Cloud Connection tab
// ---------------------------------------------------------------------------

const CloudTab = () => {
	return <CloudConnectionPanel />;
};

const CloudConnectionPanel = () => {
	const d = data();
	const [ licenseKey, setLicenseKey ]       = useState( '' );
	const [ syncing, setSyncing ]             = useState( false );
	const [ syncMsg, setSyncMsg ]             = useState( null );
	const [ connectError, setConnectError ]   = useState( d.saasError ?? null );
	const [ connecting, setConnecting ]       = useState( false );
	const [ disconnecting, setDisconnecting ] = useState( false );
	const [ stagingMode, setStagingMode ]     = useState( !! d.stagingMode );
	const [ connected, setConnected ]         = useState( !! d.saasConnected );
	const stagingAutoDetected = !! d.stagingAutoDetected;
	const saasConnected = connected;

	const syncNow = async () => {
		setSyncing( true );
		setSyncMsg( null );
		try {
			await apiFetch( { path: '/routinekit/v1/saas/sync', method: 'POST' } );
			setSyncMsg( __( 'Sync complete.', 'routinekit' ) );
		} catch ( e ) {
			setSyncMsg( e.message ?? __( 'Sync failed.', 'routinekit' ) );
		} finally {
			setSyncing( false );
		}
	};

	return (
		<div className="ap-settings-general">
			<Section
				title={ __( 'RoutineKit Cloud Connection', 'routinekit' ) }
				description={ __( 'Connect to your RoutineKit agency account to sync and assign workflows across sites.', 'routinekit' ) }
			>
				<div className={ `ap-cloud-status ${ saasConnected ? 'ap-cloud-status--connected' : 'ap-cloud-status--disconnected' }` }>
					<span className="ap-cloud-status__dot" />
					{ saasConnected ? __( 'Connected', 'routinekit' ) : __( 'Not Connected', 'routinekit' ) }
				</div>

				<Row
					label={ __( 'License Key', 'routinekit' ) }
					description={ __( 'Enter your RoutineKit Pro license key to connect.', 'routinekit' ) }
				>
					{ saasConnected ? (
						<div className="ap-license-activate__row">
							<input
								type="text"
								className="routinekit-input routinekit-input--license"
								value="••••••••••••••••"
								readOnly
								disabled
							/>
							<Button
								variant="danger"
								disabled={ disconnecting }
								onClick={ async () => {
									if ( ! window.confirm( __( 'Disconnect this site from RoutineKit Cloud?', 'routinekit' ) ) ) return;
									setDisconnecting( true );
									setConnectError( null );
									try {
										await apiFetch( { path: '/routinekit/v1/settings/saas/disconnect', method: 'POST' } );
										setConnected( false );
									} catch ( e ) {
										setConnectError( e.message ?? __( 'Disconnect failed.', 'routinekit' ) );
									} finally {
										setDisconnecting( false );
									}
								} }
							>
								{ disconnecting ? __( 'Disconnecting…', 'routinekit' ) : __( 'Disconnect', 'routinekit' ) }
							</Button>
						</div>
					) : (
						<div>
							<div className="ap-license-activate__row">
								<input
									type="text"
									className="routinekit-input routinekit-input--license"
									value={ licenseKey }
									onChange={ ( e ) => setLicenseKey( e.target.value ) }
									placeholder="AP–XXXX–XXXX–XXXX–XXXX"
									onKeyDown={ async ( e ) => { if ( e.key === 'Enter' ) e.target.closest( '.ap-license-activate__row' ).querySelector( 'button' )?.click(); } }
								/>
								<Button
									variant="primary"
									disabled={ ! licenseKey.trim() || connecting }
									onClick={ async () => {
										setConnecting( true );
										setConnectError( null );
										try {
											await apiFetch( {
												path:   '/routinekit/v1/settings/saas/connect',
												method: 'POST',
												data:   { license_key: licenseKey.trim() },
											} );
											setConnected( true );
											setLicenseKey( '' );
										} catch ( e ) {
											setConnectError( e.message ?? __( 'Connection failed. Please check your key.', 'routinekit' ) );
										} finally {
											setConnecting( false );
										}
									} }
								>
									{ connecting ? __( 'Connecting…', 'routinekit' ) : __( 'Connect', 'routinekit' ) }
								</Button>
							</div>
							{ connectError && <p className="ap-error">{ connectError }</p> }
						</div>
					) }
				</Row>

				<Row
					label={ __( 'Last Sync', 'routinekit' ) }
					description={ __( 'When workflows were last synced from your agency account.', 'routinekit' ) }
				>
					<div className="ap-inline-field">
						<span className="ap-settings-row__muted">
							{ d.lastSync ? d.lastSync : __( 'Never', 'routinekit' ) }
						</span>
						<Button variant="secondary" size="sm" disabled={ syncing } onClick={ syncNow }>
							{ syncing ? __( 'Syncing…', 'routinekit' ) : __( '↻ Sync Now', 'routinekit' ) }
						</Button>
						{ syncMsg && <span className="ap-settings-row__hint">{ syncMsg }</span> }
					</div>
				</Row>

			</Section>
		</div>
	);
};

// ---------------------------------------------------------------------------
// Danger Zone tab
// ---------------------------------------------------------------------------

const TypeToConfirm = ( { onConfirm, onCancel, busy, busyLabel, confirmLabel, word = 'DELETE' } ) => {
	const [ typed, setTyped ] = useState( '' );
	const matched = typed === word;

	return (
		<div className="ap-type-confirm">
			<p className="ap-type-confirm__prompt">
				{ __( 'Type', 'routinekit' ) }{ ' ' }
				<code className="ap-type-confirm__word">{ word }</code>{ ' ' }
				{ __( 'to confirm:', 'routinekit' ) }
			</p>
			<div className="ap-type-confirm__row">
				<input
					type="text"
					className={ `routinekit-input ap-type-confirm__input${ typed && ! matched ? ' ap-type-confirm__input--wrong' : '' }` }
					value={ typed }
					onChange={ ( e ) => setTyped( e.target.value ) }
					placeholder={ word }
					autoFocus
					spellCheck={ false }
				/>
				<button
					className="routinekit-btn routinekit-btn--danger"
					disabled={ ! matched || busy }
					onClick={ onConfirm }
				>
					{ busy ? busyLabel : confirmLabel }
				</button>
				<Button variant="ghost" onClick={ () => { setTyped( '' ); onCancel(); } }>
					{ __( 'Cancel', 'routinekit' ) }
				</Button>
			</div>
		</div>
	);
};

const DangerTab = () => {
	const [ confirmClear, setConfirmClear ] = useState( false );
	const [ clearing,     setClearing     ] = useState( false );
	const [ clearDone,    setClearDone    ] = useState( false );
	const [ clearError,   setClearError   ] = useState( null );

	const [ confirmReset, setConfirmReset ] = useState( false );
	const [ resetting,    setResetting    ] = useState( false );
	const [ resetError,   setResetError   ] = useState( null );

	// Uninstall preference. Saved on change rather than via the General tab's
	// Save button, since this tab has no save bar of its own.
	const [ clearOnUninstall, setClearOnUninstall ] = useState(
		!! data().uninstallClearData
	);
	const [ uninstallError, setUninstallError ] = useState( null );

	const saveClearOnUninstall = async ( next ) => {
		const previous = clearOnUninstall;
		setClearOnUninstall( next );        // optimistic
		setUninstallError( null );
		try {
			await apiFetch( {
				path:   '/routinekit/v1/settings',
				method: 'POST',
				data:   { routinekit_uninstall_clear_data: next },
			} );
		} catch ( e ) {
			setClearOnUninstall( previous ); // roll back on failure
			setUninstallError( e.message ?? __( 'Could not save that setting.', 'routinekit' ) );
		}
	};

	const clearCaptures = async () => {
		setClearing( true );
		setClearDone( false );
		setClearError( null );
		try {
			await apiFetch( { path: '/routinekit/v1/capture/all', method: 'DELETE' } );
			setClearDone( true );
			setConfirmClear( false );
		} catch ( e ) {
			setClearError( e.message ?? __( 'Failed to clear captures.', 'routinekit' ) );
		} finally {
			setClearing( false );
		}
	};

	const resetEverything = async () => {
		setResetting( true );
		setResetError( null );
		try {
			await apiFetch( { path: '/routinekit/v1/reset', method: 'DELETE' } );
			window.location.href = data().adminUrl + 'admin.php?page=routinekit&reset=1';
		} catch ( e ) {
			setResetError( e.message ?? __( 'Reset failed.', 'routinekit' ) );
			setResetting( false );
			setConfirmReset( false );
		}
	};

	return (
		<div className="ap-settings-general">
			<Section
				title={ __( 'Danger Zone', 'routinekit' ) }
				description={ __( 'These actions are irreversible. Proceed with caution.', 'routinekit' ) }
				danger
			>
				<div className="ap-danger-zone">

					{ /* ── Clear Captures ── */ }
					<div className="ap-danger-item">
						<div className="ap-danger-item__info">
							<strong>{ __( 'Delete All Captured Steps', 'routinekit' ) }</strong>
							<p>{ __( 'Remove all unassigned auto-captured steps. Assigned steps in workflows are unaffected.', 'routinekit' ) }</p>
							{ clearError && <p className="ap-danger-item__error">{ clearError }</p> }
							{ clearDone  && <p className="ap-danger-item__ok">{ __( '✓ Captured steps cleared.', 'routinekit' ) }</p> }
						</div>
						{ confirmClear ? (
							<TypeToConfirm
								onConfirm={ clearCaptures }
								onCancel={ () => setConfirmClear( false ) }
								busy={ clearing }
								busyLabel={ __( 'Clearing…', 'routinekit' ) }
								confirmLabel={ __( 'Yes, Clear', 'routinekit' ) }
							/>
						) : (
							<button
								className="routinekit-btn routinekit-btn--danger-outline"
								onClick={ () => { setClearDone( false ); setClearError( null ); setConfirmClear( true ); } }
							>
								{ __( 'Clear Captured Steps', 'routinekit' ) }
							</button>
						) }
					</div>

					{ /* ── Reset Everything ── */ }
					<div className="ap-danger-item">
						<div className="ap-danger-item__info">
							<strong>{ __( 'Reset All Plugin Data', 'routinekit' ) }</strong>
							<p>{ __( 'Permanently delete all workflows, steps, and settings. This cannot be undone.', 'routinekit' ) }</p>
							{ resetError && <p className="ap-danger-item__error">{ resetError }</p> }
						</div>
						{ confirmReset ? (
							<TypeToConfirm
								onConfirm={ resetEverything }
								onCancel={ () => setConfirmReset( false ) }
								busy={ resetting }
								busyLabel={ __( 'Resetting…', 'routinekit' ) }
								confirmLabel={ __( 'Yes, Reset Everything', 'routinekit' ) }
							/>
						) : (
							<Button variant="danger" onClick={ () => { setResetError( null ); setConfirmReset( true ); } }>
								{ __( 'Reset Everything', 'routinekit' ) }
							</Button>
						) }
					</div>

					{ /* ── Delete data on uninstall ── */ }
					<div className="ap-danger-item">
						<div className="ap-danger-item__info">
							<strong>{ __( 'Delete All Data on Uninstall', 'routinekit' ) }</strong>
							<p>
								{ __( 'Off by default: deleting RoutineKit from the Plugins screen keeps your workflows, steps, and settings, so you can reinstall without losing work. Turn this on to erase everything when the plugin is deleted.', 'routinekit' ) }
							</p>
							{ uninstallError && <p className="ap-danger-item__error">{ uninstallError }</p> }
						</div>
						<Toggle
							id="routinekit_uninstall_clear_data"
							checked={ clearOnUninstall }
							onChange={ saveClearOnUninstall }
						/>
					</div>

				</div>
			</Section>
		</div>
	);
};

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

const VALID_TABS = [ 'general', 'cloud', 'danger' ];

const getTabFromHash = () => {
	const hash = window.location.hash.replace( '#', '' );
	return VALID_TABS.includes( hash ) ? hash : 'general';
};

const Settings = () => {
	const [ tab, setTab ] = useState( getTabFromHash );

	const handleTabClick = ( id ) => {
		window.location.hash = id;
		setTab( id );
	};

	// Sync tab if hash changes externally (back/forward)
	useEffect( () => {
		const onHashChange = () => setTab( getTabFromHash() );
		window.addEventListener( 'hashchange', onHashChange );
		return () => window.removeEventListener( 'hashchange', onHashChange );
	}, [] );

	const tabs = [
		{ id: 'general',    label: __( 'General', 'routinekit' ) },
		{ id: 'cloud',      label: __( 'Cloud Connection', 'routinekit' ) },
		{ id: 'danger',     label: __( 'Danger Zone', 'routinekit' ) },
	];

	return (
		<div className="ap-settings wrap">
			<h1 className="ap-page-title">{ __( 'RoutineKit Settings', 'routinekit' ) }</h1>

			<nav className="ap-settings__tabs nav-tab-wrapper">
				{ tabs.map( ( t ) => (
					<button
						key={ t.id }
						className={ `nav-tab${ tab === t.id ? ' nav-tab-active' : '' }${ t.id === 'danger' ? ' ap-tab--danger' : '' }` }
						onClick={ () => handleTabClick( t.id ) }
					>
						{ t.label }
					</button>
				) ) }
			</nav>

			<div className="ap-settings__panel">
				{ tab === 'general' && <GeneralTab /> }
				{ tab === 'cloud'   && <CloudTab /> }
				{ tab === 'danger'  && <DangerTab /> }
			</div>
		</div>
	);
};

export default Settings;
