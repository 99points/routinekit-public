import PropTypes from 'prop-types';

const VARIANTS = {
	primary:   'alignpress-btn alignpress-btn--primary',
	secondary: 'alignpress-btn alignpress-btn--secondary',
	ghost:     'alignpress-btn alignpress-btn--ghost',
	danger:    'alignpress-btn alignpress-btn--danger',
};

const Button = ( { children, variant = 'primary', size = '', disabled = false, onClick, type = 'button', className = '', ...rest } ) => {
	const cls = [
		VARIANTS[ variant ] ?? VARIANTS.primary,
		size ? `alignpress-btn--${ size }` : '',
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
