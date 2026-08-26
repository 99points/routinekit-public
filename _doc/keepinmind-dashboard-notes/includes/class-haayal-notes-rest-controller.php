<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Haayal_Notes_REST_Controller {

    const REST_NS = 'haayal/v1';

    public function register_routes() {
        register_rest_route( self::REST_NS, '/notes', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_comments' ),
                'permission_callback' => array( $this, 'check_comment_permission' ),
                'args'                => array(
                    'page_url' => array(
                        'required'          => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'create_comment' ),
                'permission_callback' => array( $this, 'check_comment_permission' ),
                'args'                => array(
                    'page_url'     => array(
                        'required'          => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'css_selector' => array(
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'pos_x'        => array(
                        'default'           => 0,
                        'sanitize_callback' => array( $this, 'sanitize_float' ),
                    ),
                    'pos_y'        => array(
                        'default'           => 0,
                        'sanitize_callback' => array( $this, 'sanitize_float' ),
                    ),
                    'content'      => array(
                        'required'          => true,
                        'sanitize_callback' => array( $this, 'sanitize_rich_content' ),
                    ),
                    'comment_type' => array(
                        'default'           => 'pin',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'is_private'   => array(
                        'default'           => false,
                        'sanitize_callback' => 'rest_sanitize_boolean',
                    ),
                    'page_title'   => array(
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'parent_id'    => array(
                        'default'           => 0,
                        'sanitize_callback' => 'absint',
                    ),
                    'tagged_users' => array(
                        'default'           => array(),
                        'sanitize_callback' => array( $this, 'sanitize_int_array' ),
                    ),
                    'banner_layout' => array(
                        'default'           => 'full',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'banner_position' => array(
                        'default'           => 'before',
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
        ) );

        register_rest_route( self::REST_NS, '/notes/all', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array( $this, 'get_all_comments' ),
            'permission_callback' => array( $this, 'check_comment_permission' ),
            'args'                => array(
                'page'     => array(
                    'default'           => 1,
                    'sanitize_callback' => 'absint',
                ),
                'per_page' => array(
                    'default'           => 20,
                    'sanitize_callback' => 'absint',
                ),
                'search'   => array(
                    'default'           => '',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ) );

        register_rest_route( self::REST_NS, '/notes/(?P<id>\d+)', array(
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'delete_comment' ),
                'permission_callback' => array( $this, 'check_delete_permission' ),
                'args'                => array(
                    'id' => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
            array(
                'methods'             => 'PUT',
                'callback'            => array( $this, 'edit_comment' ),
                'permission_callback' => array( $this, 'check_edit_permission' ),
                'args'                => array(
                    'id'      => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                    ),
                    'content' => array(
                        'required'          => true,
                        'sanitize_callback' => array( $this, 'sanitize_rich_content' ),
                    ),
                    'banner_layout' => array(
                        'default'           => null,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'banner_position' => array(
                        'default'           => null,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'comment_type' => array(
                        'default'           => null,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
            array(
                'methods'             => 'PATCH',
                'callback'            => array( $this, 'update_comment_position' ),
                'permission_callback' => array( $this, 'check_relocate_permission' ),
                'args'                => array(
                    'id'           => array(
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                    ),
                    'css_selector' => array(
                        'required'          => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'pos_x'        => array(
                        'required'          => true,
                        'sanitize_callback' => array( $this, 'sanitize_float' ),
                    ),
                    'pos_y'        => array(
                        'required'          => true,
                        'sanitize_callback' => array( $this, 'sanitize_float' ),
                    ),
                    'banner_position' => array(
                        'default'           => null,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
        ) );

        register_rest_route( self::REST_NS, '/notes/(?P<id>\d+)/privacy', array(
            'methods'             => 'PATCH',
            'callback'            => array( $this, 'toggle_privacy' ),
            'permission_callback' => array( $this, 'check_delete_permission' ),
            'args'                => array(
                'id'         => array(
                    'required'          => true,
                    'sanitize_callback' => 'absint',
                ),
                'is_private' => array(
                    'required'          => true,
                    'sanitize_callback' => 'rest_sanitize_boolean',
                ),
            ),
        ) );

        register_rest_route( self::REST_NS, '/user/visibility', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_user_visibility' ),
                'permission_callback' => array( $this, 'check_comment_permission' ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'set_user_visibility' ),
                'permission_callback' => array( $this, 'check_comment_permission' ),
            ),
        ) );

        register_rest_route( self::REST_NS, '/mentions', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array( $this, 'search_mentionable_users' ),
            'permission_callback' => array( $this, 'check_comment_permission' ),
            'args'                => array(
                'q' => array(
                    'default'           => '',
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ) );

        register_rest_route( self::REST_NS, '/settings', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_settings' ),
                'permission_callback' => array( $this, 'check_admin_permission' ),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'update_settings' ),
                'permission_callback' => array( $this, 'check_admin_permission' ),
            ),
        ) );

        add_filter( 'rest_post_dispatch', array( $this, 'add_no_cache_headers' ), 10, 3 );
    }

    public function add_no_cache_headers( $response, $server, $request ) {
        if ( 0 === strpos( $request->get_route(), '/' . self::REST_NS ) ) {
            $response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
            $response->header( 'Pragma', 'no-cache' );
            $response->header( 'X-LiteSpeed-Cache-Control', 'no-cache' );
            do_action( 'litespeed_control_set_nocache', 'haayal REST API' );
        }
        return $response;
    }

    public function sanitize_float( $value ) {
        return floatval( $value );
    }

    public function sanitize_rich_content( $value ) {
        return self::sanitize_rich_content_static( $value );
    }

    public static function sanitize_rich_content_static( $value ) {
        return wp_kses( $value, array(
            'strong' => array(),
            'b'      => array(),
            'br'     => array(),
            'a'      => array(
                'href'   => array(),
                'target' => array(),
                'rel'    => array(),
            ),
            'span'   => array(
                'style'           => array(),
                'class'           => array(),
                'data-user-id'    => array(),
                'contenteditable' => array(),
            ),
            'font'   => array(
                'color' => array(),
            ),
        ) );
    }

    public function check_comment_permission() {
        return Haayal_Notes_Permissions::current_user_can_comment();
    }

    public function check_edit_permission( $request ) {
        if ( ! Haayal_Notes_Permissions::current_user_can_comment() ) {
            return false;
        }
        $comment = Haayal_Notes_DB::get_comment( $request['id'] );
        if ( ! $comment ) {
            return true; // Will 404 in callback.
        }
        return Haayal_Notes_Permissions::can_delete_comment( $comment );
    }

    public function check_delete_permission( $request ) {
        if ( ! Haayal_Notes_Permissions::current_user_can_comment() ) {
            return false;
        }
        $comment = Haayal_Notes_DB::get_comment( $request['id'] );
        if ( ! $comment ) {
            return true; // Will 404 in callback.
        }
        return Haayal_Notes_Permissions::can_delete_comment( $comment );
    }

    public function check_relocate_permission( $request ) {
        if ( ! Haayal_Notes_Permissions::current_user_can_comment() ) {
            return false;
        }
        $comment = Haayal_Notes_DB::get_comment( $request['id'] );
        if ( ! $comment ) {
            return true; // Will 404 in callback.
        }
        return Haayal_Notes_Permissions::can_delete_comment( $comment );
    }

    public function check_admin_permission() {
        return current_user_can( 'manage_options' );
    }

    public function get_comments( $request ) {
        $page_url = $request->get_param( 'page_url' );
        $comments = Haayal_Notes_DB::get_comments_by_page( $page_url );
        $comments = self::add_role_levels( $comments );
        return rest_ensure_response( $comments );
    }

    private static function add_role_levels( $comments ) {
        $role_levels = array(
            'administrator' => 4,
            'editor'        => 3,
            'author'        => 2,
            'contributor'   => 1,
            'subscriber'    => 0,
        );
        $cache = array();
        foreach ( $comments as &$c ) {
            $uid = isset( $c['user_id'] ) ? (int) $c['user_id'] : 0;
            if ( ! isset( $cache[ $uid ] ) ) {
                $level = 0;
                $u = get_user_by( 'id', $uid );
                if ( $u ) {
                    foreach ( (array) $u->roles as $role ) {
                        if ( isset( $role_levels[ $role ] ) && $role_levels[ $role ] > $level ) {
                            $level = $role_levels[ $role ];
                        }
                    }
                }
                $cache[ $uid ] = $level;
            }
            $c['user_role_level'] = $cache[ $uid ];
        }
        return $comments;
    }

    public function get_all_comments( $request ) {
        $result = Haayal_Notes_DB::get_all_comments(
            $request->get_param( 'page' ),
            $request->get_param( 'per_page' ),
            $request->get_param( 'search' )
        );
        if ( ! empty( $result['comments'] ) ) {
            $result['comments'] = self::add_role_levels( $result['comments'] );
        }
        return rest_ensure_response( $result );
    }

    public function create_comment( $request ) {
        // Ensure table exists.
        Haayal_Notes_Activator::create_table();

        $data = array(
            'user_id'      => get_current_user_id(),
            'page_url'     => $request->get_param( 'page_url' ),
            'page_title'   => $request->get_param( 'page_title' ),
            'css_selector' => $request->get_param( 'css_selector' ),
            'pos_x'        => $request->get_param( 'pos_x' ),
            'pos_y'        => $request->get_param( 'pos_y' ),
            'content'      => $request->get_param( 'content' ),
            'comment_type' => $request->get_param( 'comment_type' ),
            'is_private'      => $request->get_param( 'is_private' ),
            'parent_id'       => $request->get_param( 'parent_id' ),
            'banner_layout'   => $request->get_param( 'banner_layout' ),
            'banner_position' => $request->get_param( 'banner_position' ),
        );

        // Replies inherit parent's privacy; reject if parent was deleted.
        $parent_id = absint( $data['parent_id'] );
        if ( $parent_id ) {
            $parent = Haayal_Notes_DB::get_comment( $parent_id );
            if ( ! $parent ) {
                return new WP_Error(
                    'haayal_parent_not_found',
                    __( 'The note you are replying to no longer exists.', 'keepinmind-dashboard-notes' ),
                    array( 'status' => 404 )
                );
            }
            if ( (int) $parent['is_private'] ) {
                $data['is_private'] = true;
            }
        }

        $comment = Haayal_Notes_DB::create_comment( $data );

        if ( ! $comment ) {
            return new WP_Error(
                'haayal_create_failed',
                __( 'Failed to create note.', 'keepinmind-dashboard-notes' ),
                array( 'status' => 500 )
            );
        }

        // Send email notifications to tagged users.
        $tagged = $request->get_param( 'tagged_users' );
        if ( ! empty( $tagged ) && is_array( $tagged ) ) {
            $this->notify_tagged_users( $tagged, $comment, $data );
        }

        return rest_ensure_response( $comment );
    }

    public function edit_comment( $request ) {
        $id      = $request->get_param( 'id' );
        $comment = Haayal_Notes_DB::get_comment( $id );

        if ( ! $comment ) {
            return new WP_Error( 'haayal_not_found', __( 'Note not found.', 'keepinmind-dashboard-notes' ), array( 'status' => 404 ) );
        }

        $extra = array();
        if ( null !== $request->get_param( 'banner_layout' ) ) {
            $extra['banner_layout'] = $request->get_param( 'banner_layout' );
        }
        if ( null !== $request->get_param( 'banner_position' ) ) {
            $extra['banner_position'] = $request->get_param( 'banner_position' );
        }
        if ( null !== $request->get_param( 'comment_type' ) ) {
            $extra['comment_type'] = $request->get_param( 'comment_type' );
        }
        $updated = Haayal_Notes_DB::update_comment_content( $id, $request->get_param( 'content' ), $extra );

        if ( ! $updated ) {
            return new WP_Error( 'haayal_edit_failed', __( 'Failed to edit note.', 'keepinmind-dashboard-notes' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( Haayal_Notes_DB::get_comment( $id ) );
    }

    public function toggle_privacy( $request ) {
        $id      = $request->get_param( 'id' );
        $comment = Haayal_Notes_DB::get_comment( $id );

        if ( ! $comment ) {
            return new WP_Error( 'haayal_not_found', __( 'Note not found.', 'keepinmind-dashboard-notes' ), array( 'status' => 404 ) );
        }

        Haayal_Notes_DB::update_privacy( $id, $request->get_param( 'is_private' ) );

        return rest_ensure_response( array( 'success' => true ) );
    }

    public function update_comment_position( $request ) {
        $id      = $request->get_param( 'id' );
        $comment = Haayal_Notes_DB::get_comment( $id );

        if ( ! $comment ) {
            return new WP_Error( 'haayal_not_found', __( 'Note not found.', 'keepinmind-dashboard-notes' ), array( 'status' => 404 ) );
        }

        $updated = Haayal_Notes_DB::update_comment_position(
            $id,
            $request->get_param( 'css_selector' ),
            $request->get_param( 'pos_x' ),
            $request->get_param( 'pos_y' ),
            $request->get_param( 'banner_position' )
        );

        if ( ! $updated ) {
            return new WP_Error( 'haayal_update_failed', __( 'Failed to update note position.', 'keepinmind-dashboard-notes' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( Haayal_Notes_DB::get_comment( $id ) );
    }

    public function delete_comment( $request ) {
        $id      = $request->get_param( 'id' );
        $comment = Haayal_Notes_DB::get_comment( $id );

        if ( ! $comment ) {
            return new WP_Error( 'haayal_not_found', __( 'Note not found.', 'keepinmind-dashboard-notes' ), array( 'status' => 404 ) );
        }

        $deleted = Haayal_Notes_DB::delete_comment( $id );

        if ( ! $deleted ) {
            return new WP_Error( 'haayal_delete_failed', __( 'Failed to delete note.', 'keepinmind-dashboard-notes' ), array( 'status' => 500 ) );
        }

        return rest_ensure_response( array( 'deleted' => true, 'id' => $id ) );
    }

    public function search_mentionable_users( $request ) {
        $q        = $request->get_param( 'q' );
        $settings = get_option( 'haayal_settings', array() );

        $allowed_roles = isset( $settings['allowed_roles'] ) ? $settings['allowed_roles'] : array( 'administrator', 'editor' );
        $allowed_users = isset( $settings['allowed_users'] ) ? array_map( 'absint', $settings['allowed_users'] ) : array();

        $args = array(
            'role__in' => $allowed_roles,
            'number'   => 10,
            'orderby'  => 'display_name',
            'order'    => 'ASC',
            'fields'   => array( 'ID', 'display_name', 'user_login' ),
        );
        if ( $q ) {
            $args['search']         = '*' . $q . '*';
            $args['search_columns'] = array( 'display_name', 'user_login', 'user_email' );
        }

        $role_users = get_users( $args );

        // Also fetch explicitly allowed users.
        $extra_users = array();
        if ( ! empty( $allowed_users ) ) {
            $extra_args = array(
                'include' => $allowed_users,
                'fields'  => array( 'ID', 'display_name', 'user_login' ),
            );
            if ( $q ) {
                $extra_args['search']         = '*' . $q . '*';
                $extra_args['search_columns'] = array( 'display_name', 'user_login', 'user_email' );
            }
            $extra_users = get_users( $extra_args );
        }

        // Merge and deduplicate.
        $seen   = array();
        $result = array();
        foreach ( array_merge( $role_users, $extra_users ) as $u ) {
            if ( isset( $seen[ $u->ID ] ) ) continue;
            $seen[ $u->ID ] = true;
            $result[] = array(
                'id'   => (int) $u->ID,
                'name' => $u->display_name,
                'slug' => $u->user_login,
            );
        }

        return rest_ensure_response( $result );
    }

    public function sanitize_int_array( $value ) {
        if ( ! is_array( $value ) ) return array();
        return array_values( array_unique( array_map( 'absint', $value ) ) );
    }

    private function notify_tagged_users( $user_ids, $comment, $data ) {
        $author     = wp_get_current_user();
        $page_title = ! empty( $data['page_title'] ) ? $data['page_title'] : $data['page_url'];
        $page_url   = preg_match( '#^https?://#i', $data['page_url'] ) ? $data['page_url'] : site_url( $data['page_url'] );
        $site_name  = get_bloginfo( 'name' );
        $content    = html_entity_decode( wp_strip_all_tags( preg_replace( '/<br\s*\/?>/i', "\n", $comment['content'] ) ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );

        $author_name = str_replace( array( "\r", "\n" ), '', $author->display_name );

        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
            sprintf( 'From: %s <%s>', $author_name, get_bloginfo( 'admin_email' ) ),
        );

        foreach ( $user_ids as $uid ) {
            $uid = absint( $uid );
            if ( ! $uid || $uid === $author->ID ) continue;

            $user = get_user_by( 'id', $uid );
            if ( ! $user || ! $user->user_email ) continue;

            $subject = sprintf(
                /* translators: 1: author name, 2: page title */
                __( '%1$s mentioned you in a note on "%2$s"', 'keepinmind-dashboard-notes' ),
                $author_name,
                $page_title
            );

            $body = $this->build_mention_email_html( $author_name, $content, $page_title, $page_url, $site_name, $comment['comment_type'] );

            wp_mail( $user->user_email, $subject, $body, $headers );
        }
    }

    private function build_mention_email_html( $author_name, $content, $page_title, $page_url, $site_name, $comment_type = 'pin' ) {
        $a           = esc_html( $author_name );
        $c           = nl2br( esc_html( $content ) );
        $pt          = esc_html( $page_title );
        $pu          = esc_url( $page_url );
        $sn          = esc_html( $site_name );
        $cta         = 'pin' === $comment_type
            ? esc_html__( 'Read and respond', 'keepinmind-dashboard-notes' )
            : esc_html__( 'Read', 'keepinmind-dashboard-notes' );
        $note_label  = esc_html_x( 'Note', 'email section label', 'keepinmind-dashboard-notes' );
        $page_label  = esc_html_x( 'Page', 'email section label', 'keepinmind-dashboard-notes' );
        $heading     = sprintf(
            /* translators: %s: author display name */
            esc_html__( '%s mentioned you in a note', 'keepinmind-dashboard-notes' ),
            $a
        );
        $footer_note = sprintf(
            /* translators: %s: site name */
            esc_html__( 'You received this because you were mentioned in a note on %s.', 'keepinmind-dashboard-notes' ),
            $sn
        );

        return '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
  <tr>
    <td align="center" style="padding:48px 10px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;background-color:#fcfcfc;border-radius:10px;overflow:hidden;border:1px solid #e8e3d9;">
        <tr>
          <td style="padding:36px 20px 28px 20px;border-bottom:1px solid #ececec;">
            <p style="margin:0 0 6px 0;font-size:12px;color:#b0a898;text-transform:uppercase;letter-spacing:0.08em;">' . $sn . '</p>
            <h1 style="margin:0;font-size:18px;font-weight:600;color:#1c1a17;line-height:1.3;">' . $heading . '</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 20px 0 20px;">
            <p style="margin:0 0 10px 0;font-size:11px;font-weight:600;color:#9b9283;text-transform:uppercase;letter-spacing:0.1em;">' . $note_label . '</p>
            <p style="margin:0 0 32px 0;font-size:12px;color:#2e2b25;line-height:1.5;padding:20px 24px;background:#f7f6f3;border-radius:6px;">' . $c . '</p>
            <p style="margin:0 0 10px 0;font-size:11px;font-weight:600;color:#9b9283;text-transform:uppercase;letter-spacing:0.1em;">' . $page_label . '</p>
            <p style="margin:0 0 36px 0;"><a href="' . $pu . '" style="font-size:12px;color:#4f22b1;text-decoration:none;font-weight:500;">' . $pt . '</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 20px 36px 20px;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background-color:#4f22b1;border-radius:30px;">
                  <a href="' . $pu . '" style="display:inline-block;padding:8px 20px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;">' . $cta . ' &#8594;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 20px;border-top:1px solid #ececec;">
            <p style="margin:0;font-size:12px;color:#706a63;">' . $footer_note . '</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>';
    }

    public function get_settings( $request ) {
        $defaults = array(
            'allowed_roles'           => array( 'administrator', 'editor' ),
            'allowed_users'           => array(),
            'markers_visible_default' => true,
            'show_floating_buttons'   => true,
            'delete_policy'           => 'own_only',
            'uninstall_action'        => 'keep',
            'deleted_user_action'     => 'keep',
            'default_privacy'         => 'public',
            'vivid_colors'            => false,
        );
        $settings = get_option( 'haayal_settings', $defaults );
        foreach ( $defaults as $key => $value ) {
            if ( ! isset( $settings[ $key ] ) ) {
                $settings[ $key ] = $value;
            }
        }
        return rest_ensure_response( $settings );
    }

    public function update_settings( $request ) {
        $body     = $request->get_json_params();
        $settings = get_option( 'haayal_settings', array() );

        if ( isset( $body['allowed_roles'] ) && is_array( $body['allowed_roles'] ) ) {
            $wp_roles   = wp_roles();
            $valid_slugs = array_keys( $wp_roles->role_names );
            $roles = array_filter(
                array_map( 'sanitize_text_field', $body['allowed_roles'] ),
                function ( $role ) use ( $valid_slugs ) {
                    return in_array( $role, $valid_slugs, true );
                }
            );
            if ( ! in_array( 'administrator', $roles, true ) ) {
                $roles[] = 'administrator';
            }
            $settings['allowed_roles'] = array_values( $roles );
        }

        if ( isset( $body['allowed_users'] ) && is_array( $body['allowed_users'] ) ) {
            $settings['allowed_users'] = array_map( 'absint', $body['allowed_users'] );
        }

        if ( isset( $body['markers_visible_default'] ) ) {
            $settings['markers_visible_default'] = (bool) $body['markers_visible_default'];
        }

        if ( isset( $body['show_floating_buttons'] ) ) {
            $settings['show_floating_buttons'] = (bool) $body['show_floating_buttons'];
        }

        if ( isset( $body['delete_policy'] ) ) {
            $allowed_policies = array( 'everybody', 'own_only', 'role_hierarchy', 'role_hierarchy_strict' );
            $policy = sanitize_text_field( $body['delete_policy'] );
            if ( in_array( $policy, $allowed_policies, true ) ) {
                $settings['delete_policy'] = $policy;
            }
        }

        if ( isset( $body['uninstall_action'] ) ) {
            $action = sanitize_text_field( $body['uninstall_action'] );
            if ( in_array( $action, array( 'keep', 'delete' ), true ) ) {
                $settings['uninstall_action'] = $action;
            }
        }

        if ( isset( $body['deleted_user_action'] ) ) {
            $action = sanitize_text_field( $body['deleted_user_action'] );
            if ( in_array( $action, array( 'keep', 'delete' ), true ) ) {
                $settings['deleted_user_action'] = $action;
            }
        }

        if ( isset( $body['default_privacy'] ) ) {
            $privacy = sanitize_text_field( $body['default_privacy'] );
            if ( in_array( $privacy, array( 'public', 'private' ), true ) ) {
                $settings['default_privacy'] = $privacy;
            }
        }

        if ( isset( $body['vivid_colors'] ) ) {
            $settings['vivid_colors'] = (bool) $body['vivid_colors'];
        }

        update_option( 'haayal_settings', $settings );

        return rest_ensure_response( $settings );
    }

    public function get_user_visibility( $request ) {
        $user_id = get_current_user_id();
        $value   = get_user_meta( $user_id, 'haayal_markers_visible', true );
        if ( '' === $value ) {
            // No per-user preference yet — use global default.
            $settings = get_option( 'haayal_settings', array() );
            $visible  = ! empty( $settings['markers_visible_default'] );
        } else {
            $visible = (bool) $value;
        }
        return rest_ensure_response( array( 'visible' => $visible ) );
    }

    public function set_user_visibility( $request ) {
        $user_id = get_current_user_id();
        $body    = $request->get_json_params();
        $visible = ! empty( $body['visible'] );
        update_user_meta( $user_id, 'haayal_markers_visible', $visible ? '1' : '0' );
        return rest_ensure_response( array( 'visible' => $visible ) );
    }
}
