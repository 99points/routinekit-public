/**
 * Deep-link helpers.
 *
 * Deep links are stored relative to wp-admin — "admin.php?page=x",
 * "options-general.php" — matching the built-in library format in
 * class-ap-deeplinks.php. They must be resolved against adminUrl before use as
 * an href: a bare relative value resolves against the *current* page instead,
 * so on a subdirectory install "wordpress/wp-admin/admin.php" is read as the
 * host "wordpress".
 *
 * Absolute URLs are passed through untouched — users may paste a full URL into
 * the deep-link field by hand, and steps imported from another site can carry
 * one.
 */

/** Matches an absolute http(s) URL. */
const ABSOLUTE = /^https?:\/\//i;

/**
 * Reject anything that is not http(s) — notably javascript: and data: URLs,
 * which must never reach an href.
 *
 * @param {string} url
 * @return {boolean}
 */
export const isSafeUrl = ( url ) =>
	typeof url === 'string' && ABSOLUTE.test( url.trim() );

/**
 * Turn a stored deep link into a usable absolute href.
 *
 * @param {string} deepLink Admin-relative deep link, or an absolute URL.
 * @return {string} Absolute URL, or '' when the value is unusable.
 */
export const resolveDeepLink = ( deepLink ) => {
	if ( typeof deepLink !== 'string' ) {
		return '';
	}

	const value = deepLink.trim();
	if ( ! value ) {
		return '';
	}

	// Already absolute — only allow http(s) through.
	if ( value.includes( '://' ) || value.startsWith( '//' ) ) {
		return isSafeUrl( value ) ? value : '';
	}

	// A scheme-like prefix that is not http(s) (javascript:, data:, mailto:).
	if ( /^[a-z][a-z0-9+.-]*:/i.test( value ) ) {
		return '';
	}

	const adminUrl = window.routinekitData?.adminUrl ?? '';
	if ( ! adminUrl ) {
		return '';
	}

	return adminUrl.replace( /\/?$/, '/' ) + value.replace( /^\/+/, '' );
};
