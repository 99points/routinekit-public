import { __ } from '@wordpress/i18n';

const EmptyState = () => (
	<div className="ap-empty-state">
		<div className="ap-empty-state__icon">📋</div>
		<h2 className="ap-empty-state__title">{ __( 'No workflows yet', 'routinekit' ) }</h2>
		<p className="ap-empty-state__body">
			{ __( 'Create your first workflow to start building reusable configuration checklists for your client sites.', 'routinekit' ) }
		</p>
	</div>
);

export default EmptyState;
