<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Haayal_Notes_Admin {

    public function init() {
        add_action( 'admin_menu', array( $this, 'register_pages' ) );
        add_filter( 'plugin_action_links_' . HAAYAL_NOTES_PLUGIN_BASENAME, array( $this, 'add_action_links' ) );
    }

    public function add_action_links( $links ) {
        $notes_link    = '<a href="' . esc_url( admin_url( 'admin.php?page=haayal-notes-dashboard' ) ) . '">' . esc_html__( 'Notes', 'keepinmind-dashboard-notes' ) . '</a>';
        $settings_link = '<a href="' . esc_url( admin_url( 'admin.php?page=haayal-notes-settings' ) ) . '">' . esc_html__( 'Settings', 'keepinmind-dashboard-notes' ) . '</a>';
        array_unshift( $links, $notes_link, $settings_link );
        return $links;
    }

    public function register_pages() {
        add_submenu_page(
            'tools.php',
            __( 'KeepInMind Dashboard Notes', 'keepinmind-dashboard-notes' ),
            __( 'Dashboard Notes', 'keepinmind-dashboard-notes' ),
            'edit_posts',
            'haayal-notes-dashboard',
            array( $this, 'render_dashboard_page' )
        );

        // Settings page registered hidden (no menu item) — accessible via tab navigation.
        add_submenu_page(
            null,
            __( 'KeepInMind Dashboard Notes', 'keepinmind-dashboard-notes' ) . ' — '. __( 'Settings', 'keepinmind-dashboard-notes' ),
            '',
            'manage_options',
            'haayal-notes-settings',
            array( $this, 'render_settings_page' )
        );

        // Settings submenu item under WordPress Settings menu.
        add_submenu_page(
            'options-general.php',
            __( 'KeepInMind Dashboard Notes', 'keepinmind-dashboard-notes' ) . ' — ' . __( 'Settings', 'keepinmind-dashboard-notes' ),
            __( 'Dashboard Notes', 'keepinmind-dashboard-notes' ),
            'manage_options',
            'haayal-notes-settings',
            array( $this, 'render_settings_page' )
        );

        add_filter( 'admin_title', array( $this, 'fix_settings_title' ), 10, 2 );
    }

    public function fix_settings_title( $admin_title, $title ) {
        $screen = get_current_screen();
        if ( $screen && $screen->id === 'admin_page_haayal-notes-settings' ) {
            return __( 'KeepInMind Dashboard Notes', 'keepinmind-dashboard-notes' ) . ' — ' . __( 'Settings', 'keepinmind-dashboard-notes' ) . ' ‹ ' . get_bloginfo( 'name' );
        }
        return $admin_title;
    }

    private function render_nav_tabs( $active ) {
        $tabs = array(
            'dashboard' => array(
                'url'   => admin_url( 'admin.php?page=haayal-notes-dashboard' ),
                'label' => __( 'All Notes', 'keepinmind-dashboard-notes' ),
            ),
            'settings'  => array(
                'url'   => admin_url( 'admin.php?page=haayal-notes-settings' ),
                'label' => __( 'Settings', 'keepinmind-dashboard-notes' ),
            ),
        );
        echo '<nav class="haayal-notes-nav-tabs" aria-label="' . esc_attr__( 'Dashboard Notes navigation', 'keepinmind-dashboard-notes' ) . '">';
        foreach ( $tabs as $key => $tab ) {
            $class = ( $key === $active ) ? 'haayal-notes-nav-item haayal-notes-nav-item-active' : 'haayal-notes-nav-item';
            echo '<a href="' . esc_url( $tab['url'] ) . '" class="' . esc_attr( $class ) . '">' . esc_html( $tab['label'] ) . '</a>';
        }
        echo '</nav>';
    }

    private function render_page_sidebar( $active ) {
        echo '<div class="haayal-notes-page-sidebar">';
        echo '<img src="' . esc_url( HAAYAL_NOTES_PLUGIN_URL . 'assets/png/logo.png' ) . '" alt="Keep In Mind' . esc_attr__( 'KeepInMind Dashboard Notes', 'keepinmind-dashboard-notes' ) . '" class="haayal-notes-page-logo">';
        $this->render_nav_tabs( $active );
        echo '</div>';
    }

    public function render_dashboard_page() {
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__( 'Dashboard Notes', 'keepinmind-dashboard-notes' ) . '</h1>';
        echo '<div class="haayal-notes-page-wrap">';
        $this->render_page_sidebar( 'dashboard' );
        echo '<div class="haayal-notes-page-content">';
        echo '<div id="haayal-notes-dashboard-app"></div>';
        echo '</div>';
        echo '</div>';
        echo '</div>';
    }

    public function render_settings_page() {
        $review_url = 'https://wordpress.org/support/plugin/keepinmind-dashboard-notes/reviews/#new-post';
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__( 'Dashboard Notes Settings', 'keepinmind-dashboard-notes' ) . '</h1>';
        echo '<div class="haayal-notes-page-wrap">';
        $this->render_page_sidebar( 'settings' );
        echo '<div class="haayal-notes-page-content">';
        echo '<div class="haayal-notes-settings-layout">';
        echo '<div id="haayal-notes-settings-app">';
        echo '<div class="haayal-notes-settings-form haayal-notes-skeleton">';
        echo '<div class="haayal-notes-settings-section haayal-notes-skeleton-section" style="height:450px"></div>';
        echo '<div class="haayal-notes-settings-section haayal-notes-skeleton-section" style="height:520px"></div>';
        echo '<div class="haayal-notes-settings-section haayal-notes-skeleton-section" style="height:180px"></div>';
        echo '<div class="haayal-notes-settings-section haayal-notes-skeleton-section" style="height:300px"></div>';
        echo '</div>';
        echo '</div>';
        echo '<aside class="haayal-notes-review-sidebar">';
        echo '<div class="haayal-notes-review-card">';
        echo '<div class="haayal-notes-review-stars" aria-label="5 stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>';
        echo '<h3>' . esc_html__( 'Enjoying Dashboard Notes?', 'keepinmind-dashboard-notes' ) . '</h3>';
        echo '<p>' . esc_html__( 'If it made your day a bit easier, a 5-star review is the best kind of thank you.', 'keepinmind-dashboard-notes' ) . '</p>';
        echo '<a href="' . esc_url( $review_url ) . '" target="_blank" rel="noopener noreferrer" class="haayal-notes-review-cta">' . esc_html__( 'Leave a review', 'keepinmind-dashboard-notes' ) . '</a>';
        echo '</div>';

        echo '<div class="haayal-notes-tip-card">';
        echo '<div class="haayal-notes-tip-icon" aria-hidden="true"><span class="dashicons dashicons-lightbulb"></span></div>';
        echo '<h3>' . esc_html__( 'Tip', 'keepinmind-dashboard-notes' ) . '</h3>';
        echo '<p>' . esc_html__( 'Type @ in a note to mention a user. To highlight text, change its color, or add a link — select the text and choose the desired option from the toolbar.', 'keepinmind-dashboard-notes' ) . '</p>';
        echo '</div>';

        $locale = get_locale();
        if ( 0 !== strpos( $locale, 'en' ) ) {
            $slug_url = ( 'he_IL' === $locale )
                ? 'https://he.wordpress.org/plugins/haayal-ai-slug-translator/'
                : 'https://wordpress.org/plugins/haayal-ai-slug-translator/';
            echo '<div class="haayal-notes-promo-card">';
            echo '<div class="haayal-notes-promo-icon" aria-hidden="true"><span class="dashicons dashicons-admin-links"></span></div>';
            echo '<h3>' . esc_html__( 'Install Ailo – AI Slug Translator', 'keepinmind-dashboard-notes' ) . '</h3>';
            echo '<p>' . esc_html__( 'Non-latin characters turn URLs into long, messy links that are hard to copy, share, and read. Ailo uses AI to turn them into clean, simple slugs instantly.', 'keepinmind-dashboard-notes' ) . '</p>';
            echo '<a href="' . esc_url( $slug_url ) . '" target="_blank" rel="noopener noreferrer" class="haayal-notes-promo-cta">' . esc_html__( 'Install the Plugin', 'keepinmind-dashboard-notes' ) . ' ' . ( is_rtl() ? '&#11164;' : '&#10140;' ) . '</a>';
            echo '</div>';
        }

        echo '</aside>';
        echo '</div>';
        echo '</div>';
        echo '</div>';
        echo '</div>';
    }
}
