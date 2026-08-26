import PropTypes from 'prop-types';
import { __ } from '@wordpress/i18n';

const { runnerPosition = 'right' } = window.alignpressData ?? {};

const RunnerLauncher = ( { hasActive, isOpen, onClick, progress } ) => {
	const posClass = runnerPosition === 'left'
		? 'ap-runner-launcher--left'
		: 'ap-runner-launcher--right';

	return (
		<button
			type="button"
			className={ `ap-runner-launcher ${ posClass } ${ hasActive ? 'ap-runner-launcher--active' : '' }` }
			onClick={ onClick }
			aria-label={ isOpen
				? __( 'Minimise runner', 'alignpress' )
				: __( 'Open runner', 'alignpress' ) }
			title={ hasActive
				? __( 'AlignPress Runner — workflow in progress', 'alignpress' )
				: __( 'AlignPress Runner', 'alignpress' ) }
		>
			<span className="ap-runner-launcher__icon" aria-hidden="true">
				{ hasActive ? (
					<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
						<path d="M6 4.5l7 4.5-7 4.5V4.5z" fill="currentColor"/>
					</svg>
				) : (
					<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
						<path d="M4 9l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
					</svg>
				) }
			</span>
			{ hasActive && progress && (
				<span className="ap-runner-launcher__progress">{ progress }</span>
			) }
		</button>
	);
};

RunnerLauncher.propTypes = {
	hasActive: PropTypes.bool.isRequired,
	isOpen:    PropTypes.bool,
	onClick:   PropTypes.func.isRequired,
	progress:  PropTypes.string,
};

RunnerLauncher.defaultProps = {
	isOpen:   false,
	progress: null,
};

export default RunnerLauncher;
