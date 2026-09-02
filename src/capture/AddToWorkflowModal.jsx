import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import CapturePreview from './CapturePreview';

const AddToWorkflowModal = ( { changes, onClose } ) => {
	const [ workflows, setWorkflows ]   = useState( [] );
	const [ workflowId, setWorkflowId ] = useState( '' );
	const [ stepTitle, setStepTitle ]   = useState( '' );
	const [ saving, setSaving ]         = useState( false );
	const [ error, setError ]           = useState( null );

	useEffect( () => {
		apiFetch( { path: '/routinekit/v1/workflows?status=active' } )
			.then( ( data ) => setWorkflows( data ) )
			.catch( () => setWorkflows( [] ) );
	}, [] );

	const handleSubmit = async ( e ) => {
		e.preventDefault();
		if ( ! workflowId ) return;
		setSaving( true );
		setError( null );
		try {
			const captureIds = changes.map( ( c ) => c.id );
			const result = await apiFetch( {
				path: '/routinekit/v1/capture/add-to-workflow',
				method: 'POST',
				data: {
					workflow_id: parseInt( workflowId, 10 ),
					capture_ids: captureIds,
					step_title:  stepTitle.trim() || undefined,
				},
			} );

			// Tell an open Runner to refetch. Without this a run already in
			// progress keeps showing its original step list until the page is
			// reloaded. Same event the floating capture widget dispatches.
			window.dispatchEvent(
				new CustomEvent( 'ap:capture:saved', { detail: result } )
			);

			onClose();
		} catch ( err ) {
			setError( err.message ?? __( 'Something went wrong.', 'routinekit' ) );
			setSaving( false );
		}
	};

	const autoTitle = changes[ 0 ]?.page_title
		? `${ __( 'Configure', 'routinekit' ) } ${ changes[ 0 ].page_title }`
		: '';

	return (
		<Modal
			title={ __( 'Add to Workflow', 'routinekit' ) }
			onClose={ onClose }
			size="md"
			footer={
				<>
					<Button variant="ghost" onClick={ onClose } disabled={ saving }>
						{ __( 'Cancel', 'routinekit' ) }
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="ap-add-to-workflow-form"
						disabled={ ! workflowId || saving }
					>
						{ saving ? __( 'Adding…', 'routinekit' ) : __( 'Add Step', 'routinekit' ) }
					</Button>
				</>
			}
		>
			<form id="ap-add-to-workflow-form" onSubmit={ handleSubmit }>
				{ error && <p className="ap-error">{ error }</p> }

				<CapturePreview changes={ changes } />

				<div className="ap-field">
					<label className="routinekit-label" htmlFor="ap-atw-workflow">
						{ __( 'Workflow', 'routinekit' ) }
						<span className="ap-required" aria-hidden="true"> *</span>
					</label>
					{ workflows.length === 0 ? (
						<p className="ap-help">
							{ __( 'No active workflows found. Create a workflow first.', 'routinekit' ) }
						</p>
					) : (
						<select
							id="ap-atw-workflow"
							className="routinekit-select"
							value={ workflowId }
							onChange={ ( e ) => setWorkflowId( e.target.value ) }
							required
						>
							<option value="">{ __( '— Select a workflow —', 'routinekit' ) }</option>
							{ workflows.map( ( wf ) => (
								<option key={ wf.id } value={ wf.id }>{ wf.title }</option>
							) ) }
						</select>
					) }
				</div>

				<div className="ap-field">
					<label className="routinekit-label" htmlFor="ap-atw-title">
						{ __( 'Step Title', 'routinekit' ) }
					</label>
					<input
						id="ap-atw-title"
						type="text"
						className="routinekit-input"
						value={ stepTitle }
						onChange={ ( e ) => setStepTitle( e.target.value ) }
						placeholder={ autoTitle || __( 'Auto-generated from page name', 'routinekit' ) }
					/>
				</div>
			</form>
		</Modal>
	);
};

AddToWorkflowModal.propTypes = {
	changes: PropTypes.arrayOf( PropTypes.object ).isRequired,
	onClose: PropTypes.func.isRequired,
};

export default AddToWorkflowModal;
