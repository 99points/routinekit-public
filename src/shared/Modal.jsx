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
		overlayRef.current?.querySelector( '.stepwise-modal' )?.focus();
	}, [] );

	return (
		<div
			ref={ overlayRef }
			className="stepwise-modal-overlay"
			role="dialog"
			aria-modal="true"
			aria-label={ title }
			onClick={ ( e ) => { if ( e.target === overlayRef.current ) onClose(); } }
		>
			<div className={ `stepwise-modal stepwise-modal--${ size }` } tabIndex="-1">
				<div className="stepwise-modal__header">
					<h2 className="stepwise-modal__title">{ title }</h2>
					<button className="stepwise-modal__close" onClick={ onClose } aria-label="Close modal">
						&times;
					</button>
				</div>

				<div className="stepwise-modal__body">
					{ children }
				</div>

				{ footer && (
					<div className="stepwise-modal__footer">
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
