import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { __ } from '@wordpress/i18n';

const { deeplinks = [] } = window.alignpressData ?? {};

const DeepLinkInput = ( { value, onChange } ) => {
	const [ open, setOpen ]     = useState( false );
	const [ query, setQuery ]   = useState( '' );
	const dropdownRef           = useRef( null );

	const filtered = query
		? deeplinks.filter( ( dl ) =>
			dl.label.toLowerCase().includes( query.toLowerCase() ) ||
			( dl.plugin ?? '' ).toLowerCase().includes( query.toLowerCase() )
		)
		: deeplinks;

	useEffect( () => {
		const handleClickOutside = ( e ) => {
			if ( dropdownRef.current && ! dropdownRef.current.contains( e.target ) ) {
				setOpen( false );
			}
		};
		if ( open ) document.addEventListener( 'mousedown', handleClickOutside );
		return () => document.removeEventListener( 'mousedown', handleClickOutside );
	}, [ open ] );

	const handleSelect = ( dl ) => {
		onChange( dl.url );
		setQuery( '' );
		setOpen( false );
	};

	const handleManualChange = ( e ) => {
		onChange( e.target.value );
	};

	return (
		<div className="ap-deeplink-input" ref={ dropdownRef }>
			<div className="ap-deeplink-input__row">
				<input
					type="url"
					className="alignpress-input"
					value={ value }
					onChange={ handleManualChange }
					placeholder="https://example.com/wp-admin/..."
				/>
				{ deeplinks.length > 0 && (
					<button
						type="button"
						className="alignpress-btn alignpress-btn--ghost alignpress-btn--sm ap-deeplink-input__picker"
						onClick={ () => setOpen( ( o ) => ! o ) }
						aria-label={ __( 'Browse deep-links', 'alignpress' ) }
					>
						{ __( 'Browse', 'alignpress' ) }
					</button>
				) }
			</div>

			{ open && (
				<div className="ap-deeplink-input__dropdown">
					<input
						type="text"
						className="alignpress-input ap-deeplink-input__search"
						value={ query }
						onChange={ ( e ) => setQuery( e.target.value ) }
						placeholder={ __( 'Search deep-links…', 'alignpress' ) }
						autoFocus
					/>
					<ul className="ap-deeplink-input__list">
						{ filtered.length === 0 && (
							<li className="ap-deeplink-input__empty">{ __( 'No results', 'alignpress' ) }</li>
						) }
						{ filtered.map( ( dl, i ) => (
							<li key={ i }>
								<button
									type="button"
									className="ap-deeplink-input__option"
									onClick={ () => handleSelect( dl ) }
								>
									<span className="ap-deeplink-input__option-label">{ dl.label }</span>
									{ dl.plugin && (
										<span className="ap-deeplink-input__option-plugin">{ dl.plugin }</span>
									) }
								</button>
							</li>
						) ) }
					</ul>
				</div>
			) }
		</div>
	);
};

DeepLinkInput.propTypes = {
	value:    PropTypes.string.isRequired,
	onChange: PropTypes.func.isRequired,
};

export default DeepLinkInput;
