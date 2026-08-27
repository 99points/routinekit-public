import PropTypes from 'prop-types';

const VARIANTS = {
	primary:   'stepwise-btn stepwise-btn--primary',
	secondary: 'stepwise-btn stepwise-btn--secondary',
	ghost:     'stepwise-btn stepwise-btn--ghost',
	danger:    'stepwise-btn stepwise-btn--danger',
};

const Button = ( { children, variant = 'primary', size = '', disabled = false, onClick, type = 'button', className = '', ...rest } ) => {
	const cls = [
		VARIANTS[ variant ] ?? VARIANTS.primary,
		size ? `stepwise-btn--${ size }` : '',
		className,
	].filter( Boolean ).join( ' ' );

	return (
		<button
			type={ type }
			className={ cls }
			disabled={ disabled }
			onClick={ onClick }
			{ ...rest }
		>
			{ children }
		</button>
	);
};

Button.propTypes = {
	children:  PropTypes.node.isRequired,
	variant:   PropTypes.oneOf( [ 'primary', 'secondary', 'ghost', 'danger' ] ),
	size:      PropTypes.oneOf( [ '', 'sm', 'lg' ] ),
	disabled:  PropTypes.bool,
	onClick:   PropTypes.func,
	type:      PropTypes.string,
	className: PropTypes.string,
};

export default Button;
