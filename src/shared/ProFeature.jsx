import PropTypes from 'prop-types';
import UpgradePrompt from './UpgradePrompt';

/**
 * Wrap any Pro-only UI with this component.
 * Renders children for Pro users; renders an upgrade prompt for free users.
 * Never duplicate this gate logic elsewhere.
 *
 * Usage:
 *   <ProFeature feature="Evidence Capture">
 *     <EvidenceCapture step={step} />
 *   </ProFeature>
 */
const ProFeature = ( { children, feature, inline = false } ) => {
	const isPro = window.stepwiseData?.isPro ?? false;

	if ( isPro ) {
		return children;
	}

	return <UpgradePrompt feature={ feature } inline={ inline } />;
};

ProFeature.propTypes = {
	children: PropTypes.node.isRequired,
	feature:  PropTypes.string,
	inline:   PropTypes.bool,
};

export default ProFeature;
