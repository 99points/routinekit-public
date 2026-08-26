<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Haayal_Notes_Loader {

    public function init() {
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        add_action( 'admin_bar_menu', array( $this, 'add_admin_bar_buttons' ), 100 );
        add_action( 'delete_user', array( $this, 'handle_deleted_user' ) );
        add_filter( 'admin_body_class', array( $this, 'add_vivid_body_class' ) );
    }

    public function add_vivid_body_class( $classes ) {
        $settings = get_option( 'haayal_settings', array() );
        if ( ! empty( $settings['vivid_colors'] ) ) {
            $classes .= ' haayal-notes-vivid-colors';
        }
        return $classes;
    }

    public function enqueue_assets( $hook ) {
        if ( ! Haayal_Notes_Permissions::current_user_can_comment() ) {
            return;
        }

        // Disable on Gutenberg / block editor pages.
        if ( in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
            $current_screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
            if ( $current_screen && method_exists( $current_screen, 'is_block_editor' ) && $current_screen->is_block_editor() ) {
                return;
            }
        }

        $settings = get_option( 'haayal_settings', array(
            'markers_visible_default' => true,
            'show_floating_buttons'   => true,
        ) );

        // Core CSS & JS on every admin page.
        wp_enqueue_style(
            'haayal-notes-css',
            HAAYAL_NOTES_PLUGIN_URL . 'assets/css/haayal-notes.css',
            array(),
            HAAYAL_NOTES_VERSION
        );

        wp_enqueue_script(
            'haayal-notes-js',
            HAAYAL_NOTES_PLUGIN_URL . 'assets/js/haayal-notes.js',
            array(),
            HAAYAL_NOTES_VERSION,
            true
        );

        $delete_policy = isset( $settings['delete_policy'] ) ? $settings['delete_policy'] : 'own_only';

        $page_context = $this->get_page_context( $hook );

        wp_localize_script( 'haayal-notes-js', 'haayalData', array(
            'restUrl'        => esc_url_raw( rest_url( 'haayal/v1' ) ),
            'nonce'          => wp_create_nonce( 'wp_rest' ),
            'currentPage'    => $this->get_current_admin_path(),
            'canComment'     => true,
            'markersVisible' => $this->get_user_markers_visible( $settings ),
            'currentUserId'  => get_current_user_id(),
            'currentUserName' => wp_get_current_user()->display_name,
            'isAdmin'              => current_user_can( 'manage_options' ),
            'showFloatingButtons'  => isset( $settings['show_floating_buttons'] ) ? (bool) $settings['show_floating_buttons'] : true,
            'deletePolicy'   => $delete_policy,
            'defaultPrivacy' => isset( $settings['default_privacy'] ) ? $settings['default_privacy'] : 'public',
            'currentUserRoleLevel' => self::get_current_user_role_level(),
            'pageContext'    => $page_context,
            'i18n'           => array(
                'addComment'    => __( 'Note', 'keepinmind-dashboard-notes' ),
                'addOpenNote'   => __( 'Open Note', 'keepinmind-dashboard-notes' ),
                'addPinNote'    => __( 'Pinned Note', 'keepinmind-dashboard-notes' ),
                'placementBannerOpen' => __( 'Click between elements to place an open note', 'keepinmind-dashboard-notes' ),
                'placementBannerPin'  => __( 'Click on any element to place a pinned note', 'keepinmind-dashboard-notes' ),
                'selectType'    => __( 'Select type', 'keepinmind-dashboard-notes' ),
                'typeWarning'   => __( 'Warning', 'keepinmind-dashboard-notes' ),
                'typeImportant' => __( 'Important', 'keepinmind-dashboard-notes' ),
                'typeInfo'      => __( 'Info', 'keepinmind-dashboard-notes' ),
                'typeTip'       => __( 'Tip', 'keepinmind-dashboard-notes' ),
                'openNote'      => __( 'Open Note', 'keepinmind-dashboard-notes' ),
                'pinnedNote'    => __( 'Pinned Note', 'keepinmind-dashboard-notes' ),
                'reply'         => __( 'Reply', 'keepinmind-dashboard-notes' ),
                'delete'        => __( 'Delete', 'keepinmind-dashboard-notes' ),
                'deleteThread'  => __( 'Delete thread', 'keepinmind-dashboard-notes' ),
                'cancel'        => __( 'Cancel', 'keepinmind-dashboard-notes' ),
                'submit'        => __( 'Post note', 'keepinmind-dashboard-notes' ),
                'submitReply'   => __( 'Post reply', 'keepinmind-dashboard-notes' ),
                'placeholder'      => __( 'Write a note...', 'keepinmind-dashboard-notes' ),
                'replyPlaceholder' => __( 'Write a reply...', 'keepinmind-dashboard-notes' ),
                'confirmDelete'       => __( 'Delete this note and all replies?', 'keepinmind-dashboard-notes' ),
                'confirmDeleteSingle' => __( 'Delete this note?', 'keepinmind-dashboard-notes' ),
                'fallbackTitle' => __( 'Unanchored Notes', 'keepinmind-dashboard-notes' ),
                'noComments'    => __( 'No notes yet.', 'keepinmind-dashboard-notes' ),
                'clickToPlace'  => __( 'Click on any element to place a note', 'keepinmind-dashboard-notes' ),
                'exitPlacement' => __( 'Press Escape to exit placement mode', 'keepinmind-dashboard-notes' ),
                'edit'          => __( 'Edit', 'keepinmind-dashboard-notes' ),
                'save'          => __( 'Save', 'keepinmind-dashboard-notes' ),
                'typeLabel'     => __( 'Type:', 'keepinmind-dashboard-notes' ),
                'typeRegular'   => __( 'Regular', 'keepinmind-dashboard-notes' ),
                'typeAlert'     => __( 'Warning', 'keepinmind-dashboard-notes' ),
                'typeAttention'   => __( 'Attention', 'keepinmind-dashboard-notes' ),
                'relocate'        => __( 'Relocate', 'keepinmind-dashboard-notes' ),
                'relocatePrompt'  => __( 'Click on any element to relocate this note', 'keepinmind-dashboard-notes' ),
                'scopeLabel'      => __( 'Apply to:', 'keepinmind-dashboard-notes' ),
                /* translators: %s: entity label, e.g. "This Product only" */
                'scopeSpecific'   => __( 'This %s only', 'keepinmind-dashboard-notes' ),
                /* translators: %s: entity label, e.g. "Every Product" */
                'scopeGeneric'    => __( 'Every %s', 'keepinmind-dashboard-notes' ),
                'privateLabel'    => __( 'Private', 'keepinmind-dashboard-notes' ),
                'makePrivate'     => __( 'Make private', 'keepinmind-dashboard-notes' ),
                'makePublic'      => __( 'Make public', 'keepinmind-dashboard-notes' ),
                'privateNote'     => __( 'Only visible to you', 'keepinmind-dashboard-notes' ),
                'privateDisabledHint' => __( 'Cannot be private while users are mentioned', 'keepinmind-dashboard-notes' ),
                'mentionsDisabledHint' => __( 'Mentions are disabled for private notes', 'keepinmind-dashboard-notes' ),
                'removeMention'        => __( 'Remove mention', 'keepinmind-dashboard-notes' ),
                'hide'            => __( 'Hide', 'keepinmind-dashboard-notes' ),
                'show'            => __( 'Show', 'keepinmind-dashboard-notes' ),
                'hideNotes'       => __( 'Hide Notes', 'keepinmind-dashboard-notes' ),
                'showNotes'       => __( 'Show Notes', 'keepinmind-dashboard-notes' ),
                'orphanBadge'        => __( 'Original location not found', 'keepinmind-dashboard-notes' ),
                'orphanModalTitle'   => __( 'Original location not found', 'keepinmind-dashboard-notes' ),
                'orphanModalIntro'   => __( "This note couldn't be placed where it was originally attached.", 'keepinmind-dashboard-notes' ),
                'orphanModalWhy'     => __( 'This usually happens for one of two reasons:', 'keepinmind-dashboard-notes' ),
                'orphanReason1Title' => __( 'The page layout changed', 'keepinmind-dashboard-notes' ),
                'orphanReason1Desc'  => __( "The structure of this admin page may have been updated (by WordPress, a plugin, or settings). If the note used to appear in the right place and suddenly doesn't - this is likely why.", 'keepinmind-dashboard-notes' ),
                'orphanReason1Fix'   => __( 'What you can do: Simply relocate the note. In most cases, placing it again will fix the issue.', 'keepinmind-dashboard-notes' ),
                'orphanReason2Title' => __( 'The area loads dynamically', 'keepinmind-dashboard-notes' ),
                'orphanReason2Desc'  => __( "Some parts of the admin are built after the page loads. If the element wasn't there when the page opened, the note has nothing to attach to.", 'keepinmind-dashboard-notes' ),
                'orphanReason2Fix'   => __( 'What you can do: Try attaching the note to a more stable part of the page - one that is visible immediately when the page loads.', 'keepinmind-dashboard-notes' ),
                'layoutFull'      => __( 'Full width', 'keepinmind-dashboard-notes' ),
                'layoutCompact'   => __( 'Compact', 'keepinmind-dashboard-notes' ),
                'posAbove'        => __( 'Show above selected target', 'keepinmind-dashboard-notes' ),
                'posBelow'        => __( 'Show below selected target', 'keepinmind-dashboard-notes' ),
                'insertLink'      => __( 'Insert Link', 'keepinmind-dashboard-notes' ),
                'editLink'        => __( 'Edit Link', 'keepinmind-dashboard-notes' ),
                'openInNewTab'    => __( 'Open in new tab', 'keepinmind-dashboard-notes' ),
                'insert'          => __( 'Insert', 'keepinmind-dashboard-notes' ),
                'update'          => __( 'Update', 'keepinmind-dashboard-notes' ),
                'genericError'       => __( 'Something went wrong. Please try again.', 'keepinmind-dashboard-notes' ),
                'parentNoteDeleted'  => __( "Your reply wasn't posted because the note had already been deleted.", 'keepinmind-dashboard-notes' ),
                'addStickyNote'      => __( 'Sticky Note', 'keepinmind-dashboard-notes' ),
                'stickyNote'         => __( 'Sticky Note', 'keepinmind-dashboard-notes' ),
                'stickyNoteExpanded' => __( 'Read full note', 'keepinmind-dashboard-notes' ),
            ),
        ) );

        // Settings page.
        if ( strpos( $hook, 'haayal-notes-settings' ) !== false ) {
            wp_enqueue_style(
                'haayal-notes-admin-pages-css',
                HAAYAL_NOTES_PLUGIN_URL . 'assets/css/haayal-notes-admin-pages.css',
                array(),
                HAAYAL_NOTES_VERSION
            );

            wp_enqueue_script(
                'haayal-notes-settings-js',
                HAAYAL_NOTES_PLUGIN_URL . 'assets/js/haayal-notes-settings.js',
                array(),
                HAAYAL_NOTES_VERSION,
                true
            );

            $wp_roles    = wp_roles();
            $all_roles   = array();
            foreach ( $wp_roles->role_names as $slug => $name ) {
                // Only show roles that have admin dashboard access (edit_posts capability).
                $role_obj = $wp_roles->get_role( $slug );
                if ( ! $role_obj || ( 'administrator' !== $slug && empty( $role_obj->capabilities['edit_posts'] ) ) ) {
                    continue;
                }
                $all_roles[] = array(
                    'slug'  => $slug,
                    'name'  => translate_user_role( $name ),
                    'power' => count( array_filter( $role_obj->capabilities ) ),
                );
            }
            // Sort by capability count descending (most powerful first).
            usort( $all_roles, function ( $a, $b ) {
                return $b['power'] - $a['power'];
            } );

            wp_localize_script( 'haayal-notes-settings-js', 'haayalSettingsData', array(
                'restUrl'  => esc_url_raw( rest_url( 'haayal/v1' ) ),
                'wpRestUrl' => esc_url_raw( rest_url( 'wp/v2' ) ),
                'nonce'    => wp_create_nonce( 'wp_rest' ),
                'allRoles' => $all_roles,
                'i18n'     => array(
                    'saved'        => __( 'Settings saved.', 'keepinmind-dashboard-notes' ),
                    'saveError'    => __( 'Failed to save settings.', 'keepinmind-dashboard-notes' ),
                    'searchUsers'  => __( 'Search users...', 'keepinmind-dashboard-notes' ),
                    'save'         => __( 'Save Settings', 'keepinmind-dashboard-notes' ),
                    'rolesLabel'   => __( 'Allowed Roles', 'keepinmind-dashboard-notes' ),
                    'usersLabel'   => __( 'Allowed Users (Optional)', 'keepinmind-dashboard-notes' ),
                    'usersDesc'    => __( 'Limit access to specific users. If empty, all users with allowed roles can add notes.', 'keepinmind-dashboard-notes' ),
                    'visibleLabel'           => __( 'Notes visible by default', 'keepinmind-dashboard-notes' ),
                    'visibleDesc'            => __( 'Warning notes are always visible regardless of this setting.', 'keepinmind-dashboard-notes' ),
                    'showFabLabel'           => __( 'Show floating buttons', 'keepinmind-dashboard-notes' ),
                    'showFabDesc'            => __( 'When disabled, the New Note and Show/Hide Notes controls appear in the WordPress admin toolbar instead.', 'keepinmind-dashboard-notes' ),
                    'accessGroupLabel'       => __( 'Access', 'keepinmind-dashboard-notes' ),
                    'visibilityGroupLabel'   => __( 'Display Settings', 'keepinmind-dashboard-notes' ),
                    'permissionsGroupLabel'  => __( 'Permissions', 'keepinmind-dashboard-notes' ),
                    'dataGroupLabel'         => __( 'Data Management', 'keepinmind-dashboard-notes' ),
                    'deletePolicyLabel'      => __( 'Edit, Delete & Relocate Notes Permissions', 'keepinmind-dashboard-notes' ),
                    'deletePolicyOwnOnly'    => __( 'Author only (Recommended)', 'keepinmind-dashboard-notes' ),
                    'deletePolicyOwnOnlyDesc' => __( 'Only the author of a note can edit, delete or relocate it', 'keepinmind-dashboard-notes' ),
                    'deletePolicyRoleHierarchyStrict' => __( 'Lower role', 'keepinmind-dashboard-notes' ),
                    'deletePolicyRoleHierarchyStrictDesc' => __( 'Users can edit, delete or relocate notes by users with a lower role (e.g. editor can delete author\'s note but not another editor\'s)', 'keepinmind-dashboard-notes' ),
                    'deletePolicyRoleHierarchy' => __( 'Same or lower role', 'keepinmind-dashboard-notes' ),
                    'deletePolicyRoleHierarchyDesc' => __( 'Users can edit, delete or relocate notes by users with the same or lower role (e.g. editor can delete another editor\'s note but not admin\'s)', 'keepinmind-dashboard-notes' ),
                    'deletePolicyEverybody'  => __( 'Everybody (Not recommended)', 'keepinmind-dashboard-notes' ),
                    'deletePolicyEverybodyDesc' => __( 'All users can edit, delete or relocate any note', 'keepinmind-dashboard-notes' ),
                    'uninstallLabel'         => __( 'On Plugin Uninstall', 'keepinmind-dashboard-notes' ),
                    'uninstallToggleLabel'   => __( 'Delete plugin data on uninstall', 'keepinmind-dashboard-notes' ),
                    'uninstallToggleDesc'    => __( 'Removes all notes and settings; otherwise they are kept.', 'keepinmind-dashboard-notes' ),
                    'deletedUserLabel'       => __( 'On User Deletion', 'keepinmind-dashboard-notes' ),
                    'deletedUserToggleLabel' => __( 'Delete notes created by the user when their account is deleted', 'keepinmind-dashboard-notes' ),
                    'deletedUserToggleDesc'  => __( 'Otherwise, notes are kept with the author\'s name.', 'keepinmind-dashboard-notes' ),
                    'defaultPrivacyLabel'    => __( 'Default Note Privacy', 'keepinmind-dashboard-notes' ),
                    'defaultPrivacyToggleLabel' => __( 'Make new notes private by default', 'keepinmind-dashboard-notes' ),
                    'defaultPrivacyToggleDesc'  => __( 'New notes are visible only to the author. Can be changed per note.', 'keepinmind-dashboard-notes' ),
                    'vividColorsLabel'          => __( 'Use vivid colors for notes', 'keepinmind-dashboard-notes' ),
                    'vividColorsDesc'           => __( 'Enable a more saturated color palette for better visibility.', 'keepinmind-dashboard-notes' ),
                ),
            ) );
        }

        // Dashboard page.
        if ( strpos( $hook, 'haayal-notes-dashboard' ) !== false ) {
            wp_enqueue_style(
                'haayal-notes-admin-pages-css',
                HAAYAL_NOTES_PLUGIN_URL . 'assets/css/haayal-notes-admin-pages.css',
                array(),
                HAAYAL_NOTES_VERSION
            );

            wp_enqueue_script(
                'haayal-notes-dashboard-js',
                HAAYAL_NOTES_PLUGIN_URL . 'assets/js/haayal-notes-dashboard.js',
                array(),
                HAAYAL_NOTES_VERSION,
                true
            );

            wp_localize_script( 'haayal-notes-dashboard-js', 'haayalDashboardData', array(
                'restUrl'              => esc_url_raw( rest_url( 'haayal/v1' ) ),
                'nonce'                => wp_create_nonce( 'wp_rest' ),
                'adminUrl'             => admin_url(),
                'currentUserId'        => get_current_user_id(),
                'currentUserRoleLevel' => self::get_current_user_role_level(),
                'deletePolicy'         => $delete_policy,
                'i18n'      => array(
                    'loading'     => __( 'Loading notes...', 'keepinmind-dashboard-notes' ),
                    'noComments'  => __( 'No notes found.', 'keepinmind-dashboard-notes' ),
                    'emptyDesc'   => __( 'Start organizing your thoughts.', 'keepinmind-dashboard-notes' ),
                    'emptyCta'    => __( 'Add your first note!', 'keepinmind-dashboard-notes' ),
                    'delete'      => __( 'Delete', 'keepinmind-dashboard-notes' ),
                    'deleteThread' => __( 'Delete thread', 'keepinmind-dashboard-notes' ),
                    'confirmDelete'       => __( 'Delete this note and all replies?', 'keepinmind-dashboard-notes' ),
                    'confirmDeleteSingle' => __( 'Delete this note?', 'keepinmind-dashboard-notes' ),
                    'search'      => __( 'Search notes...', 'keepinmind-dashboard-notes' ),
                    'prev'        => __( '&laquo; Previous', 'keepinmind-dashboard-notes' ),
                    'next'        => __( 'Next &raquo;', 'keepinmind-dashboard-notes' ),
                    'page'        => __( 'Page', 'keepinmind-dashboard-notes' ),
                    'of'          => __( 'of', 'keepinmind-dashboard-notes' ),
                    'replyTo'     => __( 'Reply to', 'keepinmind-dashboard-notes' ),
                    'bulkDelete'  => __( 'Delete Selected', 'keepinmind-dashboard-notes' ),
                    'confirmBulkDelete' => __( 'Delete selected notes and all their replies?', 'keepinmind-dashboard-notes' ),
                    'selectAll'   => __( 'Select all', 'keepinmind-dashboard-notes' ),
                    'cancel'      => __( 'Cancel', 'keepinmind-dashboard-notes' ),
                    'colTags'     => __( 'Tags', 'keepinmind-dashboard-notes' ),
                    'colNote'     => __( 'Note', 'keepinmind-dashboard-notes' ),
                    'colPage'     => __( 'Page', 'keepinmind-dashboard-notes' ),
                    'colAuthor'   => __( 'Author', 'keepinmind-dashboard-notes' ),
                    'colDate'     => __( 'Date', 'keepinmind-dashboard-notes' ),
                    'colActions'  => __( 'Actions', 'keepinmind-dashboard-notes' ),
                    'tagWarning'   => __( 'Warning', 'keepinmind-dashboard-notes' ),
                    'tagImportant' => __( 'Important', 'keepinmind-dashboard-notes' ),
                    'tagInfo'      => __( 'Info', 'keepinmind-dashboard-notes' ),
                    'tagTip'       => __( 'Tip', 'keepinmind-dashboard-notes' ),
                    'tagPinned'    => __( 'Pinned', 'keepinmind-dashboard-notes' ),
                    'tagStickyWarning'   => __( 'Sticky Warning',   'keepinmind-dashboard-notes' ),
                    'tagStickyImportant' => __( 'Sticky Important', 'keepinmind-dashboard-notes' ),
                    'tagStickyInfo'      => __( 'Sticky Info',      'keepinmind-dashboard-notes' ),
                    'tagStickyTip'       => __( 'Sticky Tip',       'keepinmind-dashboard-notes' ),
                    'tagReply'     => _x( 'Reply', 'tag label', 'keepinmind-dashboard-notes' ),
                    'tagPrivate'   => __( 'Private', 'keepinmind-dashboard-notes' ),
                    /* translators: %d: number of deleted notes */
                    'bulkDeleted'      => __( '%d notes deleted.', 'keepinmind-dashboard-notes' ),
                    'bulkDeleteError'  => __( 'Failed to delete notes. Please try again.', 'keepinmind-dashboard-notes' ),
                    'cannotDeleteOwn'  => __( 'Only the author can delete', 'keepinmind-dashboard-notes' ),
                    'cannotDeleteRole' => __( 'Only the author or a higher role can delete', 'keepinmind-dashboard-notes' ),
                ),
            ) );
        }
    }

    public function add_admin_bar_buttons( $wp_admin_bar ) {
        if ( ! is_admin() ) {
            return;
        }
        if ( ! Haayal_Notes_Permissions::current_user_can_comment() ) {
            return;
        }
        $settings         = get_option( 'haayal_settings', array() );
        $show_floating     = isset( $settings['show_floating_buttons'] ) ? (bool) $settings['show_floating_buttons'] : true;
        if ( $show_floating ) {
            return;
        }

        // Determine current user's marker visibility for the initial label.
        $user_id     = get_current_user_id();
        $vis_meta    = get_user_meta( $user_id, 'haayal_markers_visible', true );
        $is_visible  = ( '' === $vis_meta ) ? ! empty( $settings['markers_visible_default'] ) : (bool) $vis_meta;
        $vis_label   = $is_visible
            ? __( 'Hide Notes', 'keepinmind-dashboard-notes' )
            : __( 'Show Notes', 'keepinmind-dashboard-notes' );

        $wp_admin_bar->add_node( array(
            'id'    => 'haayal-notes',
            'title' => '<span class="ab-icon dashicons dashicons-sticky" aria-hidden="true"></span>'
                     . '<span class="ab-label">' . esc_html__( 'Notes', 'keepinmind-dashboard-notes' ) . '</span>',
            'href'  => '#',
            'meta'  => array(
                'aria-haspopup' => 'true',
                'aria-expanded' => 'false',
            ),
        ) );

        $wp_admin_bar->add_node( array(
            'id'     => 'haayal-notes-add-open',
            'parent' => 'haayal-notes',
            'title'  => __( 'Add Open Note', 'keepinmind-dashboard-notes' ),
            'href'   => '#',
        ) );

        $wp_admin_bar->add_node( array(
            'id'     => 'haayal-notes-add-pin',
            'parent' => 'haayal-notes',
            'title'  => __( 'Add Pinned Note', 'keepinmind-dashboard-notes' ),
            'href'   => '#',
        ) );

        $wp_admin_bar->add_node( array(
            'id'     => 'haayal-notes-add-sticky',
            'parent' => 'haayal-notes',
            'title'  => __( 'Add Sticky Note', 'keepinmind-dashboard-notes' ),
            'href'   => '#',
        ) );

        $wp_admin_bar->add_node( array(
            'id'     => 'haayal-notes-toggle-vis',
            'parent' => 'haayal-notes',
            'title'  => esc_html( $vis_label ),
            'href'   => '#',
        ) );
    }

    private static function get_current_user_role_level() {
        $user = wp_get_current_user();
        $role_levels = array(
            'administrator' => 4,
            'editor'        => 3,
            'author'        => 2,
            'contributor'   => 1,
            'subscriber'    => 0,
        );
        $level = 0;
        foreach ( (array) $user->roles as $role ) {
            if ( isset( $role_levels[ $role ] ) && $role_levels[ $role ] > $level ) {
                $level = $role_levels[ $role ];
            }
        }
        return $level;
    }

    private function get_user_markers_visible( $settings ) {
        $user_id = get_current_user_id();
        $value   = get_user_meta( $user_id, 'haayal_markers_visible', true );
        if ( '' === $value ) {
            return ! empty( $settings['markers_visible_default'] );
        }
        return (bool) $value;
    }

    private function get_page_context( $hook ) {
        $context = array(
            'hasId'        => false,
            'genericUrl'   => '',
            'entityLabel'  => '',
            'genericTitle' => '',
        );

        if ( ! current_user_can( 'edit_posts' ) ) {
            return $context;
        }

        // Post edit page: post.php?post=123&action=edit
        if ( 'post.php' === $hook ) {
            $post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
            if ( $post_id ) {
                $post = get_post( $post_id );
                if ( $post ) {
                    $post_type_obj = get_post_type_object( $post->post_type );
                    $label         = $post_type_obj ? $post_type_obj->labels->singular_name : ucfirst( $post->post_type );
                    $context['hasId']        = true;
                    $context['genericUrl']   = '__type__/wp-admin/post.php?action=edit&post_type=' . $post->post_type;
                    $context['entityLabel']  = $label;
                    $context['genericTitle'] = sprintf(
                        /* translators: %s: post type label, e.g. "All Product edit pages" */
                        __( 'All %s edit pages', 'keepinmind-dashboard-notes' ),
                        $label
                    );
                }
            }
        }

        // Term edit page: term.php?taxonomy=category&tag_ID=3
        if ( 'term.php' === $hook || ( 'edit-tags.php' === $hook && isset( $_GET['action'] ) && 'edit' === $_GET['action'] ) ) {
            $tag_id   = isset( $_GET['tag_ID'] ) ? absint( $_GET['tag_ID'] ) : 0;
            $taxonomy = isset( $_GET['taxonomy'] ) ? sanitize_text_field( wp_unslash( $_GET['taxonomy'] ) ) : '';
            if ( $tag_id && $taxonomy ) {
                $tax_obj = get_taxonomy( $taxonomy );
                $label   = $tax_obj ? $tax_obj->labels->singular_name : ucfirst( $taxonomy );
                $base    = ( 'term.php' === $hook ) ? 'term.php' : 'edit-tags.php?action=edit';
                $context['hasId']        = true;
                $context['genericUrl']   = '__type__/wp-admin/' . $base . '&taxonomy=' . $taxonomy;
                $context['entityLabel']  = $label;
                $context['genericTitle'] = sprintf(
                    /* translators: %s: taxonomy singular label, e.g. "All Category edit pages" */
                    __( 'All %s edit pages', 'keepinmind-dashboard-notes' ),
                    $label
                );
            }
        }

        // User edit page: user-edit.php?user_id=5
        if ( 'user-edit.php' === $hook ) {
            $user_id = isset( $_GET['user_id'] ) ? absint( $_GET['user_id'] ) : 0;
            if ( $user_id ) {
                $context['hasId']        = true;
                $context['genericUrl']   = '__type__/wp-admin/user-edit.php';
                $context['entityLabel']  = __( 'User', 'keepinmind-dashboard-notes' );
                $context['genericTitle'] = __( 'All User edit pages', 'keepinmind-dashboard-notes' );
            }
        }

        return $context;
    }

    public function handle_deleted_user( $user_id ) {
        $settings = get_option( 'haayal_settings', array() );
        $action   = isset( $settings['deleted_user_action'] ) ? $settings['deleted_user_action'] : 'keep';

        if ( 'delete' === $action ) {
            Haayal_Notes_DB::delete_comments_by_user( $user_id );
        } else {
            $user = get_user_by( 'id', $user_id );
            if ( $user ) {
                Haayal_Notes_DB::preserve_author_name( $user_id, $user->display_name );
            }
        }
    }

    private function get_current_admin_path() {
        $path = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
        $parsed = wp_parse_url( $path );
        $path_only = isset( $parsed['path'] ) ? $parsed['path'] : '';
        $query     = isset( $parsed['query'] ) ? '?' . $parsed['query'] : '';

        // Normalize to relative admin path.
        $admin_pos = strpos( $path_only, '/wp-admin/' );
        if ( false !== $admin_pos ) {
            $path_only = substr( $path_only, $admin_pos );
        }

        // /wp-admin/ and /wp-admin/index.php are the same page.
        if ( '/wp-admin/' === $path_only ) {
            $path_only = '/wp-admin/index.php';
        }

        return $path_only . $query;
    }
}
