import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { __ } from '@wordpress/i18n';

const { runnerPosition = 'right', routinekitCapture: captureCfg = null, adminUrl = '' } = window.routinekitData ?? {};
const apAdminPage = adminUrl ? adminUrl + 'admin.php?page=routinekit' : '/wp-admin/admin.php?page=routinekit';

// Open the capture panel from the vanilla JS capture-watcher (dispatches a custom event).
const openCapturePanel = () => {
	window.dispatchEvent( new CustomEvent( 'ap:capture:open' ) );
};

const RunnerLauncher = ( { hasActive, isOpen, onClick, progress, workflowTitle, currentStep, totalSteps } ) => {
	const [ dockOpen, setDockOpen ] = useState( false );
	const [ dragX, setDragX ]       = useState( null ); // null = CSS default; resets on every page load
	const dockRef   = useRef( null );
	const dragState = useRef( null ); // { startMouseX, startLeft, didMove }

	// Compute ring pct for conic-gradient.
	let ringPct = 0;
	if ( hasActive && progress ) {
		const [ cur, tot ] = progress.split( '/' ).map( Number );
		if ( tot > 0 ) ringPct = Math.round( ( cur / tot ) * 100 );
	}

	// Close dock on outside click.
	useEffect( () => {
		if ( ! dockOpen ) return;
		const handler = ( e ) => {
			if ( dockRef.current && ! dockRef.current.contains( e.target ) ) {
				setDockOpen( false );
			}
		};
		document.addEventListener( 'mousedown', handler );
		return () => document.removeEventListener( 'mousedown', handler );
	}, [ dockOpen ] );

	// Horizontal drag on the pill.
	const handlePillMouseDown = ( e ) => {
		if ( e.button !== 0 ) return;
		const rect = dockRef.current.getBoundingClientRect();
		dragState.current = {
			startMouseX: e.clientX,
			startLeft:   rect.left,
			didMove:     false,
		};

		const onMove = ( ev ) => {
			const dx = ev.clientX - dragState.current.startMouseX;
			if ( Math.abs( dx ) > 4 ) dragState.current.didMove = true;
			if ( ! dragState.current.didMove ) return;
			// Clamp to viewport width minus dock width.
			const dockW = dockRef.current.offsetWidth;
			const newX  = Math.max( 0, Math.min( window.innerWidth - dockW, dragState.current.startLeft + dx ) );
			setDragX( newX );
		};

		const onUp = () => {
			document.removeEventListener( 'mousemove', onMove );
			document.removeEventListener( 'mouseup', onUp );
		};

		document.addEventListener( 'mousemove', onMove );
		document.addEventListener( 'mouseup', onUp );
	};

	const handlePillClick = () => {
		// Ignore click if it was actually a drag.
		if ( dragState.current?.didMove ) { dragState.current = null; return; }
		dragState.current = null;
		setDockOpen( ( o ) => ! o );
	};

	const handleCaptureStep = () => {
		setDockOpen( false );
		openCapturePanel();
	};

	const handleOpenWorkflow = () => {
		setDockOpen( false );
		if ( hasActive ) {
			onClick();
		} else {
			window.location.href = apAdminPage;
		}
	};

	// Dock position: dragX overrides the CSS default (right: 24px).
	const dockStyle = dragX !== null
		? { left: dragX, right: 'unset' }
		: {};

	return (
		<div ref={ dockRef } className={ `ap-run-dock ${ dragX !== null ? 'ap-run-dock--absolute' : ( runnerPosition === 'left' ? 'ap-run-dock--left' : 'ap-run-dock--right' ) }` } style={ dockStyle }>
			{ /* Rollover card — shown above pill when dockOpen */ }
			{ dockOpen && (
				<div className="ap-run-dock__card" role="menu">
					<button
						type="button"
						className="ap-run-dock__row"
						role="menuitem"
						onClick={ handleCaptureStep }
					>
						<span className="ap-run-dock__row-icon ap-run-dock__row-icon--indigo">
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
								<rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/>
								<path d="M7 4v6M4 7h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
							</svg>
						</span>
						<span className="ap-run-dock__row-label">{ __( 'Capture Step', 'routinekit' ) }</span>
					</button>

					<div className="ap-run-dock__divider" />

					<button
						type="button"
						className="ap-run-dock__row"
						role="menuitem"
						onClick={ handleOpenWorkflow }
					>
						<span className="ap-run-dock__row-icon">
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
								<path d="M4 3l6 4-6 4V3z" fill="currentColor"/>
							</svg>
						</span>
						<span className="ap-run-dock__row-label">
							{ __( 'Open Workflow', 'routinekit' ) }
							{ hasActive && (
								<span className="ap-run-dock__row-sub">
									{ __( 'Running', 'routinekit' ) } · { __( 'Step', 'routinekit' ) } { currentStep } { __( 'of', 'routinekit' ) } { totalSteps }
								</span>
							) }
						</span>
					</button>
				</div>
			) }

			{ /* Dock pill */ }
			<button
				type="button"
				className={ `ap-run-dock__pill ${ hasActive ? 'ap-run-dock__pill--active' : '' } ${ dockOpen ? 'ap-run-dock__pill--open' : '' }` }
				style={ hasActive ? { '--ap-ring-pct': `${ ringPct }%` } : {} }
				onMouseDown={ handlePillMouseDown }
				onClick={ handlePillClick }
				aria-label={ dockOpen
					? __( 'Close dock', 'routinekit' )
					: __( 'RoutineKit Run Dock', 'routinekit' ) }
				aria-expanded={ dockOpen }
				aria-haspopup="true"
			>
				{ /* Left: ring + icon */ }
				<span className="ap-run-dock__ring-wrap" aria-hidden="true">
					{ hasActive && (
						<svg className="ap-run-dock__ring-svg" viewBox="0 0 40 40" fill="none">
							<circle cx="20" cy="20" r="17" stroke="rgba(255,255,255,0.12)" strokeWidth="3"/>
							<circle
								cx="20" cy="20" r="17"
								stroke="#4f46e5"
								strokeWidth="3"
								strokeLinecap="round"
								strokeDasharray={ `${ ringPct * 1.068 } 106.8` }
								transform="rotate(-90 20 20)"
							/>
						</svg>
					) }
					<span className="ap-run-dock__ring-icon">
						{ dockOpen ? (
							<svg width="12" height="12" viewBox="0 0 14 14" fill="none">
								<path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
							</svg>
						) : hasActive ? (
							<svg width="12" height="12" viewBox="0 0 14 14" fill="none">
								<path d="M4 3l6 4-6 4V3z" fill="currentColor"/>
							</svg>
						) : (
							<svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
								<rect x="5" y="10" width="19" height="6.5" rx="2" fill="rgba(255,255,255,0.45)"/>
								<rect x="5" y="20.75" width="19" height="6.5" rx="2" fill="rgba(255,255,255,0.45)"/>
								<rect x="5" y="31.5" width="19" height="6.5" rx="2" fill="rgba(255,255,255,0.45)"/>
								<path d="M26 27 32 33 43 13" stroke="rgba(255,255,255,0.9)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round"/>
							</svg>
						) }
					</span>
				</span>

				{ /* Right: brand + subtitle */ }
				<span className="ap-run-dock__pill-text">
					<span className="ap-run-dock__pill-brand">RoutineKit</span>
					<span className="ap-run-dock__pill-sub">
						{ hasActive
							? `${ __( 'Step', 'routinekit' ) } ${ currentStep }/${ totalSteps }`
							: __( 'Run Dock', 'routinekit' ) }
					</span>
				</span>
			</button>
		</div>
	);
};

RunnerLauncher.propTypes = {
	hasActive:     PropTypes.bool.isRequired,
	isOpen:        PropTypes.bool,
	onClick:       PropTypes.func.isRequired,
	progress:      PropTypes.string,
	workflowTitle: PropTypes.string,
	currentStep:   PropTypes.number,
	totalSteps:    PropTypes.number,
};

RunnerLauncher.defaultProps = {
	isOpen:        false,
	progress:      null,
	workflowTitle: '',
	currentStep:   0,
	totalSteps:    0,
};

export default RunnerLauncher;
