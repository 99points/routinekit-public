const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

module.exports = {
	...defaultConfig,
	entry: {
		// Main admin bundle — Workflow Manager, Step Builder, Settings
		'alignpress-admin': path.resolve( __dirname, 'src/index.js' ),
		// Lightweight capture + runner bundle — loaded on every wp-admin page
		'alignpress-capture': path.resolve( __dirname, 'src/capture-entry.js' ),
	},
	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'assets/js' ),
		filename: '[name].js',
		// Unique global so this plugin's chunks don't collide with other
		// wp-scripts builds (or with each other when both bundles are loaded).
		chunkLoadingGlobal: 'webpackChunkAlignPress',
	},
	optimization: {
		...defaultConfig.optimization,
		// Single shared runtime chunk so both entry points use the same
		// chunk registry — avoids the two-runtime collision on AP admin pages.
		runtimeChunk: 'single',
	},
};
