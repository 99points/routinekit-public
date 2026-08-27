import { useState, useEffect, Fragment } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import AuditTrail from '../runner/AuditTrail';

const STATUS_LABEL = {
	completed:   __( 'Completed', 'stepwise' ),
	in_progress: __( 'In Progress', 'stepwise' ),
	paused:      __( 'Paused', 'stepwise' ),
	abandoned:   __( 'Abandoned', 'stepwise' ),
	pending:     __( 'Pending', 'stepwise' ),
};

const STATUS_CLASS = {
	completed:   'completed',
	in_progress: 'active',
	paused:      'paused',
	abandoned:   'draft',
	pending:     'draft',
};

const fmt = ( str ) => str
	? new Date( str ).toLocaleString( undefined, {
		year: 'numeric', month: 'short', day: 'numeric',
		hour: '2-digit', minute: '2-digit',
	} )
	: '—';

const RunHistory = ( { workflowId, workflowTitle } ) => {
	const [ executions, setExecutions ] = useState( [] );
	const [ loading, setLoading ]       = useState( true );
	const [ expandedId, setExpandedId ] = useState( null );

	useEffect( () => {
		apiFetch( { path: `/stepwise/v1/executions?workflow_id=${ workflowId }` } )
			.then( ( data ) => setExecutions( Array.isArray( data ) ? data : [] ) )
			.catch( () => setExecutions( [] ) )
			.finally( () => setLoading( false ) );
	}, [ workflowId ] );

	const toggleAudit = ( id ) => setExpandedId( ( prev ) => ( prev === id ? null : id ) );

	if ( loading ) {
		return (
			<div className="ap-run-history">
				<div className="ap-loading">
					<span className="spinner is-active" />
					{ __( 'Loading run history…', 'stepwise' ) }
				</div>
			</div>
		);
	}

	if ( executions.length === 0 ) {
		return (
			<div className="ap-run-history">
				<div className="ap-run-history__empty">
					<p>{ __( 'No runs yet.', 'stepwise' ) }</p>
					<p className="ap-run-history__empty-sub">
						{ __( 'Use the Run button on the Workflows list to start a run.', 'stepwise' ) }
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="ap-run-history">
			<div className="ap-run-history__header">
				<span className="ap-run-history__count">
					{ executions.length }{ ' ' }
					{ executions.length === 1
						? __( 'run', 'stepwise' )
						: __( 'runs', 'stepwise' ) }
				</span>
			</div>

			<table className="stepwise-table ap-run-history__table">
				<thead>
					<tr>
						<th>{ __( 'Status', 'stepwise' ) }</th>
						<th>{ __( 'Started', 'stepwise' ) }</th>
						<th>{ __( 'Completed / Paused', 'stepwise' ) }</th>
						<th>{ __( 'Run by', 'stepwise' ) }</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{ executions.map( ( ex ) => (
						<Fragment key={ ex.id }>
							<tr
								className={ `ap-run-history__row ${ expandedId === ex.id ? 'ap-run-history__row--expanded' : '' }` }
							>
								<td>
									<span className={ `stepwise-badge stepwise-badge--${ STATUS_CLASS[ ex.status ] ?? 'draft' }` }>
										{ STATUS_LABEL[ ex.status ] ?? ex.status }
									</span>
								</td>
								<td className="ap-run-history__date">{ fmt( ex.started_at ) }</td>
								<td className="ap-run-history__date">
									{ ex.status === 'paused' ? fmt( ex.paused_at ) : fmt( ex.completed_at ) }
								</td>
								<td className="ap-run-history__user">
									{ ex.started_by }
									{ ex.status === 'paused' && ex.paused_by && (
										<span className="ap-run-history__paused-by">
											{ ' · ' }{ __( 'paused by', 'stepwise' ) }{ ' ' }{ ex.paused_by }
										</span>
									) }
								</td>
								<td className="ap-run-history__action">
									{ ex.status === 'completed' && (
										<button
											type="button"
											className="ap-row-action"
											onClick={ () => toggleAudit( ex.id ) }
										>
											{ expandedId === ex.id
												? __( 'Hide audit trail ▲', 'stepwise' )
												: __( 'View audit trail ▼', 'stepwise' ) }
										</button>
									) }
								</td>
							</tr>
							{ expandedId === ex.id && (
								<tr key={ `audit-${ ex.id }` } className="ap-run-history__audit-row">
									<td colSpan={ 5 }>
										<div className="ap-run-history__audit-wrap">
											<AuditTrail executionId={ ex.id } />
										</div>
									</td>
								</tr>
							) }
						</Fragment>
					) ) }
				</tbody>
			</table>
		</div>
	);
};

export default RunHistory;
