import { useState, useEffect, useCallback } from 'react';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import Toggle from '../shared/Toggle';
import Button from '../shared/Button';

const data = () => window.stepwiseData ?? {};

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
				path: '/stepwise/v1/settings',
				method: 'POST',
				data: payload ?? values,
			} );
			setSaved( true );
			setTimeout( () => setSaved( false ), 3000 );
		} catch ( e ) {
			setError( e.message ?? __( 'Save failed.', 'stepwise' ) );
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
		stepwise_capture_enabled:     d.captureEnabled     ?? true,
		stepwise_capture_scope:        d.captureScope       ?? 'all_changes',
		stepwise_capture_exclude:      d.captureExclude     ?? 'session_tokens, transient_*, _site_transient_*',
		stepwise_capture_retention:    d.captureRetention   ?? 30,
		stepwise_capture_min_changes:  d.captureMinChanges  ?? 1,
		// Notifications & Toast
		stepwise_toast_enabled:        d.toastEnabled       ?? true,
		stepwise_toast_autodismiss:    d.captureAutodismiss ?? 0,
		stepwise_launcher_enabled:     d.launcherEnabled    ?? true,
		// Workflow Defaults
		stepwise_default_status:       d.defaultStatus      ?? 'active',
		stepwise_default_category:     d.defaultCategory    ?? '',
		stepwise_show_run_button:      d.showRunButton      ?? true,
		// Team & Access
		stepwise_roles_view:           d.rolesView          ?? [ 'administrator' ],
		stepwise_roles_run:            d.rolesRun           ?? [ 'administrator' ],
		stepwise_roles_edit:           d.rolesEdit          ?? [ 'administrator' ],
		// Email Notifications
		stepwise_notify_assigned:      d.notifyAssigned     ?? true,
		stepwise_notify_completed:     d.notifyCompleted    ?? true,
		stepwise_notify_skipped:       d.notifySkipped      ?? false,
		stepwise_notify_email:         d.notifyEmail        ?? '',
	} );

	const allRoles = [
		{ value: 'administrator', label: __( 'Administrator', 'stepwise' ) },
		{ value: 'editor',        label: __( 'Editor',        'stepwise' ) },
		{ value: 'author',        label: __( 'Author',        'stepwise' ) },
		{ value: 'contributor',   label: __( 'Contributor',   'stepwise' ) },
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
						{ isLocked && <span className="ap-role-check__only">{ __( 'only', 'stepwise' ) }</span> }
					</label>
				);
			} ) }
		</div>
	);

	return (
		<div className="ap-settings-general">
			{ /* ── Auto-Capture ── */ }
			<Section
				title={ __( 'Auto-Capture', 'stepwise' ) }
				description={ __( 'Automatically detect and record WordPress option changes as workflow steps.', 'stepwise' ) }
			>
				<Row
					label={ __( 'Enable Auto-Capture', 'stepwise' ) }
					description={ __( 'Monitor this site for setting changes in real time.', 'stepwise' ) }
				>
					<Toggle
						id="stepwise_capture_enabled"
						checked={ !! values.stepwise_capture_enabled }
						onChange={ ( v ) => set( 'stepwise_capture_enabled', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Capture Scope', 'stepwise' ) }
					description={ __( 'Which option changes should be recorded.', 'stepwise' ) }
				>
					<select
						className="stepwise-select"
						value={ values.stepwise_capture_scope }
						onChange={ ( e ) => set( 'stepwise_capture_scope', e.target.value ) }
					>
						<option value="all_changes">{ __( 'All option changes', 'stepwise' ) }</option>
						<option value="plugin_settings_only">{ __( 'Plugin settings pages only', 'stepwise' ) }</option>
					</select>
				</Row>

				<Row
					label={ __( 'Exclude options', 'stepwise' ) }
					description={ __( 'Comma-separated option names to always ignore. Wildcards (*) supported.', 'stepwise' ) }
				>
					<input
						type="text"
						className="stepwise-input stepwise-input--wide"
						value={ values.stepwise_capture_exclude }
						onChange={ ( e ) => set( 'stepwise_capture_exclude', e.target.value ) }
						placeholder="session_tokens, transient_*, _site_transient_*"
					/>
				</Row>

				<Row
					label={ __( 'Capture retention', 'stepwise' ) }
					description={ __( 'How long to keep unassigned captured steps before auto-deleting.', 'stepwise' ) }
				>
					<select
						className="stepwise-select"
						value={ values.stepwise_capture_retention }
						onChange={ ( e ) => set( 'stepwise_capture_retention', Number( e.target.value ) ) }
					>
						{ [ 3, 7, 14, 30, 90 ].map( ( d ) => (
							<option key={ d } value={ d }>{ d } { __( 'days', 'stepwise' ) }</option>
						) ) }
					</select>
				</Row>
			</Section>

			{ /* ── Notifications & Toast ── */ }
			<Section
				title={ __( 'Notifications & Toast', 'stepwise' ) }
				description={ __( 'Control when and how the floating notification appears.', 'stepwise' ) }
			>
				<Row
					label={ __( 'Show toast notifications', 'stepwise' ) }
					description={ __( 'Display a floating prompt when changes are detected.', 'stepwise' ) }
				>
					<Toggle
						id="stepwise_toast_enabled"
						checked={ !! values.stepwise_toast_enabled }
						onChange={ ( v ) => set( 'stepwise_toast_enabled', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Minimum changes to trigger toast', 'stepwise' ) }
					description={ __( 'Only show the toast when this many or more options changed.', 'stepwise' ) }
				>
					<div className="ap-inline-field">
						<select
							className="stepwise-select stepwise-select--sm"
							value={ values.stepwise_capture_min_changes }
							onChange={ ( e ) => set( 'stepwise_capture_min_changes', Number( e.target.value ) ) }
						>
							{ [ 1, 2, 3, 5, 10 ].map( ( n ) => (
								<option key={ n } value={ n }>{ n }</option>
							) ) }
						</select>
						<span className="ap-inline-field__suffix">{ __( 'changes', 'stepwise' ) }</span>
					</div>
				</Row>

				<Row
					label={ __( 'Toast auto-dismiss', 'stepwise' ) }
					description={ __( 'Automatically hide the toast after a period of inactivity.', 'stepwise' ) }
				>
					<select
						className="stepwise-select"
						value={ values.stepwise_toast_autodismiss }
						onChange={ ( e ) => set( 'stepwise_toast_autodismiss', Number( e.target.value ) ) }
					>
						<option value={ 0 }>{ __( 'Never (manual dismiss)', 'stepwise' ) }</option>
						<option value={ 5 }>{ __( '5 seconds', 'stepwise' ) }</option>
						<option value={ 8 }>{ __( '8 seconds', 'stepwise' ) }</option>
						<option value={ 15 }>{ __( '15 seconds', 'stepwise' ) }</option>
						<option value={ 30 }>{ __( '30 seconds', 'stepwise' ) }</option>
					</select>
				</Row>

				<Row
					label={ __( 'Persistent launcher button', 'stepwise' ) }
					description={ __( 'Show the Stepwise floating button on every admin page.', 'stepwise' ) }
				>
					<Toggle
						id="stepwise_launcher_enabled"
						checked={ !! values.stepwise_launcher_enabled }
						onChange={ ( v ) => set( 'stepwise_launcher_enabled', v ) }
					/>
					{ values.stepwise_launcher_enabled && (
						<p className="ap-settings-row__hint">
							{ __( 'This is the ▶ Stepwise button visible in the bottom-right corner.', 'stepwise' ) }
						</p>
					) }
				</Row>
			</Section>

			{ /* ── Workflow Defaults ── */ }
			<Section
				title={ __( 'Workflow Defaults', 'stepwise' ) }
				description={ __( 'Default values applied when creating a new workflow.', 'stepwise' ) }
			>
				<Row
					label={ __( 'Default status', 'stepwise' ) }
					description={ __( 'New workflows start as Active or Draft.', 'stepwise' ) }
				>
					<div className="ap-radio-group">
						{ [ { value: 'active', label: __( 'Active', 'stepwise' ) }, { value: 'draft', label: __( 'Draft', 'stepwise' ) } ].map( ( opt ) => (
							<label key={ opt.value } className="ap-radio-label">
								<input
									type="radio"
									name="stepwise_default_status"
									value={ opt.value }
									checked={ values.stepwise_default_status === opt.value }
									onChange={ () => set( 'stepwise_default_status', opt.value ) }
								/>
								{ opt.label }
							</label>
						) ) }
					</div>
				</Row>

				<Row
					label={ __( 'Default category', 'stepwise' ) }
					description={ __( 'Pre-fill the category field on new workflows.', 'stepwise' ) }
				>
					<select
						className="stepwise-select"
						value={ values.stepwise_default_category }
						onChange={ ( e ) => set( 'stepwise_default_category', e.target.value ) }
					>
						{ CATEGORIES.map( ( c ) => (
							<option key={ c } value={ c }>{ c || __( '— None —', 'stepwise' ) }</option>
						) ) }
					</select>
				</Row>

				<Row
					label={ __( 'Show "Run" button in list table', 'stepwise' ) }
					description={ __( 'Display the Run Workflow button in the workflows table.', 'stepwise' ) }
				>
					<Toggle
						id="stepwise_show_run_button"
						checked={ !! values.stepwise_show_run_button }
						onChange={ ( v ) => set( 'stepwise_show_run_button', v ) }
					/>
				</Row>
			</Section>

			{ /* ── Team & Access ── */ }
			<Section
				title={ __( 'Team & Access', 'stepwise' ) }
				description={ __( 'Control which WordPress user roles can view and run workflows on this site.', 'stepwise' ) }
			>
				<Row
					label={ __( 'Roles that can view workflows', 'stepwise' ) }
					description={ __( 'These roles will see the Stepwise menu item.', 'stepwise' ) }
				>
					<RoleCheckboxes settingKey="stepwise_roles_view" />
				</Row>

				<Row
					label={ __( 'Roles that can run workflows', 'stepwise' ) }
					description={ __( 'Restrict who can execute a workflow on this site.', 'stepwise' ) }
				>
					<RoleCheckboxes settingKey="stepwise_roles_run" />
				</Row>

				<Row
					label={ __( 'Roles that can edit workflows', 'stepwise' ) }
					description={ __( 'Who can create, edit, and delete workflows on this site.', 'stepwise' ) }
				>
					<RoleCheckboxes settingKey="stepwise_roles_edit" locked="administrator" />
				</Row>
			</Section>

			{ /* ── Email Notifications ── */ }
			<Section
				title={ __( 'Email Notifications', 'stepwise' ) }
				description={ __( 'Send email alerts for key workflow events on this site.', 'stepwise' ) }
			>
				<Row
					label={ __( 'Notify when workflow assigned', 'stepwise' ) }
					description={ __( 'Email admin when a new workflow is pushed to this site from the agency dashboard.', 'stepwise' ) }
				>
					<Toggle
						id="stepwise_notify_assigned"
						checked={ !! values.stepwise_notify_assigned }
						onChange={ ( v ) => set( 'stepwise_notify_assigned', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Notify when workflow completed', 'stepwise' ) }
					description={ __( 'Email admin when a user finishes all steps of a workflow.', 'stepwise' ) }
				>
					<Toggle
						id="stepwise_notify_completed"
						checked={ !! values.stepwise_notify_completed }
						onChange={ ( v ) => set( 'stepwise_notify_completed', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Notify when step skipped', 'stepwise' ) }
					description={ __( 'Email when a required step is skipped with a reason.', 'stepwise' ) }
				>
					<Toggle
						id="stepwise_notify_skipped"
						checked={ !! values.stepwise_notify_skipped }
						onChange={ ( v ) => set( 'stepwise_notify_skipped', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Notification email address', 'stepwise' ) }
					description={ __( 'Where these emails are sent. Defaults to the site admin email.', 'stepwise' ) }
				>
					<input
						type="email"
						className="stepwise-input"
						value={ values.stepwise_notify_email }
						onChange={ ( e ) => set( 'stepwise_notify_email', e.target.value ) }
						placeholder={ __( 'admin@clientsite.com', 'stepwise' ) }
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
					{ saving ? __( 'Saving…', 'stepwise' ) : __( 'Save Settings', 'stepwise' ) }
				</Button>
				{ saved && <span className="ap-settings-save-bar__saved">{ __( '✓ Saved', 'stepwise' ) }</span> }
				<span className="ap-settings-save-bar__version">
					Stepwise v{ data().version ?? '1.0.0' } ·{ ' ' }
					<a href="https://wpstepwise.com/docs" target="_blank" rel="noreferrer">{ __( 'Documentation', 'stepwise' ) }</a>
					{ ' · ' }
					<a href="https://wpstepwise.com/support" target="_blank" rel="noreferrer">{ __( 'Support', 'stepwise' ) }</a>
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
			title={ __( 'License & Pro Features', 'stepwise' ) }
			description={ __( 'Unlock multi-site management, template library, team sharing, and more.', 'stepwise' ) }
		>
			<div className="ap-license-header">
				<span className={ `ap-plan-badge ${ isPro ? 'ap-plan-badge--pro' : 'ap-plan-badge--free' }` }>
					{ planLabel }
				</span>
				{ d.saasConnected && (
					<span className="ap-license-header__sub">
						{ __( 'Your site is connected to Stepwise Cloud.', 'stepwise' ) }
					</span>
				) }
			</div>

			<div className="ap-plan-cards">
				{ /* Free */ }
				<div className={ `ap-plan-card${ ! isPro ? ' ap-plan-card--active' : '' }` }>
					<h3 className="ap-plan-card__name">{ __( 'Free', 'stepwise' ) }</h3>
					<ul className="ap-plan-card__features">
						<li>{ __( 'Unlimited workflows', 'stepwise' ) }</li>
						<li>{ __( 'Up to 3 connected sites', 'stepwise' ) }</li>
						<li>{ __( 'Stepwise Cloud dashboard', 'stepwise' ) }</li>
						<li>{ __( 'Auto-capture', 'stepwise' ) }</li>
						<li>{ __( 'JSON export', 'stepwise' ) }</li>
						<li className="ap-plan-card__feature--locked">{ __( 'Multiple site groups', 'stepwise' ) }</li>
						<li className="ap-plan-card__feature--locked">{ __( 'Cloud template library', 'stepwise' ) }</li>
						<li className="ap-plan-card__feature--locked">{ __( 'Team members', 'stepwise' ) }</li>
					</ul>
				</div>

				{ /* Agency */ }
				<div className={ `ap-plan-card ap-plan-card--pro${ isPro && d.licensePlan === 'agency' ? ' ap-plan-card--active' : '' }` }>
					<div className="ap-plan-card__badge">AGENCY</div>
					<h3 className="ap-plan-card__name">{ __( '$149 / year', 'stepwise' ) }</h3>
					<p style={ { fontSize: '11px', color: '#6366f1', fontWeight: 500, marginTop: '-4px', marginBottom: '10px' } }>
						{ __( 'Up to 50 sites — just $0.25/site/mo', 'stepwise' ) }
					</p>
					<ul className="ap-plan-card__features">
						<li>{ __( 'Up to 50 connected sites', 'stepwise' ) }</li>
						<li>{ __( 'Multiple site groups & fleet push', 'stepwise' ) }</li>
						<li>{ __( 'Cloud workflow template library', 'stepwise' ) }</li>
						<li>{ __( 'Import from URL', 'stepwise' ) }</li>
						<li>{ __( 'Team members', 'stepwise' ) }</li>
						<li>{ __( 'Auto-capture', 'stepwise' ) }</li>
					</ul>
					{ ! isPro && (
						<Button variant="primary" onClick={ () => { window.location.href = d.upgradeUrl ?? '#'; } }>
							{ __( 'Get Agency →', 'stepwise' ) }
						</Button>
					) }
				</div>

				{ /* Agency Pro */ }
				<div className={ `ap-plan-card ap-plan-card--pro${ isPro && d.licensePlan === 'agency_pro' ? ' ap-plan-card--active' : '' }` }>
					<div className="ap-plan-card__badge" style={ { background: '#4f46e5' } }>AGENCY PRO</div>
					<h3 className="ap-plan-card__name">{ __( '$249 / year', 'stepwise' ) }</h3>
					<p style={ { fontSize: '11px', color: '#6366f1', fontWeight: 500, marginTop: '-4px', marginBottom: '10px' } }>
						{ __( 'Unlimited sites — $0.42/site/mo at 50 sites, less as you grow', 'stepwise' ) }
					</p>
					<ul className="ap-plan-card__features">
						<li>{ __( 'Everything in Agency', 'stepwise' ) }</li>
						<li><strong>{ __( 'Unlimited connected sites', 'stepwise' ) }</strong></li>
						<li><strong>{ __( 'Priority email support', 'stepwise' ) }</strong></li>
						<li>{ __( 'Early access to new features', 'stepwise' ) }</li>
					</ul>
					{ ! isPro && (
						<Button variant="primary" onClick={ () => { window.location.href = d.upgradeUrl ?? '#'; } }>
							{ __( 'Get Agency Pro →', 'stepwise' ) }
						</Button>
					) }
					{ isPro && d.licensePlan === 'agency' && (
						<Button variant="secondary" onClick={ () => { window.location.href = d.upgradeUrl ?? '#'; } }>
							{ __( 'Upgrade to Agency Pro →', 'stepwise' ) }
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
			await apiFetch( { path: '/stepwise/v1/saas/sync', method: 'POST' } );
			setSyncMsg( __( 'Sync complete.', 'stepwise' ) );
		} catch ( e ) {
			setSyncMsg( e.message ?? __( 'Sync failed.', 'stepwise' ) );
		} finally {
			setSyncing( false );
		}
	};

	return (
		<div className="ap-settings-general">
			<Section
				title={ __( 'Stepwise Cloud Connection', 'stepwise' ) }
				description={ __( 'Connect to your Stepwise agency account to sync and assign workflows across sites.', 'stepwise' ) }
			>
				<div className={ `ap-cloud-status ${ saasConnected ? 'ap-cloud-status--connected' : 'ap-cloud-status--disconnected' }` }>
					<span className="ap-cloud-status__dot" />
					{ saasConnected ? __( 'Connected', 'stepwise' ) : __( 'Not Connected', 'stepwise' ) }
				</div>

				<Row
					label={ __( 'License Key', 'stepwise' ) }
					description={ __( 'Enter your Stepwise Pro license key to connect.', 'stepwise' ) }
				>
					{ saasConnected ? (
						<div className="ap-license-activate__row">
							<input
								type="text"
								className="stepwise-input stepwise-input--license"
								value="••••••••••••••••"
								readOnly
								disabled
							/>
							<Button
								variant="danger"
								disabled={ disconnecting }
								onClick={ async () => {
									if ( ! window.confirm( __( 'Disconnect this site from Stepwise Cloud?', 'stepwise' ) ) ) return;
									setDisconnecting( true );
									setConnectError( null );
									try {
										await apiFetch( { path: '/stepwise/v1/settings/saas/disconnect', method: 'POST' } );
										setConnected( false );
									} catch ( e ) {
										setConnectError( e.message ?? __( 'Disconnect failed.', 'stepwise' ) );
									} finally {
										setDisconnecting( false );
									}
								} }
							>
								{ disconnecting ? __( 'Disconnecting…', 'stepwise' ) : __( 'Disconnect', 'stepwise' ) }
							</Button>
						</div>
					) : (
						<div>
							<div className="ap-license-activate__row">
								<input
									type="text"
									className="stepwise-input stepwise-input--license"
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
												path:   '/stepwise/v1/settings/saas/connect',
												method: 'POST',
												data:   { license_key: licenseKey.trim() },
											} );
											setConnected( true );
											setLicenseKey( '' );
										} catch ( e ) {
											setConnectError( e.message ?? __( 'Connection failed. Please check your key.', 'stepwise' ) );
										} finally {
											setConnecting( false );
										}
									} }
								>
									{ connecting ? __( 'Connecting…', 'stepwise' ) : __( 'Connect', 'stepwise' ) }
								</Button>
							</div>
							{ connectError && <p className="ap-error">{ connectError }</p> }
						</div>
					) }
				</Row>

				<Row
					label={ __( 'Last Sync', 'stepwise' ) }
					description={ __( 'When workflows were last synced from your agency account.', 'stepwise' ) }
				>
					<div className="ap-inline-field">
						<span className="ap-settings-row__muted">
							{ d.lastSync ? d.lastSync : __( 'Never', 'stepwise' ) }
						</span>
						<Button variant="secondary" size="sm" disabled={ syncing } onClick={ syncNow }>
							{ syncing ? __( 'Syncing…', 'stepwise' ) : __( '↻ Sync Now', 'stepwise' ) }
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
				{ __( 'Type', 'stepwise' ) }{ ' ' }
				<code className="ap-type-confirm__word">{ word }</code>{ ' ' }
				{ __( 'to confirm:', 'stepwise' ) }
			</p>
			<div className="ap-type-confirm__row">
				<input
					type="text"
					className={ `stepwise-input ap-type-confirm__input${ typed && ! matched ? ' ap-type-confirm__input--wrong' : '' }` }
					value={ typed }
					onChange={ ( e ) => setTyped( e.target.value ) }
					placeholder={ word }
					autoFocus
					spellCheck={ false }
				/>
				<button
					className="stepwise-btn stepwise-btn--danger"
					disabled={ ! matched || busy }
					onClick={ onConfirm }
				>
					{ busy ? busyLabel : confirmLabel }
				</button>
				<Button variant="ghost" onClick={ () => { setTyped( '' ); onCancel(); } }>
					{ __( 'Cancel', 'stepwise' ) }
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

	const clearCaptures = async () => {
		setClearing( true );
		setClearDone( false );
		setClearError( null );
		try {
			await apiFetch( { path: '/stepwise/v1/capture/all', method: 'DELETE' } );
			setClearDone( true );
			setConfirmClear( false );
		} catch ( e ) {
			setClearError( e.message ?? __( 'Failed to clear captures.', 'stepwise' ) );
		} finally {
			setClearing( false );
		}
	};

	const resetEverything = async () => {
		setResetting( true );
		setResetError( null );
		try {
			await apiFetch( { path: '/stepwise/v1/reset', method: 'DELETE' } );
			window.location.href = data().adminUrl + 'admin.php?page=stepwise&reset=1';
		} catch ( e ) {
			setResetError( e.message ?? __( 'Reset failed.', 'stepwise' ) );
			setResetting( false );
			setConfirmReset( false );
		}
	};

	return (
		<div className="ap-settings-general">
			<Section
				title={ __( 'Danger Zone', 'stepwise' ) }
				description={ __( 'These actions are irreversible. Proceed with caution.', 'stepwise' ) }
				danger
			>
				<div className="ap-danger-zone">

					{ /* ── Clear Captures ── */ }
					<div className="ap-danger-item">
						<div className="ap-danger-item__info">
							<strong>{ __( 'Delete All Captured Steps', 'stepwise' ) }</strong>
							<p>{ __( 'Remove all unassigned auto-captured steps. Assigned steps in workflows are unaffected.', 'stepwise' ) }</p>
							{ clearError && <p className="ap-danger-item__error">{ clearError }</p> }
							{ clearDone  && <p className="ap-danger-item__ok">{ __( '✓ Captured steps cleared.', 'stepwise' ) }</p> }
						</div>
						{ confirmClear ? (
							<TypeToConfirm
								onConfirm={ clearCaptures }
								onCancel={ () => setConfirmClear( false ) }
								busy={ clearing }
								busyLabel={ __( 'Clearing…', 'stepwise' ) }
								confirmLabel={ __( 'Yes, Clear', 'stepwise' ) }
							/>
						) : (
							<button
								className="stepwise-btn stepwise-btn--danger-outline"
								onClick={ () => { setClearDone( false ); setClearError( null ); setConfirmClear( true ); } }
							>
								{ __( 'Clear Captured Steps', 'stepwise' ) }
							</button>
						) }
					</div>

					{ /* ── Reset Everything ── */ }
					<div className="ap-danger-item">
						<div className="ap-danger-item__info">
							<strong>{ __( 'Reset All Plugin Data', 'stepwise' ) }</strong>
							<p>{ __( 'Permanently delete all workflows, steps, and settings. This cannot be undone.', 'stepwise' ) }</p>
							{ resetError && <p className="ap-danger-item__error">{ resetError }</p> }
						</div>
						{ confirmReset ? (
							<TypeToConfirm
								onConfirm={ resetEverything }
								onCancel={ () => setConfirmReset( false ) }
								busy={ resetting }
								busyLabel={ __( 'Resetting…', 'stepwise' ) }
								confirmLabel={ __( 'Yes, Reset Everything', 'stepwise' ) }
							/>
						) : (
							<Button variant="danger" onClick={ () => { setResetError( null ); setConfirmReset( true ); } }>
								{ __( 'Reset Everything', 'stepwise' ) }
							</Button>
						) }
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
		{ id: 'general',    label: __( 'General', 'stepwise' ) },
		{ id: 'cloud',      label: __( 'Cloud Connection', 'stepwise' ) },
		{ id: 'danger',     label: __( 'Danger Zone', 'stepwise' ) },
	];

	return (
		<div className="ap-settings wrap">
			<h1 className="ap-page-title">{ __( 'Stepwise Settings', 'stepwise' ) }</h1>

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
