import { useEffect, useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Modal from '../shared/Modal';
import Button from '../shared/Button';


const TemplatePickerModal = ( { onClose } ) => {
	const [ templates, setTemplates ] = useState( [] );
	const [ loading, setLoading ]     = useState( true );
	const [ selected, setSelected ]   = useState( null );
	const [ saving, setSaving ]       = useState( false );
	const [ error, setError ]         = useState( null );
	const [ filter, setFilter ]       = useState( '' );

	const { fetchWorkflows } = useDispatch( 'stepwise/workflows' );

	useEffect( () => {
		apiFetch( { path: '/stepwise/v1/saas/templates' } )
			.then( ( res ) => setTemplates( res.templates ?? [] ) )
			.catch( ( err ) => {
				setError( err.message ?? __( 'Could not load templates.', 'stepwise' ) );
				setTemplates( [] );
			} )
			.finally( () => setLoading( false ) );
	}, [] );

	const categories = [ ...new Set( templates.map( ( t ) => t.category ).filter( Boolean ) ) ].sort();

	const visible = filter
		? templates.filter( ( t ) => t.category === filter )
		: templates;

	const handleImport = async () => {
		if ( ! selected ) return;
		setSaving( true );
		setError( null );
		try {
			const workflow = await apiFetch( {
				path:   '/stepwise/v1/workflows/import',
				method: 'POST',
				data:   {
					title:       selected.title,
					description: selected.description ?? '',
					category:    selected.category ?? '',
					steps:       selected.steps,
				},
			} );
			await fetchWorkflows();
			onClose();
			if ( workflow?.id ) {
				const editUrl = `${ window.stepwiseData?.adminUrl ?? '' }admin.php?page=stepwise&workflow_id=${ workflow.id }`;
				window.location.href = editUrl;
			}
		} catch ( err ) {
			setError( err.message ?? __( 'Failed to import template.', 'stepwise' ) );
			setSaving( false );
		}
	};

	return (
		<Modal
			title={ __( 'Choose a Template', 'stepwise' ) }
			onClose={ onClose }
			footer={
				<>
					<Button variant="ghost" onClick={ onClose } disabled={ saving }>
						{ __( 'Cancel', 'stepwise' ) }
					</Button>
					<Button variant="primary" onClick={ handleImport } disabled={ ! selected || saving }>
						{ saving ? __( 'Importing…', 'stepwise' ) : __( 'Import Template', 'stepwise' ) }
					</Button>
				</>
			}
		>
			{ error && <p className="ap-error" style={ { marginBottom: '12px' } }>{ error }</p> }

			{ loading ? (
				<div className="ap-loading"><span className="spinner is-active" /></div>
			) : templates.length === 0 ? (
				<p style={ { color: '#888', fontSize: '13px' } }>
					{ __( 'No templates available.', 'stepwise' ) }
				</p>
			) : (
				<div style={ { display: 'flex', flexDirection: 'column', gap: '12px' } }>
					{ categories.length > 1 && (
						<div style={ { display: 'flex', gap: '8px', flexWrap: 'wrap' } }>
							<button
								onClick={ () => setFilter( '' ) }
								style={ {
									fontSize: '12px', padding: '3px 10px', borderRadius: '12px', border: '1px solid',
									borderColor: filter === '' ? '#6366f1' : '#d1d5db',
									background: filter === '' ? '#eef2ff' : 'transparent',
									color: filter === '' ? '#4f46e5' : '#6b7280',
									cursor: 'pointer',
								} }
							>
								{ __( 'All', 'stepwise' ) }
							</button>
							{ categories.map( ( cat ) => (
								<button
									key={ cat }
									onClick={ () => setFilter( cat ) }
									style={ {
										fontSize: '12px', padding: '3px 10px', borderRadius: '12px', border: '1px solid',
										borderColor: filter === cat ? '#6366f1' : '#d1d5db',
										background: filter === cat ? '#eef2ff' : 'transparent',
										color: filter === cat ? '#4f46e5' : '#6b7280',
										cursor: 'pointer',
									} }
								>
									{ cat }
								</button>
							) ) }
						</div>
					) }

					<div style={ { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' } }>
						{ visible.map( ( tpl ) => {
							const isSelected = selected?.id === tpl.id;
							return (
								<div
									key={ tpl.id }
									onClick={ () => setSelected( tpl ) }
									style={ {
										padding: '12px 14px', borderRadius: '6px', border: '1.5px solid',
										borderColor: isSelected ? '#6366f1' : '#e5e7eb',
										background: isSelected ? '#eef2ff' : '#fff',
										cursor: 'pointer',
										transition: 'border-color 0.1s',
									} }
								>
									<div style={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }>
										<span style={ { fontSize: '13px', fontWeight: 600, color: '#111' } }>{ tpl.title }</span>
										<span style={ { fontSize: '11px', color: '#9ca3af' } }>
											{ tpl.steps.length } { __( 'steps', 'stepwise' ) }
										</span>
									</div>
									{ tpl.description && (
										<p style={ { fontSize: '12px', color: '#6b7280', marginTop: '4px', marginBottom: 0 } }>
											{ tpl.description }
										</p>
									) }
								</div>
							);
						} ) }
					</div>
				</div>
			) }
		</Modal>
	);
};

export default TemplatePickerModal;
