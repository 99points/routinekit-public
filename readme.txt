=== AlignPress ===
Contributors: codeleftover
Tags: workflow, checklist, agency, configuration, site management
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reusable configuration workflow checklists for WordPress agencies — stop re-doing the same setup tasks on every client site.

== Description ==

**AlignPress** solves the agency problem of replicating the same WordPress configuration changes across dozens or hundreds of client sites.

Build reusable, step-by-step workflow checklists inside one site, then run them anywhere. Each step includes instructions, a direct deep-link to the exact settings page, and optional evidence capture — so your team always knows what was done, when, and by whom.

= Core Features (Free) =

* **Workflow Builder** — create reusable configuration checklists with step-by-step instructions
* **Guided Runner** — a floating sidebar that walks your team through each step and links directly to the right settings page
* **Auto-Capture** — AlignPress watches wp_options changes as you configure a site and offers to turn them into workflow steps automatically
* **25+ Deep-Links** — pre-built links to the most common WordPress, WooCommerce, Yoast SEO, Wordfence, and UpdraftPlus settings pages
* **5 Starter Templates** — New Site Setup, Security Hardening, WooCommerce Launch, SEO Setup, Site Migration
* **JSON Export/Import** — share workflows between sites via JSON file or URL
* **3 Active Workflows** included on the free plan

= Pro Features =

* **Unlimited Workflows** — no cap on active workflows per site
* **SaaS Dashboard** — manage and assign workflows across all your client sites from one central dashboard
* **Site Groups & Fleet Assignment** — push workflows to groups of client sites from your dashboard
* **Import from URL** — import any shared workflow directly from a URL
* **90-Day Auto-Capture Retention** — extended capture history vs 7 days on free
* **Evidence Capture** — upload screenshots or PDFs as proof of completion per step
* **Audit Trail** — full timestamped log of who completed what and when, with before/after option snapshots
* **Progress Sync** — execution progress synced back to your central dashboard

= How It Works =

1. **Build** — create a workflow with named steps, instructions, and deep-links
2. **Run** — click Run on any workflow to open the floating Runner sidebar
3. **Follow** — the Runner walks you through each step, links you to the right page, and tracks your progress
4. **Done** — all steps completed? AlignPress marks the run complete with a full audit trail

= Auto-Capture =

Turn live configuration sessions into documented workflows automatically. AlignPress monitors wp_options changes as you navigate through settings pages and offers to add them as workflow steps — with the exact option values captured for future reference.

== Installation ==

1. Upload the `alignpress` folder to `/wp-content/plugins/`
2. Activate the plugin from the Plugins screen in WordPress
3. Go to **AlignPress > Workflows** to create your first workflow
4. Use the **Run** button to open the guided Runner sidebar

== Frequently Asked Questions ==

= Does AlignPress replace MainWP or ManageWP? =

No. AlignPress is complementary to multi-site management tools. It focuses on *what* needs to be configured on each site and provides a guided runner to do it, rather than managing plugin updates or security scans.

= Can I share workflows between sites? =

Yes — use the JSON Export button on any workflow, then import the JSON file on another site. Pro users can also import from a URL and share via the central SaaS dashboard.

= How does Auto-Capture work? =

When you navigate to a WordPress settings page and save changes, AlignPress detects which wp_options values changed and shows a notification offering to add them as a workflow step. The step includes a snapshot of the exact settings you changed.

= Is my data sent anywhere? =

On the free plan, all data stays on your own site. Pro users optionally connect to the AlignPress SaaS dashboard for cross-site management — connection requires an explicit API key entry and can be revoked at any time.

= What happens if I deactivate the plugin? =

Deactivating preserves all your workflows and data. To remove all data permanently, uninstall (delete) the plugin.

= Can multiple team members run the same workflow? =

Yes — each run is tracked separately as an execution with its own audit trail. Multiple people can run the same workflow on different sites simultaneously.

== Screenshots ==

1. Workflow Manager — list of all workflows with status and last-run date
2. Step Builder — add and reorder steps with deep-link selector
3. Guided Runner — floating sidebar walking through each step
4. Auto-Capture toast — detected settings change, ready to add as a step
5. Audit Trail — timestamped log of all completed steps

== External Services ==

AlignPress communicates with an external service **only when you explicitly connect to AlignPress Cloud** (a Pro feature). No data is sent to any external server on the free plan.

= AlignPress Cloud (Pro only) =

When you enter a license key and connect to AlignPress Cloud, this plugin sends data to and receives data from `https://alignpress.app`.

**Data sent:**
* Your site URL, site name, and WordPress version (on connect and heartbeat)
* AlignPress plugin version (on heartbeat)
* Workflow structure (title, steps) when you push a workflow to a site group
* Execution completion status when a runner finishes a SaaS-assigned workflow

**Data received:**
* Workflow assignments pushed from your central dashboard
* Template library available for your plan
* License plan status

**When this happens:** Only after you explicitly enter an API key in AlignPress > Settings > Cloud Connection. The connection can be removed at any time from the same screen, after which no further data is sent.

* AlignPress Cloud service: https://alignpress.app
* Privacy policy: https://alignpress.app/privacy
* Terms of service: https://alignpress.app/terms

== Privacy Policy ==

AlignPress captures wp_options changes made during your admin sessions to help you build workflow steps (Auto-Capture feature). This data is stored locally in your own database and is never sent externally on the free plan.

The Auto-Capture buffer stores: the option name, old value, new value, the URL of the admin page where the change occurred, and the WordPress user ID of the person who made the change. This data is retained for a configurable period (default: 7 days) and deleted automatically. It is fully removed when the plugin is uninstalled.

Execution audit trails store: which user ran a workflow, which steps were completed or skipped, timestamps, and any notes or evidence files uploaded. This data is stored locally in your database.

If you connect to AlignPress Cloud (Pro), please review the AlignPress Cloud privacy policy at https://alignpress.app/privacy.

== Changelog ==

= 1.0.0 =
* Initial release
* Workflow Builder with step editor and deep-link selector
* Guided Runner floating sidebar
* Auto-Capture engine for wp_options changes
* 25+ built-in deep-links (WP core, WooCommerce, Yoast, Wordfence, UpdraftPlus, Rank Math, WPForms, SMTP, CF7)
* 5 starter workflow templates
* JSON export and import (file and URL)
* Pro: unlimited workflows
* Pro: SaaS connection for cross-site fleet management and assignment push
* Pro: evidence upload per step
* Pro: full audit trail with user attribution and option snapshots
* Pro: 90-day auto-capture retention
* Pro: import workflows from URL

== Upgrade Notice ==

= 1.0.0 =
Initial release — no upgrade needed.
