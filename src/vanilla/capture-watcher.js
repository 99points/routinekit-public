/*!
 * Stepwise — Auto-Capture watcher (vanilla JS, no jQuery/React)
 * Plugin:  Stepwise — Reusable Configuration Checklists
 * Version: 1.0.0
 * Author:  Zeeshan Rasool <https://profiles.wordpress.org/codeleftover/>
 * License: GPLv2 or later <https://www.gnu.org/licenses/gpl-2.0.html>
 * Source:  https://github.com/99points/stepwise-public
 */
( function () {
	'use strict';

	var cfg = window.stepwiseCapture || {};
	if ( ! cfg.restUrl || ! cfg.nonce ) return;

	/* ─── Snapshot ─────────────────────────────────────────────────── */

	var snapshot = {};

	function takeSnapshot() {
		var fields = document.querySelectorAll( 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=file]), select, textarea' );
		fields.forEach( function ( el ) {
			if ( ! el.name && ! el.id ) return;
			var key = el.name || el.id;
			if ( /nonce|_wpnonce|_wp_http_referer/i.test( key ) ) return;
			if ( el.type === 'radio' ) {
				var checked = document.querySelector( 'input[type=radio][name="' + CSS.escape( el.name ) + '"]:checked' );
				snapshot[ key ] = checked ? checked.value : '';
			} else if ( el.type === 'checkbox' ) {
				snapshot[ key ] = el.checked ? '1' : '0';
			} else {
				snapshot[ key ] = el.value;
			}
		} );
	}

	function getFieldValue( el ) {
		if ( el.type === 'radio' ) {
			var checked = document.querySelector( 'input[type=radio][name="' + CSS.escape( el.name ) + '"]:checked' );
			return checked ? checked.value : '';
		}
		if ( el.type === 'checkbox' ) return el.checked ? '1' : '0';
		return el.value;
	}

	function getFieldLabel( el ) {
		var id = el.id;
		if ( id ) {
			var lbl = document.querySelector( 'label[for="' + CSS.escape( id ) + '"]' );
			if ( lbl ) return lbl.textContent.trim();
		}
		if ( el.getAttribute( 'aria-label' ) ) return el.getAttribute( 'aria-label' ).trim();
		if ( el.placeholder ) return el.placeholder.trim();
		var name = el.name || el.id || '';
		return name.replace( /[_\-]/g, ' ' ).replace( /\b\w/g, function ( c ) { return c.toUpperCase(); } );
	}

	function findFirstChange() {
		var fields = document.querySelectorAll( 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=file]), select, textarea' );
		var seen = {};
		for ( var i = 0; i < fields.length; i++ ) {
			var el  = fields[ i ];
			var key = el.name || el.id;
			if ( ! key ) continue;
			if ( /nonce|_wpnonce|_wp_http_referer/i.test( key ) ) continue;
			if ( seen[ key ] ) continue;
			seen[ key ] = true;
			var cur  = getFieldValue( el );
			var prev = snapshot[ key ];
			if ( prev === undefined ) continue;
			if ( prev === '' && cur !== '' ) continue; // skip empty→non-empty (async-populated)
			if ( cur !== prev ) {
				return { el: el, key: key, label: getFieldLabel( el ), oldValue: prev, newValue: cur };
			}
		}
		return null;
	}

	/* ─── Active WF helper ──────────────────────────────────────────── */

	function getActiveWorkflowId() {
		try {
			var exec = window.wp && window.wp.data && window.wp.data.select( 'stepwise/execution' ) && window.wp.data.select( 'stepwise/execution' ).getActiveExecution();
			if ( exec && exec.status === 'in_progress' && exec.workflow_id ) return String( exec.workflow_id );
		} catch ( e ) {}
		return '';
	}

	/* ─── Drag helper ───────────────────────────────────────────────── */

	function makeDraggable( handle, container ) {
		var startX, startY, origLeft, origTop;
		handle.addEventListener( 'mousedown', function ( e ) {
			if ( e.button !== 0 ) return;
			e.preventDefault();
			var rect = container.getBoundingClientRect();
			startX   = e.clientX;
			startY   = e.clientY;
			origLeft = rect.left;
			origTop  = rect.top;
			container.style.right  = 'auto';
			container.style.bottom = 'auto';
			container.style.left   = origLeft + 'px';
			container.style.top    = origTop  + 'px';

			function onMove( e ) {
				container.style.left = ( origLeft + e.clientX - startX ) + 'px';
				container.style.top  = ( origTop  + e.clientY - startY ) + 'px';
			}
			function onUp() {
				document.removeEventListener( 'mousemove', onMove );
				document.removeEventListener( 'mouseup',   onUp );
			}
			document.addEventListener( 'mousemove', onMove );
			document.addEventListener( 'mouseup',   onUp );
		} );
	}

	/* ─── Styles ────────────────────────────────────────────────────── */

	var STYLES = [
		'@keyframes ap-spin{to{transform:rotate(360deg)}}',
		'#ap-capture-panel{position:fixed;bottom:140px;right:20px;z-index:100000;',
		'width:360px;background:#fff;border-radius:10px;',
		'box-shadow:0 8px 32px rgba(0,0,0,.22);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
		'display:none;flex-direction:column;overflow:hidden;}',
		'[data-ap-dark] #ap-capture-panel,',
		'.ap-dark #ap-capture-panel{background:#1e1e1e;color:#e8e8e8;}',

		'#ap-capture-panel-header{padding:12px 16px;background:#f0f0f0;',
		'display:flex;align-items:center;justify-content:space-between;',
		'cursor:grab;user-select:none;border-bottom:1px solid #ddd;}',
		'[data-ap-dark] #ap-capture-panel-header,',
		'.ap-dark #ap-capture-panel-header{background:#2a2a2a;border-color:#444;}',
		'#ap-capture-panel-header h3{margin:0;font-size:13px;font-weight:700;letter-spacing:.3px;}',
		'#ap-capture-panel-close{background:none;border:none;font-size:18px;line-height:1;cursor:pointer;',
		'color:inherit;padding:0 2px;}',

		'#ap-capture-panel-body{padding:14px 16px;display:flex;flex-direction:column;gap:10px;',
		'max-height:70vh;overflow-y:auto;}',

		'.ap-cp-label{display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#444;}',
		'[data-ap-dark] .ap-cp-label,.ap-dark .ap-cp-label{color:#bbb;}',
		'.ap-cp-required{color:#d63638;margin-left:2px;}',

		'.ap-cp-input,.ap-cp-select,.ap-cp-textarea{width:100%;box-sizing:border-box;',
		'border:1px solid #ccc;border-radius:6px;padding:7px 10px;font-size:13px;',
		'font-family:inherit;background:#fff;color:#1e1e1e;}',
		'[data-ap-dark] .ap-cp-input,[data-ap-dark] .ap-cp-select,[data-ap-dark] .ap-cp-textarea,',
		'.ap-dark .ap-cp-input,.ap-dark .ap-cp-select,.ap-dark .ap-cp-textarea',
		'{background:#2c2c2c;color:#e8e8e8;border-color:#555;}',
		'.ap-cp-input:focus,.ap-cp-select:focus,.ap-cp-textarea:focus',
		'{outline:2px solid #2271b1;outline-offset:-1px;}',
		'.ap-cp-textarea{resize:vertical;min-height:80px;}',

		'.ap-cp-compose{display:flex;flex-direction:column;gap:0;}',
		'.ap-cp-compose-toolbar{display:flex;align-items:center;gap:4px;',
		'padding:4px 8px;background:#f6f7f7;border:1px solid #ccc;',
		'border-bottom:none;border-radius:6px 6px 0 0;}',
		'[data-ap-dark] .ap-cp-compose-toolbar,.ap-dark .ap-cp-compose-toolbar',
		'{background:#2a2a2a;border-color:#555;}',
		'.ap-cp-compose-toolbar button{background:none;border:none;cursor:pointer;',
		'padding:3px 5px;border-radius:4px;font-size:15px;line-height:1;color:#555;}',
		'[data-ap-dark] .ap-cp-compose-toolbar button,.ap-dark .ap-cp-compose-toolbar button{color:#bbb;}',
		'.ap-cp-compose-toolbar button:hover{background:rgba(0,0,0,.08);}',
		'.ap-cp-compose textarea{border-radius:0 0 6px 6px;border-top:none;}',

		'.ap-cp-attachments{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;}',
		'.ap-cp-thumb{position:relative;width:60px;height:60px;border-radius:4px;overflow:hidden;',
		'border:1px solid #ddd;flex-shrink:0;}',
		'.ap-cp-thumb img{width:100%;height:100%;object-fit:cover;}',
		'.ap-cp-thumb-del{position:absolute;top:1px;right:1px;background:rgba(0,0,0,.6);',
		'color:#fff;border:none;border-radius:3px;font-size:10px;cursor:pointer;padding:1px 3px;line-height:1;}',

		'.ap-cp-actions{display:flex;gap:8px;padding:12px 16px;border-top:1px solid #eee;justify-content:flex-end;}',
		'[data-ap-dark] .ap-cp-actions,.ap-dark .ap-cp-actions{border-color:#444;}',
		'.ap-cp-btn{padding:7px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;border:none;}',
		'.ap-cp-btn--primary{background:#2271b1;color:#fff;}',
		'.ap-cp-btn--primary:hover{background:#135e96;}',
		'.ap-cp-btn--ghost{background:transparent;color:#555;border:1px solid #ccc;}',
		'[data-ap-dark] .ap-cp-btn--ghost,.ap-dark .ap-cp-btn--ghost{color:#bbb;border-color:#555;}',
		'.ap-cp-btn--ghost:hover{background:rgba(0,0,0,.05);}',
		'.ap-cp-error{color:#d63638;font-size:12px;display:none;}',
	].join( '' );

	/* ─── DOM builders ──────────────────────────────────────────────── */

	var panel, panelTitle, instrTextarea, instrFileInput, deepLinkInput, wfSelect, errorEl, submitBtn;
	var attachments = []; // { dataUrl, file }
	var attachsContainer;

	function injectStyles() {
		var s = document.createElement( 'style' );
		s.textContent = STYLES;
		document.head.appendChild( s );
	}

	function buildWfOptions( selectEl, activeId ) {
		var workflows = cfg.workflows || [];
		selectEl.innerHTML = '<option value="">— Select Workflow —</option>';
		workflows.forEach( function ( wf ) {
			var opt      = document.createElement( 'option' );
			opt.value    = String( wf.id );
			opt.textContent = wf.title;
			if ( String( wf.id ) === activeId ) opt.selected = true;
			selectEl.appendChild( opt );
		} );
	}

	function addThumb( dataUrl ) {
		var wrapper = document.createElement( 'div' );
		wrapper.className = 'ap-cp-thumb';
		var img = document.createElement( 'img' );
		img.src = dataUrl;
		var del = document.createElement( 'button' );
		del.className   = 'ap-cp-thumb-del';
		del.type        = 'button';
		del.textContent = '×';
		del.addEventListener( 'click', function () {
			var idx = attachments.findIndex( function ( a ) { return a.dataUrl === dataUrl; } );
			if ( idx !== -1 ) attachments.splice( idx, 1 );
			wrapper.remove();
		} );
		wrapper.appendChild( img );
		wrapper.appendChild( del );
		attachsContainer.appendChild( wrapper );
	}

	function createPanel() {
		panel = document.createElement( 'div' );
		panel.id = 'ap-capture-panel';

		/* Header */
		var header   = document.createElement( 'div' );
		header.id    = 'ap-capture-panel-header';
		var htitle   = document.createElement( 'h3' );
		htitle.textContent = '⊕ Capture Step';
		var closeBtn = document.createElement( 'button' );
		closeBtn.id          = 'ap-capture-panel-close';
		closeBtn.type        = 'button';
		closeBtn.innerHTML   = '&times;';
		closeBtn.setAttribute( 'aria-label', 'Close' );
		closeBtn.addEventListener( 'click', closePanel );
		header.appendChild( htitle );
		header.appendChild( closeBtn );
		panel.appendChild( header );

		/* Body */
		var body = document.createElement( 'div' );
		body.id  = 'ap-capture-panel-body';

		/* Step Title */
		var titleGroup = document.createElement( 'div' );
		var titleLabel = document.createElement( 'label' );
		titleLabel.className   = 'ap-cp-label';
		titleLabel.htmlFor     = 'ap-cp-title';
		titleLabel.innerHTML   = 'Step Title <span class="ap-cp-required">*</span>';
		panelTitle = document.createElement( 'input' );
		panelTitle.type        = 'text';
		panelTitle.id          = 'ap-cp-title';
		panelTitle.className   = 'ap-cp-input';
		panelTitle.placeholder = 'What was changed or configured?';
		titleGroup.appendChild( titleLabel );
		titleGroup.appendChild( panelTitle );
		body.appendChild( titleGroup );

		/* Instructions compose area */
		var instrGroup = document.createElement( 'div' );
		var instrLabel = document.createElement( 'label' );
		instrLabel.className   = 'ap-cp-label';
		instrLabel.htmlFor     = 'ap-cp-instructions';
		instrLabel.textContent = 'Instructions';

		var compose = document.createElement( 'div' );
		compose.className = 'ap-cp-compose';

		var toolbar = document.createElement( 'div' );
		toolbar.className = 'ap-cp-compose-toolbar';

		/* Image attach button */
		instrFileInput = document.createElement( 'input' );
		instrFileInput.type     = 'file';
		instrFileInput.accept   = 'image/*';
		instrFileInput.multiple = true;
		instrFileInput.style.display = 'none';
		instrFileInput.addEventListener( 'change', function () {
			Array.from( instrFileInput.files ).forEach( function ( file ) {
				var reader = new FileReader();
				reader.onload = function ( e ) {
					attachments.push( { dataUrl: e.target.result, file: file } );
					addThumb( e.target.result );
				};
				reader.readAsDataURL( file );
			} );
			instrFileInput.value = '';
		} );

		var imgBtn = document.createElement( 'button' );
		imgBtn.type      = 'button';
		imgBtn.title     = 'Attach image';
		imgBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" stroke-width="1.25"/><circle cx="5.5" cy="6.5" r="1" fill="currentColor"/><path d="M1.5 10.5l3.5-3 2.5 2.5 2-1.5 3 3" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/></svg>';
		imgBtn.addEventListener( 'click', function () { instrFileInput.click(); } );

		/* Screen capture button */
		var scrBtn = document.createElement( 'button' );
		scrBtn.type      = 'button';
		scrBtn.title     = 'Screenshot page';
		scrBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 5.5V3.5A1 1 0 0 1 2.5 2.5h2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><path d="M14.5 5.5V3.5A1 1 0 0 0 13.5 2.5h-2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><path d="M1.5 10.5v2a1 1 0 0 0 1 1h2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><path d="M14.5 10.5v2a1 1 0 0 1-1 1h-2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.25"/></svg>';
		var scrBtnSvg = scrBtn.innerHTML;
		scrBtn.addEventListener( 'click', function () {
			scrBtn.innerHTML = '…';
			scrBtn.disabled  = true;

			setTimeout( function () {
				if ( ! window.html2canvas ) {
					scrBtn.innerHTML = scrBtnSvg;
					scrBtn.disabled  = false;
					return;
				}
				panel.style.display = 'none';

				// Temporarily remove stylesheet rules with SVG data URIs that crash html2canvas.
				var disabledRules = [];
				try {
					for ( var si = 0; si < document.styleSheets.length; si++ ) {
						try {
							var rules = document.styleSheets[ si ].cssRules || [];
							for ( var ri = rules.length - 1; ri >= 0; ri-- ) {
								var ruleText = rules[ ri ] && rules[ ri ].cssText || '';
								if ( ruleText.indexOf( 'data:image/svg' ) !== -1 ) {
									disabledRules.push( { sheet: document.styleSheets[ si ], index: ri, text: ruleText } );
									try { document.styleSheets[ si ].deleteRule( ri ); } catch ( e ) {}
								}
							}
						} catch ( e ) { /* cross-origin sheet */ }
					}
				} catch ( e ) {}

				html2canvas( document.body, {
					useCORS:               true,
					allowTaint:            false,
					logging:               false,
					scale:                 1,
					foreignObjectRendering:false,
					ignoreElements: function ( el ) {
						return el.tagName === 'IFRAME' || el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT';
					},
				} ).then( function ( canvas ) {
					var dataUrl = canvas.toDataURL( 'image/png' );
					attachments.push( { dataUrl: dataUrl } );
					addThumb( dataUrl );
				} ).catch( function () {} ).then( function () {
					// Restore deleted rules.
					for ( var i = disabledRules.length - 1; i >= 0; i-- ) {
						try { disabledRules[ i ].sheet.insertRule( disabledRules[ i ].text, disabledRules[ i ].index ); } catch ( e ) {}
					}
					panel.style.display = 'flex';
					scrBtn.innerHTML    = scrBtnSvg;
					scrBtn.disabled     = false;
				} );
			}, 150 );
		} );

		/* Paste handler on textarea */
		instrTextarea = document.createElement( 'textarea' );
		instrTextarea.id          = 'ap-cp-instructions';
		instrTextarea.className   = 'ap-cp-textarea';
		instrTextarea.placeholder = 'Optional instructions for this step…';
		instrTextarea.rows        = 4;
		instrTextarea.addEventListener( 'paste', function ( e ) {
			var items = e.clipboardData && e.clipboardData.items;
			if ( ! items ) return;
			for ( var i = 0; i < items.length; i++ ) {
				if ( items[ i ].type.indexOf( 'image' ) === 0 ) {
					e.preventDefault();
					var file   = items[ i ].getAsFile();
					var reader = new FileReader();
					reader.onload = ( function ( f ) {
						return function ( ev ) {
							attachments.push( { dataUrl: ev.target.result, file: f } );
							addThumb( ev.target.result );
						};
					} )( file );
					reader.readAsDataURL( file );
				}
			}
		} );

		toolbar.appendChild( imgBtn );
		toolbar.appendChild( scrBtn );
		toolbar.appendChild( instrFileInput );

		attachsContainer = document.createElement( 'div' );
		attachsContainer.className = 'ap-cp-attachments';

		compose.appendChild( toolbar );
		compose.appendChild( instrTextarea );
		compose.appendChild( attachsContainer );

		instrGroup.appendChild( instrLabel );
		instrGroup.appendChild( compose );
		body.appendChild( instrGroup );

		/* Deep Link */
		var dlGroup = document.createElement( 'div' );
		var dlLabel = document.createElement( 'label' );
		dlLabel.className   = 'ap-cp-label';
		dlLabel.htmlFor     = 'ap-cp-deeplink';
		dlLabel.textContent = 'Deep Link';
		deepLinkInput = document.createElement( 'input' );
		deepLinkInput.type        = 'text';
		deepLinkInput.id          = 'ap-cp-deeplink';
		deepLinkInput.className   = 'ap-cp-input';
		deepLinkInput.placeholder = 'e.g. wp-admin/options-general.php';
		dlGroup.appendChild( dlLabel );
		dlGroup.appendChild( deepLinkInput );
		body.appendChild( dlGroup );

		/* Workflow dropdown */
		var wfGroup = document.createElement( 'div' );
		var wfLabel = document.createElement( 'label' );
		wfLabel.className  = 'ap-cp-label';
		wfLabel.htmlFor    = 'ap-cp-wf';
		wfLabel.innerHTML  = 'Workflow <span class="ap-cp-required">*</span>';
		wfSelect = document.createElement( 'select' );
		wfSelect.id        = 'ap-cp-wf';
		wfSelect.className = 'ap-cp-select';
		wfGroup.appendChild( wfLabel );
		wfGroup.appendChild( wfSelect );
		body.appendChild( wfGroup );

		/* Error */
		errorEl = document.createElement( 'div' );
		errorEl.className = 'ap-cp-error';
		errorEl.id        = 'ap-cp-error';
		body.appendChild( errorEl );

		panel.appendChild( body );

		/* Actions */
		var actions    = document.createElement( 'div' );
		actions.className = 'ap-cp-actions';
		var cancelBtn  = document.createElement( 'button' );
		cancelBtn.type        = 'button';
		cancelBtn.className   = 'ap-cp-btn ap-cp-btn--ghost';
		cancelBtn.textContent = 'Cancel';
		cancelBtn.addEventListener( 'click', closePanel );
		submitBtn  = document.createElement( 'button' );
		submitBtn.type        = 'button';
		submitBtn.className   = 'ap-cp-btn ap-cp-btn--primary';
		submitBtn.textContent = 'Save Step';
		submitBtn.addEventListener( 'click', handleSubmit );
		actions.appendChild( cancelBtn );
		actions.appendChild( submitBtn );
		panel.appendChild( actions );

		document.body.appendChild( panel );
		makeDraggable( header, panel );

		/* Close on Escape */
		document.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Escape' && panel.style.display !== 'none' ) closePanel();
		} );

		/* Close on outside click */
		document.addEventListener( 'mousedown', function ( e ) {
			if ( panel.style.display === 'none' ) return;
			if ( ! panel.contains( e.target ) ) closePanel();
		} );
	}

	/* ─── Panel open/close ──────────────────────────────────────────── */

	function openPanel() {
		/* Pre-fill title from first detected change */
		var change = findFirstChange();
		if ( change && ! panelTitle.value ) {
			panelTitle.value = change.label;
		}

		/* Pre-fill deep link from current page path */
		if ( ! deepLinkInput.value ) {
			deepLinkInput.value = window.location.pathname.replace( /^\//, '' ) + window.location.search;
		}

		/* Pre-select active workflow */
		var activeId = getActiveWorkflowId();
		buildWfOptions( wfSelect, activeId );

		errorEl.style.display = 'none';
		panel.style.display   = 'flex';
		panelTitle.focus();
	}

	function closePanel() {
		panel.style.display = 'none';
		setSubmitLoading( false );
	}


	/* ─── Submit ────────────────────────────────────────────────────── */

	function setSubmitLoading( loading ) {
		submitBtn.disabled = loading;
		submitBtn.innerHTML = loading
			? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;animation:ap-spin 0.7s linear infinite"><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" stroke-width="2"/><path d="M8 2a6 6 0 0 1 6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg> Saving…'
			: 'Save Step';
	}

	function handleSubmit() {
		var title = panelTitle.value.trim();
		var wfId  = wfSelect.value;

		errorEl.style.display = 'none';

		if ( ! title ) {
			errorEl.textContent   = 'Step title is required.';
			errorEl.style.display = 'block';
			panelTitle.focus();
			return;
		}
		if ( ! wfId ) {
			errorEl.textContent   = 'Please select a workflow.';
			errorEl.style.display = 'block';
			wfSelect.focus();
			return;
		}

		setSubmitLoading( true );

		var noteText        = instrTextarea.value.trim();
		var noteAttachments = attachments.slice(); // snapshot before clearing
		var change          = findFirstChange();

		var body = {
			label:       title,
			field_key:   change ? change.key : '_manual_',
			old_value:   change ? change.oldValue : '',
			new_value:   change ? change.newValue : '',
			page_url:    cfg.pageUrl || window.location.href,
			page_title:  cfg.pageTitle || document.title,
			workflow_id: parseInt( wfId, 10 ),
		};

		fetch( cfg.restUrl + 'capture/manual', {
			method:  'POST',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
			body:    JSON.stringify( body ),
		} )
			.then( function ( r ) { return r.json(); } )
			.then( function ( data ) {
				if ( ! ( data && data.success ) ) {
					setSubmitLoading( false );
					errorEl.textContent   = 'Failed to save. Please try again.';
					errorEl.style.display = 'block';
					return;
				}

				if ( change ) snapshot[ change.key ] = change.newValue;
				panelTitle.value    = '';
				instrTextarea.value = '';
				deepLinkInput.value = '';
				attachments         = [];
				attachsContainer.innerHTML = '';
				closePanel();
				window.dispatchEvent( new CustomEvent( 'ap:capture:saved', { detail: data } ) );

				// If the step was created and there are notes/screenshots, post them as a note.
				var stepId = data.step && data.step.id;
				if ( ! stepId || ( ! noteText && ! noteAttachments.length ) ) return;

				var restBase = cfg.restUrl + 'steps/' + stepId + '/notes';
				fetch( restBase, {
					method:  'POST',
					headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
					body:    JSON.stringify( { body: noteText, shared: true } ),
				} )
					.then( function ( r ) { return r.json(); } )
					.then( function ( note ) {
						if ( ! note || ! note.id || ! noteAttachments.length ) return;
						// Upload the first screenshot to the note.
						var attachment = noteAttachments[ 0 ];
						// Convert dataUrl to Blob then post as multipart.
						var byteStr = atob( attachment.dataUrl.split( ',' )[ 1 ] );
						var ab = new ArrayBuffer( byteStr.length );
						var ia = new Uint8Array( ab );
						for ( var i = 0; i < byteStr.length; i++ ) ia[ i ] = byteStr.charCodeAt( i );
						var blob = new Blob( [ ab ], { type: 'image/png' } );
						var fd   = new FormData();
						fd.append( 'screenshot', blob, 'screenshot.png' );
						fetch( restBase + '/' + note.id + '/screenshot', {
							method:  'POST',
							headers: { 'X-WP-Nonce': cfg.nonce },
							body:    fd,
						} ).catch( function () {} );
					} )
					.catch( function () {} );
			} )
			.catch( function () {
				setSubmitLoading( false );
				errorEl.textContent   = 'Network error. Please try again.';
				errorEl.style.display = 'block';
			} );
	}

	/* ─── Change detectors ──────────────────────────────────────────── */

	function initClickDetector() {
		document.addEventListener( 'click', function ( e ) {
			var el = e.target;
			var label = el.getAttribute( 'aria-label' ) || '';
			var actions = [ 'Bold', 'Italic', 'Underline', 'Strikethrough', 'Link', 'Unlink', 'Image', 'Media' ];
			actions.forEach( function ( a ) {
				if ( label.indexOf( a ) !== -1 ) {
					var key = 'toolbar_' + a.toLowerCase();
					if ( ! snapshot[ key ] ) snapshot[ key ] = '0';
				}
			} );
		}, true );
	}

	function initBeforeInputDetector() {
		document.addEventListener( 'beforeinput', function ( e ) {
			if ( e.target && ( e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ) ) return;
			var key = 'rte_' + ( e.inputType || 'edit' );
			if ( ! ( key in snapshot ) ) snapshot[ key ] = '0';
		} );
	}

	function initWpDataDetector() {
		try {
			if ( ! window.wp || ! window.wp.data ) return;
			var prevAttrs = {};
			window.wp.data.subscribe( function () {
				try {
					var editor = window.wp.data.select( 'core/block-editor' );
					if ( ! editor ) return;
					var blocks = editor.getBlocks();
					if ( ! blocks ) return;
					blocks.forEach( function ( block ) {
						var key  = 'block_' + block.clientId;
						var curr = JSON.stringify( block.attributes );
						if ( prevAttrs[ key ] !== undefined && prevAttrs[ key ] !== curr ) {
							if ( ! ( key in snapshot ) ) snapshot[ key ] = prevAttrs[ key ];
						}
						prevAttrs[ key ] = curr;
					} );
				} catch ( err ) {}
			} );
		} catch ( e ) {}
	}

	/* ─── Boot ──────────────────────────────────────────────────────── */

	function boot() {
		injectStyles();
		takeSnapshot();
		setTimeout( takeSnapshot, 800 );
		createPanel();
		initClickDetector();
		initBeforeInputDetector();
		setTimeout( initWpDataDetector, 500 );

		window.addEventListener( 'ap:capture:open', function () {
			openPanel();
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}

} )();
