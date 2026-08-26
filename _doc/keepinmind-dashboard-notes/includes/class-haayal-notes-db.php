<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Haayal_Notes_DB {

    private static function table_name() {
        global $wpdb;
        return $wpdb->prefix . 'haayal_notes';
    }

    public static function get_comments_by_page( $page_url ) {
        global $wpdb;
        $table   = self::table_name();
        $user_id = get_current_user_id();

        $results = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT c.*, COALESCE(u.display_name, NULLIF(c.author_name, ''), '') as author_name
                 FROM {$table} c
                 LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
                 WHERE c.page_url = %s AND (c.is_private = 0 OR c.user_id = %d)
                 ORDER BY c.created_at ASC",
                $page_url,
                $user_id
            ),
            ARRAY_A
        );

        return self::normalize_results( $results ? $results : array() );
    }

    public static function get_all_comments( $page = 1, $per_page = 20, $search = '' ) {
        global $wpdb;
        $table   = self::table_name();
        $offset  = ( $page - 1 ) * $per_page;
        $user_id = get_current_user_id();

        $privacy = '(c.is_private = 0 OR c.user_id = %d)';
        $privacy_args = array( $user_id );

        if ( ! empty( $search ) ) {
            $like = '%' . $wpdb->esc_like( $search ) . '%';
            $search_cond = '(c.content LIKE %s OR u.display_name LIKE %s OR c.page_url LIKE %s)';
            $search_args = array( $like, $like, $like );

            // Find parent IDs that match directly.
            $parent_where_args = array_merge( $privacy_args, $search_args );
            $matched_parents_sql = $wpdb->prepare(
                "SELECT DISTINCT c.id FROM {$table} c
                 LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
                 WHERE c.parent_id = 0 AND {$privacy} AND {$search_cond}",
                ...$parent_where_args
            );

            // Find parent IDs of matching replies.
            $reply_where_args = array_merge( $privacy_args, $search_args );
            $matched_via_reply_sql = $wpdb->prepare(
                "SELECT DISTINCT c.parent_id FROM {$table} c
                 LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
                 WHERE c.parent_id > 0 AND {$privacy} AND {$search_cond}",
                ...$reply_where_args
            );

            // Union both sets of parent IDs, count and paginate.
            $union_sql = "({$matched_parents_sql}) UNION ({$matched_via_reply_sql})";

            $total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM ({$union_sql}) AS matched_parents" ); // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter,WordPress.DB.PreparedSQL.NotPrepared -- $union_sql is composed from two $wpdb->prepare() outputs.

            $parent_ids_rows = $wpdb->get_col( $wpdb->prepare( // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter -- $union_sql is composed from two $wpdb->prepare() outputs.
                "SELECT id FROM {$table} WHERE id IN ({$union_sql}) ORDER BY created_at DESC LIMIT %d OFFSET %d",
                $per_page,
                $offset
            ) );
        } else {
            // Count only parent notes for pagination.
            $count_args = $privacy_args;
            $total = (int) $wpdb->get_var( $wpdb->prepare( // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter -- $privacy is a hard-coded SQL fragment, not user input; $user_id is passed via prepare() args.
                "SELECT COUNT(*) FROM {$table} c
                 LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
                 WHERE c.parent_id = 0 AND {$privacy}",
                ...$count_args
            ) );

            // Fetch parent IDs for this page.
            $page_args = array_merge( $privacy_args, array( $per_page, $offset ) );
            $parent_ids_rows = $wpdb->get_col( $wpdb->prepare( // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter -- $privacy is a hard-coded SQL fragment, not user input; $user_id is passed via prepare() args.
                "SELECT c.id FROM {$table} c
                 LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
                 WHERE c.parent_id = 0 AND {$privacy}
                 ORDER BY c.created_at DESC
                 LIMIT %d OFFSET %d",
                ...$page_args
            ) );
        }

        if ( empty( $parent_ids_rows ) ) {
            return array(
                'comments'    => array(),
                'total'       => $total,
                'page'        => $page,
                'per_page'    => $per_page,
                'total_pages' => (int) ceil( $total / $per_page ),
            );
        }

        $parent_ids = array_map( 'absint', $parent_ids_rows );
        $id_placeholders = implode( ',', array_fill( 0, count( $parent_ids ), '%d' ) );

        // Fetch parents + their replies in one query.
        $fetch_args = array_merge( $parent_ids, $parent_ids, array( $user_id ) );
        $results = $wpdb->get_results( $wpdb->prepare(
            "SELECT c.*, COALESCE(u.display_name, NULLIF(c.author_name, ''), '') as author_name
             FROM {$table} c
             LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
             WHERE (c.id IN ({$id_placeholders}) OR c.parent_id IN ({$id_placeholders}))
               AND (c.is_private = 0 OR c.user_id = %d)
             ORDER BY c.parent_id ASC, c.created_at ASC",
            ...$fetch_args
        ), ARRAY_A );

        // Group: parents first (in DESC created order), then replies after each parent.
        $parents = array();
        $replies = array();
        foreach ( $results as $row ) {
            if ( (int) $row['parent_id'] === 0 ) {
                $parents[ (int) $row['id'] ] = $row;
            } else {
                $replies[ (int) $row['parent_id'] ][] = $row;
            }
        }

        // Maintain the original page order (created_at DESC for parents).
        $ordered = array();
        foreach ( $parent_ids as $pid ) {
            if ( isset( $parents[ $pid ] ) ) {
                $ordered[] = $parents[ $pid ];
                if ( ! empty( $replies[ $pid ] ) ) {
                    foreach ( $replies[ $pid ] as $reply ) {
                        $ordered[] = $reply;
                    }
                }
            }
        }

        return array(
            'comments'    => self::normalize_results( $ordered ),
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => (int) ceil( $total / $per_page ),
        );
    }

    public static function normalize_type( $type ) {
        $map = array(
            'regular'   => 'pin',
            'alert'     => 'open_warning',
            'attention' => 'open_tip',
        );
        return isset( $map[ $type ] ) ? $map[ $type ] : $type;
    }

    private static function normalize_results( $results ) {
        if ( ! is_array( $results ) ) {
            return $results;
        }
        foreach ( $results as &$row ) {
            if ( isset( $row['comment_type'] ) ) {
                $row['comment_type'] = self::normalize_type( $row['comment_type'] );
            }
            $row = self::sanitize_output( $row );
        }
        return $results;
    }

    private static function sanitize_output( $row ) {
        if ( ! is_array( $row ) ) {
            return $row;
        }
        if ( isset( $row['content'] ) ) {
            $row['content'] = Haayal_Notes_REST_Controller::sanitize_rich_content_static( $row['content'] );
        }
        if ( isset( $row['author_name'] ) ) {
            $row['author_name'] = sanitize_text_field( $row['author_name'] );
        }
        if ( isset( $row['page_title'] ) ) {
            $row['page_title'] = sanitize_text_field( $row['page_title'] );
        }
        if ( isset( $row['css_selector'] ) ) {
            $row['css_selector'] = sanitize_text_field( $row['css_selector'] );
        }
        return $row;
    }

    public static function create_comment( $data ) {
        global $wpdb;
        $table = self::table_name();

        $comment_type = isset( $data['comment_type'] ) ? sanitize_text_field( $data['comment_type'] ) : 'pin';
        $allowed = array( 'pin', 'open_warning', 'open_important', 'open_info', 'open_tip', 'regular', 'alert', 'attention', 'sticky_warning', 'sticky_important', 'sticky_info', 'sticky_tip' );
        if ( ! in_array( $comment_type, $allowed, true ) ) {
            $comment_type = 'pin';
        }
        $comment_type = self::normalize_type( $comment_type );

        $inserted = $wpdb->insert(
            $table,
            array(
                'parent_id'    => isset( $data['parent_id'] ) ? absint( $data['parent_id'] ) : 0,
                'user_id'      => absint( $data['user_id'] ),
                'page_url'     => sanitize_text_field( $data['page_url'] ),
                'page_title'   => sanitize_text_field( $data['page_title'] ?? '' ),
                'css_selector' => sanitize_text_field( $data['css_selector'] ?? '' ),
                'pos_x'        => floatval( $data['pos_x'] ?? 0 ),
                'pos_y'        => floatval( $data['pos_y'] ?? 0 ),
                'content'      => Haayal_Notes_REST_Controller::sanitize_rich_content_static( $data['content'] ),
                'comment_type' => $comment_type,
                'is_private'      => ! empty( $data['is_private'] ) ? 1 : 0,
                'banner_layout'   => isset( $data['banner_layout'] ) && in_array( $data['banner_layout'], array( 'full', 'compact' ), true ) ? $data['banner_layout'] : 'full',
                'banner_position' => isset( $data['banner_position'] ) && in_array( $data['banner_position'], array( 'before', 'after' ), true ) ? $data['banner_position'] : 'before',
                'created_at'      => current_time( 'mysql' ),
                'updated_at'      => current_time( 'mysql' ),
            ),
            array( '%d', '%d', '%s', '%s', '%s', '%f', '%f', '%s', '%s', '%d', '%s', '%s', '%s', '%s' )
        );

        if ( false === $inserted ) {
            return false;
        }

        return self::get_comment( $wpdb->insert_id );
    }

    public static function get_comment( $id ) {
        global $wpdb;
        $table = self::table_name();

        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT c.*, COALESCE(u.display_name, NULLIF(c.author_name, ''), '') as author_name
                 FROM {$table} c
                 LEFT JOIN {$wpdb->users} u ON c.user_id = u.ID
                 WHERE c.id = %d",
                $id
            ),
            ARRAY_A
        );
        if ( $row && isset( $row['comment_type'] ) ) {
            $row['comment_type'] = self::normalize_type( $row['comment_type'] );
        }
        return self::sanitize_output( $row );
    }

    public static function update_comment_content( $id, $content, $extra = array() ) {
        global $wpdb;
        $table = self::table_name();

        $data = array(
            'content'    => Haayal_Notes_REST_Controller::sanitize_rich_content_static( $content ),
            'updated_at' => current_time( 'mysql' ),
        );
        $formats = array( '%s', '%s' );

        if ( isset( $extra['banner_layout'] ) ) {
            $layout = sanitize_text_field( $extra['banner_layout'] );
            if ( in_array( $layout, array( 'full', 'compact' ), true ) ) {
                $data['banner_layout'] = $layout;
                $formats[] = '%s';
            }
        }
        if ( isset( $extra['banner_position'] ) ) {
            $position = sanitize_text_field( $extra['banner_position'] );
            if ( in_array( $position, array( 'before', 'after' ), true ) ) {
                $data['banner_position'] = $position;
                $formats[] = '%s';
            }
        }
        if ( isset( $extra['comment_type'] ) ) {
            $type = self::normalize_type( sanitize_text_field( $extra['comment_type'] ) );
            $allowed_types = array( 'pin', 'open_warning', 'open_important', 'open_info', 'open_tip', 'sticky_warning', 'sticky_important', 'sticky_info', 'sticky_tip' );
            if ( in_array( $type, $allowed_types, true ) ) {
                $data['comment_type'] = $type;
                $formats[] = '%s';
            }
        }

        $updated = $wpdb->update(
            $table,
            $data,
            array( 'id' => absint( $id ) ),
            $formats,
            array( '%d' )
        );

        return false !== $updated;
    }

    public static function update_comment_position( $id, $css_selector, $pos_x, $pos_y, $banner_position = null ) {
        global $wpdb;
        $table = self::table_name();

        $data = array(
            'css_selector' => sanitize_text_field( $css_selector ),
            'pos_x'        => floatval( $pos_x ),
            'pos_y'        => floatval( $pos_y ),
            'updated_at'   => current_time( 'mysql' ),
        );
        $formats = array( '%s', '%f', '%f', '%s' );

        if ( null !== $banner_position ) {
            $pos = sanitize_text_field( $banner_position );
            if ( in_array( $pos, array( 'before', 'after' ), true ) ) {
                $data['banner_position'] = $pos;
                $formats[] = '%s';
            }
        }

        $updated = $wpdb->update(
            $table,
            $data,
            array( 'id' => absint( $id ) ),
            $formats,
            array( '%d' )
        );

        return false !== $updated;
    }

    public static function delete_comment( $id ) {
        global $wpdb;
        $table = self::table_name();

        $ids_to_delete = self::get_descendant_ids( $id );
        $ids_to_delete[] = absint( $id );

        $placeholders = implode( ',', array_fill( 0, count( $ids_to_delete ), '%d' ) );
        return $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$table} WHERE id IN ({$placeholders})",
                ...$ids_to_delete
            )
        );
    }

    private static function get_descendant_ids( $parent_id ) {
        global $wpdb;
        $table = self::table_name();

        $children = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT id FROM {$table} WHERE parent_id = %d",
                $parent_id
            )
        );

        $descendants = array();
        foreach ( $children as $child_id ) {
            $descendants[] = absint( $child_id );
            $descendants   = array_merge( $descendants, self::get_descendant_ids( $child_id ) );
        }

        return $descendants;
    }

    public static function delete_comments_by_user( $user_id ) {
        global $wpdb;
        $table = self::table_name();

        return $wpdb->delete( $table, array( 'user_id' => absint( $user_id ) ), array( '%d' ) );
    }

    public static function update_privacy( $id, $is_private ) {
        global $wpdb;
        $table     = self::table_name();
        $id        = absint( $id );
        $private   = $is_private ? 1 : 0;

        // Update the note itself.
        $wpdb->update( $table, array( 'is_private' => $private ), array( 'id' => $id ), array( '%d' ), array( '%d' ) );

        // Update all replies.
        $descendant_ids = self::get_descendant_ids( $id );
        if ( ! empty( $descendant_ids ) ) {
            $placeholders = implode( ',', array_fill( 0, count( $descendant_ids ), '%d' ) );
            $wpdb->query( $wpdb->prepare(
                "UPDATE {$table} SET is_private = %d WHERE id IN ({$placeholders})",
                array_merge( array( $private ), $descendant_ids )
            ) );
        }

        return true;
    }

    public static function should_show_review_notice() {
        global $wpdb;
        $table = self::table_name();

        $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE parent_id = 0" );
        if ( $count < 3 ) {
            return false;
        }

        $newest = $wpdb->get_var( "SELECT MAX(created_at) FROM {$table} WHERE parent_id = 0" );
        if ( ! $newest ) {
            return false;
        }

        return ( strtotime( $newest ) < time() - DAY_IN_SECONDS );
    }

    public static function preserve_author_name( $user_id, $display_name ) {
        global $wpdb;
        $table = self::table_name();

        return $wpdb->update(
            $table,
            array( 'author_name' => sanitize_text_field( $display_name ) ),
            array( 'user_id' => absint( $user_id ) ),
            array( '%s' ),
            array( '%d' )
        );
    }
}
