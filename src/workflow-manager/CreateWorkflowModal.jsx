import { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Modal from '../shared/Modal';
import Button from '../shared/Button';

const CreateWorkflowModal = ( { onClose } ) => {
	const [ title, setTitle ]       = useState( '' );
	const [ description, setDesc ]  = useState( '' );
	const [ status, setStatus ]     = useState( 'active' );

	const { createWorkflow } = useDispatch( 'stepwise/workflows' );
	const isSaving = useSelect( ( select ) => select( 'stepwise/workflows' ).isSaving() );

	const handleSubmit = async ( e ) => {
		e.preventDefault();
		if ( ! title.trim() ) return;

		const workflow = await createWorkflow( { title: title.trim(), description, status } );
		if ( workflow ) {
			// Navigate to Step Builder for the new workflow
			const editUrl = `${ window.stepwiseData?.adminUrl ?? '' }admin.php?page=stepwise&workflow_id=${ workflow.id }`;
			window.location.href = editUrl;
		}
	};

	return (
		<Modal
			title={ __( 'Create New Workflow', 'stepwise' ) }
			onClose={ onClose }
			footer={
				<>
					<Button variant="ghost" onClick={ onClose } disabled={ isSaving }>
						{ __( 'Cancel', 'stepwise' ) }
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="ap-create-workflow-form"
						disabled={ ! title.trim() || isSaving }
					>
						{ isSaving ? __( 'Creating…', 'stepwise' ) : __( 'Create Workflow', 'stepwise' ) }
					</Button>
				</>
			}
		>
			<form id="ap-create-workflow-form" onSubmit={ handleSubmit }>
				<div className="ap-field">
					<label className="stepwise-label" htmlFor="ap-workflow-title">
						{ __( 'Workflow Title', 'stepwise' ) }
						<span className="ap-required" aria-hidden="true"> *</span>
					</label>
					<input
						id="ap-workflow-title"
						type="text"
						className="stepwise-input"
						value={ title }
						onChange={ ( e ) => setTitle( e.target.value ) }
						placeholder={ __( 'e.g. New Site Setup', 'stepwise' ) }
						required
						autoFocus
					/>
				</div>

				<div className="ap-field">
					<label className="stepwise-label" htmlFor="ap-workflow-desc">
						{ __( 'Description', 'stepwise' ) }
					</label>
					<textarea
						id="ap-workflow-desc"
						className="stepwise-input ap-textarea"
						value={ description }
						onChange={ ( e ) => setDesc( e.target.value ) }
						placeholder={ __( 'Optional — describe when to use this workflow.', 'stepwise' ) }
						rows={ 3 }
					/>
				</div>

				<div className="ap-field">
					<label className="stepwise-label" htmlFor="ap-workflow-status">
						{ __( 'Status', 'stepwise' ) }
					</label>
					<select
						id="ap-workflow-status"
						className="stepwise-select"
						value={ status }
						onChange={ ( e ) => setStatus( e.target.value ) }
					>
						<option value="active">{ __( 'Active', 'stepwise' ) }</option>
						<option value="draft">{ __( 'Draft', 'stepwise' ) }</option>
					</select>
				</div>
			</form>
		</Modal>
	);
};

CreateWorkflowModal.propTypes = {
	onClose: PropTypes.func.isRequired,
};

export default CreateWorkflowModal;
