import { useState, useEffect, useCallback } from 'react';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import Toggle from '../shared/Toggle';
import Button from '../shared/Button';

const data = () => window.alignpressData ?? {};

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
				path: '/alignpress/v1/settings',
				method: 'POST',
				data: payload ?? values,
			} );
			setSaved( true );
			setTimeout( () => setSaved( false ), 3000 );
		} catch ( e ) {
			setError( e.message ?? __( 'Save failed.', 'alignpress' ) );
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
		alignpress_capture_enabled:     d.captureEnabled     ?? true,
		alignpress_capture_scope:        d.captureScope       ?? 'all_changes',
		alignpress_capture_exclude:      d.captureExclude     ?? 'session_tokens, transient_*, _site_transient_*',
		alignpress_capture_retention:    d.captureRetention   ?? 7,
		alignpress_capture_min_changes:  d.captureMinChanges  ?? 1,
		// Notifications & Toast
		alignpress_toast_enabled:        d.toastEnabled       ?? true,
		alignpress_toast_autodismiss:    d.captureAutodismiss ?? 0,
		alignpress_launcher_enabled:     d.launcherEnabled    ?? true,
		// Workflow Defaults
		alignpress_default_status:       d.defaultStatus      ?? 'active',
		alignpress_default_category:     d.defaultCategory    ?? '',
		alignpress_show_run_button:      d.showRunButton      ?? true,
		// Team & Access
		alignpress_roles_view:           d.rolesView          ?? [ 'administrator' ],
		alignpress_roles_run:            d.rolesRun           ?? [ 'administrator' ],
		alignpress_roles_edit:           d.rolesEdit          ?? [ 'administrator' ],
		// Email Notifications
		alignpress_notify_assigned:      d.notifyAssigned     ?? true,
		alignpress_notify_completed:     d.notifyCompleted    ?? true,
		alignpress_notify_skipped:       d.notifySkipped      ?? false,
		alignpress_notify_email:         d.notifyEmail        ?? '',
	} );

	const allRoles = [
		{ value: 'administrator', label: __( 'Administrator', 'alignpress' ) },
		{ value: 'editor',        label: __( 'Editor',        'alignpress' ) },
		{ value: 'author',        label: __( 'Author',        'alignpress' ) },
		{ value: 'contributor',   label: __( 'Contributor',   'alignpress' ) },
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
						{ isLocked && <span className="ap-role-check__only">{ __( 'only', 'alignpress' ) }</span> }
					</label>
				);
			} ) }
		</div>
	);

	return (
		<div className="ap-settings-general">
			{ /* ── Auto-Capture ── */ }
			<Section
				title={ __( 'Auto-Capture', 'alignpress' ) }
				description={ __( 'Automatically detect and record WordPress option changes as workflow steps.', 'alignpress' ) }
			>
				<Row
					label={ __( 'Enable Auto-Capture', 'alignpress' ) }
					description={ __( 'Monitor this site for setting changes in real time.', 'alignpress' ) }
				>
					<Toggle
						id="alignpress_capture_enabled"
						checked={ !! values.alignpress_capture_enabled }
						onChange={ ( v ) => set( 'alignpress_capture_enabled', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Capture Scope', 'alignpress' ) }
					description={ __( 'Which option changes should be recorded.', 'alignpress' ) }
				>
					<select
						className="alignpress-select"
						value={ values.alignpress_capture_scope }
						onChange={ ( e ) => set( 'alignpress_capture_scope', e.target.value ) }
					>
						<option value="all_changes">{ __( 'All option changes', 'alignpress' ) }</option>
						<option value="plugin_settings_only">{ __( 'Plugin settings pages only', 'alignpress' ) }</option>
					</select>
				</Row>

				<Row
					label={ __( 'Exclude options', 'alignpress' ) }
					description={ __( 'Comma-separated option names to always ignore. Wildcards (*) supported.', 'alignpress' ) }
				>
					<input
						type="text"
						className="alignpress-input alignpress-input--wide"
						value={ values.alignpress_capture_exclude }
						onChange={ ( e ) => set( 'alignpress_capture_exclude', e.target.value ) }
						placeholder="session_tokens, transient_*, _site_transient_*"
					/>
				</Row>

				<Row
					label={ __( 'Capture retention', 'alignpress' ) }
					description={ __( 'How long to keep unassigned captured steps before auto-deleting.', 'alignpress' ) }
				>
					<select
						className="alignpress-select"
						value={ values.alignpress_capture_retention }
						onChange={ ( e ) => set( 'alignpress_capture_retention', Number( e.target.value ) ) }
					>
						{ [ 3, 7, 14, 30, 90 ].map( ( d ) => (
							<option key={ d } value={ d }>{ d } { __( 'days', 'alignpress' ) }</option>
						) ) }
					</select>
				</Row>
			</Section>

			{ /* ── Notifications & Toast ── */ }
			<Section
				title={ __( 'Notifications & Toast', 'alignpress' ) }
				description={ __( 'Control when and how the floating notification appears.', 'alignpress' ) }
			>
				<Row
					label={ __( 'Show toast notifications', 'alignpress' ) }
					description={ __( 'Display a floating prompt when changes are detected.', 'alignpress' ) }
				>
					<Toggle
						id="alignpress_toast_enabled"
						checked={ !! values.alignpress_toast_enabled }
						onChange={ ( v ) => set( 'alignpress_toast_enabled', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Minimum changes to trigger toast', 'alignpress' ) }
					description={ __( 'Only show the toast when this many or more options changed.', 'alignpress' ) }
				>
					<div className="ap-inline-field">
						<select
							className="alignpress-select alignpress-select--sm"
							value={ values.alignpress_capture_min_changes }
							onChange={ ( e ) => set( 'alignpress_capture_min_changes', Number( e.target.value ) ) }
						>
							{ [ 1, 2, 3, 5, 10 ].map( ( n ) => (
								<option key={ n } value={ n }>{ n }</option>
							) ) }
						</select>
						<span className="ap-inline-field__suffix">{ __( 'changes', 'alignpress' ) }</span>
					</div>
				</Row>

				<Row
					label={ __( 'Toast auto-dismiss', 'alignpress' ) }
					description={ __( 'Automatically hide the toast after a period of inactivity.', 'alignpress' ) }
				>
					<select
						className="alignpress-select"
						value={ values.alignpress_toast_autodismiss }
						onChange={ ( e ) => set( 'alignpress_toast_autodismiss', Number( e.target.value ) ) }
					>
						<option value={ 0 }>{ __( 'Never (manual dismiss)', 'alignpress' ) }</option>
						<option value={ 5 }>{ __( '5 seconds', 'alignpress' ) }</option>
						<option value={ 8 }>{ __( '8 seconds', 'alignpress' ) }</option>
						<option value={ 15 }>{ __( '15 seconds', 'alignpress' ) }</option>
						<option value={ 30 }>{ __( '30 seconds', 'alignpress' ) }</option>
					</select>
				</Row>

				<Row
					label={ __( 'Persistent launcher button', 'alignpress' ) }
					description={ __( 'Show the AlignPress floating button on every admin page.', 'alignpress' ) }
				>
					<Toggle
						id="alignpress_launcher_enabled"
						checked={ !! values.alignpress_launcher_enabled }
						onChange={ ( v ) => set( 'alignpress_launcher_enabled', v ) }
					/>
					{ values.alignpress_launcher_enabled && (
						<p className="ap-settings-row__hint">
							{ __( 'This is the ▶ AlignPress button visible in the bottom-right corner.', 'alignpress' ) }
						</p>
					) }
				</Row>
			</Section>

			{ /* ── Workflow Defaults ── */ }
			<Section
				title={ __( 'Workflow Defaults', 'alignpress' ) }
				description={ __( 'Default values applied when creating a new workflow.', 'alignpress' ) }
			>
				<Row
					label={ __( 'Default status', 'alignpress' ) }
					description={ __( 'New workflows start as Active or Draft.', 'alignpress' ) }
				>
					<div className="ap-radio-group">
						{ [ { value: 'active', label: __( 'Active', 'alignpress' ) }, { value: 'draft', label: __( 'Draft', 'alignpress' ) } ].map( ( opt ) => (
							<label key={ opt.value } className="ap-radio-label">
								<input
									type="radio"
									name="alignpress_default_status"
									value={ opt.value }
									checked={ values.alignpress_default_status === opt.value }
									onChange={ () => set( 'alignpress_default_status', opt.value ) }
								/>
								{ opt.label }
							</label>
						) ) }
					</div>
				</Row>

				<Row
					label={ __( 'Default category', 'alignpress' ) }
					description={ __( 'Pre-fill the category field on new workflows.', 'alignpress' ) }
				>
					<select
						className="alignpress-select"
						value={ values.alignpress_default_category }
						onChange={ ( e ) => set( 'alignpress_default_category', e.target.value ) }
					>
						{ CATEGORIES.map( ( c ) => (
							<option key={ c } value={ c }>{ c || __( '— None —', 'alignpress' ) }</option>
						) ) }
					</select>
				</Row>

				<Row
					label={ __( 'Show "Run" button in list table', 'alignpress' ) }
					description={ __( 'Display the Run Workflow button in the workflows table.', 'alignpress' ) }
				>
					<Toggle
						id="alignpress_show_run_button"
						checked={ !! values.alignpress_show_run_button }
						onChange={ ( v ) => set( 'alignpress_show_run_button', v ) }
					/>
				</Row>
			</Section>

			{ /* ── Team & Access ── */ }
			<Section
				title={ __( 'Team & Access', 'alignpress' ) }
				description={ __( 'Control which WordPress user roles can view and run workflows on this site.', 'alignpress' ) }
			>
				<Row
					label={ __( 'Roles that can view workflows', 'alignpress' ) }
					description={ __( 'These roles will see the AlignPress menu item.', 'alignpress' ) }
				>
					<RoleCheckboxes settingKey="alignpress_roles_view" />
				</Row>

				<Row
					label={ __( 'Roles that can run workflows', 'alignpress' ) }
					description={ __( 'Restrict who can execute a workflow on this site.', 'alignpress' ) }
				>
					<RoleCheckboxes settingKey="alignpress_roles_run" />
				</Row>

				<Row
					label={ __( 'Roles that can edit workflows', 'alignpress' ) }
					description={ __( 'Who can create, edit, and delete workflows on this site.', 'alignpress' ) }
				>
					<RoleCheckboxes settingKey="alignpress_roles_edit" locked="administrator" />
				</Row>
			</Section>

			{ /* ── Email Notifications ── */ }
			<Section
				title={ __( 'Email Notifications', 'alignpress' ) }
				description={ __( 'Send email alerts for key workflow events on this site.', 'alignpress' ) }
			>
				<Row
					label={ __( 'Notify when workflow assigned', 'alignpress' ) }
					description={ __( 'Email admin when a new workflow is pushed to this site from the agency dashboard.', 'alignpress' ) }
				>
					<Toggle
						id="alignpress_notify_assigned"
						checked={ !! values.alignpress_notify_assigned }
						onChange={ ( v ) => set( 'alignpress_notify_assigned', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Notify when workflow completed', 'alignpress' ) }
					description={ __( 'Email admin when a user finishes all steps of a workflow.', 'alignpress' ) }
				>
					<Toggle
						id="alignpress_notify_completed"
						checked={ !! values.alignpress_notify_completed }
						onChange={ ( v ) => set( 'alignpress_notify_completed', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Notify when step skipped', 'alignpress' ) }
					description={ __( 'Email when a required step is skipped with a reason.', 'alignpress' ) }
				>
					<Toggle
						id="alignpress_notify_skipped"
						checked={ !! values.alignpress_notify_skipped }
						onChange={ ( v ) => set( 'alignpress_notify_skipped', v ) }
					/>
				</Row>

				<Row
					label={ __( 'Notification email address', 'alignpress' ) }
					description={ __( 'Where these emails are sent. Defaults to the site admin email.', 'alignpress' ) }
				>
					<input
						type="email"
						className="alignpress-input"
						value={ values.alignpress_notify_email }
						onChange={ ( e ) => set( 'alignpress_notify_email', e.target.value ) }
						placeholder={ __( 'admin@clientsite.com', 'alignpress' ) }
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
					{ saving ? __( 'Saving…', 'alignpress' ) : __( 'Save Settings', 'alignpress' ) }
				</Button>
				{ saved && <span className="ap-settings-save-bar__saved">{ __( '✓ Saved', 'alignpress' ) }</span> }
				<span className="ap-settings-save-bar__version">
					AlignPress v{ data().version ?? '1.0.0' } ·{ ' ' }
					<a href="https://alignpress.optinable.com/docs" target="_blank" rel="noreferrer">{ __( 'Documentation', 'alignpress' ) }</a>
					{ ' · ' }
					<a href="https://alignpress.optinable.com/support" target="_blank" rel="noreferrer">{ __( 'Support', 'alignpress' ) }</a>
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
			title={ __( 'License & Pro Features', 'alignpress' ) }
			description={ __( 'Unlock multi-site management, template library, team sharing, and more.', 'alignpress' ) }
		>
			<div className="ap-license-header">
				<span className={ `ap-plan-badge ${ isPro ? 'ap-plan-badge--pro' : 'ap-plan-badge--free' }` }>
					{ planLabel }
				</span>
				{ d.saasConnected && (
					<span className="ap-license-header__sub">
						{ __( 'Your site is connected to AlignPress Cloud.', 'alignpress' ) }
					</span>
				) }
			</div>

			<div className="ap-plan-cards">
				{ /* Free */ }
				<div className={ `ap-plan-card${ ! isPro ? ' ap-plan-card--active' : '' }` }>
					<h3 className="ap-plan-card__name">{ __( 'Free', 'alignpress' ) }</h3>
					<ul className="ap-plan-card__features">
						<li>{ __( 'Unlimited workflows', 'alignpress' ) }</li>
						<li>{ __( 'Up to 3 connected sites', 'alignpress' ) }</li>
						<li>{ __( 'AlignPress Cloud dashboard', 'alignpress' ) }</li>
						<li>{ __( 'Auto-capture (7 days)', 'alignpress' ) }</li>
						<li>{ __( 'JSON export', 'alignpress' ) }</li>
						<li className="ap-plan-card__feature--locked">{ __( 'Multiple site groups', 'alignpress' ) }</li>
						<li className="ap-plan-card__feature--locked">{ __( 'Cloud template library', 'alignpress' ) }</li>
						<li className="ap-plan-card__feature--locked">{ __( 'Team members', 'alignpress' ) }</li>
					</ul>
				</div>

				{ /* Agency */ }
				<div className={ `ap-plan-card ap-plan-card--pro${ isPro && d.licensePlan === 'agency' ? ' ap-plan-card--active' : '' }` }>
					<div className="ap-plan-card__badge">AGENCY</div>
					<h3 className="ap-plan-card__name">{ __( '$149 / year', 'alignpress' ) }</h3>
					<p style={ { fontSize: '11px', color: '#6366f1', fontWeight: 500, marginTop: '-4px', marginBottom: '10px' } }>
						{ __( 'Up to 50 sites — just $0.25/site/mo', 'alignpress' ) }
					</p>
					<ul className="ap-plan-card__features">
						<li>{ __( 'Up to 50 connected sites', 'alignpress' ) }</li>
						<li>{ __( 'Multiple site groups & fleet push', 'alignpress' ) }</li>
						<li>{ __( 'Cloud workflow template library', 'alignpress' ) }</li>
						<li>{ __( 'Import from URL', 'alignpress' ) }</li>
						<li>{ __( 'Team members', 'alignpress' ) }</li>
						<li>{ __( 'Auto-capture (90 days)', 'alignpress' ) }</li>
					</ul>
					{ ! isPro && (
						<Button variant="primary" onClick={ () => { window.location.href = d.upgradeUrl ?? '#'; } }>
							{ __( 'Get Agency →', 'alignpress' ) }
						</Button>
					) }
				</div>

				{ /* Agency Pro */ }
				<div className={ `ap-plan-card ap-plan-card--pro${ isPro && d.licensePlan === 'agency_pro' ? ' ap-plan-card--active' : '' }` }>
					<div className="ap-plan-card__badge" style={ { background: '#4f46e5' } }>AGENCY PRO</div>
					<h3 className="ap-plan-card__name">{ __( '$249 / year', 'alignpress' ) }</h3>
					<p style={ { fontSize: '11px', color: '#6366f1', fontWeight: 500, marginTop: '-4px', marginBottom: '10px' } }>
						{ __( 'Unlimited sites — $0.42/site/mo at 50 sites, less as you grow', 'alignpress' ) }
					</p>
					<ul className="ap-plan-card__features">
						<li>{ __( 'Everything in Agency', 'alignpress' ) }</li>
						<li><strong>{ __( 'Unlimited connected sites', 'alignpress' ) }</strong></li>
						<li><strong>{ __( 'Priority email support', 'alignpress' ) }</strong></li>
						<li>{ __( 'Early access to new features', 'alignpress' ) }</li>
					</ul>
					{ ! isPro && (
						<Button variant="primary" onClick={ () => { window.location.href = d.upgradeUrl ?? '#'; } }>
							{ __( 'Get Agency Pro →', 'alignpress' ) }
						</Button>
					) }
					{ isPro && d.licensePlan === 'agency' && (
						<Button variant="secondary" onClick={ () => { window.location.href = d.upgradeUrl ?? '#'; } }>
							{ __( 'Upgrade to Agency Pro →', 'alignpress' ) }
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
			await apiFetch( { path: '/alignpress/v1/saas/sync', method: 'POST' } );
			setSyncMsg( __( 'Sync complete.', 'alignpress' ) );
		} catch ( e ) {
			setSyncMsg( e.message ?? __( 'Sync failed.', 'alignpress' ) );
		} finally {
			setSyncing( false );
		}
	};

	return (
		<div className="ap-settings-general">
			<Section
				title={ __( 'AlignPress Cloud Connection', 'alignpress' ) }
				description={ __( 'Connect to your AlignPress agency account to sync and assign workflows across sites.', 'alignpress' ) }
			>
				<div className={ `ap-cloud-status ${ saasConnected ? 'ap-cloud-status--connected' : 'ap-cloud-status--disconnected' }` }>
					<span className="ap-cloud-status__dot" />
					{ saasConnected ? __( 'Connected', 'alignpress' ) : __( 'Not Connected', 'alignpress' ) }
				</div>

				<Row
					label={ __( 'License Key', 'alignpress' ) }
					description={ __( 'Enter your AlignPress Pro license key to connect.', 'alignpress' ) }
				>
					{ saasConnected ? (
						<div className="ap-license-activate__row">
							<input
								type="text"
								className="alignpress-input alignpress-input--license"
								value="••••••••••••••••"
								readOnly
								disabled
							/>
							<Button
								variant="danger"
								disabled={ disconnecting }
								onClick={ async () => {
									if ( ! window.confirm( __( 'Disconnect this site from AlignPress Cloud?', 'alignpress' ) ) ) return;
									setDisconnecting( true );
									setConnectError( null );
									try {
										await apiFetch( { path: '/alignpress/v1/settings/saas/disconnect', method: 'POST' } );
										setConnected( false );
									} catch ( e ) {
										setConnectError( e.message ?? __( 'Disconnect failed.', 'alignpress' ) );
									} finally {
										setDisconnecting( false );
									}
								} }
							>
								{ disconnecting ? __( 'Disconnecting…', 'alignpress' ) : __( 'Disconnect', 'alignpress' ) }
							</Button>
						</div>
					) : (
						<div>
							<div className="ap-license-activate__row">
								<input
									type="text"
									className="alignpress-input alignpress-input--license"
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
												path:   '/alignpress/v1/settings/saas/connect',
												method: 'POST',
												data:   { license_key: licenseKey.trim() },
											} );
											setConnected( true );
											setLicenseKey( '' );
										} catch ( e ) {
											setConnectError( e.message ?? __( 'Connection failed. Please check your key.', 'alignpress' ) );
										} finally {
											setConnecting( false );
										}
									} }
								>
									{ connecting ? __( 'Connecting…', 'alignpress' ) : __( 'Connect', 'alignpress' ) }
								</Button>
							</div>
							{ connectError && <p className="ap-error">{ connectError }</p> }
						</div>
					) }
				</Row>

				<Row
					label={ __( 'Last Sync', 'alignpress' ) }
					description={ __( 'When workflows were last synced from your agency account.', 'alignpress' ) }
				>
					<div className="ap-inline-field">
						<span className="ap-settings-row__muted">
							{ d.lastSync ? d.lastSync : __( 'Never', 'alignpress' ) }
						</span>
						<Button variant="secondary" size="sm" disabled={ syncing } onClick={ syncNow }>
							{ syncing ? __( 'Syncing…', 'alignpress' ) : __( '↻ Sync Now', 'alignpress' ) }
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
				{ __( 'Type', 'alignpress' ) }{ ' ' }
				<code className="ap-type-confirm__word">{ word }</code>{ ' ' }
				{ __( 'to confirm:', 'alignpress' ) }
			</p>
			<div className="ap-type-confirm__row">
				<input
					type="text"
					className={ `alignpress-input ap-type-confirm__input${ typed && ! matched ? ' ap-type-confirm__input--wrong' : '' }` }
					value={ typed }
					onChange={ ( e ) => setTyped( e.target.value ) }
					placeholder={ word }
					autoFocus
					spellCheck={ false }
				/>
				<button
					className="alignpress-btn alignpress-btn--danger"
					disabled={ ! matched || busy }
					onClick={ onConfirm }
				>
					{ busy ? busyLabel : confirmLabel }
				</button>
				<Button variant="ghost" onClick={ () => { setTyped( '' ); onCancel(); } }>
					{ __( 'Cancel', 'alignpress' ) }
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
			await apiFetch( { path: '/alignpress/v1/capture/all', method: 'DELETE' } );
			setClearDone( true );
			setConfirmClear( false );
		} catch ( e ) {
			setClearError( e.message ?? __( 'Failed to clear captures.', 'alignpress' ) );
		} finally {
			setClearing( false );
		}
	};

	const resetEverything = async () => {
		setResetting( true );
		setResetError( null );
		try {
			await apiFetch( { path: '/alignpress/v1/reset', method: 'DELETE' } );
			window.location.href = data().adminUrl + 'admin.php?page=alignpress&reset=1';
		} catch ( e ) {
			setResetError( e.message ?? __( 'Reset failed.', 'alignpress' ) );
			setResetting( false );
			setConfirmReset( false );
		}
	};

	return (
		<div className="ap-settings-general">
			<Section
				title={ __( 'Danger Zone', 'alignpress' ) }
				description={ __( 'These actions are irreversible. Proceed with caution.', 'alignpress' ) }
				danger
			>
				<div className="ap-danger-zone">

					{ /* ── Clear Captures ── */ }
					<div className="ap-danger-item">
						<div className="ap-danger-item__info">
							<strong>{ __( 'Delete All Captured Steps', 'alignpress' ) }</strong>
							<p>{ __( 'Remove all unassigned auto-captured steps. Assigned steps in workflows are unaffected.', 'alignpress' ) }</p>
							{ clearError && <p className="ap-danger-item__error">{ clearError }</p> }
							{ clearDone  && <p className="ap-danger-item__ok">{ __( '✓ Captured steps cleared.', 'alignpress' ) }</p> }
						</div>
						{ confirmClear ? (
							<TypeToConfirm
								onConfirm={ clearCaptures }
								onCancel={ () => setConfirmClear( false ) }
								busy={ clearing }
								busyLabel={ __( 'Clearing…', 'alignpress' ) }
								confirmLabel={ __( 'Yes, Clear', 'alignpress' ) }
							/>
						) : (
							<button
								className="alignpress-btn alignpress-btn--danger-outline"
								onClick={ () => { setClearDone( false ); setClearError( null ); setConfirmClear( true ); } }
							>
								{ __( 'Clear Captured Steps', 'alignpress' ) }
							</button>
						) }
					</div>

					{ /* ── Reset Everything ── */ }
					<div className="ap-danger-item">
						<div className="ap-danger-item__info">
							<strong>{ __( 'Reset All Plugin Data', 'alignpress' ) }</strong>
							<p>{ __( 'Permanently delete all workflows, steps, and settings. This cannot be undone.', 'alignpress' ) }</p>
							{ resetError && <p className="ap-danger-item__error">{ resetError }</p> }
						</div>
						{ confirmReset ? (
							<TypeToConfirm
								onConfirm={ resetEverything }
								onCancel={ () => setConfirmReset( false ) }
								busy={ resetting }
								busyLabel={ __( 'Resetting…', 'alignpress' ) }
								confirmLabel={ __( 'Yes, Reset Everything', 'alignpress' ) }
							/>
						) : (
							<Button variant="danger" onClick={ () => { setResetError( null ); setConfirmReset( true ); } }>
								{ __( 'Reset Everything', 'alignpress' ) }
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
		{ id: 'general',    label: __( 'General', 'alignpress' ) },
		{ id: 'cloud',      label: __( 'Cloud Connection', 'alignpress' ) },
		{ id: 'danger',     label: __( 'Danger Zone', 'alignpress' ) },
	];

	return (
		<div className="ap-settings wrap">
			<h1 className="ap-page-title">{ __( 'AlignPress Settings', 'alignpress' ) }</h1>

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
