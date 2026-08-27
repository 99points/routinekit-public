import { useEffect, useRef, useState } from 'react';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

const SavedToast = () => {
	const [ visible, setVisible ] = useState( false );
	const timerRef = useRef( null );

	const isSavingWorkflow = useSelect( ( select ) => select( 'stepwise/workflows' ).isSaving() );
	const isSavingStep     = useSelect( ( select ) => select( 'stepwise/steps' ).isSaving() );
	const wasSaving = useRef( false );

	useEffect( () => {
		const saving = isSavingWorkflow || isSavingStep;
		if ( wasSaving.current && ! saving ) {
			setVisible( true );
			clearTimeout( timerRef.current );
			timerRef.current = setTimeout( () => setVisible( false ), 2500 );
		}
		wasSaving.current = saving;
	}, [ isSavingWorkflow, isSavingStep ] );

	useEffect( () => () => clearTimeout( timerRef.current ), [] );

	if ( ! visible ) return null;

	return (
		<div className="ap-saved-toast" role="status" aria-live="polite">
			<span className="ap-saved-toast__icon">✓</span>
			{ __( 'Saved', 'stepwise' ) }
		</div>
	);
};

export default SavedToast;
