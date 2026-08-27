import { useState, useEffect, useCallback } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import AddToWorkflowModal from './AddToWorkflowModal';

const { adminUrl = '' } = window.stepwiseData ?? {};

const CapturePage = () => {
	const [ changes, setChanges ]         = useState( [] );
	const [ loading, setLoading ]         = useState( true );
	const [ selected, setSelected ]       = useState( new Set() );
	const [ showModal, setShowModal ]     = useState( false );
	const [ clearing, setClearing ]       = useState( false );
	const [ successMsg, setSuccessMsg ]   = useState( '' );

	const load = useCallback( () => {
		setLoading( true );
		apiFetch( { path: '/stepwise/v1/capture/all' } )
			.then( ( data ) => setChanges( data?.changes ?? [] ) )
			.catch( () => setChanges( [] ) )
			.finally( () => setLoading( false ) );
	}, [] );

	useEffect( () => { load(); }, [ load ] );

	const toggleSelect = ( id ) => {
		setSelected( ( prev ) => {
			const next = new Set( prev );
			next.has( id ) ? next.delete( id ) : next.add( id );
			return next;
		} );
	};

	const toggleAll = () => {
		if ( selected.size === changes.length ) {
			setSelected( new Set() );
		} else {
			setSelected( new Set( changes.map( ( c ) => c.id ) ) );
		}
	};

	const selectedChanges = changes.filter( ( c ) => selected.has( c.id ) );

	const handleDismissSelected = () => {
		if ( ! selected.size ) return;
		apiFetch( {
			path: '/stepwise/v1/capture/dismiss',
			method: 'DELETE',
			data: { capture_ids: [ ...selected ] },
		} ).then( () => {
			setChanges( ( prev ) => prev.filter( ( c ) => ! selected.has( c.id ) ) );
			setSelected( new Set() );
		} ).catch( () => {} );
	};

	const handleClearAll = () => {
		if ( ! window.confirm( __( 'Clear all captured changes? This cannot be undone.', 'stepwise' ) ) ) return;
		setClearing( true );
		apiFetch( { path: '/stepwise/v1/capture/all', method: 'DELETE' } )
			.then( () => {
				setChanges( [] );
				setSelected( new Set() );
				setSuccessMsg( __( 'All captured changes cleared.', 'stepwise' ) );
				setTimeout( () => setSuccessMsg( '' ), 3000 );
			} )
			.catch( () => {} )
			.finally( () => setClearing( false ) );
	};

	const formatDate = ( str ) => {
		if ( ! str ) return '';
		try {
			return new Date( str ).toLocaleString( undefined, { dateStyle: 'medium', timeStyle: 'short' } );
		} catch {
			return str;
		}
	};

	return (
		<div className="ap-capture-page">
			<div className="ap-capture-page__header">
				<div className="ap-capture-page__title-row">
					<h1 className="ap-page-title">{ __( 'Captured Steps', 'stepwise' ) }</h1>
					<a href={ `${ adminUrl }admin.php?page=stepwise` } className="ap-capture-page__back">
						← { __( 'Back to Workflows', 'stepwise' ) }
					</a>
				</div>
				<p className="ap-capture-page__desc">
					{ __( 'Stepwise detected these setting changes. Select one or more to add as a workflow step, or dismiss them.', 'stepwise' ) }
				</p>
			</div>

			{ successMsg && (
				<div className="ap-notice notice notice-success">
					<p>{ successMsg }</p>
				</div>
			) }

			{ loading && (
				<div className="ap-loading">
					<span className="spinner is-active" />
					{ __( 'Loading…', 'stepwise' ) }
				</div>
			) }

			{ ! loading && changes.length === 0 && (
				<div className="ap-capture-page__empty">
					<p>{ __( 'No pending captured changes.', 'stepwise' ) }</p>
					<p className="ap-capture-page__empty-sub">
						{ __( 'Stepwise will detect setting changes as you navigate WP admin.', 'stepwise' ) }
					</p>
				</div>
			) }

			{ ! loading && changes.length > 0 && (
				<>
					<div className="ap-capture-page__toolbar">
						<label className="ap-capture-page__select-all">
							<input
								type="checkbox"
								checked={ selected.size === changes.length }
								onChange={ toggleAll }
							/>
							{ selected.size > 0
								? `${ selected.size } ${ __( 'selected', 'stepwise' ) }`
								: __( 'Select all', 'stepwise' ) }
						</label>

						<div className="ap-capture-page__toolbar-actions">
							{ selected.size > 0 && (
								<>
									<button
										type="button"
										className="stepwise-btn stepwise-btn--primary stepwise-btn--sm"
										onClick={ () => setShowModal( true ) }
									>
										{ __( 'Add to Workflow', 'stepwise' ) }
										{ ' ' }({ selected.size })
									</button>
									<button
										type="button"
										className="stepwise-btn stepwise-btn--ghost stepwise-btn--sm"
										onClick={ handleDismissSelected }
									>
										{ __( 'Dismiss', 'stepwise' ) }
									</button>
								</>
							) }
							<button
								type="button"
								className="stepwise-btn stepwise-btn--danger stepwise-btn--sm"
								onClick={ handleClearAll }
								disabled={ clearing }
							>
								{ clearing ? __( 'Clearing…', 'stepwise' ) : __( 'Clear All', 'stepwise' ) }
							</button>
						</div>
					</div>

					<table className="ap-capture-page__table widefat striped">
						<thead>
							<tr>
								<th className="ap-capture-page__col-check"></th>
								<th>{ __( 'Page', 'stepwise' ) }</th>
								<th>{ __( 'Setting', 'stepwise' ) }</th>
								<th>{ __( 'Old Value', 'stepwise' ) }</th>
								<th>{ __( 'New Value', 'stepwise' ) }</th>
								<th>{ __( 'Captured', 'stepwise' ) }</th>
							</tr>
						</thead>
						<tbody>
							{ changes.map( ( c ) => (
								<tr
									key={ c.id }
									className={ selected.has( c.id ) ? 'ap-capture-page__row--selected' : '' }
									onClick={ () => toggleSelect( c.id ) }
								>
									<td className="ap-capture-page__col-check">
										<input
											type="checkbox"
											checked={ selected.has( c.id ) }
											onChange={ () => toggleSelect( c.id ) }
											onClick={ ( e ) => e.stopPropagation() }
										/>
									</td>
									<td>
										<a
											href={ c.page_url }
											target="_blank"
											rel="noopener noreferrer"
											onClick={ ( e ) => e.stopPropagation() }
											title={ c.page_url }
										>
											{ c.page_title || c.page_url }
										</a>
									</td>
									<td>
										<code>{ c.option_label || c.option_name }</code>
									</td>
									<td className="ap-capture-page__val">
										<span title={ c.old_value }>
											{ String( c.old_value ?? '' ).slice( 0, 60 ) || <em>{ __( '(empty)', 'stepwise' ) }</em> }
										</span>
									</td>
									<td className="ap-capture-page__val">
										<span title={ c.new_value }>
											{ String( c.new_value ?? '' ).slice( 0, 60 ) || <em>{ __( '(empty)', 'stepwise' ) }</em> }
										</span>
									</td>
									<td className="ap-capture-page__date">
										{ formatDate( c.captured_at ) }
									</td>
								</tr>
							) ) }
						</tbody>
					</table>
				</>
			) }

			{ showModal && (
				<AddToWorkflowModal
					changes={ selectedChanges }
					onClose={ () => {
						setShowModal( false );
						load();
						setSelected( new Set() );
					} }
				/>
			) }
		</div>
	);
};

export default CapturePage;
