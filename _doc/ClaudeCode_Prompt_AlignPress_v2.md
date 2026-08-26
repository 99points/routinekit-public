# Claude Code — AlignPress WordPress Plugin: Full Build Prompt

## Your Role

You are building a WordPress plugin called **AlignPress**. You are an expert WordPress plugin developer with deep knowledge of PHP, React, WordPress APIs, REST API, Freemius SDK, and SaaS integration patterns. You write clean, documented, acquisition-ready code as if this product will be reviewed by Awesome Motive's engineering team before purchase.

Every decision you make should reflect:
- Clean, well-documented, scalable code
- WordPress coding standards throughout
- Acquisition-readiness (Awesome Motive or similar WP product company)
- Zero technical debt introduced knowingly

---

## What AlignPress Is

AlignPress is a WordPress plugin + SaaS hybrid that helps agencies managing 20–100+ separate WordPress client sites build reusable configuration workflows, execute them with guided step-by-step walkthroughs inside wp-admin, and track completion across their entire site fleet.

**The core problem:** When an agency makes a configuration change on one site (CF7 notification email, WooCommerce tax settings, security plugin config), they need to replicate that exact change across 20, 50, or 100 other client sites. Currently done manually with Google Sheets, logged into each site one by one, with no audit trail and constant risk of losing track.

**How AlignPress solves it:**
- **Workflows** — reusable step-by-step checklists created inside wp-admin
- **Auto-Capture** — detects wp_options changes when saving settings, prompts "add to workflow?"
- **Guided Runner** — floating sidebar inside wp-admin walks team members through each step with direct deep-links to exact settings pages
- **Cross-site Assignment** — assign a workflow to any or all sites from central SaaS dashboard (Pro)
- **Completion Tracking** — per-site and fleet-wide status (Pro)

**Naming conventions used throughout this codebase:**
- Product name: **AlignPress**
- Feature noun: **Workflow** / **Workflows**
- Steps inside a workflow: **Steps**
- Executing a workflow: **Run** / **Running**
- DB table prefix: `alignpress_` (e.g. `wp_alignpress_workflows`)
- PHP function/class prefix: `alignpress_` or `AP_`
- Option prefix: `alignpress_`
- REST namespace: `alignpress/v1`
- Text domain: `alignpress`
- Plugin slug: `alignpress`

---

## Architecture: Single Plugin, Two Modes

One plugin codebase. One zip file. Free and Pro are the same plugin — license key activates Pro features.

```
alignpress/
├── Free mode (no license key)
│   ├── Workflow Manager — create, edit, view workflows on this site
│   ├── Auto-Capture — basic wp_options change detection + toast prompt
│   ├── Guided Runner — floating sidebar execution with deep-links
│   ├── Step Builder — add, edit, reorder steps with deep-link selector
│   ├── 5 bundled starter workflow templates
│   ├── JSON export and import
│   ├── Import from URL (pull workflow from another site's REST endpoint)
│   └── Maximum 3 active workflows (upgrade prompt at limit)
│
└── Pro mode (Freemius license key entered)
    ├── Everything in Free, unlimited workflows
    ├── SaaS sync — push workflows to central SaaS dashboard
    ├── Receive workflow assignments from SaaS
    ├── Push run completion status back to SaaS
    ├── Full deep-link library (50+ plugins, regularly updated)
    ├── Advanced auto-capture with intelligent noise filtering
    ├── Evidence capture per step (screenshot or note attachment)
    ├── Full audit trail with timestamps and user attribution
    ├── Change recording — before/after wp_options snapshot per step
    └── Role-based access — which WP roles can view and run workflows
```

**Feature gating rule:** All Pro checks go through one central helper `alignpress_is_pro()`. Never scatter raw Freemius calls throughout the codebase.

---

## File Structure

Build exactly this structure. Do not deviate or invent new locations:

```
alignpress/
├── alignpress.php                               # Main plugin file, headers, bootstrap
├── readme.txt                                   # WordPress.org readme
├── uninstall.php                                # Clean uninstall handler
├── freemius-config.php                          # Freemius SDK initialisation
│
├── includes/
│   ├── class-alignpress.php                     # Main plugin class, hook registration
│   ├── class-alignpress-activator.php           # Activation: DB table creation
│   ├── class-alignpress-deactivator.php         # Deactivation cleanup
│   ├── class-alignpress-loader.php              # Hook loader pattern
│   │
│   ├── core/
│   │   ├── class-ap-workflow.php                # Workflow CRUD model
│   │   ├── class-ap-step.php                    # Step CRUD model
│   │   ├── class-ap-execution.php               # Execution/run tracking model
│   │   ├── class-ap-capture.php                 # Auto-capture engine
│   │   ├── class-ap-deeplinks.php               # Deep-link library + resolver
│   │   └── class-ap-templates.php               # Bundled starter templates loader
│   │
│   ├── admin/
│   │   ├── class-ap-admin.php                   # Admin menu, pages, enqueue scripts
│   │   ├── class-ap-settings.php                # Settings page handler
│   │   └── class-ap-notices.php                 # Admin notices, upgrade prompts
│   │
│   ├── api/
│   │   ├── class-ap-rest-workflows.php          # REST: alignpress/v1/workflows
│   │   ├── class-ap-rest-steps.php              # REST: alignpress/v1/steps
│   │   ├── class-ap-rest-executions.php         # REST: alignpress/v1/executions
│   │   ├── class-ap-rest-capture.php            # REST: alignpress/v1/capture
│   │   └── class-ap-rest-sync.php               # REST: alignpress/v1/sync (Pro)
│   │
│   ├── saas/
│   │   ├── class-ap-saas-client.php             # HTTP client for SaaS API calls
│   │   ├── class-ap-saas-sync.php               # Sync engine: push/pull SaaS
│   │   └── class-ap-saas-auth.php               # SaaS auth, site registration
│   │
│   └── helpers/
│       ├── functions.php                        # alignpress_is_pro() + helpers
│       └── constants.php                        # ALIGNPRESS_VERSION, DB_VERSION etc.
│
├── admin/
│   ├── partials/
│   │   ├── workflow-manager.php                 # Workflow list page shell (React mount)
│   │   ├── settings.php                         # Settings page shell (React mount)
│   │   └── upgrade.php                          # Upgrade prompt page
│   └── css/
│       └── alignpress-admin.css                 # Non-React admin styles
│
├── src/                                         # React source → built to /assets/js/
│   ├── index.js                                 # Entry: mounts all React apps by page
│   │
│   ├── workflow-manager/                        # Screen 1: Workflow list
│   │   ├── WorkflowManager.jsx
│   │   ├── WorkflowList.jsx
│   │   ├── WorkflowRow.jsx
│   │   └── EmptyState.jsx
│   │
│   ├── step-builder/                            # Screen 2: Edit workflow + steps
│   │   ├── StepBuilder.jsx
│   │   ├── StepList.jsx
│   │   ├── StepItem.jsx
│   │   ├── CapturedStepsPanel.jsx
│   │   └── DeepLinkInput.jsx
│   │
│   ├── runner/                                  # Screen 4: Floating execution sidebar
│   │   ├── Runner.jsx                           # Sidebar shell, persists across pages
│   │   ├── RunnerStep.jsx                       # Individual step display
│   │   ├── RunnerProgress.jsx                   # Progress bar + step count
│   │   ├── RunnerNotes.jsx                      # Per-step notes field
│   │   ├── EvidenceCapture.jsx                  # Screenshot/note attach (Pro)
│   │   └── RunnerLauncher.jsx                   # Persistent floating launch button
│   │
│   ├── capture/                                 # Screen 3: Auto-capture toast
│   │   ├── CaptureToast.jsx                     # Toast notification
│   │   ├── CapturePreview.jsx                   # Shows detected changes (readable)
│   │   └── AddToWorkflowModal.jsx               # Confirm + name step modal
│   │
│   ├── settings/                                # Screen 5: Plugin settings
│   │   ├── Settings.jsx
│   │   ├── SaasConnectionPanel.jsx              # License key + sync status (Pro)
│   │   ├── AutoCaptureSettings.jsx
│   │   └── NotificationSettings.jsx
│   │
│   ├── shared/                                  # Reusable components
│   │   ├── Button.jsx
│   │   ├── Badge.jsx
│   │   ├── Modal.jsx
│   │   ├── Toggle.jsx
│   │   ├── ProBadge.jsx                         # Lock icon for gated features
│   │   ├── UpgradePrompt.jsx                    # Inline upgrade CTA
│   │   └── ProFeature.jsx                       # Wrapper: shows children or upgrade prompt
│   │
│   └── store/                                   # @wordpress/data state
│       ├── index.js                             # Register all stores
│       ├── workflows.js                         # Workflow state + resolvers
│       ├── execution.js                         # Active run state
│       └── capture.js                           # Capture buffer state
│
├── assets/
│   ├── js/
│   │   ├── alignpress-admin.js                  # Built React bundle (all screens)
│   │   └── alignpress-capture.js                # Capture engine (separate lighter bundle)
│   └── css/
│       └── alignpress.css                       # Built styles
│
├── templates/                                   # Bundled starter workflows (JSON)
│   ├── new-site-setup.json
│   ├── woocommerce-config.json
│   ├── pre-launch-qa.json
│   ├── client-handoff.json
│   └── security-hardening.json
│
├── languages/
│   └── alignpress.pot
│
├── vendor/                                      # Freemius SDK
├── package.json
├── webpack.config.js
└── composer.json
```

---

## Database Schema

Create all tables on plugin activation via `dbDelta()`. Always use `$wpdb->prefix . 'alignpress_'` as table prefix. Version-gate schema changes with `ALIGNPRESS_DB_VERSION`.

```sql
-- Workflows
CREATE TABLE {prefix}alignpress_workflows (
    id               BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'draft',
    source           VARCHAR(20) NOT NULL DEFAULT 'local',
    saas_id          VARCHAR(100) DEFAULT NULL,
    template_key     VARCHAR(100) DEFAULT NULL,
    created_by       BIGINT(20) UNSIGNED NOT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_run_at      DATETIME DEFAULT NULL,
    PRIMARY KEY (id),
    KEY status (status),
    KEY source (source)
);

-- Steps within a workflow
CREATE TABLE {prefix}alignpress_steps (
    id               BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    workflow_id      BIGINT(20) UNSIGNED NOT NULL,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    deep_link        VARCHAR(500) DEFAULT NULL,
    deep_link_type   VARCHAR(20) NOT NULL DEFAULT 'static',
    is_required      TINYINT(1) NOT NULL DEFAULT 1,
    evidence_required TINYINT(1) NOT NULL DEFAULT 0,
    sort_order       INT(11) UNSIGNED NOT NULL DEFAULT 0,
    captured_options TEXT DEFAULT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY workflow_id (workflow_id)
);

-- Execution records: one per workflow run per site
CREATE TABLE {prefix}alignpress_executions (
    id               BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    workflow_id      BIGINT(20) UNSIGNED NOT NULL,
    saas_assignment_id VARCHAR(100) DEFAULT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_by       BIGINT(20) UNSIGNED DEFAULT NULL,
    started_at       DATETIME DEFAULT NULL,
    completed_at     DATETIME DEFAULT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY workflow_id (workflow_id),
    KEY status (status),
    KEY saas_assignment_id (saas_assignment_id)
);

-- Step completion records
CREATE TABLE {prefix}alignpress_step_completions (
    id               BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    execution_id     BIGINT(20) UNSIGNED NOT NULL,
    step_id          BIGINT(20) UNSIGNED NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_by     BIGINT(20) UNSIGNED DEFAULT NULL,
    completed_at     DATETIME DEFAULT NULL,
    notes            TEXT DEFAULT NULL,
    evidence_url     VARCHAR(500) DEFAULT NULL,
    skipped_reason   TEXT DEFAULT NULL,
    before_snapshot  LONGTEXT DEFAULT NULL,
    after_snapshot   LONGTEXT DEFAULT NULL,
    PRIMARY KEY (id),
    KEY execution_id (execution_id),
    KEY step_id (step_id)
);

-- Auto-capture buffer: temporary store for detected option changes
CREATE TABLE {prefix}alignpress_capture_buffer (
    id               BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    option_name      VARCHAR(191) NOT NULL,
    option_label     VARCHAR(255) DEFAULT NULL,
    old_value        LONGTEXT,
    new_value        LONGTEXT,
    page_url         VARCHAR(500) DEFAULT NULL,
    captured_by      BIGINT(20) UNSIGNED NOT NULL,
    captured_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    PRIMARY KEY (id),
    KEY status (status),
    KEY captured_by (captured_by)
);
```

**Status values — use these strings, not ENUMs (easier to extend):**
- Workflow status: `draft`, `active`, `archived`
- Workflow source: `local`, `saas`, `imported`
- Execution status: `pending`, `in_progress`, `completed`, `skipped`
- Step completion status: `pending`, `completed`, `skipped`
- Capture buffer status: `pending`, `added`, `dismissed`
- Deep link type: `static`, `dynamic`

---

## wp_options Keys

Every option stored by AlignPress uses the `alignpress_` prefix. Document every key:

```php
// Core
'alignpress_version'              // Installed plugin version
'alignpress_db_version'           // DB schema version for upgrade routines

// SaaS connection (Pro only)
'alignpress_saas_url'             // SaaS base URL, default: https://app.alignpress.io/api
'alignpress_site_token'           // This site's bearer token with SaaS
'alignpress_site_id'              // This site's UUID in SaaS system
'alignpress_last_sync'            // Unix timestamp of last successful sync
'alignpress_sync_queue'           // JSON array of workflow IDs pending sync push

// Auto-capture settings
'alignpress_capture_enabled'      // bool, default true
'alignpress_capture_scope'        // 'all_changes' | 'plugin_settings_only'
'alignpress_capture_exclude'      // JSON array: option names to never capture
'alignpress_capture_retention'    // int: days to keep capture buffer, default 7
'alignpress_capture_min_changes'  // int: minimum changes to trigger toast, default 1

// UI preferences
'alignpress_runner_position'      // 'right' | 'left'
'alignpress_launcher_enabled'     // bool: show persistent floating launcher button
'alignpress_toast_enabled'        // bool: show capture toast notifications
'alignpress_toast_autodismiss'    // int: seconds before auto-dismiss, default 8
```

---

## Core PHP Classes

### Main Plugin File: `alignpress.php`

```php
<?php
/**
 * Plugin Name:       AlignPress
 * Plugin URI:        https://alignpress.app
 * Description:       Reusable configuration workflows for WordPress agencies managing multiple client sites.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Your Name
 * Author URI:        https://alignpress.app
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       alignpress
 * Domain Path:       /languages
 */

defined('ABSPATH') || exit;

require_once plugin_dir_path(__FILE__) . 'includes/helpers/constants.php';
require_once plugin_dir_path(__FILE__) . 'freemius-config.php';

register_activation_hook(__FILE__, ['AlignPress_Activator', 'activate']);
register_deactivation_hook(__FILE__, ['AlignPress_Deactivator', 'deactivate']);

function alignpress_run() {
    require_once plugin_dir_path(__FILE__) . 'includes/class-alignpress.php';
    $plugin = new AlignPress();
    $plugin->init();
}
alignpress_run();
```

### Constants: `includes/helpers/constants.php`

```php
<?php
defined('ABSPATH') || exit;

define('ALIGNPRESS_VERSION',        '1.0.0');
define('ALIGNPRESS_DB_VERSION',     '1.0.0');
define('ALIGNPRESS_PLUGIN_FILE',    plugin_dir_path(dirname(__FILE__, 2)) . 'alignpress.php');
define('ALIGNPRESS_PLUGIN_DIR',     plugin_dir_path(dirname(__FILE__, 2)));
define('ALIGNPRESS_PLUGIN_URL',     plugin_dir_url(dirname(__FILE__, 2)));
define('ALIGNPRESS_TEMPLATES_DIR',  ALIGNPRESS_PLUGIN_DIR . 'templates/');
define('ALIGNPRESS_FREE_WORKFLOW_LIMIT', 3);
define('ALIGNPRESS_SAAS_DEFAULT_URL',    'https://app.alignpress.io/api');
define('ALIGNPRESS_REST_NAMESPACE',      'alignpress/v1');
```

### Helpers: `includes/helpers/functions.php`

```php
<?php
defined('ABSPATH') || exit;

/**
 * Check if the current site has an active AlignPress Pro license.
 * Always use this function — never call Freemius directly in feature code.
 *
 * @return bool
 */
function alignpress_is_pro(): bool {
    if (!function_exists('alignpress_fs')) {
        return false;
    }
    return alignpress_fs()->can_use_premium_code();
}

/**
 * Get the number of active workflows on this site.
 *
 * @return int
 */
function alignpress_get_active_workflow_count(): int {
    global $wpdb;
    return (int) $wpdb->get_var(
        "SELECT COUNT(*) FROM {$wpdb->prefix}alignpress_workflows WHERE status = 'active'"
    );
}

/**
 * Check if free tier workflow limit has been reached.
 *
 * @return bool
 */
function alignpress_at_workflow_limit(): bool {
    if (alignpress_is_pro()) return false;
    return alignpress_get_active_workflow_count() >= ALIGNPRESS_FREE_WORKFLOW_LIMIT;
}

/**
 * Get the SaaS client instance (Pro only).
 *
 * @return AP_SaaS_Client|null
 */
function alignpress_saas(): ?AP_SaaS_Client {
    if (!alignpress_is_pro()) return null;
    static $client = null;
    if (null === $client) {
        $client = new AP_SaaS_Client();
    }
    return $client;
}

/**
 * Log debug messages when WP_DEBUG is enabled.
 *
 * @param mixed  $message
 * @param string $context
 */
function alignpress_log($message, string $context = 'general'): void {
    if (!defined('WP_DEBUG') || !WP_DEBUG) return;
    if (is_array($message) || is_object($message)) {
        $message = print_r($message, true);
    }
    error_log("[AlignPress:{$context}] {$message}");
}
```

---

## Auto-Capture Engine: `includes/core/class-ap-capture.php`

This is the most critical and most delicate class. The noise filter must be aggressive — WordPress writes hundreds of internal options constantly. Only meaningful plugin/theme settings changes should surface to the user.

```php
<?php
defined('ABSPATH') || exit;

class AP_Capture {

    /**
     * Option name patterns to always ignore.
     * Checked via strpos — if option name contains any of these strings, skip it.
     */
    private array $noise_patterns = [
        '_transient_',
        '_site_transient_',
        'cron',
        'session_tokens',
        'rewrite_rules',
        'widget_',
        'sidebars_widgets',
        'recently_activated',
        'auto_updater',
        'wp_user_roles',
        'recovery_mode',
        // WooCommerce noise
        '_wc_session_',
        'woocommerce_queue_flush_rewrite_rules',
        'wc_notices',
        // Elementor noise
        'elementor_log_',
        'elementor_remote_info_',
        // Generic plugin noise
        '_cache_',
        '_queue_',
        '_lock_',
        'heartbeat',
    ];

    /**
     * Exact option names to always ignore.
     */
    private array $noise_exact = [
        'active_plugins',
        'auth_key',
        'secure_auth_key',
        'logged_in_key',
        'nonce_key',
        'db_version',
        'initial_db_version',
    ];

    /**
     * Human-readable labels for known wp_options keys.
     * Expand this list progressively from real usage data.
     */
    private array $option_labels = [
        // WordPress Core
        'blogname'                        => 'Site Title',
        'blogdescription'                 => 'Tagline',
        'admin_email'                     => 'Admin Email Address',
        'siteurl'                         => 'WordPress Address (URL)',
        'home'                            => 'Site Address (URL)',
        'default_role'                    => 'Default User Role',
        'timezone_string'                 => 'Timezone',
        'date_format'                     => 'Date Format',
        'time_format'                     => 'Time Format',
        'posts_per_page'                  => 'Blog Posts Per Page',
        'default_comment_status'          => 'Default Comment Status',
        // WooCommerce
        'woocommerce_store_address'       => 'WooCommerce — Store Address',
        'woocommerce_store_city'          => 'WooCommerce — Store City',
        'woocommerce_default_country'     => 'WooCommerce — Store Country',
        'woocommerce_currency'            => 'WooCommerce — Currency',
        'woocommerce_price_thousand_sep'  => 'WooCommerce — Thousand Separator',
        'woocommerce_tax_based_on'        => 'WooCommerce — Tax Based On',
        'woocommerce_calc_taxes'          => 'WooCommerce — Enable Taxes',
        'woocommerce_email_from_name'     => 'WooCommerce — Email From Name',
        'woocommerce_email_from_address'  => 'WooCommerce — Email From Address',
        // Contact Form 7
        'wpcf7'                           => 'Contact Form 7 — Settings',
        // Yoast SEO
        'wpseo'                           => 'Yoast SEO — General Settings',
        'wpseo_titles'                    => 'Yoast SEO — Title Settings',
        'wpseo_social'                    => 'Yoast SEO — Social Settings',
    ];

    private bool $capture_active = false;
    private array $session_buffer = [];

    /**
     * Register hooks.
     */
    public function init(): void {
        if (!get_option('alignpress_capture_enabled', true)) return;
        if (!current_user_can('manage_options')) return;

        // Start capture session on admin_init (only when a real settings page is loaded)
        add_action('admin_init', [$this, 'maybe_start_capture']);

        // Capture option changes
        add_action('updated_option', [$this, 'handle_option_update'], 10, 3);
        add_action('added_option',   [$this, 'handle_option_add'],    10, 2);

        // After page load finishes, persist buffer and trigger toast
        add_action('shutdown', [$this, 'flush_buffer']);
    }

    /**
     * Only activate capture on genuine settings form submissions.
     * Prevents capturing background WP writes (autosave, heartbeat, cron).
     */
    public function maybe_start_capture(): void {
        // Only capture on POST requests to options pages
        if ('POST' !== $_SERVER['REQUEST_METHOD']) return;

        $page = $_GET['page'] ?? '';
        $action = $_POST['action'] ?? '';

        $is_options_page = (
            isset($_POST['option_page']) ||
            strpos($page, 'settings') !== false ||
            $action === 'update'
        );

        if ($is_options_page) {
            $this->capture_active = true;
        }
    }

    /**
     * Handle updated_option action.
     */
    public function handle_option_update(string $option, $old_value, $new_value): void {
        if (!$this->capture_active) return;
        if ($this->is_noise($option)) return;
        if ($old_value === $new_value) return;

        $this->session_buffer[] = [
            'option_name'  => $option,
            'option_label' => $this->get_option_label($option),
            'old_value'    => maybe_serialize($old_value),
            'new_value'    => maybe_serialize($new_value),
            'page_url'     => $_SERVER['REQUEST_URI'] ?? '',
            'captured_by'  => get_current_user_id(),
        ];
    }

    /**
     * Handle added_option action (new options being set for first time).
     */
    public function handle_option_add(string $option, $value): void {
        if (!$this->capture_active) return;
        if ($this->is_noise($option)) return;
        $this->handle_option_update($option, null, $value);
    }

    /**
     * Flush session buffer to DB at end of request.
     */
    public function flush_buffer(): void {
        if (empty($this->session_buffer)) return;

        $min_changes = (int) get_option('alignpress_capture_min_changes', 1);
        if (count($this->session_buffer) < $min_changes) return;

        global $wpdb;
        $table = $wpdb->prefix . 'alignpress_capture_buffer';

        foreach ($this->session_buffer as $change) {
            $wpdb->insert($table, [
                'option_name'  => sanitize_key($change['option_name']),
                'option_label' => sanitize_text_field($change['option_label']),
                'old_value'    => $change['old_value'],
                'new_value'    => $change['new_value'],
                'page_url'     => esc_url_raw($change['page_url']),
                'captured_by'  => (int) $change['captured_by'],
                'status'       => 'pending',
            ]);
        }

        // Store count in transient — React capture bundle reads this to show toast
        set_transient(
            'alignpress_pending_captures_' . get_current_user_id(),
            count($this->session_buffer),
            300 // 5 minute TTL
        );
    }

    /**
     * Check if an option name is noise and should be ignored.
     */
    private function is_noise(string $option): bool {
        if (in_array($option, $this->noise_exact, true)) return true;

        foreach ($this->noise_patterns as $pattern) {
            if (strpos($option, $pattern) !== false) return true;
        }

        // Check user-defined exclusions
        $user_exclusions = get_option('alignpress_capture_exclude', []);
        if (is_array($user_exclusions) && in_array($option, $user_exclusions, true)) return true;

        return false;
    }

    /**
     * Get human-readable label for an option name.
     * Falls back to auto-converting snake_case to Title Case.
     */
    public function get_option_label(string $option_name): string {
        if (isset($this->option_labels[$option_name])) {
            return $this->option_labels[$option_name];
        }
        // Auto-label: convert snake_case/kebab-case to Title Case
        return ucwords(str_replace(['_', '-'], ' ', $option_name));
    }
}
```

---

## Deep-Link Library: `includes/core/class-ap-deeplinks.php`

```php
<?php
defined('ABSPATH') || exit;

class AP_Deeplinks {

    /**
     * Curated library of admin deep-links.
     * Format: 'key' => ['label', 'url', 'plugin', 'plugin_file']
     * plugin_file used to check if plugin is active before showing link.
     */
    private array $library = [
        // WordPress Core — always available
        'wp_general'         => ['label' => 'General Settings',          'url' => 'options-general.php',                                       'plugin' => 'core', 'plugin_file' => null],
        'wp_writing'         => ['label' => 'Writing Settings',           'url' => 'options-writing.php',                                       'plugin' => 'core', 'plugin_file' => null],
        'wp_reading'         => ['label' => 'Reading Settings',           'url' => 'options-reading.php',                                       'plugin' => 'core', 'plugin_file' => null],
        'wp_discussion'      => ['label' => 'Discussion Settings',        'url' => 'options-discussion.php',                                    'plugin' => 'core', 'plugin_file' => null],
        'wp_media'           => ['label' => 'Media Settings',             'url' => 'options-media.php',                                         'plugin' => 'core', 'plugin_file' => null],
        'wp_permalink'       => ['label' => 'Permalink Settings',         'url' => 'options-permalink.php',                                     'plugin' => 'core', 'plugin_file' => null],
        'wp_privacy'         => ['label' => 'Privacy Settings',           'url' => 'options-privacy.php',                                       'plugin' => 'core', 'plugin_file' => null],
        'wp_users'           => ['label' => 'Users',                      'url' => 'users.php',                                                 'plugin' => 'core', 'plugin_file' => null],
        'wp_plugins'         => ['label' => 'Plugins',                    'url' => 'plugins.php',                                               'plugin' => 'core', 'plugin_file' => null],
        // WooCommerce
        'wc_general'         => ['label' => 'WooCommerce — General',      'url' => 'admin.php?page=wc-settings',                                'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php'],
        'wc_products'        => ['label' => 'WooCommerce — Products',     'url' => 'admin.php?page=wc-settings&tab=products',                   'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php'],
        'wc_tax'             => ['label' => 'WooCommerce — Tax',          'url' => 'admin.php?page=wc-settings&tab=tax',                        'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php'],
        'wc_shipping'        => ['label' => 'WooCommerce — Shipping',     'url' => 'admin.php?page=wc-settings&tab=shipping',                   'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php'],
        'wc_payments'        => ['label' => 'WooCommerce — Payments',     'url' => 'admin.php?page=wc-settings&tab=checkout',                   'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php'],
        'wc_email'           => ['label' => 'WooCommerce — Emails',       'url' => 'admin.php?page=wc-settings&tab=email',                      'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php'],
        'wc_advanced'        => ['label' => 'WooCommerce — Advanced',     'url' => 'admin.php?page=wc-settings&tab=advanced',                   'plugin' => 'woocommerce', 'plugin_file' => 'woocommerce/woocommerce.php'],
        // Contact Form 7
        'cf7_forms'          => ['label' => 'CF7 — All Forms',            'url' => 'admin.php?page=wpcf7',                                      'plugin' => 'contact-form-7', 'plugin_file' => 'contact-form-7/wp-contact-form-7.php'],
        'cf7_settings'       => ['label' => 'CF7 — Settings',             'url' => 'admin.php?page=wpcf7-integration',                          'plugin' => 'contact-form-7', 'plugin_file' => 'contact-form-7/wp-contact-form-7.php'],
        // Yoast SEO
        'yoast_general'      => ['label' => 'Yoast — General',            'url' => 'admin.php?page=wpseo_dashboard',                            'plugin' => 'yoast-seo', 'plugin_file' => 'wordpress-seo/wp-seo.php'],
        'yoast_search'       => ['label' => 'Yoast — Search Appearance',  'url' => 'admin.php?page=wpseo_titles',                               'plugin' => 'yoast-seo', 'plugin_file' => 'wordpress-seo/wp-seo.php'],
        'yoast_social'       => ['label' => 'Yoast — Social',             'url' => 'admin.php?page=wpseo_social',                               'plugin' => 'yoast-seo', 'plugin_file' => 'wordpress-seo/wp-seo.php'],
        // WPForms
        'wpforms_settings'   => ['label' => 'WPForms — Settings',         'url' => 'admin.php?page=wpforms-settings',                           'plugin' => 'wpforms', 'plugin_file' => 'wpforms-lite/wpforms.php'],
        'wpforms_forms'      => ['label' => 'WPForms — All Forms',        'url' => 'admin.php?page=wpforms-overview',                           'plugin' => 'wpforms', 'plugin_file' => 'wpforms-lite/wpforms.php'],
        // WP Mail SMTP
        'smtp_settings'      => ['label' => 'WP Mail SMTP — Settings',    'url' => 'admin.php?page=wp-mail-smtp',                               'plugin' => 'wp-mail-smtp', 'plugin_file' => 'wp-mail-smtp/wp_mail_smtp.php'],
        // Rank Math
        'rankmath_general'   => ['label' => 'Rank Math — General',        'url' => 'admin.php?page=rank-math',                                  'plugin' => 'rank-math', 'plugin_file' => 'seo-by-rank-math/rank-math.php'],
        // Wordfence
        'wordfence_settings' => ['label' => 'Wordfence — Settings',       'url' => 'admin.php?page=WordfenceOptions',                           'plugin' => 'wordfence', 'plugin_file' => 'wordfence/wordfence.php'],
        // Updraft Plus
        'updraft_settings'   => ['label' => 'UpdraftPlus — Settings',     'url' => 'options-general.php?page=updraftplus',                      'plugin' => 'updraftplus', 'plugin_file' => 'updraftplus/updraftplus.php'],
    ];

    /**
     * Get full library, optionally filtered to only active plugins.
     *
     * @param bool $active_only Only return links for active plugins
     * @return array
     */
    public function get_library(bool $active_only = true): array {
        if (!$active_only) {
            return apply_filters('alignpress_deeplink_library', $this->library);
        }

        return array_filter(
            apply_filters('alignpress_deeplink_library', $this->library),
            fn($item) => $item['plugin'] === 'core' || $this->plugin_is_active($item['plugin_file'])
        );
    }

    /**
     * Resolve a URL template, replacing dynamic tokens with real values.
     *
     * @param string $url_template
     * @return string Full admin URL
     */
    public function resolve(string $url_template): string {
        $tokens = [
            '{site_url}'     => get_site_url(),
            '{admin_url}'    => admin_url(),
            '{admin_email}'  => get_option('admin_email'),
        ];

        $url = str_replace(array_keys($tokens), array_values($tokens), $url_template);
        return admin_url($url);
    }

    /**
     * Check if a plugin is active by its plugin file path.
     *
     * @param string|null $plugin_file e.g. 'woocommerce/woocommerce.php'
     * @return bool
     */
    public function plugin_is_active(?string $plugin_file): bool {
        if (null === $plugin_file) return false;
        return is_plugin_active($plugin_file);
    }
}
```

---

## REST API Authentication Pattern

Use this on every REST controller. Supports two auth methods:

```php
<?php

class AP_REST_Workflows extends WP_REST_Controller {

    protected $namespace = ALIGNPRESS_REST_NAMESPACE;
    protected $rest_base = 'workflows';

    public function register_routes(): void {
        register_rest_route($this->namespace, '/' . $this->rest_base, [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [$this, 'get_items'],
                'permission_callback' => [$this, 'get_items_permissions_check'],
            ],
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [$this, 'create_item'],
                'permission_callback' => [$this, 'create_item_permissions_check'],
                'args'                => $this->get_endpoint_args_for_item_schema(true),
            ],
        ]);
    }

    /**
     * Permission check — supports WP nonce (admin UI) and SaaS API key (Pro central dashboard).
     */
    public function get_items_permissions_check(WP_REST_Request $request): bool|WP_Error {
        // Method 1: WordPress nonce — logged-in admin user
        if (current_user_can('manage_options')) {
            return true;
        }

        // Method 2: SaaS API key — Pro only, for central dashboard calls
        if (alignpress_is_pro()) {
            $api_key = $request->get_header('X-AlignPress-Key');
            if (!empty($api_key) && $this->verify_saas_key($api_key)) {
                return true;
            }
        }

        return new WP_Error(
            'alignpress_forbidden',
            __('You do not have permission to access this resource.', 'alignpress'),
            ['status' => 403]
        );
    }

    private function verify_saas_key(string $key): bool {
        $stored_key = get_option('alignpress_saas_site_key', '');
        return !empty($stored_key) && hash_equals($stored_key, $key);
    }
}
```

---

## React: Key Component Specs

### ProFeature Wrapper (`src/shared/ProFeature.jsx`)

Use this everywhere a Pro feature appears. Never duplicate the gate logic:

```jsx
import { UpgradePrompt } from './UpgradePrompt';

const ProFeature = ({ children, feature, inline = false }) => {
    const isPro = window.alignpressData?.isPro ?? false;

    if (isPro) return children;

    return <UpgradePrompt feature={feature} inline={inline} />;
};

export default ProFeature;

// Usage:
// <ProFeature feature="evidence_capture">
//     <EvidenceCapture step={step} />
// </ProFeature>
```

### Runner Sidebar (`src/runner/Runner.jsx`)

The Runner is the core product experience. It is injected on every wp-admin page and persists as the user navigates to deep-linked settings pages:

```jsx
import { useState, useEffect } from 'react';
import { useSelect, useDispatch } from '@wordpress/data';
import RunnerProgress from './RunnerProgress';
import RunnerStep from './RunnerStep';
import RunnerLauncher from './RunnerLauncher';

const Runner = () => {
    const [isOpen, setIsOpen] = useState(true);

    const activeExecution = useSelect(
        select => select('alignpress/execution').getActiveExecution()
    );

    // No active execution — show launcher only
    if (!activeExecution) {
        return <RunnerLauncher hasActive={false} onClick={() => {}} />;
    }

    return (
        <>
            {isOpen && (
                <div className="ap-runner ap-runner--open">
                    <div className="ap-runner__header">
                        <span className="ap-runner__title">
                            {activeExecution.workflow_title}
                        </span>
                        <button
                            className="ap-runner__close"
                            onClick={() => setIsOpen(false)}
                            aria-label="Minimise runner"
                        >×</button>
                    </div>

                    <RunnerProgress
                        current={activeExecution.current_step_index + 1}
                        total={activeExecution.total_steps}
                    />

                    <div className="ap-runner__steps">
                        <RunnerStep
                            step={activeExecution.current_step}
                            executionId={activeExecution.id}
                        />
                    </div>
                </div>
            )}

            <RunnerLauncher
                hasActive={true}
                isOpen={isOpen}
                onClick={() => setIsOpen(!isOpen)}
                progress={`${activeExecution.current_step_index + 1}/${activeExecution.total_steps}`}
            />
        </>
    );
};

export default Runner;
```

### Capture Toast (`src/capture/CaptureToast.jsx`)

```jsx
import { useState, useEffect } from 'react';
import apiFetch from '@wordpress/api-fetch';
import AddToWorkflowModal from './AddToWorkflowModal';

const CaptureToast = () => {
    const [changes, setChanges] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Check if pending captures exist for this page load
        apiFetch({ path: '/alignpress/v1/capture/pending' })
            .then(data => {
                if (data?.changes?.length > 0) {
                    setChanges(data.changes);
                    setVisible(true);
                }
            });
    }, []);

    // Auto-dismiss
    useEffect(() => {
        if (!visible) return;
        const autodismiss = window.alignpressData?.captureAutodismiss ?? 8;
        const timer = setTimeout(() => setVisible(false), autodismiss * 1000);
        return () => clearTimeout(timer);
    }, [visible]);

    if (!visible || changes.length === 0) return null;

    return (
        <div className="ap-capture-toast" role="alert">
            <div className="ap-capture-toast__body">
                <strong>{changes.length} setting{changes.length > 1 ? 's' : ''} changed</strong>
                <span>Add to workflow?</span>
            </div>
            <div className="ap-capture-toast__actions">
                <button
                    className="ap-btn ap-btn--primary ap-btn--sm"
                    onClick={() => setShowModal(true)}
                >
                    Add to Workflow
                </button>
                <button
                    className="ap-btn ap-btn--ghost ap-btn--sm"
                    onClick={() => setVisible(false)}
                >
                    Dismiss
                </button>
            </div>

            {showModal && (
                <AddToWorkflowModal
                    changes={changes}
                    onClose={() => { setShowModal(false); setVisible(false); }}
                />
            )}
        </div>
    );
};

export default CaptureToast;
```

---

## @wordpress/data Store Pattern

```js
// src/store/workflows.js
import { createReduxStore, register } from '@wordpress/data';
import apiFetch from '@wordpress/api-fetch';

const DEFAULT_STATE = {
    workflows: [],
    isLoading: false,
    error: null,
};

const actions = {
    setWorkflows: (workflows) => ({ type: 'SET_WORKFLOWS', workflows }),
    setLoading:   (isLoading) => ({ type: 'SET_LOADING', isLoading }),
    setError:     (error)     => ({ type: 'SET_ERROR', error }),

    fetchWorkflows: () => async ({ dispatch }) => {
        dispatch(actions.setLoading(true));
        try {
            const workflows = await apiFetch({ path: '/alignpress/v1/workflows' });
            dispatch(actions.setWorkflows(workflows));
        } catch (error) {
            dispatch(actions.setError(error.message));
        } finally {
            dispatch(actions.setLoading(false));
        }
    },
};

const reducer = (state = DEFAULT_STATE, action) => {
    switch (action.type) {
        case 'SET_WORKFLOWS': return { ...state, workflows: action.workflows };
        case 'SET_LOADING':   return { ...state, isLoading: action.isLoading };
        case 'SET_ERROR':     return { ...state, error: action.error };
        default:              return state;
    }
};

const selectors = {
    getWorkflows: (state) => state.workflows,
    isLoading:    (state) => state.isLoading,
    getError:     (state) => state.error,
};

const store = createReduxStore('alignpress/workflows', { reducer, actions, selectors });
register(store);

export default store;
```

---

## Data Passed to React from PHP

Always pass data from PHP to React via `wp_localize_script()` or `wp_add_inline_script()`:

```php
// In class-ap-admin.php, when enqueuing scripts:
wp_localize_script('alignpress-admin', 'alignpressData', [
    'nonce'              => wp_create_nonce('wp_rest'),
    'restUrl'            => rest_url('alignpress/v1/'),
    'isPro'              => alignpress_is_pro(),
    'workflowLimit'      => ALIGNPRESS_FREE_WORKFLOW_LIMIT,
    'atLimit'            => alignpress_at_workflow_limit(),
    'currentPage'        => $this->get_current_page(),
    'adminUrl'           => admin_url(),
    'captureEnabled'     => (bool) get_option('alignpress_capture_enabled', true),
    'captureAutodismiss' => (int) get_option('alignpress_toast_autodismiss', 8),
    'saasConnected'      => alignpress_is_pro() && !empty(get_option('alignpress_site_token')),
    'upgradeUrl'         => alignpress_is_pro() ? null : admin_url('admin.php?page=alignpress-upgrade'),
]);
```

---

## SaaS Client: `includes/saas/class-ap-saas-client.php`

```php
<?php
defined('ABSPATH') || exit;

class AP_SaaS_Client {

    private string $base_url;
    private string $site_token;
    private int    $timeout = 15;

    public function __construct() {
        $this->base_url   = get_option('alignpress_saas_url', ALIGNPRESS_SAAS_DEFAULT_URL);
        $this->site_token = get_option('alignpress_site_token', '');
    }

    public function push_workflow(array $workflow): array|WP_Error {
        return $this->post('/v1/workflows', $workflow);
    }

    public function get_assignments(): array|WP_Error {
        return $this->get('/v1/assignments');
    }

    public function push_progress(string $assignment_id, array $progress): array|WP_Error {
        return $this->post("/v1/assignments/{$assignment_id}/progress", $progress);
    }

    public function register_site(string $license_key): array|WP_Error {
        return $this->post('/v1/sites/register', [
            'license_key' => $license_key,
            'site_url'    => get_site_url(),
            'site_name'   => get_bloginfo('name'),
            'wp_version'  => get_bloginfo('version'),
            'plugin_version' => ALIGNPRESS_VERSION,
        ]);
    }

    public function test_connection(): bool {
        $result = $this->get('/v1/ping');
        return !is_wp_error($result);
    }

    private function get(string $endpoint): array|WP_Error {
        $response = wp_remote_get($this->base_url . $endpoint, [
            'headers' => $this->get_headers(),
            'timeout' => $this->timeout,
        ]);
        return $this->handle_response($response);
    }

    private function post(string $endpoint, array $body): array|WP_Error {
        $response = wp_remote_post($this->base_url . $endpoint, [
            'headers' => $this->get_headers(),
            'body'    => wp_json_encode($body),
            'timeout' => $this->timeout,
        ]);
        return $this->handle_response($response);
    }

    private function get_headers(): array {
        return [
            'Authorization' => 'Bearer ' . $this->site_token,
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
            'X-Site-URL'    => get_site_url(),
            'X-Plugin-Ver'  => ALIGNPRESS_VERSION,
        ];
    }

    private function handle_response($response): array|WP_Error {
        if (is_wp_error($response)) {
            alignpress_log('SaaS request failed: ' . $response->get_error_message(), 'saas');
            return $response;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 400) {
            $message = $body['message'] ?? "SaaS error: HTTP {$code}";
            alignpress_log("SaaS error {$code}: {$message}", 'saas');
            return new WP_Error('alignpress_saas_error', $message, ['status' => $code]);
        }

        return $body ?? [];
    }
}
```

---

## Non-Blocking Sync Pattern

Never block the admin UI waiting for SaaS. Always queue and run via WP Cron:

```php
// When a workflow is saved in wp-admin:
add_action('alignpress_workflow_saved', function(int $workflow_id): void {
    if (!alignpress_is_pro()) return;

    // Queue for async sync — don't block the save action
    $queue = get_option('alignpress_sync_queue', []);
    $queue[] = $workflow_id;
    update_option('alignpress_sync_queue', array_unique($queue));

    wp_schedule_single_event(time() + 5, 'alignpress_process_sync_queue');
});

// Cron handler:
add_action('alignpress_process_sync_queue', function(): void {
    $queue = get_option('alignpress_sync_queue', []);
    if (empty($queue)) return;

    $client = alignpress_saas();
    if (!$client) return;

    foreach ($queue as $workflow_id) {
        $workflow = AP_Workflow::get($workflow_id);
        if (!$workflow) continue;

        $result = $client->push_workflow($workflow->to_array());
        if (!is_wp_error($result)) {
            alignpress_log("Synced workflow {$workflow_id}", 'sync');
        }
    }

    // Clear processed queue
    delete_option('alignpress_sync_queue');
});

// Pull assignments (with 15-minute cache):
add_action('admin_init', function(): void {
    if (!alignpress_is_pro()) return;

    $cache_key = 'alignpress_assignments_check';
    if (get_transient($cache_key)) return;

    set_transient($cache_key, true, 15 * MINUTE_IN_SECONDS);

    $result = alignpress_saas()?->get_assignments();
    if (!is_wp_error($result) && !empty($result)) {
        // Store received assignments as pending executions
        foreach ($result as $assignment) {
            AP_Execution::create_from_saas_assignment($assignment);
        }
    }
});
```

---

## Bundled Starter Workflow Template Format

```json
{
    "template_key": "new-site-setup",
    "title": "New Site Setup",
    "description": "Standard configuration steps for every new client WordPress site",
    "version": "1.0",
    "steps": [
        {
            "sort_order": 1,
            "title": "Set site title and tagline",
            "description": "Update to the client's official business name. Do not use the dev/staging placeholder.",
            "deep_link": "options-general.php",
            "deep_link_type": "static",
            "is_required": true,
            "evidence_required": false
        },
        {
            "sort_order": 2,
            "title": "Set admin email address",
            "description": "Change from developer email to client's primary contact. Confirm they can receive emails to this address.",
            "deep_link": "options-general.php",
            "deep_link_type": "static",
            "is_required": true,
            "evidence_required": false
        },
        {
            "sort_order": 3,
            "title": "Configure permalink structure",
            "description": "Set to Post name unless client has specific requirements. Save twice — first save generates .htaccess.",
            "deep_link": "options-permalink.php",
            "deep_link_type": "static",
            "is_required": true,
            "evidence_required": false
        },
        {
            "sort_order": 4,
            "title": "Set timezone",
            "description": "Set to client's local timezone, not UTC. Critical for scheduled posts and WooCommerce orders.",
            "deep_link": "options-general.php",
            "deep_link_type": "static",
            "is_required": true,
            "evidence_required": false
        },
        {
            "sort_order": 5,
            "title": "Disable search engine indexing (confirm it is ON for live sites)",
            "description": "Check Settings > Reading. Staging: indexing OFF. Live: indexing ON. Verify before handoff.",
            "deep_link": "options-reading.php",
            "deep_link_type": "static",
            "is_required": true,
            "evidence_required": true
        }
    ]
}
```

---

## Code Standards — Every Line

**PHP:**
- PHP 7.4 minimum, PHP 8.2 compatible
- All classes prefixed `AP_`, all functions prefixed `alignpress_`
- PHPDoc block on every class and public method
- Sanitize ALL inputs: `sanitize_text_field()`, `sanitize_key()`, `esc_url_raw()`, `intval()`, `absint()`
- Escape ALL outputs: `esc_html()`, `esc_url()`, `esc_attr()`, `wp_json_encode()`
- Nonce on every form (`wp_nonce_field()`) and every AJAX/REST action (`check_ajax_referer()`)
- Capability check on every admin action: `current_user_can('manage_options')`
- Never use `$_GET`/`$_POST` directly — always via `isset()` + sanitize function
- All DB queries via `$wpdb->prepare()` — zero raw interpolated queries
- No direct file includes without `defined('ABSPATH') || exit`

**React / JS:**
- Functional components only — no class components
- `@wordpress/data` for global state — not Redux, not Zustand, not Context alone
- `@wordpress/api-fetch` for all REST calls — handles nonces automatically
- PropTypes on every component (or TypeScript)
- No inline styles — CSS classes only
- CSS custom properties for all colors/spacing (inherits wp-admin design tokens)
- Zero `console.log` statements in committed code

**General:**
- Git from first commit — meaningful commit messages per feature
- `.env` or `wp-config.php` constants for environment config — no hardcoded values
- Constants for all string literals used more than once
- Error states handled in every async operation — no silent failures
- Every REST endpoint returns consistent shape: `{ success, data, message }`

---

## What NOT to Build in v1

Do not build these — they are v2+ features. If you find yourself starting on any of these, stop:

- AI-powered step suggestions
- Screenshot diff comparison between before/after
- Client-facing progress reports
- White-label / agency branding mode
- Shopify or non-WordPress platform connectors
- MainWP extension (build after plugin has real traction)
- Mobile-optimised runner view
- Workflow versioning / changelog

---

## Build Sequence — Follow This Order Exactly

### Phase 1 — Foundation (Week 1–2)
1. Plugin scaffold — `alignpress.php`, main class, loader, constants, helpers
2. Freemius SDK integration + `alignpress_is_pro()` helper wired up
3. DB table creation on activation — all 5 tables via `dbDelta()`
4. Admin menu registration — AlignPress top-level menu, subpages
5. Workflow CRUD — `AP_Workflow` class + REST endpoints
6. Step CRUD — `AP_Step` class + REST endpoints

### Phase 2 — Core React UI (Week 3–4)
7. Webpack build setup with `@wordpress/scripts`
8. `@wordpress/data` stores — workflows, execution, capture
9. Workflow Manager screen — list, create button, status badges, progress column
10. Step Builder screen — add steps, edit title/description, deep-link selector, reorder
11. `wp_localize_script` data bridge — PHP → React

### Phase 3 — The Differentiators (Week 5–6)
12. Auto-capture engine — `AP_Capture` class, noise filter, buffer table
13. Capture REST endpoint — `GET /alignpress/v1/capture/pending`
14. Capture toast React component — shows after settings save
15. Add to Workflow modal — name step, select target workflow, save
16. Runner sidebar React component — floating, persistent across page navigation
17. Execution tracking — `AP_Execution` class + REST endpoints
18. Step tick-off with status + notes field

### Phase 4 — Free Tier Complete (Week 7)
19. Bundled templates loader — 5 JSON templates importable on fresh install
20. JSON export REST endpoint
21. JSON import REST endpoint
22. Import from URL endpoint
23. 3-workflow limit enforcement + upgrade prompt UI
24. Pro feature gates with `<ProFeature>` wrapper + `<UpgradePrompt>` CTAs
25. Settings page — capture settings, UI preferences, notification toggles

### Phase 5 — Pro / SaaS Layer (Week 8–9)
26. `AP_SaaS_Client` class
27. License key activation flow — Freemius + SaaS site registration
28. Non-blocking sync engine — push workflows via WP Cron
29. Pull SaaS assignments — 15-minute cached admin_init check
30. Push execution progress back to SaaS on step completion
31. Evidence capture — file upload per step, stored as attachment
32. Audit trail — full log UI inside runner + workflow detail view
33. Change recording — before/after snapshot stored in step_completions
34. SaaS connection panel in settings — key input, status, last sync, manual sync button

### Phase 6 — Release Prep (Week 10)
35. `uninstall.php` — clean removal of all tables and options
36. `readme.txt` for WordPress.org — description, FAQ, screenshots, changelog
37. Full inline documentation — PHPDoc on all classes, JSDoc on React components
38. Input/output audit — verify every sanitize/escape is in place
39. Unit tests — capture engine noise filter, REST authentication, workflow limit logic
40. QA pass — test free mode end-to-end, upgrade flow, Pro mode end-to-end

---

## First Task

Start with Phase 1, Step 1. Generate these five files in full, ready to run:

1. **`alignpress.php`** — Plugin headers, constants include, Freemius include, activation/deactivation hooks, bootstrap call
2. **`includes/helpers/constants.php`** — All constants defined
3. **`includes/helpers/functions.php`** — `alignpress_is_pro()`, `alignpress_at_workflow_limit()`, `alignpress_saas()`, `alignpress_log()`
4. **`includes/class-alignpress-activator.php`** — Creates all 5 DB tables using `dbDelta()` on activation
5. **`includes/class-alignpress.php`** — Main class with `init()`, admin hooks stubbed, loader pattern

Do not move to Phase 1 Step 2 until these files are generated and confirmed correct.
