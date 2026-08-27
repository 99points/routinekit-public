import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import apiFetch from '@wordpress/api-fetch';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Modal from '../shared/Modal';
import Button from '../shared/Button';

const PushToSaasModal = ( { workflowId, pushedGroupIds = [], onClose, onPushed } ) => {
	const [ groups, setGroups ]           = useState( [] );
	const [ loading, setLoading ]         = useState( true );
	const [ pushing, setPushing ]         = useState( null ); // group id being pushed, or null
	const [ error, setError ]             = useState( null );
	const [ assignedIds, setAssignedIds ] = useState( pushedGroupIds.map( Number ) );

	const { fetchWorkflows } = useDispatch( 'stepwise/workflows' );

	useEffect( () => {
		apiFetch( { path: '/stepwise/v1/saas/groups' } )
			.then( ( res ) => setGroups( res.groups ?? [] ) )
			.catch( () => setError( __( 'Could not load groups.', 'stepwise' ) ) )
			.finally( () => setLoading( false ) );
	}, [] );

	const handlePush = async ( groupId ) => {
		if ( ! window.confirm( __( 'Push this workflow to all sites in the selected group? Steps will be locked and cannot be edited after pushing to the cloud.', 'stepwise' ) ) ) {
			return;
		}
		setPushing( groupId );
		setError( null );
		try {
			await apiFetch( {
				path:   `/stepwise/v1/saas/groups/${ groupId }/assign`,
				method: 'POST',
				data:   { workflow_id: workflowId },
			} );
			const next = [ ...assignedIds, Number( groupId ) ];
			setAssignedIds( next );
			await fetchWorkflows();
			onPushed();
		} catch ( err ) {
			setError( err.message ?? __( 'Push failed.', 'stepwise' ) );
		} finally {
			setPushing( null );
		}
	};

	return (
		<Modal
			title={ __( 'Assign to Group', 'stepwise' ) }
			onClose={ onClose }
			size="sm"
			footer={
				<Button variant="ghost" onClick={ onClose }>
					{ __( 'Close', 'stepwise' ) }
				</Button>
			}
		>
			<p className="ap-help" style={ { marginBottom: '16px' } }>
				{ __( 'Push this workflow to all sites in a group via the cloud.', 'stepwise' ) }
			</p>

			{ error && <p className="ap-error" style={ { marginBottom: '12px' } }>{ error }</p> }

			{ loading && <p>{ __( 'Loading groups…', 'stepwise' ) }</p> }

			{ ! loading && ! groups.length && (
				<div className="ap-push-no-groups">
					<p>{ __( 'This site is not in any groups yet.', 'stepwise' ) }</p>
					<p style={ { marginTop: '10px' } }>{ __( 'Groups are created and managed from your Stepwise Cloud dashboard. To push this workflow:', 'stepwise' ) }</p>
					<ol style={ { marginTop: '8px', paddingLeft: '18px', lineHeight: '1.9' } }>
						<li>{ __( 'Go to your Stepwise Cloud dashboard → Groups → create a group and add this site to it.', 'stepwise' ) }</li>
						<li>{ __( 'Come back here and open "Assign to Group" again.', 'stepwise' ) }</li>
					</ol>
				</div>
			) }

			{ ! loading && groups.length > 0 && (
				<div className="ap-push-groups">
					{ groups.map( ( g ) => {
						const isAssigned = assignedIds.includes( Number( g.id ) );
						const isBusy     = pushing === g.id;
						return (
							<div key={ g.id } className="ap-push-group-row">
								<span className="ap-push-group-row__name">{ g.name }</span>
								{ isAssigned ? (
									<span className="ap-push-group-row__assigned">
										{ __( 'Assigned ✓', 'stepwise' ) }
									</span>
								) : (
									<Button
										variant="secondary"
										disabled={ isBusy || pushing !== null }
										onClick={ () => handlePush( g.id ) }
									>
										{ isBusy ? __( 'Assigning…', 'stepwise' ) : __( 'Assign', 'stepwise' ) }
									</Button>
								) }
							</div>
						);
					} ) }
				</div>
			) }
		</Modal>
	);
};

PushToSaasModal.propTypes = {
	workflowId:     PropTypes.number.isRequired,
	pushedGroupIds: PropTypes.arrayOf( PropTypes.number ),
	onClose:        PropTypes.func.isRequired,
	onPushed:       PropTypes.func.isRequired,
};

export default PushToSaasModal;
