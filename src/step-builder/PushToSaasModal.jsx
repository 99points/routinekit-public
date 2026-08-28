import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import apiFetch from '@wordpress/api-fetch';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Modal from '../shared/Modal';
import Button from '../shared/Button';

const PushToSaasModal = ( { workflowId, pushedGroupIds = [], onClose, onPushed } ) => {
	const [ pushing, setPushing ]     = useState( false );
	const [ error, setError ]         = useState( null );
	const [ allGroups, setAllGroups ] = useState( [] );

	const { fetchWorkflows } = useDispatch( 'stepwise/workflows' );

	const groupIds  = pushedGroupIds.map( Number );
	const hasGroups = groupIds.length > 0;

	useEffect( () => {
		if ( ! hasGroups ) return;
		apiFetch( { path: '/stepwise/v1/saas/groups' } )
			.then( ( res ) => setAllGroups( res.groups ?? [] ) )
			.catch( () => {} );
	}, [] );

	const doPush = async () => {
		setPushing( true );
		setError( null );
		try {
			for ( const groupId of groupIds ) {
				await apiFetch( {
					path:   `/stepwise/v1/saas/groups/${ groupId }/assign`,
					method: 'POST',
					data:   { workflow_id: workflowId },
				} );
			}
			await fetchWorkflows();
			onPushed();
			onClose();
		} catch ( err ) {
			setError( err.message ?? __( 'Push failed.', 'stepwise' ) );
			setPushing( false );
		}
	};

	// No groups assigned yet
	if ( ! hasGroups ) {
		return (
			<Modal
				title={ __( 'Push to Cloud', 'stepwise' ) }
				onClose={ onClose }
				size="sm"
				footer={
					<Button variant="ghost" onClick={ onClose }>
						{ __( 'Close', 'stepwise' ) }
					</Button>
				}
			>
				<p style={ { marginBottom: '10px' } }>
					{ __( 'No groups assigned to this workflow yet.', 'stepwise' ) }
				</p>
				<p style={ { fontSize: '13px', color: '#555' } }>
					{ __( 'Open the workflow in the step builder, use the "Assign to Group" panel to tag which groups should receive it, then come back and push.', 'stepwise' ) }
				</p>
			</Modal>
		);
	}

	return (
		<Modal
			title={ __( 'Before you push…', 'stepwise' ) }
			onClose={ onClose }
			size="sm"
			footer={
				<>
					<Button variant="ghost" onClick={ onClose } disabled={ pushing }>
						{ __( 'Cancel', 'stepwise' ) }
					</Button>
					<Button variant="primary" onClick={ doPush } disabled={ pushing }>
						{ pushing ? __( 'Pushing…', 'stepwise' ) : __( 'Yes, push it', 'stepwise' ) }
					</Button>
				</>
			}
		>
			<p style={ { marginBottom: '12px' } }>
				{ __( 'Make sure your workflow is finalised before pushing. Once pushed to the cloud:', 'stepwise' ) }
			</p>
			<ul style={ { paddingLeft: '20px', marginBottom: '12px', lineHeight: 1.7 } }>
				<li>{ __( 'You cannot add, remove, or reorder steps', 'stepwise' ) }</li>
				<li>{ __( 'Step titles and settings are locked', 'stepwise' ) }</li>
			</ul>
			<p style={ { color: '#16a34a', fontSize: '13px', marginBottom: '16px' } }>
				{ __( '✓ You can still run the workflow, complete steps, and add notes normally.', 'stepwise' ) }
			</p>
			<p style={ { fontSize: '13px', color: '#555', marginBottom: '6px' } }>
				{ __( 'Will be pushed to:', 'stepwise' ) }
			</p>
			<ul style={ { paddingLeft: '20px', lineHeight: 1.8, fontSize: '13px' } }>
				{ groupIds.map( ( id ) => {
					const name = allGroups.find( ( g ) => Number( g.id ) === id )?.name;
					return <li key={ id }>{ name ?? `#${ id }` }</li>;
				} ) }
			</ul>
			{ error && <p style={ { color: '#dc2626', fontSize: '13px', marginTop: '12px' } }>{ error }</p> }
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
