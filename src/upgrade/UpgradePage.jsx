import { useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import Button from '../shared/Button';

const { saasUrl = 'http://stepwise-saas.test', adminUrl = '', isPro = false } = window.stepwiseData ?? {};

const REGISTER_URL = saasUrl + '/register';
const SETTINGS_URL = adminUrl + 'admin.php?page=stepwise-settings#cloud';

// ── Feature comparison data ──────────────────────────────────────────────────

const FEATURES = [
	{ label: __( 'Workflows per site', 'stepwise' ),            free: 'Unlimited',     agency: 'Unlimited',   pro: 'Unlimited' },
	{ label: __( 'Connected sites', 'stepwise' ),               free: 'Up to 3',       agency: 'Up to 50',    pro: 'Unlimited' },
	{ label: __( 'Stepwise Cloud dashboard', 'stepwise' ),    free: true,            agency: true,          pro: true },
	{ label: __( 'JSON export', 'stepwise' ),                   free: true,            agency: true,          pro: true },
	{ label: __( 'Free workflow templates', 'stepwise' ),       free: true,            agency: true,          pro: true },
	{ label: __( 'Auto-capture retention', 'stepwise' ),        free: '7 days',        agency: '90 days',     pro: '90 days' },
	{ label: __( 'Multiple site groups', 'stepwise' ),          free: false,           agency: true,          pro: true },
	{ label: __( 'Cloud workflow template library', 'stepwise' ), free: false,         agency: true,          pro: true },
	{ label: __( 'Import from URL', 'stepwise' ),               free: false,           agency: true,          pro: true },
	{ label: __( 'Fleet push & assignment', 'stepwise' ),       free: false,           agency: true,          pro: true },
	{ label: __( 'Team members', 'stepwise' ),                  free: false,           agency: true,          pro: true },
	{ label: __( 'Priority email support', 'stepwise' ),        free: false,           agency: false,         pro: true },
	{ label: __( 'Early access to new features', 'stepwise' ),  free: false,           agency: false,         pro: true },
];

const Check  = () => <span style={ { color: '#6366f1', fontWeight: 700 } }>✓</span>;
const Cross  = () => <span style={ { color: '#d1d5db' } }>—</span>;

const Cell = ( { value } ) => {
	if ( value === true )  return <Check />;
	if ( value === false ) return <Cross />;
	return <span style={ { fontSize: '13px', color: '#374151' } }>{ value }</span>;
};

// ── Plan cards ───────────────────────────────────────────────────────────────

const PLANS = [
	{
		key:       'agency',
		name:      __( 'Agency', 'stepwise' ),
		price:     '$149',
		period:    __( '/yr', 'stepwise' ),
		monthly:   __( '~$12/mo billed annually', 'stepwise' ),
		sites:     __( 'Up to 50 sites', 'stepwise' ),
		perSite:   __( 'That\'s just $0.25/site/mo', 'stepwise' ),
		highlight: false,
		cta:       __( 'Get Agency →', 'stepwise' ),
	},
	{
		key:       'agency_pro',
		name:      __( 'Agency Pro', 'stepwise' ),
		price:     '$249',
		period:    __( '/yr', 'stepwise' ),
		monthly:   __( '~$21/mo billed annually', 'stepwise' ),
		sites:     __( 'Unlimited sites', 'stepwise' ),
		perSite:   __( '$0.42/site/mo at 50 sites — less as you grow', 'stepwise' ),
		highlight: true,
		badge:     __( 'BEST VALUE', 'stepwise' ),
		cta:       __( 'Get Agency Pro →', 'stepwise' ),
	},
];

// ── Main component ───────────────────────────────────────────────────────────

const UpgradePage = () => {
	const [ licenseKey, setLicenseKey ] = useState( '' );
	const [ activating, setActivating ] = useState( false );
	const [ error, setError ]           = useState( null );
	const [ success, setSuccess ]       = useState( false );

	if ( isPro ) {
		return (
			<div className="wrap">
				<div style={ { ...s.page, textAlign: 'center' } }>
					<div style={ s.successCard }>
						<div style={ { fontSize: '40px', marginBottom: '12px' } }>✅</div>
						<h2 style={ s.successTitle }>{ __( 'You\'re on Stepwise Pro', 'stepwise' ) }</h2>
						<p style={ s.muted }>{ __( 'All Pro features are unlocked on this site.', 'stepwise' ) }</p>
						<a href={ SETTINGS_URL } style={ s.link }>{ __( '← Back to Settings', 'stepwise' ) }</a>
					</div>
				</div>
			</div>
		);
	}

	const activate = async () => {
		if ( ! licenseKey.trim() ) return;
		setActivating( true );
		setError( null );
		try {
			await apiFetch( {
				path:   '/stepwise/v1/settings/saas/connect',
				method: 'POST',
				data:   { license_key: licenseKey.trim() },
			} );
			setSuccess( true );
			setTimeout( () => {
				window.location.href = ( window.stepwiseData?.adminUrl ?? '' ) + 'admin.php?page=stepwise';
			}, 1500 );
		} catch ( e ) {
			setError( e.message ?? __( 'Activation failed. Check your license key and try again.', 'stepwise' ) );
		} finally {
			setActivating( false );
		}
	};

	return (
		<div className="wrap">
			<div style={ s.page }>

				{ /* Header */ }
				<div style={ s.header }>
					<h1 style={ s.heading }>{ __( 'Upgrade to Agency or Agency Pro', 'stepwise' ) }</h1>
					<p style={ s.subheading }>
						{ __( 'Manage your full fleet. Billed annually. No per-site fees. Cancel anytime.', 'stepwise' ) }
					</p>
				</div>

				{ /* Plan cards */ }
				<div style={ s.planGrid }>
					{ /* Free card */ }
					<div style={ s.planCard }>
						<div style={ s.planName }>{ __( 'Free', 'stepwise' ) }</div>
						<div style={ s.planPrice }>
							<span style={ s.priceAmount }>$0</span>
						</div>
						<div style={ s.planSites }>{ __( 'Up to 3 sites', 'stepwise' ) }</div>
						<div style={ s.planPerSite }>{ __( 'Unlimited workflows', 'stepwise' ) }</div>
						<div style={ { ...s.planCta, background: '#f3f4f6', color: '#6b7280', cursor: 'default' } }>
							{ __( 'Current plan', 'stepwise' ) }
						</div>
					</div>

					{ PLANS.map( ( plan ) => (
						<div key={ plan.key } style={ plan.highlight ? { ...s.planCard, ...s.planCardHighlight } : s.planCard }>
							{ plan.badge && (
								<div style={ s.planBadge }>{ plan.badge }</div>
							) }
							<div style={ { ...s.planName, color: plan.highlight ? '#4f46e5' : '#111827' } }>
								{ plan.name }
							</div>
							<div style={ s.planPrice }>
								<span style={ s.priceAmount }>{ plan.price }</span>
								<span style={ s.pricePer }>{ plan.period }</span>
							</div>
							<div style={ s.planMonthly }>{ plan.monthly }</div>
							<div style={ s.planSites }>{ plan.sites }</div>
							<div style={ s.planPerSite }>{ plan.perSite }</div>
							<a
								href={ REGISTER_URL + '?plan=' + plan.key }
								target="_blank"
								rel="noreferrer"
								style={ { textDecoration: 'none' } }
							>
								<div style={ plan.highlight ? s.planCta : { ...s.planCta, background: '#f9fafb', color: '#4f46e5', border: '1.5px solid #6366f1' } }>
									{ plan.cta }
								</div>
							</a>
						</div>
					) ) }
				</div>

				{ /* Comparison table */ }
				<div style={ s.tableWrap }>
					<h3 style={ s.tableTitle }>{ __( 'Compare plans', 'stepwise' ) }</h3>
					<table style={ s.table }>
						<thead>
							<tr>
								<th style={ { ...s.th, textAlign: 'left', width: '40%' } }>{ __( 'Feature', 'stepwise' ) }</th>
								<th style={ s.th }>{ __( 'Free', 'stepwise' ) }</th>
								<th style={ s.th }>{ __( 'Agency', 'stepwise' ) }<br /><span style={ s.thSub }>$149/yr · 50 sites</span></th>
								<th style={ { ...s.th, color: '#4f46e5' } }>{ __( 'Agency Pro', 'stepwise' ) }<br /><span style={ s.thSub }>$249/yr</span></th>
							</tr>
						</thead>
						<tbody>
							{ FEATURES.map( ( row, i ) => (
								<tr key={ row.label } style={ i % 2 === 0 ? { background: '#f9fafb' } : {} }>
									<td style={ s.tdLabel }>{ row.label }</td>
									<td style={ s.td }><Cell value={ row.free } /></td>
									<td style={ s.td }><Cell value={ row.agency } /></td>
									<td style={ { ...s.td, fontWeight: row.pro && row.agency === false ? 600 : 'normal' } }>
										<Cell value={ row.pro } />
									</td>
								</tr>
							) ) }
						</tbody>
					</table>
				</div>

				{ /* How it works */ }
				<div style={ s.steps }>
					<h3 style={ s.stepsTitle }>{ __( 'How to get started', 'stepwise' ) }</h3>
					<div style={ s.stepsGrid }>
						{ [
							{ n: '1', title: __( 'Choose a plan above', 'stepwise' ),    body: __( 'Click "Get Agency" or "Get Agency Pro" — you\'ll be taken to the Stepwise dashboard to create your account.', 'stepwise' ) },
							{ n: '2', title: __( 'Copy your license key', 'stepwise' ),  body: __( 'After subscribing, find your license key in the Stepwise dashboard. It looks like SW-XXXX-XXXX-XXXX-XXXX.', 'stepwise' ) },
							{ n: '3', title: __( 'Activate below', 'stepwise' ),         body: __( 'Paste the key into the field below and click Activate. Pro features unlock instantly — no restart needed.', 'stepwise' ) },
						].map( ( step ) => (
							<div key={ step.n } style={ s.step }>
								<div style={ s.stepNum }>{ step.n }</div>
								<h4 style={ s.stepTitle }>{ step.title }</h4>
								<p style={ s.stepBody }>{ step.body }</p>
							</div>
						) ) }
					</div>
				</div>

				{ /* Activation */ }
				<div style={ s.activateCard }>
					<h3 style={ s.activateTitle }>{ __( 'Already have a license key?', 'stepwise' ) }</h3>
					{ success ? (
						<p style={ { color: '#16a34a', fontWeight: 500 } }>
							{ __( '✓ License activated! Reloading…', 'stepwise' ) }
						</p>
					) : (
						<>
							<div style={ s.activateRow }>
								<input
									type="text"
									style={ s.licenseInput }
									placeholder="SW-XXXX-XXXX-XXXX-XXXX"
									value={ licenseKey }
									onChange={ ( e ) => setLicenseKey( e.target.value ) }
									onKeyDown={ ( e ) => e.key === 'Enter' && activate() }
									autoFocus
								/>
								<Button variant="primary" disabled={ activating || ! licenseKey.trim() } onClick={ activate }>
									{ activating ? __( 'Activating…', 'stepwise' ) : __( 'Activate', 'stepwise' ) }
								</Button>
							</div>
							{ error && <p style={ s.error }>{ error }</p> }
							<p style={ s.activateHint }>
								🔒 { __( 'Your key is stored locally and never shared. Activates instantly — no restart required.', 'stepwise' ) }
							</p>
						</>
					) }
				</div>

			</div>
		</div>
	);
};

// ── Styles ───────────────────────────────────────────────────────────────────

const s = {
	page:              { maxWidth: '780px', margin: '40px auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
	header:            { textAlign: 'center', marginBottom: '36px' },
	heading:           { fontSize: '28px', fontWeight: 700, color: '#111827', margin: 0 },
	subheading:        { fontSize: '14px', color: '#6b7280', marginTop: '8px' },
	muted:             { color: '#9ca3af', margin: 0 },
	link:              { color: '#6366f1', textDecoration: 'none' },

	// Plan cards
	planGrid:          { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' },
	planCard:          { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '24px', textAlign: 'center', position: 'relative' },
	planCardHighlight: { border: '2px solid #6366f1', boxShadow: '0 4px 24px rgba(99,102,241,0.12)' },
	planBadge:         { position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', padding: '3px 12px', borderRadius: '20px', whiteSpace: 'nowrap' },
	planName:          { fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '12px' },
	planPrice:         { marginBottom: '4px' },
	priceAmount:       { fontSize: '36px', fontWeight: 800, color: '#111827' },
	pricePer:          { fontSize: '14px', color: '#6b7280', marginLeft: '2px' },
	planMonthly:       { fontSize: '12px', color: '#9ca3af', marginBottom: '4px' },
	planSites:         { fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: 500 },
	planPerSite:       { fontSize: '11px', color: '#6366f1', marginBottom: '16px', fontWeight: 500 },
	planCta:           { background: '#6366f1', color: '#fff', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'center' },

	// Comparison table
	tableWrap:         { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', marginBottom: '36px' },
	tableTitle:        { fontSize: '15px', fontWeight: 600, color: '#111827', margin: '20px 20px 0' },
	table:             { width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '12px' },
	th:                { padding: '10px 16px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textAlign: 'center', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' },
	thSub:             { fontWeight: 400, color: '#9ca3af' },
	tdLabel:           { padding: '10px 16px', color: '#374151', borderBottom: '1px solid #f3f4f6' },
	td:                { padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid #f3f4f6' },

	// Steps
	steps:             { marginBottom: '32px' },
	stepsTitle:        { fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px' },
	stepsGrid:         { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
	step:              { background: '#f9fafb', borderRadius: '8px', padding: '20px' },
	stepNum:           { width: '26px', height: '26px', borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' },
	stepTitle:         { fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 6px' },
	stepBody:          { fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.5 },

	// Activation
	activateCard:      { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px' },
	activateTitle:     { fontSize: '15px', fontWeight: 600, color: '#111827', marginTop: 0, marginBottom: '16px' },
	activateRow:       { display: 'flex', gap: '10px', alignItems: 'center' },
	licenseInput:      { flex: 1, border: '1px solid #d1d5db', borderRadius: '6px', padding: '9px 12px', fontSize: '14px', fontFamily: 'monospace', outline: 'none' },
	error:             { color: '#dc2626', fontSize: '13px', marginTop: '8px', marginBottom: 0 },
	activateHint:      { fontSize: '12px', color: '#6b7280', marginTop: '10px', marginBottom: 0 },

	// Success state
	successCard:       { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '48px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' },
	successTitle:      { fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 8px' },
};

export default UpgradePage;
