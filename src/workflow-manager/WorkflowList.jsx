import { useState } from 'react';
import PropTypes from 'prop-types';
import { __ } from '@wordpress/i18n';
import WorkflowRow from './WorkflowRow';
import EmptyState from './EmptyState';

const WorkflowList = ( { workflows, onStartRun } ) => {
	const [ filter, setFilter ]   = useState( 'all' );
	const [ search, setSearch ]   = useState( '' );
	const [ selected, setSelected ] = useState( new Set() );

	const filtered = workflows.filter( ( w ) => {
		if ( filter !== 'all' && w.status !== filter ) return false;
		if ( search && ! w.title.toLowerCase().includes( search.toLowerCase() ) ) return false;
		return true;
	} );

	const counts = {
		all:      workflows.length,
		active:   workflows.filter( ( w ) => w.status === 'active' ).length,
		draft:    workflows.filter( ( w ) => w.status === 'draft' ).length,
		archived: workflows.filter( ( w ) => w.status === 'archived' ).length,
	};

	const allChecked = filtered.length > 0 && filtered.every( ( w ) => selected.has( w.id ) );

	const toggleAll = () => {
		if ( allChecked ) {
			setSelected( new Set() );
		} else {
			setSelected( new Set( filtered.map( ( w ) => w.id ) ) );
		}
	};

	const toggleOne = ( id ) => {
		setSelected( ( prev ) => {
			const next = new Set( prev );
			next.has( id ) ? next.delete( id ) : next.add( id );
			return next;
		} );
	};

	const tabs = [
		{ key: 'all',      label: __( 'All', 'alignpress' ) },
		{ key: 'active',   label: __( 'Active', 'alignpress' ) },
		{ key: 'draft',    label: __( 'Draft', 'alignpress' ) },
		{ key: 'archived', label: __( 'Archived', 'alignpress' ) },
	].filter( ( t ) => t.key === 'all' || counts[ t.key ] > 0 );

	if ( ! workflows.length ) {
		return <EmptyState />;
	}

	return (
		<div className="ap-workflow-list">
			{ /* Status filter tabs */ }
			<div className="ap-workflow-tabs">
				{ tabs.map( ( t ) => (
					<button
						key={ t.key }
						className={ `ap-workflow-tab ${ filter === t.key ? 'is-active' : '' }` }
						onClick={ () => setFilter( t.key ) }
					>
						{ t.label }
						{ counts[ t.key ] > 0 && (
							<span className="ap-workflow-tab__count">({ counts[ t.key ] })</span>
						) }
					</button>
				) ) }
			</div>

			{ /* Toolbar */ }
			<div className="ap-workflow-toolbar">
				<span className="ap-workflow-toolbar__count">
					{ filtered.length } { filtered.length === 1 ? __( 'item', 'alignpress' ) : __( 'items', 'alignpress' ) }
				</span>
				{ /* Search — temporarily hidden */ }
			</div>

			{ /* Table */ }
			<table className="alignpress-table widefat">
				<thead>
					<tr>
						<th className="ap-col-check">
							<input type="checkbox" checked={ allChecked } onChange={ toggleAll } />
						</th>
						<th className="ap-col-name">{ __( 'Workflow Name', 'alignpress' ) }</th>
						<th className="ap-col-steps">{ __( 'Steps', 'alignpress' ) }</th>
						<th className="ap-col-lastrun">{ __( 'Last Run', 'alignpress' ) }</th>
						<th className="ap-col-progress">{ __( 'Progress', 'alignpress' ) }</th>
						<th className="ap-col-status">{ __( 'Status', 'alignpress' ) }</th>
						<th className="ap-col-action"></th>
					</tr>
				</thead>
				<tbody>
					{ filtered.length === 0 ? (
						<tr>
							<td colSpan={ 7 } style={ { textAlign: 'center', padding: '24px', color: 'var(--ap-gray-400)' } }>
								{ __( 'No workflows match your filter.', 'alignpress' ) }
							</td>
						</tr>
					) : (
						filtered.map( ( workflow ) => (
							<WorkflowRow
								key={ workflow.id }
								workflow={ workflow }
								checked={ selected.has( workflow.id ) }
								onCheck={ () => toggleOne( workflow.id ) }
								onStartRun={ onStartRun }
							/>
						) )
					) }
				</tbody>
			</table>
		</div>
	);
};

WorkflowList.propTypes = {
	workflows:  PropTypes.arrayOf( PropTypes.object ).isRequired,
	onStartRun: PropTypes.func.isRequired,
};

export default WorkflowList;
