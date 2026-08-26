<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Haayal_Notes_Notices {

    /**
     * Notice registry. Add an entry here to wire up a new notice.
     *
     * Each entry:
     *   condition  — callable () : bool   — whether the notice should show
     *   nonce      — string               — nonce action used for dismiss AJAX
     *   on_dismiss — callable () : void   — runs when user dismisses (no return needed)
     *   renderer   — callable () : void   — outputs the notice HTML
     */
    private function get_notices() {
        return array(
            'review' => array(
                'condition'  => array( $this, 'should_show_review_notice' ),
                'capability' => function() { return current_user_can( 'manage_options' ); },
                'nonce'      => 'haayal_dismiss_review',
                'on_dismiss' => array( $this, 'dismiss_review' ),
                'renderer'   => array( $this, 'render_review_notice' ),
            ),
            'activation' => array(
                'condition'  => array( $this, 'should_show_activation_notice' ),
                'capability' => array( 'Haayal_Notes_Permissions', 'current_user_can_comment' ),
                'nonce'      => 'haayal_dismiss_activation',
                'on_dismiss' => array( $this, 'dismiss_activation' ),
                'renderer'   => array( $this, 'render_activation_notice' ),
            ),
        );
    }

    public function init() {
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        add_action( 'admin_notices', array( $this, 'render_notices' ) );
        add_action( 'wp_ajax_haayal_dismiss_notice', array( $this, 'ajax_dismiss' ) );
    }

    public function enqueue_assets() {
        $visible = $this->get_visible_notices();

        if ( empty( $visible ) ) {
            return;
        }

        wp_register_style(
            'haayal-notes-notices-css',
            HAAYAL_NOTES_PLUGIN_URL . 'assets/css/haayal-notes-notices.css',
            array(),
            HAAYAL_NOTES_VERSION
        );
        wp_enqueue_style( 'haayal-notes-notices-css' );

        wp_register_script(
            'haayal-notes-notices-js',
            HAAYAL_NOTES_PLUGIN_URL . 'assets/js/haayal-notes-notices.js',
            array( 'jquery' ),
            HAAYAL_NOTES_VERSION,
            true
        );
        wp_enqueue_script( 'haayal-notes-notices-js' );

        $nonces = array();
        foreach ( $visible as $key => $notice ) {
            $nonces[ $key ] = wp_create_nonce( $notice['nonce'] );
        }

        wp_localize_script( 'haayal-notes-notices-js', 'haayalNoticesData', array(
            'nonces' => $nonces,
        ) );
    }

    public function render_notices() {
        foreach ( $this->get_visible_notices() as $notice ) {
            call_user_func( $notice['renderer'] );
        }
    }

    public function ajax_dismiss() {
        $key     = isset( $_POST['key'] ) ? sanitize_key( wp_unslash( $_POST['key'] ) ) : '';
        $notices = $this->get_notices();

        if ( ! isset( $notices[ $key ] ) ) {
            wp_send_json_error( 'Invalid notice key', 400 );
        }

        $notice = $notices[ $key ];
        check_ajax_referer( $notice['nonce'] );

        if ( ! call_user_func( $notice['capability'] ) ) {
            wp_send_json_error( 'Forbidden', 403 );
        }

        call_user_func( $notice['on_dismiss'] );
        wp_send_json_success();
    }

    // -------------------------------------------------------------------------
    // Renderers
    // -------------------------------------------------------------------------

    private function render_review_notice() {
        $review_url = 'https://wordpress.org/support/plugin/keepinmind-dashboard-notes/reviews/#new-post';
        ?>
        <div class="notice notice-info is-dismissible haayal-notes-review-notice">
            <div class="haayal-notes-review-notice-inner">
                <div class="haayal-notes-review-notice-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <div class="haayal-notes-review-notice-body">
                    <strong><?php esc_html_e( 'Help others discover Dashboard Notes', 'keepinmind-dashboard-notes' ); ?></strong>
                    <span><?php esc_html_e( 'A simple 5-star review helps more people find and use the plugin.', 'keepinmind-dashboard-notes' ); ?></span>
                </div>
                <a href="<?php echo esc_url( $review_url ); ?>" target="_blank" rel="noopener noreferrer" class="haayal-notes-review-notice-cta"><?php esc_html_e( 'Leave a review', 'keepinmind-dashboard-notes' ); ?> <?php echo is_rtl() ? '&#11164;' : '&#10140;'; ?></a>
            </div>
        </div>
        <?php
    }

    private function render_activation_notice() {
        ?>
        <div class="notice notice-success is-dismissible haayal-notes-activation-notice">
            <p><strong><?php esc_html_e( 'Dashboard Notes is now active.', 'keepinmind-dashboard-notes' ); ?></strong></p>
            <p><?php esc_html_e( 'Start capturing ideas, reminders, and tasks right on your dashboard.', 'keepinmind-dashboard-notes' ); ?></p>
            <p><button type="button" class="haayal-notes-btn haayal-notes-btn-primary haayal-notes-activation-cta"><?php esc_html_e( 'Create a new note!', 'keepinmind-dashboard-notes' ); ?></button></p>
        </div>
        <?php
    }

    // -------------------------------------------------------------------------
    // Dismiss callbacks
    // -------------------------------------------------------------------------

    private function dismiss_review() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized', 403 );
        }
        update_option( 'haayal_review_dismissed', time() );
    }

    private function dismiss_activation() {
        delete_transient( 'haayal_activation_notice' );
    }

    // -------------------------------------------------------------------------
    // Conditions
    // -------------------------------------------------------------------------

    private function should_show_review_notice() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return false;
        }

        $dismissed = get_option( 'haayal_review_dismissed', 0 );
        if ( $dismissed && time() < $dismissed + ( 3 * MONTH_IN_SECONDS ) ) {
            return false;
        }

        return Haayal_Notes_DB::should_show_review_notice();
    }

    private function should_show_activation_notice() {
        if ( ! get_transient( 'haayal_activation_notice' ) ) {
            return false;
        }

        return Haayal_Notes_Permissions::current_user_can_comment();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function get_visible_notices() {
        return array_filter(
            $this->get_notices(),
            function ( $notice ) {
                return call_user_func( $notice['condition'] );
            }
        );
    }
}
