=== KeepInMind Dashboard Notes ===
Contributors: elchananlevavi
Tags: notes, admin notes, dashboard notes, team collaboration
Requires at least: 5.8
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 0.8.4.3
License: GPLv3 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Leave notes on any WordPress admin pages. Pin them to specific elements, collaborate, and document actions and guidance inside the dashboard.

== Description ==

KeepInMind Dashboard Notes turns your WordPress dashboard into a collaborative workspace. Place notes directly on any admin page - anchored to the exact element you're talking about. No more Slack messages, emails, or random chats saying “that field on the product edit page” - just click, write your note, and your team sees it right where it matters.

= Why KeepInMind Dashboard Notes? =

Whether you're working in a team or managing a site on your own, the same problem keeps coming up: how to keep track of decisions in the dashboard. Which settings need to change? What does this custom field do? Why is this item configured this way?

KeepInMind Dashboard Notes solves this by letting you **pin notes directly to dashboard elements** - for your team, or for your future self.

Here are just a few real-world scenarios where it shines:

* You temporarily **disable a plugin** to test whether it's causing a conflict. Drop a Warning note on the Plugins page so everyone knows it was turned off on purpose - and so you remember to check back in three weeks.
* You installed a plugin for one very specific reason that isn't obvious. Pin a note to it explaining why it's there, so another admin - or future you - doesn't delete it thinking it's unused.
* A client keeps changing a setting that breaks their site. Attach an always-visible Alert banner right next to that toggle: **"Do not change - this controls the checkout redirect."**
* Your developer configured a custom field with a non-obvious format. Leave a note on the field itself explaining what values are expected, so the content team doesn't have to guess.
* You're onboarding a new team member. Instead of writing a separate training doc, scatter helpful Attention banners across the pages they'll use most - guidance that shows up exactly where they need it.
* You're running a staging review before launch. Pin notes to every area that needs a final check, and let your team reply with updates as they work through the list.

= Key Features =

**Pin Notes Anywhere**
Click any element on any admin page to leave a note. Your note stays anchored to that exact element - a form field, a menu item, a settings toggle, a table row. When your teammate visits the page, they see the note marker right where it belongs.

**Rich Text Editing**
Format your notes with **bold text**, [links](https://), and text colors. The floating toolbar appears on text selection.

**Three Note Types:**

* **Pinned Note** - Appears as a marker on the page. Click to open and manage a threaded discussion.
* **Open Note** - Always visible inline. Choose a color to highlight the note based on its importance.
* **Sticky Note** - Bold square note that sticks in place for highly visible reminders and warnings.

**@Mention Teammates**
Type `@` to mention any allowed user. They'll receive an email notification with your note. Autocomplete helps you find the right person fast - just keep typing to filter.

**Private notes**
Mark any note as private so only you can see it. Perfect for personal reminders and work-in-progress notes. 

**Threaded Replies**
Pinned notes support full threaded replies. Keep conversations organized and contextual without cluttering the page.

**Drag & Relocate**
Notes can be dragged to a new element if the page layout changes. Grab the drag grip and drop it on the right spot - all replies move with it.

**Note Scoping**  
On entity pages (posts, terms, users), choose whether your note applies to **this specific item** or **all items of this type**.  For example, a note on the “Blue T-Shirt” edit page can be scoped just to that product - or to the edit page of all products.

**Configurable Permissions**
Control exactly who can add notes and who can edit or delete:

* **Role-based access** - Choose which roles can use the plugin (Administrator is always included).
* **User-level access** - Whitelist specific users regardless of role.
* **Edit/Delete/Relocate policies** - Author only, role hierarchy (strict or relaxed), or everybody.

== Installation ==

1. Upload the `keepinmind-dashboard-notes` folder to `/wp-content/plugins/`.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Click the floating note button (bottom-right corner) to start placing notes.
4. Configure roles, permissions, and policies under **Settings → Dashboard Notes**.

== Frequently Asked Questions ==

= Who can see the notes? =

Only users with allowed roles or explicitly allowed users can see and create notes. By default, Administrators and Editors have access. You can customize this in the plugin settings.

= Can I use this on the front-end? =

No - KeepInMind Dashboard Notes is designed exclusively for the WordPress admin area. It works on every admin page, including custom post type editors, WooCommerce settings, and third-party plugin pages.

= Will KeepInMind Dashboard Notes slow down my website or the admin dashboard? =

No. Notes are designed to stay lightweight and won’t slow down your admin. They load in the background after the page opens, and the plugin only runs where it’s needed - inside the admin area.

= Can I make a note visible only to myself? =

Yes! Check the **Private** checkbox when creating a note. Private notes are only visible to you - no other user can see them, regardless of their role.

= Isn’t this redundant with the Notes feature in WordPress 7? =
  
No. WordPress 7 Notes are built for **content collaboration** inside Gutenberg - commenting on and suggesting changes within post content.

This plugin focuses on **contextual admin notes** - letting you add notes across the WordPress dashboard (not inside content) to document decisions, highlight important settings, and guide editors in context.

= What happens to notes when I uninstall the plugin? =

By default, all data is preserved. You can change this to automatically delete all notes on uninstall in the plugin settings under **Data Management**.

== Screenshots ==

1. Add visual note markers directly on plugins, and quickly open contextual notes attached to each plugin.
2. Write notes with a rich editor - format text, add links, highlight content, and mention teammates with @mentions.
3. View full note content in a clean, focused panel - including author, timestamp, and actions.
4. Create a new note in seconds - choose between pinned, open, and sticky notes, and place them exactly where they’re needed.
5. Turn notes into conversations - reply, collaborate, and keep context in one place.
6. Document important decisions - explain why specific settings (like script exclusions) were added to avoid future confusion.
7. Guide content editors with contextual notes - remind them to upload a proper featured image and add alt text.
8. Add helpful reminders directly in the editor - like how to schedule or update the publish date.
9. Add sticky notes - bold square notes attached to key areas for highly visible reminders and warnings.
10. Manage all notes in one place - filter, search, and review notes across pages, plugins, and users.
11. Control access and behavior - define who can create notes, set visibility rules, and manage permissions.
12. Attach notes to WooCommerce products - keep pricing rules, updates, and internal instructions visible to your team.


== Changelog ==

= 0.8.4.3 =
Minor bug fixes.

= 0.8.4.2 =
Minor bug fixes.

= 0.8.4.1 =
Minor bug fixes.

= 0.8.4 =
Enhancement: added a vivid color option for notes.
Enhancement: improved mention notification emails.
Fix: REST routes not working when pretty permalinks are disabled. Props to dansart.

= 0.8.3.1 =
Minor bug fixes.

= 0.8.3 =
New: Introduced a new note type - Sticky Notes, designed to stay attached and persist in place, just like real sticky notes in your workspace.
Improvement: Improved compatibility with caching plugins by ensuring the notes retrieval endpoint always returns fresh, real-time data instead of cached responses.

= 0.8.2.9 =
Minor bug fixes & logo update.

= 0.8.2.8 =
Minor bug fixes.

= 0.8.2.7 =
Minor bug fixes.

= 0.8.2.6 =
Improvement: Better handling of notes attached to elements that load dynamically (e.g. via AJAX or DOM updates), helping them appear in the correct position.

= 0.8.2.5 =
Simplified settings page UI for improved usability.

= 0.8.2.4 =
Enhancement: Improved accessibility of the “Original location not found” component and added a modal explaining the issue and possible solutions.

= 0.8.2.3 =
Simplified settings page UI for improved usability.

= 0.8.2.2 =
Minor bug fixes.

= 0.8.2.1 =
Minor bug fixes.

= 0.8.2 =
Simplified settings page UI for improved usability.
Enhancement: Improved plugin file structure.

= 0.8.1 =
Initial release of Dashboard Notes - add contextual notes anywhere in the WordPress admin, collaborate with your team, and keep important decisions exactly where they matter.