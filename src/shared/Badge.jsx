import PropTypes from 'prop-types';

const Badge = ( { children, variant = 'default' } ) => (
	<span className={ `alignpress-badge alignpress-badge--${ variant }` }>{ children }</span>
);

Badge.propTypes = {
	children: PropTypes.node.isRequired,
	variant:  PropTypes.oneOf( [ 'default', 'active', 'draft', 'archived', 'pro' ] ),
};

export default Badge;
