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
			setError( __( 'Unsupported file type. Use JPEG, PNG, GIF, WebP, or PDF.', 'alignpress' ) );
			return;
		}
		if ( file.size > MAX_MB * 1024 * 1024 ) {
			setError( `${ __( 'File must be', 'alignpress' ) } ${ MAX_MB }MB ${ __( 'or smaller.', 'alignpress' ) }` );
			return;
		}

		setUploading( true );
		const formData = new FormData();
		formData.append( 'evidence', file );

		try {
			const res = await window.fetch(
				`${ window.alignpressData?.restUrl ?? '/wp-json/alignpress/v1/' }executions/${ executionId }/steps/${ stepId }/evidence`,
				{
					method:  'POST',
					headers: { 'X-WP-Nonce': window.alignpressData?.nonce ?? '' },
					body:    formData,
				}
			);
			if ( ! res.ok ) {
				const data = await res.json().catch( () => ( {} ) );
				throw new Error( data.message ?? __( 'Upload failed.', 'alignpress' ) );
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
				`${ window.alignpressData?.restUrl ?? '/wp-json/alignpress/v1/' }executions/${ executionId }/steps/${ stepId }/evidence`,
				{
					method:  'DELETE',
					headers: { 'X-WP-Nonce': window.alignpressData?.nonce ?? '' },
				}
			);
			setPreview( null );
			onUploaded?.( null );
		} catch {
			setError( __( 'Could not remove evidence.', 'alignpress' ) );
		} finally {
			setUploading( false );
		}
	};

	return (
		<div className="ap-evidence-upload">
			<span className="ap-evidence-upload__label">
				{ __( 'Attachment', 'alignpress' ) }
				{ required && <span className="ap-evidence-upload__required"> *</span> }
			</span>

			{ error && <p className="ap-evidence-upload__error">{ error }</p> }

			{ preview ? (
				<div className="ap-evidence-upload__preview">
					{ /\.(jpg|jpeg|png|gif|webp)$/i.test( preview ) ? (
						<img src={ preview } alt={ __( 'Evidence', 'alignpress' ) } className="ap-evidence-upload__img" />
					) : (
						<a href={ preview } target="_blank" rel="noopener noreferrer" className="ap-evidence-upload__file-link">
							{ __( 'View uploaded evidence', 'alignpress' ) }
						</a>
					) }
					<button
						type="button"
						className="alignpress-btn alignpress-btn--ghost alignpress-btn--sm ap-evidence-upload__remove"
						onClick={ handleRemove }
						disabled={ uploading }
					>
						{ __( 'Remove', 'alignpress' ) }
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
					<span className="alignpress-btn alignpress-btn--secondary alignpress-btn--sm">
						{ uploading ? __( 'Uploading…', 'alignpress' ) : __( 'Upload screenshot or PDF', 'alignpress' ) }
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
