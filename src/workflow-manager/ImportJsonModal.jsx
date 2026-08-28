import { useState } from 'react';
import PropTypes from 'prop-types';
import apiFetch from '@wordpress/api-fetch';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Modal from '../shared/Modal';
import Button from '../shared/Button';

const ImportJsonModal = ( { onClose } ) => {
	const [ file, setFile ]     = useState( null );
	const [ saving, setSaving ] = useState( false );
	const [ error, setError ]   = useState( null );

	const { fetchWorkflows } = useDispatch( 'stepwise/workflows' );

	const handleFile = ( e ) => {
		setError( null );
		setFile( e.target.files[ 0 ] ?? null );
	};

	const handleSubmit = async ( e ) => {
		e.preventDefault();
		if ( ! file ) return;
		setError( null );

		let parsed;
		try {
			const text = await file.text();
			parsed = JSON.parse( text );
		} catch {
			setError( __( 'Invalid JSON file — please check and try again.', 'stepwise' ) );
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
			title={ __( 'Import Workflow', 'stepwise' ) }
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
						disabled={ ! file || saving }
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
						{ __( 'Workflow JSON file', 'stepwise' ) }
						<span className="ap-required" aria-hidden="true"> *</span>
					</label>
					<input
						id="ap-import-json"
						type="file"
						accept=".json,application/json"
						className="stepwise-input"
						onChange={ handleFile }
						required
						autoFocus
					/>
					{ file && (
						<p className="ap-help">{ file.name } &mdash; { ( file.size / 1024 ).toFixed( 1 ) } KB</p>
					) }
					{ ! file && (
						<p className="ap-help">
							{ __( 'Select the .json file exported from another Stepwise installation.', 'stepwise' ) }
						</p>
					) }
				</div>
			</form>
		</Modal>
	);
};

ImportJsonModal.propTypes = {
	onClose: PropTypes.func.isRequired,
};

export default ImportJsonModal;
