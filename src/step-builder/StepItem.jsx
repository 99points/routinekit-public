import { useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Button from '../shared/Button';
import DeepLinkInput from './DeepLinkInput';

const StepItem = ( { step, workflowId, index, total, onMoveUp, onMoveDown, canEdit = false } ) => {
	const [ editing, setEditing ]         = useState( false );
	const [ titleDraft, setTitle ]        = useState( step.title );
	const [ instructionsDraft, setInstr ] = useState( step.description ?? '' );
	const [ deepLinkDraft, setDeepLink ]  = useState( step.deep_link ?? '' );
	const [ required, setRequired ]       = useState( step.is_required ?? true );
	const [ saving, setSaving ]           = useState( false );
	const [ deleting, setDeleting ]       = useState( false );

	const { saveStep, deleteStep } = useDispatch( 'alignpress/steps' );

	const handleSave = async () => {
		setSaving( true );
		await saveStep( workflowId, step.id, {
			title:       titleDraft.trim(),
			description: instructionsDraft,
			deep_link:   deepLinkDraft,
			is_required: required,
		} );
		setSaving( false );
		setEditing( false );
	};

	const handleCancel = () => {
		setTitle( step.title );
		setInstr( step.description ?? '' );
		setDeepLink( step.deep_link ?? '' );
		setRequired( step.is_required ?? true );
		setEditing( false );
	};

	const handleDelete = async () => {
		if ( ! window.confirm( __( 'Delete this step? This cannot be undone.', 'alignpress' ) ) ) return;
		setDeleting( true );
		await deleteStep( workflowId, step.id );
	};

	return (
		<li className={ `ap-step-item ${ editing ? 'ap-step-item--editing' : '' }` }>
			<div className="ap-step-item__drag-handle">
				<span className="dashicons dashicons-menu" aria-hidden="true" />
			</div>

			<div className="ap-step-item__index">{ index + 1 }</div>

			<div className="ap-step-item__body">
				{ editing ? (
					<div className="ap-step-item__edit-form">
						<div className="ap-field">
							<label className="alignpress-label">{ __( 'Step Title', 'alignpress' ) }</label>
							<input
								type="text"
								className="alignpress-input"
								value={ titleDraft }
								onChange={ ( e ) => setTitle( e.target.value ) }
								autoFocus
							/>
						</div>

						<div className="ap-field">
							<label className="alignpress-label">{ __( 'Instructions', 'alignpress' ) }</label>
							<textarea
								className="alignpress-input ap-textarea"
								value={ instructionsDraft }
								onChange={ ( e ) => setInstr( e.target.value ) }
								placeholder={ __( 'Optional step instructions or notes…', 'alignpress' ) }
								rows={ 3 }
							/>
						</div>

						<div className="ap-field">
							<label className="alignpress-label">{ __( 'Deep Link (where to perform this step)', 'alignpress' ) }</label>
							<DeepLinkInput value={ deepLinkDraft } onChange={ setDeepLink } />
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

						<div className="ap-step-item__edit-actions">
							<Button variant="primary" size="sm" onClick={ handleSave } disabled={ saving || ! titleDraft.trim() }>
								{ saving ? __( 'Saving…', 'alignpress' ) : __( 'Save Step', 'alignpress' ) }
							</Button>
							<Button variant="ghost" size="sm" onClick={ handleCancel }>
								{ __( 'Cancel', 'alignpress' ) }
							</Button>
						</div>
					</div>
				) : (
					<div className="ap-step-item__display">
						<div className="ap-step-item__title">{ step.title }</div>
						{ step.description && (
							<p className="ap-step-item__instructions">{ step.description }</p>
						) }
						{ step.deep_link && (
							<a
								href={ step.deep_link }
								className="ap-step-item__deeplink"
								target="_blank"
								rel="noopener noreferrer"
							>
								{ step.deep_link }
							</a>
						) }
						{ step.captured_options && (
							<span className="ap-step-item__captured-badge">
								{ __( 'Captured', 'alignpress' ) }
							</span>
						) }
					</div>
				) }
			</div>

			{ ! editing && canEdit && (
				<div className="ap-step-item__actions">
					<Button variant="ghost" size="sm" onClick={ () => setEditing( true ) }>
						{ __( 'Edit', 'alignpress' ) }
					</Button>
					<Button variant="ghost" size="sm" onClick={ onMoveUp } disabled={ index === 0 }>
						↑
					</Button>
					<Button variant="ghost" size="sm" onClick={ onMoveDown } disabled={ index === total - 1 }>
						↓
					</Button>
					<Button variant="danger" size="sm" onClick={ handleDelete } disabled={ deleting }>
						{ deleting ? '…' : __( 'Delete', 'alignpress' ) }
					</Button>
				</div>
			) }
		</li>
	);
};

StepItem.propTypes = {
	step:        PropTypes.object.isRequired,
	workflowId:  PropTypes.number.isRequired,
	index:       PropTypes.number.isRequired,
	total:       PropTypes.number.isRequired,
	onMoveUp:    PropTypes.func.isRequired,
	onMoveDown:  PropTypes.func.isRequired,
	canEdit:     PropTypes.bool,
};

export default StepItem;
