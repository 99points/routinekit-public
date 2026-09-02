import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Button from './Button';

const Modal = ( { title, children, onClose, footer, size = 'md' } ) => {
	const overlayRef = useRef( null );

	// Close on Escape
	useEffect( () => {
		const handler = ( e ) => {
			if ( e.key === 'Escape' ) onClose();
		};
		document.addEventListener( 'keydown', handler );
		return () => document.removeEventListener( 'keydown', handler );
	}, [ onClose ] );

	// Trap focus inside modal
	useEffect( () => {
		overlayRef.current?.querySelector( '.routinekit-modal' )?.focus();
	}, [] );

	return (
		<div
			ref={ overlayRef }
			className="routinekit-modal-overlay"
			role="dialog"
			aria-modal="true"
			aria-label={ title }
			onClick={ ( e ) => { if ( e.target === overlayRef.current ) onClose(); } }
		>
			<div className={ `routinekit-modal routinekit-modal--${ size }` } tabIndex="-1">
				<div className="routinekit-modal__header">
					<h2 className="routinekit-modal__title">{ title }</h2>
					<button className="routinekit-modal__close" onClick={ onClose } aria-label="Close modal">
						&times;
					</button>
				</div>

				<div className="routinekit-modal__body">
					{ children }
				</div>

				{ footer && (
					<div className="routinekit-modal__footer">
						{ footer }
					</div>
				) }
			</div>
		</div>
	);
};

Modal.propTypes = {
	title:    PropTypes.string.isRequired,
	children: PropTypes.node.isRequired,
	onClose:  PropTypes.func.isRequired,
	footer:   PropTypes.node,
	size:     PropTypes.oneOf( [ 'sm', 'md', 'lg' ] ),
};

export default Modal;
