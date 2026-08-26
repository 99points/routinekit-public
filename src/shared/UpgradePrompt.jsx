import PropTypes from 'prop-types';
import Button from './Button';

const UpgradePrompt = ( { feature, inline = false } ) => {
	const upgradeUrl = window.alignpressData?.upgradeUrl ?? '#';

	if ( inline ) {
		return (
			<span className="ap-upgrade-inline">
				<span className="alignpress-badge alignpress-badge--pro">PRO</span>{ ' ' }
				<a href={ upgradeUrl }>Upgrade to unlock</a>
			</span>
		);
	}

	return (
		<div className="ap-upgrade-prompt">
			<div className="ap-upgrade-prompt__icon">⭐</div>
			<h3 className="ap-upgrade-prompt__title">Pro Feature</h3>
			<p className="ap-upgrade-prompt__body">
				{ feature
					? `${ feature } is available on AlignPress Pro.`
					: 'This feature is available on AlignPress Pro.' }
			</p>
			<Button
				variant="primary"
				onClick={ () => ( window.location.href = upgradeUrl ) }
			>
				Upgrade to Pro
			</Button>
		</div>
	);
};

UpgradePrompt.propTypes = {
	feature: PropTypes.string,
	inline:  PropTypes.bool,
};

export default UpgradePrompt;
