import { useState } from 'react';
import PropTypes from 'prop-types';
import apiFetch from '@wordpress/api-fetch';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Modal from '../shared/Modal';
import Button from '../shared/Button';

const ImportUrlModal = ( { onClose } ) => {
	const [ url, setUrl ]       = useState( '' );
	const [ saving, setSaving ] = useState( false );
	const [ error, setError ]   = useState( null );

	const { fetchWorkflows } = useDispatch( 'alignpress/workflows' );

	const { saasConnected = false } = window.alignpressData ?? {};

	const handleSubmit = async ( e ) => {
		e.preventDefault();
		if ( ! url.trim() ) return;
		setSaving( true );
		setError( null );
		try {
			let workflow;
			if ( saasConnected ) {
				// Proxy through SaaS — server-enforced Pro gate, fetch happens on our server
				const parsed = await apiFetch( {
					path:   '/alignpress/v1/saas/import-url',
					method: 'POST',
					data:   { url: url.trim() },
				} );
				// parsed contains {title, description, category, steps} — import locally
				workflow = await apiFetch( {
					path:   '/alignpress/v1/workflows/import',
					method: 'POST',
					data:   parsed,
				} );
			} else {
				workflow = await apiFetch( {
					path:   '/alignpress/v1/workflows/import-url',
					method: 'POST',
					data:   { url: url.trim() },
				} );
			}
			await fetchWorkflows();
			onClose();
			if ( workflow?.id ) {
				const editUrl = `${ window.alignpressData?.adminUrl ?? '' }admin.php?page=alignpress&workflow_id=${ workflow.id }`;
				window.location.href = editUrl;
			}
		} catch ( err ) {
			setError( err.message ?? __( 'Failed to import from URL.', 'alignpress' ) );
			setSaving( false );
		}
	};

	return (
		<Modal
			title={ __( 'Import Workflow from URL', 'alignpress' ) }
			onClose={ onClose }
			footer={
				<>
					<Button variant="ghost" onClick={ onClose } disabled={ saving }>
						{ __( 'Cancel', 'alignpress' ) }
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="ap-import-url-form"
						disabled={ ! url.trim() || saving }
					>
						{ saving ? __( 'Importing…', 'alignpress' ) : __( 'Import', 'alignpress' ) }
					</Button>
				</>
			}
		>
			<form id="ap-import-url-form" onSubmit={ handleSubmit }>
				{ error && <p className="ap-error">{ error }</p> }
				<div className="ap-field">
					<label className="alignpress-label" htmlFor="ap-import-url">
						{ __( 'Workflow JSON URL', 'alignpress' ) }
						<span className="ap-required" aria-hidden="true"> *</span>
					</label>
					<input
						id="ap-import-url"
						type="url"
						className="alignpress-input"
						value={ url }
						onChange={ ( e ) => setUrl( e.target.value ) }
						placeholder="https://example.com/workflow-export.json"
						required
						autoFocus
					/>
					<p className="ap-help">
						{ __( 'Paste the URL of a workflow JSON exported from another AlignPress installation.', 'alignpress' ) }
					</p>
				</div>
			</form>
		</Modal>
	);
};

ImportUrlModal.propTypes = {
	onClose: PropTypes.func.isRequired,
};

export default ImportUrlModal;
