import { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Button from '../shared/Button';
import DeepLinkInput from './DeepLinkInput';

const AddStepForm = ( { workflowId } ) => {
	const [ open, setOpen ]         = useState( false );
	const [ title, setTitle ]       = useState( '' );
	const [ deepLink, setDeepLink ] = useState( '' );
	const [ required, setRequired ] = useState( true );

	const { createStep } = useDispatch( 'routinekit/steps' );
	const isSaving = useSelect( ( select ) => select( 'routinekit/steps' ).isSaving() );

	const handleSubmit = async ( e ) => {
		e.preventDefault();
		if ( ! title.trim() ) return;

		await createStep( workflowId, {
			title:       title.trim(),
			deep_link:   deepLink,
			is_required: required,
		} );

		setTitle( '' );
		setDeepLink( '' );
		setRequired( true );
		setOpen( false );
	};

	if ( ! open ) {
		return (
			<div className="ap-add-step">
				<Button variant="secondary" onClick={ () => setOpen( true ) }>
					+ { __( 'Add Step', 'routinekit' ) }
				</Button>
			</div>
		);
	}

	return (
		<div className="ap-add-step ap-add-step--open">
			<h3 className="ap-add-step__title">{ __( 'New Step', 'routinekit' ) }</h3>
			<form onSubmit={ handleSubmit }>
				<div className="ap-field">
					<label className="routinekit-label" htmlFor="ap-new-step-title">
						{ __( 'Title', 'routinekit' ) }
						<span className="ap-required" aria-hidden="true"> *</span>
					</label>
					<input
						id="ap-new-step-title"
						type="text"
						className="routinekit-input"
						value={ title }
						onChange={ ( e ) => setTitle( e.target.value ) }
						placeholder={ __( 'e.g. Install security plugin', 'routinekit' ) }
						autoFocus
						required
					/>
				</div>

				<div className="ap-field">
					<label className="routinekit-label">{ __( 'Deep Link', 'routinekit' ) }</label>
					<DeepLinkInput value={ deepLink } onChange={ setDeepLink } />
				</div>

				<div className="ap-field ap-field--inline">
					<label className="routinekit-label">
						<input
							type="checkbox"
							checked={ required }
							onChange={ ( e ) => setRequired( e.target.checked ) }
						/>
						{ ' ' }{ __( 'Required step', 'routinekit' ) }
					</label>
				</div>

				<div className="ap-add-step__actions">
					<Button variant="primary" type="submit" disabled={ ! title.trim() || isSaving }>
						{ isSaving ? __( 'Adding…', 'routinekit' ) : __( 'Add Step', 'routinekit' ) }
					</Button>
					<Button variant="ghost" type="button" onClick={ () => setOpen( false ) }>
						{ __( 'Cancel', 'routinekit' ) }
					</Button>
				</div>
			</form>
		</div>
	);
};

AddStepForm.propTypes = {
	workflowId: PropTypes.number.isRequired,
};

export default AddStepForm;
