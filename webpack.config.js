const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

const CopyPlugin = require( 'copy-webpack-plugin' );

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
	plugins: [
		...( defaultConfig.plugins || [] ),
		// Copy hand-authored vanilla JS files into assets/js so they survive
		// webpack's clean pass (which wipes the output directory on each build).
		new CopyPlugin( {
			patterns: [
				{ from: path.resolve( __dirname, 'src/vanilla/capture-watcher.js' ),  to: 'capture-watcher.js' },
				{ from: path.resolve( __dirname, 'src/vanilla/html2canvas.min.js' ),  to: 'html2canvas.min.js' },
			],
		} ),
	],
};
