import PropTypes from 'prop-types';
import { __ } from '@wordpress/i18n';

const RunnerProgress = ( { current, total, completed } ) => {
	const pct = total > 0 ? Math.round( ( completed / total ) * 100 ) : 0;

	return (
		<div className="ap-runner-progress">
			<div className="ap-runner-progress__bar-wrap">
				<div
					className="ap-runner-progress__bar"
					style={ { width: `${ pct }%` } }
					role="progressbar"
					aria-valuenow={ pct }
					aria-valuemin={ 0 }
					aria-valuemax={ 100 }
				/>
			</div>
			<div className="ap-runner-progress__label">
				<span>
					{ __( 'Step', 'stepwise' ) }{ ' ' }{ current }{ ' ' }{ __( 'of', 'stepwise' ) }{ ' ' }{ total }
				</span>
				<span>{ pct }%</span>
			</div>
		</div>
	);
};

RunnerProgress.propTypes = {
	current:   PropTypes.number.isRequired,
	total:     PropTypes.number.isRequired,
	completed: PropTypes.number.isRequired,
};

export default RunnerProgress;
