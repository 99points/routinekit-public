import PropTypes from 'prop-types';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import StepItem from './StepItem';

const StepList = ( { workflowId, steps, canEdit = false } ) => {
	const { reorderSteps } = useDispatch( 'alignpress/steps' );

	const handleMove = ( fromIndex, toIndex ) => {
		if ( toIndex < 0 || toIndex >= steps.length ) return;
		const reordered = [ ...steps ];
		const [ moved ]  = reordered.splice( fromIndex, 1 );
		reordered.splice( toIndex, 0, moved );

		const orderMap = reordered.map( ( step, i ) => ( {
			id:         step.id,
			sort_order: ( i + 1 ) * 10,
		} ) );

		reorderSteps( workflowId, orderMap );
	};

	if ( ! steps.length ) {
		return (
			<p className="ap-step-list__empty">
				{ __( 'No steps yet. Add your first step below.', 'alignpress' ) }
			</p>
		);
	}

	return (
		<ol className="ap-step-list">
			{ steps.map( ( step, index ) => (
				<StepItem
					key={ step.id }
					step={ step }
					workflowId={ workflowId }
					index={ index }
					total={ steps.length }
					onMoveUp={ () => handleMove( index, index - 1 ) }
					onMoveDown={ () => handleMove( index, index + 1 ) }
					canEdit={ canEdit }
				/>
			) ) }
		</ol>
	);
};

StepList.propTypes = {
	workflowId: PropTypes.number.isRequired,
	steps:      PropTypes.arrayOf( PropTypes.object ).isRequired,
	canEdit:    PropTypes.bool,
};

export default StepList;
