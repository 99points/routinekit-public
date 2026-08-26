import { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Button from '../shared/Button';
import DeepLinkInput from './DeepLinkInput';

const AddStepForm = ( { workflowId } ) => {
	const [ open, setOpen ]       = useState( false );
	const [ title, setTitle ]     = useState( '' );
	const [ instr, setInstr ]     = useState( '' );
	const [ deepLink, setDeepLink ] = useState( '' );
	const [ required, setRequired ] = useState( true );

	const { createStep } = useDispatch( 'alignpress/steps' );
	const isSaving = useSelect( ( select ) => select( 'alignpress/steps' ).isSaving() );

	const handleSubmit = async ( e ) => {
		e.preventDefault();
		if ( ! title.trim() ) return;

		await createStep( workflowId, {
			title:       title.trim(),
			description: instr,
			deep_link:   deepLink,
			is_required: required,
		} );

		setTitle( '' );
		setInstr( '' );
		setDeepLink( '' );
		setRequired( true );
		setOpen( false );
	};

	if ( ! open ) {
		return (
			<div className="ap-add-step">
				<Button variant="secondary" onClick={ () => setOpen( true ) }>
					+ { __( 'Add Step', 'alignpress' ) }
				</Button>
			</div>
		);
	}

	return (
		<div className="ap-add-step ap-add-step--open">
			<h3 className="ap-add-step__title">{ __( 'New Step', 'alignpress' ) }</h3>
			<form onSubmit={ handleSubmit }>
				<div className="ap-field">
					<label className="alignpress-label" htmlFor="ap-new-step-title">
						{ __( 'Title', 'alignpress' ) }
						<span className="ap-required" aria-hidden="true"> *</span>
					</label>
					<input
						id="ap-new-step-title"
						type="text"
						className="alignpress-input"
						value={ title }
						onChange={ ( e ) => setTitle( e.target.value ) }
						placeholder={ __( 'e.g. Install security plugin', 'alignpress' ) }
						autoFocus
						required
					/>
				</div>

				<div className="ap-field">
					<label className="alignpress-label" htmlFor="ap-new-step-instr">
						{ __( 'Instructions', 'alignpress' ) }
					</label>
					<textarea
						id="ap-new-step-instr"
						className="alignpress-input ap-textarea"
						value={ instr }
						onChange={ ( e ) => setInstr( e.target.value ) }
						placeholder={ __( 'Optional notes for the person running this step…', 'alignpress' ) }
						rows={ 2 }
					/>
				</div>

				<div className="ap-field">
					<label className="alignpress-label">{ __( 'Deep Link', 'alignpress' ) }</label>
					<DeepLinkInput value={ deepLink } onChange={ setDeepLink } />
				</div>

				<div className="ap-field ap-field--inline">
					<label className="alignpress-label">
						<input
							type="checkbox"
							checked={ required }
							onChange={ ( e ) => setRequired( e.target.checked ) }
						/>
						{ ' ' }{ __( 'Required step', 'alignpress' ) }
					</label>
				</div>

				<div className="ap-add-step__actions">
					<Button variant="primary" type="submit" disabled={ ! title.trim() || isSaving }>
						{ isSaving ? __( 'Adding…', 'alignpress' ) : __( 'Add Step', 'alignpress' ) }
					</Button>
					<Button variant="ghost" type="button" onClick={ () => setOpen( false ) }>
						{ __( 'Cancel', 'alignpress' ) }
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
