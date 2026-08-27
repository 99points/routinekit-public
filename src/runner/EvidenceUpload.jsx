import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { __ } from '@wordpress/i18n';

const ALLOWED_TYPES = [ 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf' ];
const MAX_MB        = 10;

const EvidenceUpload = ( { executionId, stepId, existingUrl, required, onUploaded } ) => {
	const [ uploading, setUploading ] = useState( false );
	const [ error, setError ]         = useState( null );
	const [ preview, setPreview ]     = useState( existingUrl ?? null );
	const inputRef                    = useRef( null );

	const handleFileChange = async ( e ) => {
		const file = e.target.files?.[ 0 ];
		if ( ! file ) return;

		setError( null );

		if ( ! ALLOWED_TYPES.includes( file.type ) ) {
			setError( __( 'Unsupported file type. Use JPEG, PNG, GIF, WebP, or PDF.', 'stepwise' ) );
			return;
		}
		if ( file.size > MAX_MB * 1024 * 1024 ) {
			setError( `${ __( 'File must be', 'stepwise' ) } ${ MAX_MB }MB ${ __( 'or smaller.', 'stepwise' ) }` );
			return;
		}

		setUploading( true );
		const formData = new FormData();
		formData.append( 'evidence', file );

		try {
			const res = await window.fetch(
				`${ window.stepwiseData?.restUrl ?? '/wp-json/stepwise/v1/' }executions/${ executionId }/steps/${ stepId }/evidence`,
				{
					method:  'POST',
					headers: { 'X-WP-Nonce': window.stepwiseData?.nonce ?? '' },
					body:    formData,
				}
			);
			if ( ! res.ok ) {
				const data = await res.json().catch( () => ( {} ) );
				throw new Error( data.message ?? __( 'Upload failed.', 'stepwise' ) );
			}
			const data = await res.json();
			setPreview( data.evidence_url );
			onUploaded?.( data );
		} catch ( err ) {
			setError( err.message );
		} finally {
			setUploading( false );
			if ( inputRef.current ) inputRef.current.value = '';
		}
	};

	const handleRemove = async () => {
		setUploading( true );
		try {
			await window.fetch(
				`${ window.stepwiseData?.restUrl ?? '/wp-json/stepwise/v1/' }executions/${ executionId }/steps/${ stepId }/evidence`,
				{
					method:  'DELETE',
					headers: { 'X-WP-Nonce': window.stepwiseData?.nonce ?? '' },
				}
			);
			setPreview( null );
			onUploaded?.( null );
		} catch {
			setError( __( 'Could not remove evidence.', 'stepwise' ) );
		} finally {
			setUploading( false );
		}
	};

	return (
		<div className="ap-evidence-upload">
			<span className="ap-evidence-upload__label">
				{ __( 'Attachment', 'stepwise' ) }
				{ required && <span className="ap-evidence-upload__required"> *</span> }
			</span>

			{ error && <p className="ap-evidence-upload__error">{ error }</p> }

			{ preview ? (
				<div className="ap-evidence-upload__preview">
					{ /\.(jpg|jpeg|png|gif|webp)$/i.test( preview ) ? (
						<img src={ preview } alt={ __( 'Evidence', 'stepwise' ) } className="ap-evidence-upload__img" />
					) : (
						<a href={ preview } target="_blank" rel="noopener noreferrer" className="ap-evidence-upload__file-link">
							{ __( 'View uploaded evidence', 'stepwise' ) }
						</a>
					) }
					<button
						type="button"
						className="stepwise-btn stepwise-btn--ghost stepwise-btn--sm ap-evidence-upload__remove"
						onClick={ handleRemove }
						disabled={ uploading }
					>
						{ __( 'Remove', 'stepwise' ) }
					</button>
				</div>
			) : (
				<label className="ap-evidence-upload__pick">
					<input
						ref={ inputRef }
						type="file"
						accept={ ALLOWED_TYPES.join( ',' ) }
						onChange={ handleFileChange }
						disabled={ uploading }
						className="ap-evidence-upload__input"
					/>
					<span className="stepwise-btn stepwise-btn--secondary stepwise-btn--sm">
						{ uploading ? __( 'Uploading…', 'stepwise' ) : __( 'Upload screenshot or PDF', 'stepwise' ) }
					</span>
				</label>
			) }
		</div>
	);
};

EvidenceUpload.propTypes = {
	executionId: PropTypes.number.isRequired,
	stepId:      PropTypes.number.isRequired,
	existingUrl: PropTypes.string,
	required:    PropTypes.bool,
	onUploaded:  PropTypes.func,
};

EvidenceUpload.defaultProps = {
	existingUrl: null,
	required:    false,
	onUploaded:  null,
};

export default EvidenceUpload;
