jQuery( function ( $ ) {
	function dismissNotice( key ) {
		var nonce = haayalNoticesData.nonces[ key ];
		if ( ! nonce ) {
			return;
		}
		$.post( ajaxurl, {
			action:    'haayal_dismiss_notice',
			key:       key,
			_wpnonce:  nonce,
		} );
	}

	$( document ).on( 'click', '.haayal-notes-review-notice .notice-dismiss', function () {
		dismissNotice( 'review' );
	} );

	$( document ).on( 'click', '.haayal-notes-activation-notice .notice-dismiss', function () {
		dismissNotice( 'activation' );
	} );
} );
