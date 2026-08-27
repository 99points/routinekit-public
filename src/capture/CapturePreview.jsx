import PropTypes from 'prop-types';
import { __ } from '@wordpress/i18n';

const CapturePreview = ( { changes } ) => {
	if ( ! changes.length ) return null;

	return (
		<div className="ap-capture-preview">
			<p className="ap-capture-preview__heading">
				{ __( 'Detected changes:', 'stepwise' ) }
			</p>
			<ul className="ap-capture-preview__list">
				{ changes.map( ( change, i ) => (
					<li key={ change.id ?? i } className="ap-capture-preview__item">
						<span className="ap-capture-preview__page">
							{ change.page_title || change.page_url }
						</span>
						{ change.option_names?.length > 0 && (
							<span className="ap-capture-preview__options">
								{ change.option_names.join( ', ' ) }
							</span>
						) }
					</li>
				) ) }
			</ul>
		</div>
	);
};

CapturePreview.propTypes = {
	changes: PropTypes.arrayOf( PropTypes.object ).isRequired,
};

export default CapturePreview;
