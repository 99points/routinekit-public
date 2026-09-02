const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );
const webpack = require( 'webpack' );
const fs = require( 'fs' );

const CopyPlugin = require( 'copy-webpack-plugin' );

/**
 * Compile JSX with the classic runtime (React.createElement) instead of the
 * automatic one.
 *
 * The automatic runtime makes wp-scripts add 'react-jsx-runtime' to each
 * bundle's dependency list, but WordPress only registers that handle from 6.6
 * onward. On an older site the handle is unknown, WP_Dependencies silently
 * refuses to print the script *and its whole dependency chain*, and the admin
 * page renders blank with nothing in any log. The classic runtime resolves JSX
 * through the plain 'react' handle, which has existed for many releases, so the
 * bundle stays loadable down to our declared "Requires at least" floor.
 */
const useClassicJsxRuntime = ( rules ) =>
	rules.map( ( rule ) => {
		const loaders = rule.use ? [ rule.use ].flat() : [];
		const babel   = loaders.find(
			( l ) => typeof l === 'object' && l.loader && l.loader.includes( 'babel-loader' )
		);

		if ( ! babel ) {
			return rule;
		}

		// wp-scripts configures JSX inside @wordpress/babel-preset-default, so we
		// can't edit its options from out here. Appending preset-react in classic
		// mode wins instead: Babel merges presets of the same name, and the later
		// entry's options take precedence.
		const presets = [
			...( babel.options?.presets || [] ),
			[ require.resolve( '@babel/preset-react' ), { runtime: 'classic' } ],
		];

		return { ...rule, use: [ { ...babel, options: { ...babel.options, presets } } ] };
	} );

module.exports = {
	...defaultConfig,
	module: {
		...defaultConfig.module,
		rules: useClassicJsxRuntime( defaultConfig.module.rules ),
	},
	entry: {
		// Main admin bundle — Workflow Manager, Step Builder, Settings
		'routinekit-admin': path.resolve( __dirname, 'src/index.js' ),
		// Lightweight capture + runner bundle — loaded on every wp-admin page
		'routinekit-capture': path.resolve( __dirname, 'src/capture-entry.js' ),
	},
	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'assets/js' ),
		filename: '[name].js',
		// Resolve split-chunk URLs from the <script> tag that loaded the runtime,
		// so they work wherever the plugin directory lives. The alternative —
		// assigning __webpack_require__.p from an inline script — cannot work:
		// that variable is scoped inside the runtime's IIFE and is not a global.
		publicPath: 'auto',
		// Unique global so this plugin's chunks don't collide with other
		// wp-scripts builds (or with each other when both bundles are loaded).
		chunkLoadingGlobal: 'webpackChunkRoutinekit',
	},
	optimization: {
		...defaultConfig.optimization,
		// Single shared runtime chunk so both entry points use the same
		// chunk registry — avoids the two-runtime collision on SW admin pages.
		runtimeChunk: 'single',
	},
	plugins: [
		...( defaultConfig.plugins || [] ),
		// The classic JSX runtime compiles to React.createElement, which needs
		// React in scope. Injecting it here keeps the source files free of the
		// boilerplate `import React` line that the automatic runtime made optional.
		new webpack.ProvidePlugin( { React: 'react' } ),
		// Copy hand-authored vanilla JS files into assets/js so they survive
		// webpack's clean pass (which wipes the output directory on each build).
		new CopyPlugin( {
			patterns: [
				{ from: path.resolve( __dirname, 'src/vanilla/capture-watcher.js' ),  to: 'capture-watcher.js' },
				{ from: path.resolve( __dirname, 'src/vanilla/html2canvas.min.js' ),  to: 'html2canvas.min.js' },
			],
		} ),
		// Inject the ABSPATH guard into all generated .asset.php files so WordPress.org
		// review tools do not flag them as missing direct-access protection.
		{
			apply( compiler ) {
				compiler.hooks.afterEmit.tap( 'AbspathGuard', ( compilation ) => {
					const outDir = path.resolve( __dirname, 'assets/js' );
					fs.readdirSync( outDir )
						.filter( ( f ) => f.endsWith( '.asset.php' ) )
						.forEach( ( f ) => {
							const file = path.join( outDir, f );
							const src  = fs.readFileSync( file, 'utf8' );
							if ( ! src.includes( 'ABSPATH' ) ) {
								fs.writeFileSync( file, src.replace( '<?php ', "<?php defined( 'ABSPATH' ) || exit; " ) );
							}
						} );
				} );
			},
		},
	],
};
