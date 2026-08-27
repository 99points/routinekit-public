import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

const CapturedStepsPanel = ( { workflowId } ) => {
	const [ open, setOpen ]     = useState( true );
	const [ adding, setAdding ] = useState( null );

	const { fetchPendingCaptures, addToWorkflow } = useDispatch( 'stepwise/capture' );
	const { addStep, fetchSteps }                 = useDispatch( 'stepwise/steps' );
	const pendingChanges = useSelect( ( select ) => select( 'stepwise/capture' ).getPendingChanges() );

	useEffect( () => {
		fetchPendingCaptures();
	}, [] );

	const preview   = pendingChanges.slice( 0, 3 );
	const remaining = pendingChanges.length - preview.length;

	const handleAdd = async ( change ) => {
		setAdding( change.id );
		const stepTitle = change.option_label || change.option_name;
		const result    = await addToWorkflow( workflowId, [ change.id ], stepTitle );
		if ( result?.step ) {
			addStep( workflowId, result.step );
			// Re-fetch to ensure the step list is fully in sync.
			fetchSteps( workflowId );
		}
		setAdding( null );
	};

	const captureUrl = `${ window.stepwiseData?.adminUrl ?? '' }admin.php?page=stepwise-capture`;

	return (
		<div className="ap-sidebar-panel">
			<button
				className="ap-sidebar-panel__toggle"
				onClick={ () => setOpen( o => ! o ) }
				aria-expanded={ open }
			>
				<span className="ap-sidebar-panel__title">
					<span className={ `ap-capture-dot ${ pendingChanges.length > 0 ? 'ap-capture-dot--active' : '' }` } />
					{ __( 'WordPress Changes', 'stepwise' ) }
				</span>
				<span className="ap-sidebar-panel__chevron">{ open ? '∧' : '∨' }</span>
			</button>

			{ open && (
				<div className="ap-sidebar-panel__body">
					{ pendingChanges.length === 0 ? (
						<>
							<p className="ap-sidebar-panel__empty">
								{ __( 'No pending WordPress option changes detected.', 'stepwise' ) }
							</p>
							<p className="ap-sidebar-panel__help" style={ { marginTop: 4 } }>
								{ __( 'To add steps manually, use the ⊕ Capture Step button on any admin page.', 'stepwise' ) }
							</p>
						</>
					) : (
						<>
							<p className="ap-sidebar-panel__help">
								{ __( 'WordPress detected these setting changes — add them as steps:', 'stepwise' ) }
							</p>
							<ul className="ap-captured-list">
								{ preview.map( ( change ) => {
									const label    = change.option_label || change.option_name;
									const newVal   = change.new_value != null ? String( change.new_value ) : null;
									const truncate = ( s, n = 30 ) => s.length > n ? s.slice( 0, n ) + '…' : s;
									return (
										<li key={ change.id } className="ap-captured-list__item">
											<div className="ap-captured-list__info">
												<div className="ap-captured-list__label">{ label }</div>
												<div className="ap-captured-list__key">{ change.option_name }</div>
												{ newVal !== null && (
													<div className="ap-captured-list__value">
														{ '→ "' }{ truncate( newVal ) }{ '"' }
													</div>
												) }
											</div>
											<button
												className="stepwise-btn stepwise-btn--primary stepwise-btn--sm"
												onClick={ () => handleAdd( change ) }
												disabled={ adding === change.id }
											>
												{ adding === change.id ? '…' : __( '+ Add', 'stepwise' ) }
											</button>
										</li>
									);
								} ) }
							</ul>

							{ remaining > 0 && (
								<a href={ captureUrl } className="ap-captured-viewall">
									{ __( `View all ${ pendingChanges.length } captured changes →`, 'stepwise' ) }
								</a>
							) }
						</>
					) }
				</div>
			) }
		</div>
	);
};

CapturedStepsPanel.propTypes = {
	workflowId: PropTypes.number.isRequired,
};

export default CapturedStepsPanel;
