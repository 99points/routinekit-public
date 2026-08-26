<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Haayal_Notes_Permissions {

    public static function current_user_can_comment() {
        if ( ! is_user_logged_in() ) {
            return false;
        }

        $user     = wp_get_current_user();
        $settings = get_option( 'haayal_settings', array() );

        $allowed_roles = isset( $settings['allowed_roles'] ) ? $settings['allowed_roles'] : array( 'administrator', 'editor' );
        $allowed_users = isset( $settings['allowed_users'] ) ? $settings['allowed_users'] : array();

        // Check if user ID is explicitly allowed.
        if ( in_array( $user->ID, array_map( 'absint', $allowed_users ), true ) ) {
            return true;
        }

        // Check if any of the user's roles are allowed.
        $user_roles = (array) $user->roles;
        if ( ! empty( array_intersect( $user_roles, $allowed_roles ) ) ) {
            return true;
        }

        return false;
    }

    public static function can_delete_comment( $comment ) {
        if ( ! is_user_logged_in() ) {
            return false;
        }

        $user     = wp_get_current_user();
        $settings = get_option( 'haayal_settings', array() );
        $policy   = isset( $settings['delete_policy'] ) ? $settings['delete_policy'] : 'own_only';

        $comment_user_id = is_array( $comment ) ? $comment['user_id'] : $comment->user_id;

        // Own comments can always be modified regardless of policy.
        if ( (int) $user->ID === (int) $comment_user_id ) {
            return true;
        }

        switch ( $policy ) {
            case 'everybody':
                return true;

            case 'role_hierarchy_strict':
            case 'role_hierarchy':
                $role_levels = array(
                    'administrator' => 4,
                    'editor'        => 3,
                    'author'        => 2,
                    'contributor'   => 1,
                    'subscriber'    => 0,
                );

                $current_level = 0;
                foreach ( (array) $user->roles as $role ) {
                    if ( isset( $role_levels[ $role ] ) && $role_levels[ $role ] > $current_level ) {
                        $current_level = $role_levels[ $role ];
                    }
                }

                $comment_user = get_user_by( 'id', $comment_user_id );
                if ( ! $comment_user ) {
                    return true; // Deleted user, allow cleanup.
                }

                $comment_level = 0;
                foreach ( (array) $comment_user->roles as $role ) {
                    if ( isset( $role_levels[ $role ] ) && $role_levels[ $role ] > $comment_level ) {
                        $comment_level = $role_levels[ $role ];
                    }
                }

                // Strict: only lower role. Normal: same or lower role.
                if ( $policy === 'role_hierarchy_strict' ) {
                    return $current_level > $comment_level;
                }
                return $current_level >= $comment_level;

            case 'own_only':
            default:
                return false;
        }
    }
}
