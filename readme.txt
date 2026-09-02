=== RoutineKit — Reusable Configuration Checklists ===
Contributors: codeleftover
Tags: workflow, checklist, agency, configuration, site management
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reusable site configuration checklists for WordPress agencies — stop re-doing the same setup tasks on every client site.

== Description ==

**RoutineKit** solves the agency problem of replicating the same WordPress configuration changes across dozens or hundreds of client sites.

Build reusable, step-by-step configuration checklists inside one site, then run them anywhere. Each step includes instructions, a direct deep-link to the exact settings page, and optional evidence capture — so your team always knows what was done, when, and by whom.

= Core Features (Free) =

* **Workflow Builder** — create reusable configuration checklists with step-by-step instructions
* **Guided Runner** — a floating sidebar that walks your team through each step and links directly to the right settings page
* **Auto-Capture** — RoutineKit watches wp_options changes as you configure a site and offers to turn them into workflow steps automatically
* **25+ Deep-Links** — pre-built links to the most common WordPress, WooCommerce, Yoast SEO, Wordfence, and UpdraftPlus settings pages
* **5 Starter Templates** — New Site Setup, Security Hardening, WooCommerce Launch, SEO Setup, Site Migration
* **JSON Export/Import** — share workflows between sites via JSON file or URL
* **Import from URL** — import any shared workflow directly from a URL (requires a connected RoutineKit account)

= Pro Features (Agency / Agency Pro) =

* **SaaS Dashboard** — manage and assign workflows across all your client sites from one central dashboard
* **Site Groups & Fleet Assignment** — push workflows to groups of client sites from your dashboard
* **Note Sharing** — share step notes across sites via the central dashboard
* **Evidence Capture** — upload screenshots or PDFs as proof of completion per step
* **Audit Trail** — full timestamped log of who completed what and when, with before/after option snapshots
* **Progress Sync** — execution progress synced back to your central dashboard
* **Priority Support** — dedicated support for Agency and Agency Pro subscribers

= How It Works =

1. **Build** — create a workflow with named steps, instructions, and deep-links
2. **Run** — click Run on any workflow to open the floating Runner sidebar
3. **Follow** — the Runner walks you through each step, links you to the right page, and tracks your progress
4. **Done** — all steps completed? RoutineKit marks the run complete with a full audit trail

= Auto-Capture =

Turn live configuration sessions into documented workflows automatically. RoutineKit monitors wp_options changes as you navigate through settings pages and offers to add them as workflow steps — with the exact option values captured for future reference.

== Installation ==

1. Upload the `routinekit` folder to `/wp-content/plugins/`
2. Activate the plugin from the Plugins screen in WordPress
3. Go to **RoutineKit > Workflows** to create your first workflow
4. Use the **Run** button to open the guided Runner sidebar

== Frequently Asked Questions ==

= Does RoutineKit replace MainWP or ManageWP? =

No. RoutineKit is complementary to multi-site management tools. It focuses on *what* needs to be configured on each site and provides a guided runner to do it, rather than managing plugin updates or security scans.

= Can I share workflows between sites? =

Yes — use the JSON Export button on any workflow, then import the JSON file on another site. Users with a connected RoutineKit account can also import directly from a URL. Pro users can additionally manage and assign workflows across all sites from the central dashboard.

= How does Auto-Capture work? =

When you navigate to a WordPress settings page and save changes, RoutineKit detects which wp_options values changed and shows a notification offering to add them as a workflow step. The step includes a snapshot of the exact settings you changed.

= Is my data sent anywhere? =

On the free plan, all data stays on your own site. Pro users optionally connect to the RoutineKit Cloud dashboard for cross-site management — connection requires an explicit API key entry and can be revoked at any time.

= What happens if I deactivate the plugin? =

Deactivating preserves all your workflows and data.

Deleting the plugin also preserves your data by default, so you can reinstall without losing anything. If you want a clean removal, enable **Settings > Danger Zone > Delete All Data on Uninstall** before deleting — RoutineKit will then drop its tables and options when the plugin is deleted.

= Can multiple team members run the same workflow? =

Yes — each run is tracked separately as an execution with its own audit trail. Multiple people can run the same workflow on different sites simultaneously.

== Screenshots ==

1. Workflow Manager — list of all workflows with status and last-run date
2. Step Builder — add and reorder steps with deep-link selector
3. Guided Runner — floating sidebar walking through each step
4. Auto-Capture toast — detected settings change, ready to add as a step
5. Audit Trail — timestamped log of all completed steps

== External Services ==

RoutineKit communicates with an external service **only when you explicitly connect to RoutineKit Cloud**. No data is sent to any external server without an active connection.

= RoutineKit Cloud =

When you enter a license key and connect to RoutineKit Cloud, this plugin sends data to and receives data from `https://app.wpstepwise.com`.

**Data sent:**
* Your site URL, site name, and WordPress version (on connect and heartbeat)
* RoutineKit plugin version (on heartbeat)
* Workflow structure (title, steps) when you push a workflow to a site group
* Execution completion status when a runner finishes a SaaS-assigned workflow

**Data received:**
* Workflow assignments pushed from your central dashboard
* Template library available for your plan
* License plan status

**When this happens:** Only after you explicitly enter an API key in RoutineKit > Settings > Cloud Connection. The connection can be removed at any time from the same screen, after which no further data is sent.

* RoutineKit Cloud service: https://app.wpstepwise.com
* Privacy policy: https://wpstepwise.com/privacy
* Terms of service: https://wpstepwise.com/terms

== Privacy Policy ==

RoutineKit captures wp_options changes made during your admin sessions to help you build workflow steps (Auto-Capture feature). This data is stored locally in your own database and is never sent externally on the free plan.

The Auto-Capture buffer stores: the option name, old value, new value, the URL of the admin page where the change occurred, and the WordPress user ID of the person who made the change. This data is retained for a configurable period (default: 30 days, adjustable in Settings) and deleted automatically. It is fully removed when the plugin is uninstalled.

Execution audit trails store: which user ran a workflow, which steps were completed or skipped, timestamps, and any notes or evidence files uploaded. This data is stored locally in your database.

If you connect to RoutineKit Cloud (Pro), please review the RoutineKit Cloud privacy policy at https://wpstepwise.com/privacy.

== Source Code ==

The complete source code for this plugin, including all JSX/JavaScript source files, is publicly available at:

https://github.com/99points/routinekit-public

== Build Instructions ==

The JavaScript assets in this plugin are compiled from source files in the `src/` directory using [@wordpress/scripts](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/) (webpack).

To rebuild from source:

1. Install Node.js (v18+) and npm
2. Run `npm install` in the plugin root
3. Run `npm run build` to compile production assets into `assets/js/`

== Third-Party Libraries ==

This plugin includes the following third-party library:

* **html2canvas** (v1.4.1, MIT License) — https://html2canvas.hertzen.com
  Used to capture screenshots of the admin screen for step evidence. Bundled in `assets/js/html2canvas.min.js` (vanilla capture watcher) and in the webpack chunk `assets/js/548.js` (React runner notes).

== Changelog ==

= 1.0.0 =
* Initial release
* Workflow Builder with step editor and deep-link selector
* Guided Runner floating sidebar
* Auto-Capture engine for wp_options changes
* 25+ built-in deep-links (WP core, WooCommerce, Yoast, Wordfence, UpdraftPlus, Rank Math, WPForms, SMTP, CF7)
* 5 starter workflow templates
* JSON export and import (file and URL)
* Import from URL (requires connected RoutineKit account)
* Auto-Capture retention configurable by all users (default: 30 days)
* Pro: SaaS dashboard for cross-site fleet management and assignment push
* Pro: note sharing across sites
* Pro: evidence upload per step
* Pro: full audit trail with user attribution and option snapshots

== Upgrade Notice ==

= 1.0.0 =
Initial release — no upgrade needed.
