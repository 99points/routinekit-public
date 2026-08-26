import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

const AuditTrail = ( { executionId } ) => {
	const [ audit, setAudit ]     = useState( null );
	const [ loading, setLoading ] = useState( true );
	const [ error, setError ]     = useState( null );
	const [ expanded, setExpanded ] = useState( {} );

	useEffect( () => {
		apiFetch( { path: `/alignpress/v1/executions/${ executionId }/audit` } )
			.then( ( data ) => { setAudit( data ); setLoading( false ); } )
			.catch( ( err ) => { setError( err.message ); setLoading( false ); } );
	}, [ executionId ] );

	if ( loading ) return <p className="ap-audit__loading">{ __( 'Loading audit trail…', 'alignpress' ) }</p>;
	if ( error )   return <p className="ap-audit__error">{ error }</p>;
	if ( ! audit ) return null;

	const formatDate = ( str ) => str
		? new Date( str ).toLocaleString()
		: __( '—', 'alignpress' );

	const toggleExpand = ( id ) =>
		setExpanded( ( prev ) => ( { ...prev, [ id ]: ! prev[ id ] } ) );

	return (
		<div className="ap-audit">
			<div className="ap-audit__meta">
				<span>{ __( 'Started:', 'alignpress' ) } { formatDate( audit.started_at ) }</span>
				{ audit.completed_at && (
					<span>{ __( 'Completed:', 'alignpress' ) } { formatDate( audit.completed_at ) }</span>
				) }
			</div>

			{ audit.log.length === 0 ? (
				<p className="ap-audit__empty">{ __( 'No steps completed yet.', 'alignpress' ) }</p>
			) : (
				<ol className="ap-audit__log">
					{ audit.log.map( ( entry, i ) => (
						<li key={ i } className={ `ap-audit__entry ap-audit__entry--${ entry.status }` }>
							<div className="ap-audit__entry-header">
								<span className="ap-audit__entry-icon">
									{ entry.status === 'completed' ? '✓' : '–' }
								</span>
								<div className="ap-audit__entry-info">
									<strong>{ entry.step_title }</strong>
									<span className="ap-audit__entry-meta">
										{ entry.completed_by } · { formatDate( entry.completed_at ) }
									</span>
								</div>
							</div>

							{ entry.notes && (
								<p className="ap-audit__entry-notes">{ entry.notes }</p>
							) }

							{ entry.skipped_reason && (
								<p className="ap-audit__entry-skip">
									{ __( 'Skipped:', 'alignpress' ) } { entry.skipped_reason }
								</p>
							) }

							{ entry.evidence_url && (
								<a
									href={ entry.evidence_url }
									target="_blank"
									rel="noopener noreferrer"
									className="ap-audit__entry-evidence"
								>
									{ __( 'View evidence', 'alignpress' ) }
								</a>
							) }

							{ ( entry.before_snapshot || entry.after_snapshot ) && (
								<div className="ap-audit__snapshot">
									<button
										type="button"
										className="ap-audit__snapshot-toggle"
										onClick={ () => toggleExpand( i ) }
									>
										{ expanded[ i ]
											? __( '▲ Hide changes', 'alignpress' )
											: __( '▼ View option changes', 'alignpress' ) }
									</button>

									{ expanded[ i ] && (
										<table className="ap-audit__snapshot-table">
											<thead>
												<tr>
													<th>{ __( 'Option', 'alignpress' ) }</th>
													<th>{ __( 'After', 'alignpress' ) }</th>
												</tr>
											</thead>
											<tbody>
												{ Object.entries( entry.after_snapshot ?? {} ).map( ( [ key, val ] ) => (
													<tr key={ key }>
														<td className="ap-audit__snapshot-key">{ key }</td>
														<td className="ap-audit__snapshot-val">
															{ typeof val === 'object'
																? JSON.stringify( val )
																: String( val ) }
														</td>
													</tr>
												) ) }
											</tbody>
										</table>
									) }
								</div>
							) }
						</li>
					) ) }
				</ol>
			) }
		</div>
	);
};

AuditTrail.propTypes = {
	executionId: PropTypes.number.isRequired,
};

export default AuditTrail;
