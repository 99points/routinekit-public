import PropTypes from 'prop-types';

const Toggle = ( { checked, onChange, label, id } ) => (
	<label className="stepwise-toggle" htmlFor={ id }>
		<span className="stepwise-toggle__switch">
			<input
				id={ id }
				type="checkbox"
				className="stepwise-toggle__input"
				checked={ checked }
				onChange={ ( e ) => onChange( e.target.checked ) }
			/>
			<span className="stepwise-toggle__track" aria-hidden="true" />
		</span>
		{ label && <span className="stepwise-toggle__label">{ label }</span> }
	</label>
);

Toggle.propTypes = {
	checked:  PropTypes.bool.isRequired,
	onChange: PropTypes.func.isRequired,
	label:    PropTypes.string,
	id:       PropTypes.string.isRequired,
};

export default Toggle;
