import { useState } from 'react';
import PropTypes from 'prop-types';
import apiFetch from '@wordpress/api-fetch';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Modal from '../shared/Modal';
import Button from '../shared/Button';

const ImportJsonModal = ( { onClose } ) => {
	const [ json, setJson ]     = useState( '' );
	const [ saving, setSaving ] = useState( false );
	const [ error, setError ]   = useState( null );

	const { fetchWorkflows } = useDispatch( 'stepwise/workflows' );

	const handleSubmit = async ( e ) => {
		e.preventDefault();
		setError( null );

		let parsed;
		try {
			parsed = JSON.parse( json.trim() );
		} catch {
			setError( __( 'Invalid JSON — please check and try again.', 'stepwise' ) );
			return;
		}

		setSaving( true );
		try {
			const workflow = await apiFetch( {
				path:   '/stepwise/v1/workflows/import',
				method: 'POST',
				data:   parsed,
			} );
			await fetchWorkflows();
			onClose();
			if ( workflow?.id ) {
				const editUrl = `${ window.stepwiseData?.adminUrl ?? '' }admin.php?page=stepwise&workflow_id=${ workflow.id }`;
				window.location.href = editUrl;
			}
		} catch ( err ) {
			setError( err.message ?? __( 'Import failed.', 'stepwise' ) );
			setSaving( false );
		}
	};

	return (
		<Modal
			title={ __( 'Import Workflow from JSON', 'stepwise' ) }
			onClose={ onClose }
			footer={
				<>
					<Button variant="ghost" onClick={ onClose } disabled={ saving }>
						{ __( 'Cancel', 'stepwise' ) }
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="ap-import-json-form"
						disabled={ ! json.trim() || saving }
					>
						{ saving ? __( 'Importing…', 'stepwise' ) : __( 'Import', 'stepwise' ) }
					</Button>
				</>
			}
		>
			<form id="ap-import-json-form" onSubmit={ handleSubmit }>
				{ error && <p className="ap-error">{ error }</p> }
				<div className="ap-field">
					<label className="stepwise-label" htmlFor="ap-import-json">
						{ __( 'Workflow JSON', 'stepwise' ) }
						<span className="ap-required" aria-hidden="true"> *</span>
					</label>
					<textarea
						id="ap-import-json"
						className="stepwise-input"
						rows={ 10 }
						style={ { fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' } }
						value={ json }
						onChange={ ( e ) => setJson( e.target.value ) }
						placeholder='{ "title": "My Workflow", "steps": [ … ] }'
						required
						autoFocus
					/>
					<p className="ap-help">
						{ __( 'Paste the JSON exported from another Stepwise installation.', 'stepwise' ) }
					</p>
				</div>
			</form>
		</Modal>
	);
};

ImportJsonModal.propTypes = {
	onClose: PropTypes.func.isRequired,
};

export default ImportJsonModal;
