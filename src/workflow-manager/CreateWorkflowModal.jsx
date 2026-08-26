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

	const { createWorkflow } = useDispatch( 'alignpress/workflows' );
	const isSaving = useSelect( ( select ) => select( 'alignpress/workflows' ).isSaving() );

	const handleSubmit = async ( e ) => {
		e.preventDefault();
		if ( ! title.trim() ) return;

		const workflow = await createWorkflow( { title: title.trim(), description, status } );
		if ( workflow ) {
			// Navigate to Step Builder for the new workflow
			const editUrl = `${ window.alignpressData?.adminUrl ?? '' }admin.php?page=alignpress&workflow_id=${ workflow.id }`;
			window.location.href = editUrl;
		}
	};

	return (
		<Modal
			title={ __( 'Create New Workflow', 'alignpress' ) }
			onClose={ onClose }
			footer={
				<>
					<Button variant="ghost" onClick={ onClose } disabled={ isSaving }>
						{ __( 'Cancel', 'alignpress' ) }
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="ap-create-workflow-form"
						disabled={ ! title.trim() || isSaving }
					>
						{ isSaving ? __( 'Creating…', 'alignpress' ) : __( 'Create Workflow', 'alignpress' ) }
					</Button>
				</>
			}
		>
			<form id="ap-create-workflow-form" onSubmit={ handleSubmit }>
				<div className="ap-field">
					<label className="alignpress-label" htmlFor="ap-workflow-title">
						{ __( 'Workflow Title', 'alignpress' ) }
						<span className="ap-required" aria-hidden="true"> *</span>
					</label>
					<input
						id="ap-workflow-title"
						type="text"
						className="alignpress-input"
						value={ title }
						onChange={ ( e ) => setTitle( e.target.value ) }
						placeholder={ __( 'e.g. New Site Setup', 'alignpress' ) }
						required
						autoFocus
					/>
				</div>

				<div className="ap-field">
					<label className="alignpress-label" htmlFor="ap-workflow-desc">
						{ __( 'Description', 'alignpress' ) }
					</label>
					<textarea
						id="ap-workflow-desc"
						className="alignpress-input ap-textarea"
						value={ description }
						onChange={ ( e ) => setDesc( e.target.value ) }
						placeholder={ __( 'Optional — describe when to use this workflow.', 'alignpress' ) }
						rows={ 3 }
					/>
				</div>

				<div className="ap-field">
					<label className="alignpress-label" htmlFor="ap-workflow-status">
						{ __( 'Status', 'alignpress' ) }
					</label>
					<select
						id="ap-workflow-status"
						className="alignpress-select"
						value={ status }
						onChange={ ( e ) => setStatus( e.target.value ) }
					>
						<option value="active">{ __( 'Active', 'alignpress' ) }</option>
						<option value="draft">{ __( 'Draft', 'alignpress' ) }</option>
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
