import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import html2canvas from 'html2canvas';

const {
	isConnected   = false,
	saasPlan      = 'free',
	currentUserId = 0,
} = window.stepwiseData ?? {};

const canShare = isConnected && [ 'agency', 'agency_pro' ].includes( saasPlan );

const ALLOWED_TYPES = [ 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ];
const MAX_MB        = 10;
const SHARE_TOOLTIP = __( 'By default, notes are private to this site — only users here can see them. Turn this on to broadcast the note (and any screenshot) to all connected sites that share this workflow via Stepwise Cloud.', 'stepwise' );

// ── Image modal ───────────────────────────────────────────────────────────────
const ImageModal = ( { src, onClose } ) => {
	const handleKey = useCallback( ( e ) => { if ( e.key === 'Escape' ) onClose(); }, [ onClose ] );
	useEffect( () => {
		document.addEventListener( 'keydown', handleKey );
		return () => document.removeEventListener( 'keydown', handleKey );
	}, [ handleKey ] );

	return createPortal(
		<div className="ap-img-modal" role="dialog" aria-modal="true" onClick={ onClose }>
			<button type="button" className="ap-img-modal__close" onClick={ onClose } aria-label={ __( 'Close', 'stepwise' ) }>×</button>
			<img
				src={ src }
				alt={ __( 'Screenshot', 'stepwise' ) }
				className="ap-img-modal__img"
				onClick={ ( e ) => e.stopPropagation() }
			/>
		</div>,
		document.body
	);
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
const Tip = ( { text } ) => {
	const [ visible, setVisible ] = useState( false );
	return (
		<span className="ap-tip">
			<span
				className="ap-tip__icon"
				onMouseEnter={ () => setVisible( true ) }
				onMouseLeave={ () => setVisible( false ) }
				onFocus={ () => setVisible( true ) }
				onBlur={ () => setVisible( false ) }
				tabIndex={ 0 }
				role="button"
				aria-label={ __( 'More info', 'stepwise' ) }
			>?</span>
			{ visible && (
				<span className="ap-tip__bubble" role="tooltip">{ text }</span>
			) }
		</span>
	);
};

// ── Single note row ───────────────────────────────────────────────────────────
const NoteRow = ( { note, stepId, onDeleted, onScreenshotChange } ) => {
	const [ uploading, setUploading ]   = useState( false );
	const [ uploadErr, setUploadErr ]   = useState( null );
	const [ deleting, setDeleting ]     = useState( false );
	const [ screenshot, setScreenshot ] = useState( note.screenshot_url );
	const [ modalOpen, setModalOpen ]   = useState( false );
	const inputRef                      = useRef( null );
	const isMine                        = note.is_mine;

	const uploadFile = async ( file ) => {
		if ( ! ALLOWED_TYPES.includes( file.type ) ) { setUploadErr( __( 'JPEG, PNG, GIF, or WebP only.', 'stepwise' ) ); return; }
		if ( file.size > MAX_MB * 1024 * 1024 ) { setUploadErr( `Max ${ MAX_MB }MB.` ); return; }
		setUploadErr( null );
		setUploading( true );
		const formData = new FormData();
		formData.append( 'screenshot', file );
		try {
			const res = await window.fetch(
				`${ window.stepwiseData?.restUrl ?? '/wp-json/stepwise/v1/' }steps/${ stepId }/notes/${ note.id }/screenshot`,
				{ method: 'POST', headers: { 'X-WP-Nonce': window.stepwiseData?.nonce ?? '' }, body: formData }
			);
			if ( ! res.ok ) throw new Error( ( await res.json().catch( () => ( {} ) ) ).message ?? __( 'Upload failed.', 'stepwise' ) );
			const data = await res.json();
			setScreenshot( data.screenshot_url );
			onScreenshotChange?.( note.id, data.screenshot_url );
		} catch ( err ) {
			setUploadErr( err.message );
		} finally {
			setUploading( false );
			if ( inputRef.current ) inputRef.current.value = '';
		}
	};

	const handleDeleteScreenshot = async () => {
		setUploading( true );
		try {
			await apiFetch( { path: `/stepwise/v1/steps/${ stepId }/notes/${ note.id }/screenshot`, method: 'DELETE' } );
			setScreenshot( null );
			onScreenshotChange?.( note.id, null );
		} catch { /* silent */ } finally { setUploading( false ); }
	};

	const handleDeleteNote = async () => {
		if ( ! window.confirm( __( 'Delete this note?', 'stepwise' ) ) ) return;
		setDeleting( true );
		try {
			await apiFetch( { path: `/stepwise/v1/steps/${ stepId }/notes/${ note.id }`, method: 'DELETE' } );
			onDeleted( note.id );
		} catch { setDeleting( false ); }
	};

	return (
		<div className={ `ap-note${ note.is_sideloaded ? ' ap-note--shared' : '' }` }>
			<div className="ap-note__header">
				<span className="ap-note__avatar" aria-hidden="true">
					{ ( note.user_display_name || 'U' ).charAt( 0 ).toUpperCase() }
				</span>
				<span className="ap-note__meta">
					<span className="ap-note__author">{ note.user_display_name }</span>
					{ note.source_site_url && parseHostname( note.source_site_url ) && (
						<span className="ap-note__domain">{ parseHostname( note.source_site_url ) }</span>
					) }
				</span>
				{ note.is_sideloaded && note.source_site_label && (
					<span className="ap-note__site-badge">{ note.source_site_label }</span>
				) }
				{ note.shared && ! note.is_sideloaded && (
					<span className="ap-note__shared-badge">{ __( 'shared', 'stepwise' ) }</span>
				) }
				{ ! note.shared && ! note.is_sideloaded && (
					<span className="ap-note__private-badge">{ __( 'private', 'stepwise' ) }</span>
				) }
				<span className="ap-note__time">{ formatTime( note.created_at ) }</span>
				{ isMine && (
					<button type="button" className="ap-note__delete" onClick={ handleDeleteNote } disabled={ deleting } title={ __( 'Delete note', 'stepwise' ) }>
						{ deleting ? '…' : '×' }
					</button>
				) }
			</div>

			{ note.body && <p className="ap-note__body">{ note.body }</p> }

			{ /* Screenshot card */ }
			{ screenshot ? (
				<div className="ap-note__screenshot">
					<img
						src={ screenshot }
						alt={ __( 'Screenshot', 'stepwise' ) }
						className="ap-note__screenshot-img ap-note__screenshot-img--clickable"
						onClick={ () => setModalOpen( true ) }
						title={ __( 'Click to expand', 'stepwise' ) }
					/>
					<span className="ap-note__screenshot-badge">{ __( '1 of 1', 'stepwise' ) }</span>
					{ isMine && (
						<button type="button" className="ap-note__screenshot-remove" onClick={ handleDeleteScreenshot } disabled={ uploading }>
							{ uploading ? '…' : __( 'Remove', 'stepwise' ) }
						</button>
					) }
					{ modalOpen && <ImageModal src={ screenshot } onClose={ () => setModalOpen( false ) } /> }
				</div>
			) : isMine && (
				<div className="ap-note__screenshot-upload">
					{ uploadErr && <p className="ap-note__upload-err">{ uploadErr }</p> }
					<label className="ap-note__upload-label">
						<input ref={ inputRef } type="file" accept={ ALLOWED_TYPES.join( ',' ) } onChange={ ( e ) => { const f = e.target.files?.[0]; if ( f ) uploadFile( f ); } } disabled={ uploading } className="ap-note__upload-input" />
						<span className="ap-note__upload-btn">
							{ uploading ? __( 'Uploading…', 'stepwise' ) : __( '+ Add screenshot', 'stepwise' ) }
						</span>
					</label>
				</div>
			) }
		</div>
	);
};

// ── Compose area ──────────────────────────────────────────────────────────────
const Compose = ( { stepId, onPosted, isSaas } ) => {
	const [ body, setBody ]               = useState( '' );
	const [ shared, setShared ]           = useState( false );
	const [ screenshotFile, setFile ]     = useState( null );
	const [ screenshotPreview, setPreview ] = useState( null );
	const [ posting, setPosting ]         = useState( false );
	const [ capturing, setCapturing ]     = useState( false );
	const [ postErr, setPostErr ]         = useState( null );
	const fileRef                         = useRef( null );
	const toggleId                        = `ap-share-${ stepId }`;

	const applyFile = ( file ) => {
		if ( ! ALLOWED_TYPES.includes( file.type ) ) { setPostErr( __( 'JPEG, PNG, GIF, or WebP only.', 'stepwise' ) ); return; }
		if ( file.size > MAX_MB * 1024 * 1024 ) { setPostErr( `Max ${ MAX_MB }MB.` ); return; }
		setFile( file );
		setPreview( URL.createObjectURL( file ) );
		setPostErr( null );
	};

	const handleFileSelect = ( e ) => {
		const file = e.target.files?.[ 0 ];
		if ( file ) applyFile( file );
	};

	const handlePaste = ( e ) => {
		const item = Array.from( e.clipboardData?.items ?? [] ).find( ( i ) => i.type.startsWith( 'image/' ) );
		if ( ! item ) return;
		const file = item.getAsFile();
		if ( file ) { e.preventDefault(); applyFile( file ); }
	};

	const handleCapture = async () => {
		setCapturing( true );
		setPostErr( null );

		// Disable stylesheet rules that contain broken SVG data URIs — these crash
		// html2canvas's CSS parser ("Error parsing CSS component value, unexpected EOF").
		// We find the offending CSSRule objects, disable them temporarily, then restore.
		const disabledRules = [];
		try {
			for ( const sheet of document.styleSheets ) {
				try {
					const rules = sheet.cssRules || [];
					for ( let i = rules.length - 1; i >= 0; i-- ) {
						const text = rules[ i ]?.cssText || '';
						if ( text.includes( 'data:image/svg' ) ) {
							disabledRules.push( { sheet, index: i, text } );
							try { sheet.deleteRule( i ); } catch { /* ignore */ }
						}
					}
				} catch { /* cross-origin sheet — skip */ }
			}
		} catch { /* ignore */ }

		try {
			const canvas = await html2canvas( document.body, {
				useCORS:               true,
				allowTaint:            false,
				logging:               false,
				foreignObjectRendering:false,
				ignoreElements: ( el ) => [ 'IFRAME', 'SCRIPT', 'NOSCRIPT' ].includes( el.tagName ),
			} );
			canvas.toBlob( ( blob ) => {
				if ( blob ) {
					applyFile( new File( [ blob ], 'screenshot.png', { type: 'image/png' } ) );
				} else {
					console.error( '[AP screenshot] toBlob returned null' );
					setPostErr( __( 'Capture failed. Try pasting a screenshot instead.', 'stepwise' ) );
				}
				setCapturing( false );
			}, 'image/png' );
		} catch ( err ) {
			console.error( '[AP screenshot]', err );
			setPostErr( __( 'Capture failed. Try pasting a screenshot instead.', 'stepwise' ) );
			setCapturing( false );
		} finally {
			// Re-insert in reverse of deletion order (deletion was high→low, restore low→high).
			for ( let i = disabledRules.length - 1; i >= 0; i-- ) {
				const { sheet, index, text } = disabledRules[ i ];
				try { sheet.insertRule( text, index ); } catch { /* ignore */ }
			}
		}
	};

	const clearFile = () => {
		setFile( null );
		if ( screenshotPreview ) URL.revokeObjectURL( screenshotPreview );
		setPreview( null );
		if ( fileRef.current ) fileRef.current.value = '';
	};

	const canPost = body.trim() || screenshotFile;

	const handlePost = async () => {
		if ( ! canPost ) return;
		setPosting( true );
		setPostErr( null );
		try {
			const note = await apiFetch( {
				path:   `/stepwise/v1/steps/${ stepId }/notes`,
				method: 'POST',
				data:   { body: body.trim(), shared },
			} );

			if ( screenshotFile ) {
				const formData = new FormData();
				formData.append( 'screenshot', screenshotFile );
				const res = await window.fetch(
					`${ window.stepwiseData?.restUrl ?? '/wp-json/stepwise/v1/' }steps/${ stepId }/notes/${ note.id }/screenshot`,
					{ method: 'POST', headers: { 'X-WP-Nonce': window.stepwiseData?.nonce ?? '' }, body: formData }
				);
				if ( res.ok ) {
					const data = await res.json();
					note.screenshot_url = data.screenshot_url;
				}
			}

			onPosted( note );
			setBody( '' );
			setShared( false );
			clearFile();
		} catch ( err ) {
			setPostErr( err.message ?? __( 'Could not post note.', 'stepwise' ) );
		} finally {
			setPosting( false );
		}
	};

	return (
		<div className="ap-notes__compose-wrap">
			{ /* Compose card */ }
			<div className="ap-notes__compose">
				<textarea
					className="ap-notes__input"
					value={ body }
					onChange={ ( e ) => setBody( e.target.value ) }
					placeholder={ __( 'Add a note…', 'stepwise' ) }
					rows={ 3 }
					onKeyDown={ ( e ) => { if ( e.key === 'Enter' && ( e.ctrlKey || e.metaKey ) ) handlePost(); } }
					onPaste={ handlePaste }
				/>

				<div className="ap-notes__compose-bar">
					{ /* Screenshot icon or preview chip */ }
					{ screenshotPreview ? (
						<div className="ap-notes__preview">
							<img src={ screenshotPreview } alt="" className="ap-notes__preview-img" />
							<button type="button" className="ap-notes__preview-remove" onClick={ clearFile } title={ __( 'Remove screenshot', 'stepwise' ) }>×</button>
						</div>
					) : (
						<>
							{ /* File picker */ }
							<label className="ap-notes__ss-pick" title={ __( 'Attach image', 'stepwise' ) }>
								<input ref={ fileRef } type="file" accept={ ALLOWED_TYPES.join( ',' ) } onChange={ handleFileSelect } className="ap-note__upload-input" />
								<span className="ap-notes__ss-icon" aria-hidden="true">
									<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
										<rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
										<circle cx="5.5" cy="6.5" r="1" fill="currentColor"/>
										<path d="M1.5 10.5l3.5-3 2.5 2.5 2-1.5 3 3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
									</svg>
								</span>
							</label>
							{ /* Page capture button */ }
							<button
								type="button"
								className="ap-notes__ss-pick ap-notes__ss-capture"
								title={ __( 'Capture page screenshot', 'stepwise' ) }
								onClick={ handleCapture }
								disabled={ capturing }
							>
								<span className="ap-notes__ss-icon" aria-hidden="true">
									{ capturing ? '…' : (
										<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M1.5 5.5V3.5A1 1 0 0 1 2.5 2.5h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
											<path d="M14.5 5.5V3.5A1 1 0 0 0 13.5 2.5h-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
											<path d="M1.5 10.5v2a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
											<path d="M14.5 10.5v2a1 1 0 0 1-1 1h-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
											<circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
										</svg>
									) }
								</span>
							</button>
						</>
					) }

					<span className="ap-notes__compose-spacer" />

					<button type="button" className="ap-notes__post-btn" onClick={ handlePost } disabled={ posting || ! canPost }>
						{ posting ? __( 'Posting…', 'stepwise' ) : __( 'Post', 'stepwise' ) }
					</button>
				</div>
			</div>

			{ postErr && <p className="ap-notes__post-err">{ postErr }</p> }

			{ /* Share row — iOS toggle, outside/below the card */ }
			{ canShare && ! isSaas && (
				<div className="ap-notes__share-row">
					<label className="ap-notes__share-label" htmlFor={ toggleId }>
						{ __( 'Share to all sites', 'stepwise' ) }
						<Tip text={ SHARE_TOOLTIP } />
					</label>
					<input
						type="checkbox"
						id={ toggleId }
						className="ap-notes__toggle-input"
						checked={ shared }
						onChange={ ( e ) => setShared( e.target.checked ) }
					/>
					<label htmlFor={ toggleId } className="ap-notes__toggle-track" aria-hidden="true" />
				</div>
			) }
		</div>
	);
};

// ── Main thread component ─────────────────────────────────────────────────────
const RunnerNotes = ( { stepId, isSaas } ) => {
	const [ notes, setNotes ]     = useState( [] );
	const [ loading, setLoading ] = useState( true );

	useEffect( () => {
		let cancelled = false;
		setLoading( true );
		apiFetch( { path: `/stepwise/v1/steps/${ stepId }/notes` } )
			.then( ( data ) => { if ( ! cancelled ) setNotes( data ); } )
			.catch( () => {} )
			.finally( () => { if ( ! cancelled ) setLoading( false ); } );
		return () => { cancelled = true; };
	}, [ stepId ] );

	const handleDeleted          = ( id )      => setNotes( ( prev ) => prev.filter( ( n ) => n.id !== id ) );
	const handleScreenshotChange = ( id, url ) => setNotes( ( prev ) => prev.map( ( n ) => n.id === id ? { ...n, screenshot_url: url } : n ) );
	const handlePosted           = ( note )    => setNotes( ( prev ) => [ ...prev, note ] );

	return (
		<div className="ap-notes">
			<span className="ap-notes__label">{ __( 'Notes', 'stepwise' ) }</span>

			{ loading ? (
				<p className="ap-notes__loading">{ __( 'Loading…', 'stepwise' ) }</p>
			) : notes.length > 0 ? (
				<div className="ap-notes__thread">
					{ notes.map( ( note ) => (
						<NoteRow
							key={ note.id }
							note={ note }
							stepId={ stepId }
							onDeleted={ handleDeleted }
							onScreenshotChange={ handleScreenshotChange }
						/>
					) ) }
				</div>
			) : (
				<p className="ap-notes__empty">{ __( 'No notes yet.', 'stepwise' ) }</p>
			) }

			<Compose stepId={ stepId } onPosted={ handlePosted } isSaas={ isSaas } />
		</div>
	);
};

RunnerNotes.propTypes = {
	stepId: PropTypes.number.isRequired,
	isSaas: PropTypes.bool,
};

function parseHostname( url ) {
	try { return new URL( url ).hostname; } catch { return null; }
}

function formatTime( dateStr ) {
	if ( ! dateStr ) return '';
	const d    = new Date( dateStr );
	const diff = ( Date.now() - d.getTime() ) / 1000;
	if ( diff < 60 )    return __( 'just now', 'stepwise' );
	if ( diff < 3600 )  return `${ Math.floor( diff / 60 ) }m ago`;
	if ( diff < 86400 ) return `${ Math.floor( diff / 3600 ) }h ago`;
	return d.toLocaleDateString();
}

export default RunnerNotes;
