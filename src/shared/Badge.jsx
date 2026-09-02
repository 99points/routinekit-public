import PropTypes from 'prop-types';

const Badge = ( { children, variant = 'default' } ) => (
	<span className={ `routinekit-badge routinekit-badge--${ variant }` }>{ children }</span>
);

Badge.propTypes = {
	children: PropTypes.node.isRequired,
	variant:  PropTypes.oneOf( [ 'default', 'active', 'draft', 'archived', 'pro', 'pushed' ] ),
};

export default Badge;
