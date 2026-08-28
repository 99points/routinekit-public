<?php
defined( 'ABSPATH' ) || exit;

/**
 * Bundled starter workflow templates loader.
 *
 * Reads JSON files from /templates/ and imports them as workflows + steps.
 */
class Stepwise_Templates {

	/**
	 * Return a list of all available template keys and metadata.
	 *
	 * @return array[]
	 */
	public static function get_available(): array {
		$templates = [];
		$dir       = STEPWISE_TEMPLATES_DIR;

		if ( ! is_dir( $dir ) ) {
			return $templates;
		}

		foreach ( glob( $dir . '*.json' ) as $file ) {
			$data = self::read_file( $file );
			if ( $data ) {
				$templates[] = [
					'key'         => $data['template_key'],
					'title'       => $data['title'],
					'description' => $data['description'] ?? '',
					'step_count'  => count( $data['steps'] ?? [] ),
				];
			}
		}

		return $templates;
	}

	/**
	 * Return all local templates with full step data, shaped for the template picker API response.
	 * Each item matches the shape the TemplatePickerModal expects (id, title, description, steps, source, plan).
	 *
	 * @return array[]
	 */
	public static function get_available_with_steps(): array {
		$templates = [];
		$dir       = STEPWISE_TEMPLATES_DIR;

		if ( ! is_dir( $dir ) ) {
			return $templates;
		}

		foreach ( glob( $dir . '*.json' ) as $file ) {
			$data = self::read_file( $file );
			if ( $data ) {
				$templates[] = [
					'id'          => $data['template_key'],
					'title'       => $data['title'],
					'description' => $data['description'] ?? '',
					'category'    => $data['category'] ?? '',
					'steps'       => $data['steps'] ?? [],
					'source'      => 'local',
					'plan'        => 'free',
				];
			}
		}

		return $templates;
	}

	/**
	 * Import a template by key. Creates a workflow + steps in the DB.
	 *
	 * @param string $template_key
	 * @return Stepwise_Workflow|WP_Error
	 */
	public static function import( string $template_key ) {
		$file = STEPWISE_TEMPLATES_DIR . sanitize_file_name( $template_key ) . '.json';

		if ( ! file_exists( $file ) ) {
			return new WP_Error( 'stepwise_not_found', __( 'Template not found.', 'stepwise' ) );
		}

		$data = self::read_file( $file );
		if ( ! $data ) {
			return new WP_Error( 'stepwise_invalid', __( 'Template file is invalid JSON.', 'stepwise' ) );
		}

		$workflow = Stepwise_Workflow::create( [
			'title'        => $data['title'],
			'description'  => $data['description'] ?? '',
			'status'       => 'active',
			'source'       => 'local',
			'template_key' => $data['template_key'],
			'created_by'   => get_current_user_id(),
		] );

		if ( is_wp_error( $workflow ) ) {
			return $workflow;
		}

		foreach ( $data['steps'] as $step_data ) {
			Stepwise_Step::create( array_merge( $step_data, [ 'workflow_id' => $workflow->id ] ) );
		}

		return $workflow;
	}

	/**
	 * Read and decode a JSON template file.
	 *
	 * @param string $file
	 * @return array|null
	 */
	private static function read_file( string $file ): ?array {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading bundled plugin files, not remote URLs
		$raw = file_get_contents( $file );
		if ( false === $raw ) {
			return null;
		}
		$data = json_decode( $raw, true );
		return is_array( $data ) ? $data : null;
	}
}
