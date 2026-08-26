(function () {
    'use strict';

    if (typeof haayalData === 'undefined') return;

    var HAAYAL = {
        comments: [],
        excludeSelectors: [],
        markersVisible: haayalData.markersVisible,
        placementMode: false,
        placementType: null, // null | 'open' | 'pin'
        openPopover: null,
        markerElements: [],
        inlineElements: [],
        stickyElements: [],
    };

    var _orphanObserver      = null;
    var _orphanSelectors     = [];
    var _orphanDebounceTimer = null;
    var _orphanTimeoutHandle = null;
    var _observerRendering   = false;

    var ORPHAN_DEBOUNCE_MS = 250;
    var ORPHAN_TIMEOUT_MS  = 5000;

    function isOpenType(t) {
        return t === 'open_warning' || t === 'open_important' || t === 'open_info' || t === 'open_tip';
    }

    function isStickyType(t) {
        return t === 'sticky_warning' || t === 'sticky_important' || t === 'sticky_info' || t === 'sticky_tip';
    }

    /* ===== Rich editor ===== */
    var HAAYAL_COLORS = [
        { color: '#1d2327', label: 'Dark' },
        { color: '#e03131', label: 'Red' },
        { color: '#e8590c', label: 'Orange' },
        { color: '#f08c00', label: 'Amber' },
        { color: '#2f9e44', label: 'Green' },
        { color: '#099268', label: 'Teal' },
        { color: '#1c7ed6', label: 'Blue' },
        { color: '#6741d9', label: 'Purple' },
        { color: '#c2255c', label: 'Pink' },
        { color: '#846358', label: 'Brown' },
    ];

    function findParentLink(node, boundary) {
        while (node && node !== boundary) {
            if (node.nodeType === 1 && node.tagName === 'A') return node;
            node = node.parentNode;
        }
        return null;
    }

    function createRichEditor(initialHtml) {
        var wrap = document.createElement('div');
        wrap.className = 'haayal-notes-rich-editor';

        // Floating toolbar (hidden until selection).
        var toolbar = document.createElement('div');
        toolbar.className = 'haayal-notes-editor-toolbar haayal-notes-editor-toolbar-floating';

        // Bold button.
        var boldBtn = document.createElement('button');
        boldBtn.type = 'button';
        boldBtn.className = 'haayal-notes-toolbar-btn';
        boldBtn.innerHTML = '<strong>B</strong>';
        boldBtn.title = 'Bold';
        boldBtn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            document.execCommand('bold', false, null);
            positionToolbar();
        });
        toolbar.appendChild(boldBtn);

        // Link button.
        var linkBtn = document.createElement('button');
        linkBtn.type = 'button';
        linkBtn.className = 'haayal-notes-toolbar-btn';
        linkBtn.innerHTML = '<span class="dashicons dashicons-admin-links"></span>';
        linkBtn.title = haayalData.i18n.insertLink;
        linkBtn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            var sel = window.getSelection();
            if (!sel.rangeCount) return;
            var savedRange = sel.getRangeAt(0).cloneRange();

            // Check if cursor/selection is inside an existing link.
            var existingLink = findParentLink(sel.anchorNode, editor);
            var prefill = null;
            if (existingLink) {
                prefill = {
                    url: existingLink.getAttribute('href') || '',
                    newTab: existingLink.getAttribute('target') === '_blank',
                };
            }

            hideToolbar();
            openLinkModal(prefill, function (url, newTab) {
                sel.removeAllRanges();
                sel.addRange(savedRange);

                if (existingLink) {
                    // Update existing link.
                    existingLink.href = url;
                    if (newTab) {
                        existingLink.target = '_blank';
                        existingLink.rel = 'noopener noreferrer';
                    } else {
                        existingLink.removeAttribute('target');
                        existingLink.removeAttribute('rel');
                    }
                } else {
                    // Create new link.
                    var a = document.createElement('a');
                    a.href = url;
                    if (newTab) {
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                    }
                    try {
                        savedRange.surroundContents(a);
                    } catch (ex) {
                        a.textContent = savedRange.toString();
                        savedRange.deleteContents();
                        savedRange.insertNode(a);
                    }
                }
                sel.collapseToEnd();
                editor.focus();
            });
        });
        toolbar.appendChild(linkBtn);

        // Color dropdown.
        var colorWrap = document.createElement('div');
        colorWrap.className = 'haayal-notes-toolbar-color-wrap';

        var colorBtn = document.createElement('button');
        colorBtn.type = 'button';
        colorBtn.className = 'haayal-notes-toolbar-btn haayal-notes-toolbar-color-btn';
        colorBtn.innerHTML = 'A';
        colorBtn.title = 'Text Color';
        colorBtn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            colorDropdown.classList.toggle('haayal-notes-dropdown-visible');
        });
        colorWrap.appendChild(colorBtn);

        var colorDropdown = document.createElement('div');
        colorDropdown.className = 'haayal-notes-color-dropdown';

        HAAYAL_COLORS.forEach(function (c) {
            var swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'haayal-notes-color-swatch';
            swatch.style.background = c.color;
            swatch.title = c.label;
            swatch.addEventListener('mousedown', function (e) {
                e.preventDefault();
                colorDropdown.classList.remove('haayal-notes-dropdown-visible');
                document.execCommand('foreColor', false, c.color);
                positionToolbar();
            });
            colorDropdown.appendChild(swatch);
        });

        colorWrap.appendChild(colorDropdown);
        toolbar.appendChild(colorWrap);

        document.body.appendChild(toolbar);

        // Editable area.
        var editor = document.createElement('div');
        editor.className = 'haayal-notes-editor-area';
        editor.contentEditable = 'true';

        // Ensure Enter inserts <br> instead of <div> (skip if mention dropdown is open).
        editor.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey && !mentionDropdown.classList.contains('haayal-notes-mention-visible')) {
                e.preventDefault();
                document.execCommand('insertLineBreak');
            }
        });
        editor.addEventListener('paste', function (e) {
            e.preventDefault();
            var html = e.clipboardData.getData('text/html');
            var sanitized;
            if (html) {
                var tmp = document.createElement('div');
                tmp.innerHTML = html;
                var BLOCK = { p:1, div:1, li:1, ul:1, ol:1, h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, blockquote:1, tr:1, td:1, th:1 };
                function walkNode(node) {
                    var out = '';
                    node.childNodes.forEach(function (child) {
                        if (child.nodeType === 3) {
                            out += child.textContent;
                        } else if (child.nodeType === 1) {
                            var tag = child.tagName.toLowerCase();
                            var inner = walkNode(child);
                            if (tag === 'strong' || tag === 'b') {
                                out += inner ? '<strong>' + inner + '</strong>' : '';
                            } else if (tag === 'a') {
                                var href = (child.getAttribute('href') || '').trim();
                                if (href && /^https?:\/\//i.test(href) && inner) {
                                    out += '<a href="' + href.replace(/"/g, '&quot;') + '">' + inner + '</a>';
                                } else {
                                    out += inner;
                                }
                            } else if (tag === 'br') {
                                out += '<br>';
                            } else {
                                out += inner + (BLOCK[tag] ? '<br>' : '');
                            }
                        }
                    });
                    return out;
                }
                sanitized = walkNode(tmp).replace(/(<br>\s*)+$/, '');
            } else {
                sanitized = (e.clipboardData.getData('text/plain') || '')
                    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br>');
            }
            document.execCommand('insertHTML', false, sanitized);
        });

        if (initialHtml) editor.innerHTML = initialHtml;

        wrap.appendChild(editor);

        // === @ Mention system ===
        var taggedUsers = [];

        // Re-activate existing mention chips (when editing a comment).
        function activateExistingChips() {
            editor.querySelectorAll('.haayal-notes-mention-chip').forEach(function (chip) {
                chip.contentEditable = 'false';
                var uid = parseInt(chip.dataset.userId);
                if (uid && taggedUsers.indexOf(uid) === -1) {
                    taggedUsers.push(uid);
                }
                // Add × button if not present.
                if (!chip.querySelector('.haayal-notes-mention-chip-remove')) {
                    var removeBtn = document.createElement('span');
                    removeBtn.className = 'haayal-notes-mention-chip-remove';
                    removeBtn.textContent = '\u00d7';
                    removeBtn.setAttribute('aria-label', haayalData.i18n.removeMention + ' ' + chip.textContent);
                    removeBtn.addEventListener('click', function () {
                        chip.remove();
                        taggedUsers = taggedUsers.filter(function (id) { return id !== uid; });
                        if (onTagsChangeCallback) onTagsChangeCallback(taggedUsers.length > 0);
                    });
                    chip.appendChild(removeBtn);
                }
            });
        }
        if (initialHtml) activateExistingChips();
        var mentionDropdown = document.createElement('div');
        mentionDropdown.className = 'haayal-notes-mention-dropdown';
        document.body.appendChild(mentionDropdown);
        var mentionSearchTimeout = null;

        function getMentionQuery() {
            var sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return null;
            var node = sel.anchorNode;
            if (node.nodeType !== 3) return null;
            var text = node.textContent.substring(0, sel.anchorOffset);
            var match = text.match(/@(\w*)$/);
            if (!match) return null;
            return { query: match[1], node: node, offset: sel.anchorOffset, atStart: match.index };
        }

        function showMentionDropdown(users, mentionCtx) {
            mentionDropdown.innerHTML = '';
            mentionActiveIndex = -1;
            if (!users.length) { hideMentionDropdown(); return; }

            users.forEach(function (u) {
                var item = document.createElement('div');
                item.className = 'haayal-notes-mention-item';
                item.textContent = u.name;
                item.addEventListener('mousedown', function (e) {
                    e.preventDefault();
                    insertMention(u, mentionCtx);
                });
                mentionDropdown.appendChild(item);
            });

            // Position below caret.
            var sel = window.getSelection();
            if (!sel.rangeCount) return;
            var range = sel.getRangeAt(0);
            var rect = range.getBoundingClientRect();
            mentionDropdown.classList.add('haayal-notes-mention-visible');
            mentionDropdown.style.left = rect.left + window.scrollX + 'px';
            mentionDropdown.style.top = rect.bottom + window.scrollY + 4 + 'px';
        }

        function hideMentionDropdown() {
            mentionDropdown.classList.remove('haayal-notes-mention-visible');
            mentionDropdown.innerHTML = '';
        }

        function insertMention(user, ctx) {
            hideMentionDropdown();
            var sel = window.getSelection();
            if (!sel.rangeCount) return;

            // Remove the @query text.
            var range = document.createRange();
            range.setStart(ctx.node, ctx.atStart);
            range.setEnd(ctx.node, ctx.offset);
            range.deleteContents();

            // Insert mention chip.
            var chip = document.createElement('span');
            chip.className = 'haayal-notes-mention-chip';
            chip.contentEditable = 'false';
            chip.dataset.userId = user.id;
            chip.textContent = '@' + user.name;

            var removeBtn = document.createElement('span');
            removeBtn.className = 'haayal-notes-mention-chip-remove';
            removeBtn.textContent = '\u00d7';
            removeBtn.setAttribute('aria-label', haayalData.i18n.removeMention + ' @' + user.name);
            removeBtn.addEventListener('click', function () {
                chip.remove();
                taggedUsers = taggedUsers.filter(function (id) { return id !== user.id; });
                if (onTagsChangeCallback) onTagsChangeCallback(taggedUsers.length > 0);
            });
            chip.appendChild(removeBtn);

            range.insertNode(chip);

            // Add a space after.
            var space = document.createTextNode('\u00A0');
            chip.after(space);

            // Move cursor after space.
            var newRange = document.createRange();
            newRange.setStartAfter(space);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);

            if (taggedUsers.indexOf(user.id) === -1) {
                taggedUsers.push(user.id);
            }
            if (onTagsChangeCallback) onTagsChangeCallback(taggedUsers.length > 0);
            editor.focus();
        }

        editor.addEventListener('input', function () {
            var ctx = getMentionQuery();
            if (!ctx || mentionsDisabled) { hideMentionDropdown(); return; }
            clearTimeout(mentionSearchTimeout);
            mentionSearchTimeout = setTimeout(function () {
                apiRequest('GET', '/mentions?q=' + encodeURIComponent(ctx.query)).then(function (users) {
                    // Filter out already-tagged and current user.
                    var currentId = parseInt(haayalData.currentUserId);
                    var filtered = users.filter(function (u) {
                        return u.id !== currentId && taggedUsers.indexOf(u.id) === -1;
                    });
                    var freshCtx = getMentionQuery();
                    if (freshCtx) showMentionDropdown(filtered, freshCtx);
                    else hideMentionDropdown();
                });
            }, 200);
        });

        var mentionActiveIndex = -1;

        function updateMentionHighlight() {
            var items = mentionDropdown.querySelectorAll('.haayal-notes-mention-item');
            items.forEach(function (item, i) {
                item.classList.toggle('haayal-notes-mention-active', i === mentionActiveIndex);
            });
            if (items[mentionActiveIndex]) {
                items[mentionActiveIndex].scrollIntoView({ block: 'nearest' });
            }
        }

        editor.addEventListener('keydown', function (e) {
            if (!mentionDropdown.classList.contains('haayal-notes-mention-visible')) return;
            var items = mentionDropdown.querySelectorAll('.haayal-notes-mention-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                mentionActiveIndex = (mentionActiveIndex + 1) % items.length;
                updateMentionHighlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                mentionActiveIndex = mentionActiveIndex <= 0 ? items.length - 1 : mentionActiveIndex - 1;
                updateMentionHighlight();
            } else if (e.key === 'Enter' && mentionActiveIndex >= 0 && items[mentionActiveIndex]) {
                e.preventDefault();
                items[mentionActiveIndex].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideMentionDropdown();
            }
        });

        // Toolbar positioning.
        function positionToolbar() {
            var sel = window.getSelection();
            if (!sel.rangeCount || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
                hideToolbar();
                return;
            }
            var range = sel.getRangeAt(0);
            var rect = range.getBoundingClientRect();
            if (!rect.width) { hideToolbar(); return; }

            toolbar.classList.add('haayal-notes-toolbar-visible');
            var tbRect = toolbar.getBoundingClientRect();
            var left = rect.left + (rect.width / 2) - (tbRect.width / 2);
            var top = rect.top - tbRect.height - 6;
            if (left < 4) left = 4;
            if (top < 4) top = rect.bottom + 6;
            toolbar.style.left = left + window.scrollX + 'px';
            toolbar.style.top = top + window.scrollY + 'px';
        }

        function hideToolbar() {
            toolbar.classList.remove('haayal-notes-toolbar-visible');
            colorDropdown.classList.remove('haayal-notes-dropdown-visible');
        }

        document.addEventListener('selectionchange', function () {
            if (!document.body.contains(editor)) {
                hideToolbar();
                return;
            }
            var sel = window.getSelection();
            if (!sel.rangeCount || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
                hideToolbar();
                return;
            }
            positionToolbar();
        });

        editor.addEventListener('keydown', function () {
            setTimeout(positionToolbar, 0);
        });

        // Delete chip on single Backspace when cursor is immediately after it.
        editor.addEventListener('keydown', function (e) {
            if (e.key !== 'Backspace') return;
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            var range = sel.getRangeAt(0);
            if (!range.collapsed) return;
            var node = range.startContainer;
            var offset = range.startOffset;
            var prev = null;
            if (node.nodeType === Node.TEXT_NODE) {
                if (offset === 0) prev = node.previousSibling;
            } else {
                if (offset > 0) prev = node.childNodes[offset - 1];
            }
            if (prev && prev.nodeType === Node.ELEMENT_NODE && prev.classList.contains('haayal-notes-mention-chip')) {
                e.preventDefault();
                prev.remove(); // MutationObserver fires → updates taggedUsers + callback
            }
        });

        // Mention/private mutual exclusion.
        var mentionsDisabled = false;
        var onTagsChangeCallback = null;
        wrap.setMentionsDisabled = function (disabled) {
            mentionsDisabled = disabled;
            if (disabled) hideMentionDropdown();
        };
        wrap.hasTags = function () {
            return taggedUsers.length > 0;
        };
        wrap.onTagsChange = function (cb) {
            onTagsChangeCallback = cb;
        };

        wrap.getContent = function () {
            // Keep mention chip spans but strip × remove buttons.
            var clone = editor.cloneNode(true);
            clone.querySelectorAll('.haayal-notes-mention-chip-remove').forEach(function (btn) {
                btn.remove();
            });
            return clone.innerHTML.replace(/<br\s*\/?>$/i, '').trim();
        };
        wrap.setContent = function (html) {
            editor.innerHTML = html;
        };
        wrap.focus = function () {
            editor.focus();
        };
        wrap.editorEl = editor;
        wrap.getTaggedUsers = function () {
            return taggedUsers.slice();
        };

        // Sync taggedUsers when chips are removed via backspace/delete (not the × button).
        var chipObserver = new MutationObserver(function (mutations) {
            var changed = false;
            mutations.forEach(function (m) {
                m.removedNodes.forEach(function (node) {
                    if (node.nodeType === 1 && node.classList && node.classList.contains('haayal-notes-mention-chip')) {
                        var uid = parseInt(node.dataset.userId);
                        if (uid) {
                            taggedUsers = taggedUsers.filter(function (id) { return id !== uid; });
                            changed = true;
                        }
                    }
                });
            });
            if (changed && onTagsChangeCallback) onTagsChangeCallback(taggedUsers.length > 0);
        });
        chipObserver.observe(editor, { childList: true, subtree: true });

        // Cleanup toolbar and mention dropdown when editor is removed from DOM.
        var observer = new MutationObserver(function () {
            if (!document.body.contains(editor)) {
                hideToolbar();
                hideMentionDropdown();
                toolbar.remove();
                mentionDropdown.remove();
                chipObserver.disconnect();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return wrap;
    }

    function openLinkModal(prefill, callback) {
        var overlay = document.createElement('div');
        overlay.className = 'haayal-notes-link-modal-overlay';

        var modal = document.createElement('div');
        modal.className = 'haayal-notes-link-modal';

        var title = document.createElement('h4');
        title.textContent = prefill ? haayalData.i18n.editLink : haayalData.i18n.insertLink;
        modal.appendChild(title);

        var urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.className = 'haayal-notes-link-modal-input';
        urlInput.placeholder = 'https://...';
        if (prefill) urlInput.value = prefill.url;
        modal.appendChild(urlInput);

        var newTabLabel = document.createElement('label');
        newTabLabel.className = 'haayal-notes-link-modal-newtab';
        var newTabCb = document.createElement('input');
        newTabCb.type = 'checkbox';
        newTabCb.checked = prefill ? prefill.newTab : true;
        newTabLabel.appendChild(newTabCb);
        newTabLabel.appendChild(document.createTextNode(' ' + haayalData.i18n.openInNewTab));
        modal.appendChild(newTabLabel);

        var btns = document.createElement('div');
        btns.className = 'haayal-notes-link-modal-actions';

        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'haayal-notes-btn haayal-notes-btn-secondary';
        cancelBtn.textContent = haayalData.i18n.cancel;
        cancelBtn.addEventListener('click', function () { overlay.remove(); });
        btns.appendChild(cancelBtn);

        var insertBtn = document.createElement('button');
        insertBtn.type = 'button';
        insertBtn.className = 'haayal-notes-btn haayal-notes-btn-primary';
        insertBtn.textContent = prefill ? haayalData.i18n.update : haayalData.i18n.insert;
        insertBtn.addEventListener('click', function () {
            var url = urlInput.value.trim();
            if (!url) return;
            overlay.remove();
            callback(url, newTabCb.checked);
        });
        btns.appendChild(insertBtn);

        modal.appendChild(btns);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        urlInput.focus();
    }

    /* ===== Kebab (3-dots) menu helper ===== */
    var activeKebabMenu = null;
    var activeKebabTrigger = null;
    var releaseKebabTrap = null;

    function openKebabMenu(triggerEl, menuEl) {
        closeKebabMenu();
        var rect = triggerEl.getBoundingClientRect();
        menuEl.style.position = 'fixed';
        menuEl.style.zIndex = '100060';
        menuEl.style.display = 'block';
        document.body.appendChild(menuEl);

        var menuW = menuEl.offsetWidth;
        var menuH = menuEl.offsetHeight;
        var left = rect.right - menuW;
        if (left < 4) left = rect.left;
        var top = rect.bottom + 2;
        if (top + menuH > window.innerHeight) top = rect.top - menuH - 2;

        menuEl.style.left = left + 'px';
        menuEl.style.top = top + 'px';
        activeKebabMenu = menuEl;
        activeKebabTrigger = triggerEl;

        // WAI-ARIA: mark trigger as expanded.
        triggerEl.setAttribute('aria-expanded', 'true');

        // WAI-ARIA: focus first menuitem.
        var items = Array.from(menuEl.querySelectorAll('[role="menuitem"]'));
        if (items.length) {
            items[0].setAttribute('tabindex', '0');
            items[0].focus();
        }

        // Push a menubar-style focus trap: Arrow keys navigate, Tab closes.
        var kebabEntry = {
            onEscape: function () {
                closeKebabMenu();
                triggerEl.focus();
            },
            isMenubar: true,
            getItems: function () {
                return Array.from(menuEl.querySelectorAll('[role="menuitem"]'));
            },
        };
        focusTrapStack.push(kebabEntry);
        releaseKebabTrap = function () {
            var idx = focusTrapStack.indexOf(kebabEntry);
            if (idx !== -1) focusTrapStack.splice(idx, 1);
        };
    }

    function closeKebabMenu() {
        if (releaseKebabTrap) {
            releaseKebabTrap();
            releaseKebabTrap = null;
        }
        if (activeKebabTrigger) {
            activeKebabTrigger.setAttribute('aria-expanded', 'false');
        }
        if (activeKebabMenu && activeKebabMenu.parentElement) {
            activeKebabMenu.style.display = 'none';
            activeKebabMenu.remove();
        }
        activeKebabMenu = null;
        activeKebabTrigger = null;
    }

    /* ===== Focus trap helper (stack-based) ===== */
    var FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex="0"], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"]';
    var focusTrapStack = [];

    function focusTrapHandler(e) {
        if (!focusTrapStack.length) return;
        var top = focusTrapStack[focusTrapStack.length - 1];
        if (e.key === 'Escape') {
            e.preventDefault();
            if (top.onEscape) top.onEscape();
            return;
        }

        // Menubar-style trap: Arrow keys move focus, Tab closes menu.
        if (top.isMenubar) {
            var items = top.getItems();
            if (!items.length) return;
            var idx = items.indexOf(document.activeElement);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                var next = idx >= items.length - 1 ? 0 : idx + 1;
                items.forEach(function (it) { it.setAttribute('tabindex', '-1'); });
                items[next].setAttribute('tabindex', '0');
                items[next].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                var prev = idx <= 0 ? items.length - 1 : idx - 1;
                items.forEach(function (it) { it.setAttribute('tabindex', '-1'); });
                items[prev].setAttribute('tabindex', '0');
                items[prev].focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                items.forEach(function (it) { it.setAttribute('tabindex', '-1'); });
                items[0].setAttribute('tabindex', '0');
                items[0].focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                items.forEach(function (it) { it.setAttribute('tabindex', '-1'); });
                items[items.length - 1].setAttribute('tabindex', '0');
                items[items.length - 1].focus();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (top.onEscape) top.onEscape();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (document.activeElement && items.indexOf(document.activeElement) !== -1) {
                    document.activeElement.click();
                }
            }
            return;
        }

        if (e.key !== 'Tab') return;
        var focusable = top.getFocusable();
        if (!focusable.length) return;
        var idx = focusable.indexOf(document.activeElement);
        e.preventDefault();
        if (e.shiftKey) {
            focusable[idx <= 0 ? focusable.length - 1 : idx - 1].focus();
        } else {
            focusable[idx >= focusable.length - 1 ? 0 : idx + 1].focus();
        }
    }
    document.addEventListener('keydown', focusTrapHandler, true);

    function trapFocus(container, onEscape) {
        var entry = {
            container: container,
            onEscape: onEscape,
            getFocusable: function () {
                return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
            },
        };
        focusTrapStack.push(entry);
        return function () {
            var idx = focusTrapStack.indexOf(entry);
            if (idx !== -1) focusTrapStack.splice(idx, 1);
        };
    }

    /* ===== Toast notification ===== */
    function showToast(message) {
        var toast = document.createElement('div');
        toast.className = 'haayal-notes-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('haayal-notes-toast-visible');
        }, 10);
        setTimeout(function () {
            toast.classList.remove('haayal-notes-toast-visible');
            setTimeout(function () { toast.remove(); }, 300);
        }, 3000);
    }

    /* ===== API helpers ===== */
    var _tempIdCounter = 0;

    function apiRequest(method, endpoint, data) {
        var opts = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': haayalData.nonce,
            },
        };
        if (data) opts.body = JSON.stringify(data);
        var qIdx = endpoint.indexOf('?');
        var path = qIdx === -1 ? endpoint : endpoint.slice(0, qIdx);
        var qs   = qIdx === -1 ? '' : endpoint.slice(qIdx + 1);
        var base = haayalData.restUrl + path;
        var url  = qs ? base + (base.indexOf('?') !== -1 ? '&' : '?') + qs : base;
        return fetch(url, opts).then(function (r) {
            if (!r.ok) {
                var status = r.status;
                return r.json().then(function (err) {
                    var msg = (err && err.message) ? err.message : 'Request failed (' + status + ')';
                    console.error('HAAYAL API error:', msg);
                    var e = new Error(msg);
                    e.status = status;
                    return Promise.reject(e);
                });
            }
            return r.json().then(function (json) {
                if (method !== 'GET') {
                    document.dispatchEvent(new CustomEvent('haayal-notes-changed', { detail: { source: 'main' } }));
                }
                return json;
            });
        });
    }

    /**
     * If markers are hidden, flip visibility to SHOW and persist.
     * Also animates the visibility button to draw attention.
     */
    function ensureMarkersVisible() {
        if (HAAYAL.markersVisible) return;
        HAAYAL.markersVisible = true;
        var visBtn = document.querySelector('.haayal-notes-visibility-btn');
        if (visBtn) {
            visBtn.classList.remove('hidden');
            visBtn.innerHTML = '<span class="haayal-notes-vis-icon">&#128065;</span> ' + haayalData.i18n.hide;
            visBtn.classList.add('haayal-notes-vis-pulse');
            visBtn.addEventListener('animationend', function handler() {
                visBtn.classList.remove('haayal-notes-vis-pulse');
                visBtn.removeEventListener('animationend', handler);
            });
        }
        apiRequest('POST', '/user/visibility', { visible: true });
    }

    /**
     * Optimistic create: immediately insert a temporary comment into
     * HAAYAL.comments and re-render, then fire the API request.
     * On success, silently swap the temp comment for the real server object.
     * On failure, rollback and show toast.
     */
    function optimisticCreate(data, afterRender) {
        var savedComments = HAAYAL.comments.slice();
        var tempId = 'temp_' + (++_tempIdCounter);
        var tempComment = {
            id: tempId,
            parent_id: data.parent_id || 0,
            user_id: haayalData.currentUserId,
            author_name: haayalData.currentUserName,
            page_url: data.page_url,
            page_title: data.page_title || '',
            css_selector: data.css_selector || '',
            pos_x: data.pos_x || 0,
            pos_y: data.pos_y || 0,
            content: data.content,
            comment_type: data.comment_type || 'pin',
            is_private: data.is_private ? 1 : 0,
            banner_layout: data.banner_layout || 'full',
            banner_position: data.banner_position || 'before',
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
            updated_at: null,
            _optimistic: true,
        };
        HAAYAL.comments.push(tempComment);
        ensureMarkersVisible();
        renderAll();
        if (afterRender) afterRender(tempId);

        apiRequest('POST', '/notes', data).then(function (serverComment) {
            // Silently replace temp with real server data — no re-render.
            for (var i = 0; i < HAAYAL.comments.length; i++) {
                if (HAAYAL.comments[i].id === tempId) {
                    // Mutate in place so all closures that captured this
                    // object reference automatically see the real server ID.
                    Object.assign(HAAYAL.comments[i], serverComment);
                    break;
                }
            }
            // Update any marker still referencing the temp ID so click
            // handlers resolve against the real server ID.
            HAAYAL.markerElements.forEach(function (m) {
                if (m.dataset.commentId === tempId) {
                    m.dataset.commentId = String(serverComment.id);
                }
            });
        }).catch(function (err) {
            if (data.parent_id && err && err.status === 404) {
                // Parent was deleted in another window — remove it and all its
                // descendants (including the temp reply) from the local state.
                var parentId = String(data.parent_id);
                var toRemove = {};
                toRemove[parentId] = true;
                var changed = true;
                while (changed) {
                    changed = false;
                    HAAYAL.comments.forEach(function (c) {
                        var cid = String(c.id);
                        var pid = String(c.parent_id);
                        if (!toRemove[cid] && toRemove[pid]) {
                            toRemove[cid] = true;
                            changed = true;
                        }
                    });
                }
                HAAYAL.comments = HAAYAL.comments.filter(function (c) {
                    return !toRemove[String(c.id)];
                });
                renderAll();
                showToast(haayalData.i18n.parentNoteDeleted);
            } else {
                HAAYAL.comments = savedComments;
                renderAll();
                showToast(haayalData.i18n.genericError);
            }
        });
    }

    /**
     * Optimistic delete: immediately remove the comment (and its replies)
     * from HAAYAL.comments and re-render.
     * On failure, rollback and show toast.
     */
    function optimisticDelete(commentOrId) {
        var savedComments = HAAYAL.comments.slice();
        var resolvedId;
        if (commentOrId && typeof commentOrId === 'object') {
            // Full comment object passed — resolve directly (handles stale temp IDs).
            resolvedId = String(resolveCommentId(commentOrId));
        } else {
            resolvedId = String(commentOrId);
            // If it's still a temp ID, try to find the real server ID.
            var commentObj = HAAYAL.comments.find(function (c) { return String(c.id) === resolvedId; });
            if (commentObj) resolvedId = String(resolveCommentId(commentObj));
        }
        // Collect the comment and all descendants.
        var toRemove = {};
        toRemove[resolvedId] = true;
        var changed = true;
        while (changed) {
            changed = false;
            HAAYAL.comments.forEach(function (c) {
                var cid = String(c.id);
                var pid = String(c.parent_id);
                if (!toRemove[cid] && toRemove[pid]) {
                    toRemove[cid] = true;
                    changed = true;
                }
            });
        }
        HAAYAL.comments = HAAYAL.comments.filter(function (c) {
            return !toRemove[String(c.id)];
        });
        renderAll();

        // Only call the API if we have a real (non-temp) server ID.
        if (resolvedId.indexOf('temp_') !== 0) {
            apiRequest('DELETE', '/notes/' + resolvedId).catch(function () {
                HAAYAL.comments = savedComments;
                renderAll();
                showToast(haayalData.i18n.genericError);
            });
        }
    }

    function loadComments() {
        var requests = [
            apiRequest('GET', '/notes?page_url=' + encodeURIComponent(haayalData.currentPage)),
        ];

        if (haayalData.currentPage !== HAAYAL_GLOBAL_PAGE) {
            requests.push(apiRequest('GET', '/notes?page_url=' + encodeURIComponent(HAAYAL_GLOBAL_PAGE)));
        } else {
            requests.push(Promise.resolve([]));
        }

        // Also fetch generic-scoped comments (e.g. "all Product edit pages").
        if (haayalData.pageContext && haayalData.pageContext.hasId && haayalData.pageContext.genericUrl) {
            requests.push(apiRequest('GET', '/notes?page_url=' + encodeURIComponent(haayalData.pageContext.genericUrl)));
        } else {
            requests.push(Promise.resolve([]));
        }

        return Promise.all(requests)
            .then(function (results) {
                var all = [];
                var ids = {};
                results.forEach(function (set) {
                    var comments = Array.isArray(set) ? set : [];
                    comments.forEach(function (c) {
                        if (!ids[c.id]) {
                            ids[c.id] = true;
                            all.push(c);
                        }
                    });
                });
                HAAYAL.comments = all;
                renderAll();
            })
            .catch(function (err) {
                console.error('HAAYAL: Failed to load comments:', err);
            });
    }

    var HAAYAL_GLOBAL_PAGE = '__global__';
    var globalParentIds = ['wpadminbar', 'adminmenuwrap', 'adminmenu', 'wp-admin-bar-root-default'];

    function isGlobalSelector(selector) {
        return globalParentIds.some(function (id) {
            var hash = '#' + id;
            return selector === hash
                || selector.indexOf(hash + ' ') === 0
                || selector.indexOf(hash + ' > ') === 0;
        });
    }

    function isGlobalElement(el) {
        return globalParentIds.some(function (id) {
            return el.closest('#' + id);
        });
    }

    function getGlobalLabel(el) {
        // Try to find the closest menu item name for a meaningful label.
        var menuItem = el.closest('li');
        if (menuItem) {
            var nameEl = menuItem.querySelector('.wp-menu-name, .ab-item');
            if (nameEl) {
                var text = nameEl.textContent.trim();
                if (text) return text + ' (menu)';
            }
        }
        return 'Global (site-wide)';
    }

    /* ===== Selector generation ===== */

    // Attributes worth checking for stable, unique selectors.
    var STABLE_ATTRS = ['data-plugin', 'name', 'for', 'aria-label', 'data-wp-component'];

    function generateSelector(el) {
        if (el.id) return '#' + CSS.escape(el.id);

        var parts = [];
        var current = el;
        while (current && current !== document.body && current !== document.documentElement) {
            var tag = current.tagName.toLowerCase();

            // 1. ID — strongest anchor.
            if (current.id) {
                parts.unshift('#' + CSS.escape(current.id));
                break;
            }

            // 2. Class-based selector — if tag + all classes is globally unique, anchor here.
            var classSegment = buildClassSegment(current, tag);
            if (classSegment !== tag && isUniqueSelector(classSegment)) {
                parts.unshift(classSegment);
                break;
            }

            // 3. Stable attribute selector (data-plugin, name, for, aria-label, etc.).
            var attrSel = buildAttrSelector(current, tag);
            if (attrSel && isUniqueSelector(attrSel)) {
                parts.unshift(attrSel);
                break;
            }

            // 4. Sibling disambiguation — prefer classes over nth-of-type.
            var parent = current.parentElement;
            var segment = classSegment;
            if (parent) {
                var siblings = Array.from(parent.children).filter(function (c) {
                    return c.tagName === current.tagName;
                });
                if (siblings.length > 1) {
                    if (classSegment !== tag) {
                        // Do classes alone pick exactly this sibling?
                        var classMatches = siblings.filter(function (s) {
                            try { return s.matches(classSegment); } catch (e) { return false; }
                        });
                        if (classMatches.length === 1) {
                            segment = classSegment;
                        } else {
                            var index = siblings.indexOf(current) + 1;
                            segment = classSegment + ':nth-of-type(' + index + ')';
                        }
                    } else {
                        var index = siblings.indexOf(current) + 1;
                        segment = tag + ':nth-of-type(' + index + ')';
                    }
                }
            }
            parts.unshift(segment);
            current = parent;
        }
        return parts.join(' > ');
    }

    /**
     * Build a tag.class1.class2 segment, skipping plugin-own classes.
     */
    function buildClassSegment(el, tag) {
        if (!el.classList || !el.classList.length) return tag;
        var classes = [];
        for (var i = 0; i < el.classList.length; i++) {
            var c = el.classList[i];
            if (c.indexOf('haayal-notes-') === 0) continue;
            classes.push('.' + CSS.escape(c));
        }
        return classes.length ? tag + classes.join('') : tag;
    }

    /**
     * Try stable HTML attributes (name, for, aria-label, etc.) as selectors.
     */
    function buildAttrSelector(el, tag) {
        for (var i = 0; i < STABLE_ATTRS.length; i++) {
            var val = el.getAttribute(STABLE_ATTRS[i]);
            if (val) {
                return tag + '[' + STABLE_ATTRS[i] + '="' + CSS.escape(val) + '"]';
            }
        }
        return null;
    }

    function isUniqueSelector(selector) {
        try {
            return document.querySelectorAll(selector).length === 1;
        } catch (e) {
            return false;
        }
    }

    /* ===== Thread tree builder ===== */
    function buildThreadTree(comments) {
        var map = {};
        var roots = [];
        comments.forEach(function (c) {
            c._children = [];
            map[c.id] = c;
        });
        comments.forEach(function (c) {
            var pid = parseInt(c.parent_id);
            if (pid && map[pid]) {
                map[pid]._children.push(c);
            } else {
                roots.push(c);
            }
        });
        return roots;
    }

    /* ===== Helpers ===== */
    // wp_localize_script converts all values to strings, so we need
    // a safe comparison for user IDs.
    var currentUserId = parseInt(haayalData.currentUserId);
    var currentRoleLevel = parseInt(haayalData.currentUserRoleLevel) || 0;

    /**
     * Resolve a comment's current ID from HAAYAL.comments.
     * Handles the case where a temp optimistic ID (e.g. 'temp_1') was
     * silently replaced by the real server ID after the API responded.
     */
    function resolveCommentId(comment) {
        // If it's already a numeric ID, it's real.
        if (typeof comment.id === 'number' || (typeof comment.id === 'string' && comment.id.indexOf('temp_') !== 0)) {
            return comment.id;
        }
        // Look for a server comment that replaced this temp entry at the same
        // position in the array (optimisticCreate swaps in-place).
        var found = HAAYAL.comments.find(function (c) {
            return c.css_selector === comment.css_selector &&
                   c.content === comment.content &&
                   String(c.user_id) === String(comment.user_id) &&
                   String(c.id).indexOf('temp_') !== 0;
        });
        return found ? found.id : comment.id;
    }

    function isOwnComment(comment) {
        return parseInt(comment.user_id) === currentUserId;
    }

    function canModifyComment(comment) {
        // Own comments can always be modified.
        if (isOwnComment(comment)) return true;

        var policy = haayalData.deletePolicy || 'own_only';
        if (policy === 'everybody') return true;
        if (policy === 'own_only') return false;
        if (policy === 'role_hierarchy' || policy === 'role_hierarchy_strict') {
            var commentRoleLevel = parseInt(comment.user_role_level) || 0;
            return policy === 'role_hierarchy_strict'
                ? currentRoleLevel > commentRoleLevel
                : currentRoleLevel >= commentRoleLevel;
        }
        return false;
    }

    /* ===== Generic modal ===== */
    function showModal(opts) {
        // Capture before any focus change so it always reflects the true origin.
        var trigger = opts.trigger || document.activeElement;
        var role    = opts.role || 'dialog';
        var wide    = opts.wide || false;

        var overlay = document.createElement('div');
        overlay.className = 'haayal-notes-modal-overlay';

        var card = document.createElement('div');
        card.className = 'haayal-notes-modal-card' + (wide ? ' haayal-notes-modal-card--wide' : '');
        card.setAttribute('role', role);
        card.setAttribute('aria-modal', 'true');

        // Header with title + X (optional)
        var xBtn = null;
        if (opts.title) {
            var titleId = 'haayal-notes-modal-title-' + Date.now();
            card.setAttribute('aria-labelledby', titleId);

            var header = document.createElement('div');
            header.className = 'haayal-notes-modal-header';

            var titleEl = document.createElement('h2');
            titleEl.id = titleId;
            titleEl.className = 'haayal-notes-modal-title';
            titleEl.textContent = opts.title;

            xBtn = document.createElement('button');
            xBtn.type = 'button';
            xBtn.className = 'haayal-notes-modal-x';
            xBtn.setAttribute('aria-label', haayalData.i18n.cancel);
            xBtn.innerHTML = '&times;';
            xBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                close();
            });

            header.appendChild(titleEl);
            header.appendChild(xBtn);
            card.appendChild(header);
        } else if (opts.ariaLabel) {
            card.setAttribute('aria-label', opts.ariaLabel);
        }

        // Body
        if (opts.body) {
            var body = document.createElement('div');
            body.className = 'haayal-notes-modal-body';
            opts.body(body, close);
            card.appendChild(body);
        }

        // Buttons row
        var firstBtn = null;
        if (opts.buttons && opts.buttons.length) {
            var actions = document.createElement('div');
            actions.className = 'haayal-notes-modal-actions';
            opts.buttons.forEach(function (btnOpts) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'haayal-notes-btn ' + (btnOpts.className || '');
                btn.textContent = btnOpts.label;
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    btnOpts.onClick(close);
                });
                if (!firstBtn) firstBtn = btn;
                actions.appendChild(btn);
            });
            card.appendChild(actions);
        }

        overlay.appendChild(card);

        // Stop WP admin event bubbling
        card.addEventListener('click',     function (e) { e.stopPropagation(); });
        card.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        card.addEventListener('mouseup',   function (e) { e.stopPropagation(); });

        var createdAt = Date.now();
        overlay.addEventListener('mousedown', function (e) {
            e.stopPropagation();
            if (opts.closeOnBackdrop !== false && e.target === overlay && Date.now() - createdAt > 200) {
                close();
            }
        });
        overlay.addEventListener('click', function (e) { e.stopPropagation(); });

        document.body.appendChild(overlay);

        var releaseTrap = trapFocus(card, function () { close(); });

        // Auto-focus: first button, or X button, or first focusable
        var autoFocus = firstBtn || xBtn || card.querySelector('button');
        if (autoFocus) autoFocus.focus();

        function close() {
            releaseTrap();
            overlay.remove();
            if (opts.onClose) opts.onClose();
            // Restore focus. If the trigger was removed from the DOM (e.g. note
            // was deleted), fall back to the top of the page so keyboard users
            // are not left stranded.
            if (trigger && trigger.focus && document.body.contains(trigger)) {
                trigger.focus();
            } else {
                var fallback = document.querySelector('#wpbody-content, #wpbody, body');
                if (fallback) {
                    if (!fallback.hasAttribute('tabindex')) fallback.setAttribute('tabindex', '-1');
                    fallback.focus();
                }
            }
        }

        return close;
    }

    /* ===== Confirm dialog ===== */
    function showConfirmDialog(message, onConfirm, confirmLabel, trigger) {
        showModal({
            role:           'alertdialog',
            ariaLabel:      message,
            closeOnBackdrop: true,
            trigger:        trigger,
            body: function (container) {
                var msg = document.createElement('div');
                msg.className = 'haayal-notes-modal-message';
                msg.textContent = message;
                container.appendChild(msg);
                container.style.padding = '0';
            },
            buttons: [
                {
                    label:     haayalData.i18n.cancel,
                    className: 'haayal-notes-btn-secondary',
                    onClick:   function (close) { close(); }
                },
                {
                    label:     confirmLabel || haayalData.i18n.delete,
                    className: 'haayal-notes-btn-danger',
                    onClick:   function (close) { close(); onConfirm(); }
                }
            ]
        });
    }

    /* ===== Render thread HTML ===== */
    HAAYAL.renderThread = function (comments, container, opts) {
        opts = opts || {};
        container.innerHTML = '';

        var tree = buildThreadTree(comments);
        if (!tree.length && !opts.hideEmpty) {
            var emptyEl = document.createElement('p');
            emptyEl.className = 'haayal-notes-plugin-no-comments';
            emptyEl.textContent = haayalData.i18n.noComments;
            container.appendChild(emptyEl);
        }

        function renderItem(comment, depth) {
            var cType = comment.comment_type || 'pin';
            var div = document.createElement('div');
            div.className = 'haayal-notes-thread-item' + (depth > 0 ? ' haayal-notes-thread-reply' : '');
            if (cType !== 'pin') {
                div.classList.add('haayal-notes-thread-' + cType);
            }

            var meta = document.createElement('div');
            meta.className = 'haayal-notes-thread-meta';

            var author = document.createElement('span');
            author.className = 'haayal-notes-thread-author';
            author.textContent = comment.author_name || 'Unknown';

            var date = document.createElement('span');
            date.className = 'haayal-notes-thread-date';
            date.textContent = formatDate(comment.created_at);

            meta.appendChild(author);
            if (isOpenType(cType)) {
                var typeLabels = {
                    open_warning: haayalData.i18n.typeWarning,
                    open_important: haayalData.i18n.typeImportant,
                    open_info: haayalData.i18n.typeInfo,
                    open_tip: haayalData.i18n.typeTip,
                };
                var typeBadge = document.createElement('span');
                typeBadge.className = 'haayal-notes-type-badge haayal-notes-type-' + cType;
                typeBadge.textContent = typeLabels[cType] || cType;
                meta.appendChild(typeBadge);
            }
            if (opts.orphaned && depth === 0) {
                meta.appendChild(createOrphanBadge());
            }
            // Build kebab trigger + menu (shared by pin and open types).
            var kebabTrigger = null;
            if (canModifyComment(comment)) {
                kebabTrigger = document.createElement('div');
                kebabTrigger.className = 'haayal-notes-kebab-trigger';
                kebabTrigger.setAttribute('role', 'button');
                kebabTrigger.setAttribute('tabindex', '0');
                kebabTrigger.setAttribute('aria-label', haayalData.i18n.edit);
                kebabTrigger.setAttribute('aria-haspopup', 'true');
                kebabTrigger.setAttribute('aria-expanded', 'false');
                kebabTrigger.innerHTML = '<span class="dashicons dashicons-ellipsis"></span>';

                var kebabMenu = document.createElement('div');
                kebabMenu.className = 'haayal-notes-kebab-menu';
                kebabMenu.setAttribute('role', 'menu');

                kebabTrigger.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (activeKebabMenu === kebabMenu) {
                        closeKebabMenu();
                    } else {
                        openKebabMenu(kebabTrigger, kebabMenu);
                    }
                });

                // Edit item.
                var editItem = document.createElement('div');
                editItem.className = 'haayal-notes-kebab-item';
                editItem.setAttribute('role', 'menuitem');
                editItem.setAttribute('tabindex', '-1');
                editItem.innerHTML = '<span class="dashicons dashicons-edit"></span> ' + haayalData.i18n.edit;
                editItem.addEventListener('click', function (e) {
                    e.stopPropagation();
                    closeKebabMenu();
                    content.style.display = 'none';

                    // Disable reply forms while editing.
                    var replyForms = container.querySelectorAll('.haayal-notes-comment-form');
                    replyForms.forEach(function (f) {
                        f.classList.add('haayal-notes-form-disabled');
                        f.querySelectorAll('button, [contenteditable]').forEach(function (el) {
                            if (el.contentEditable === 'true') { el.contentEditable = 'false'; }
                            else { el.disabled = true; }
                        });
                    });

                    var editForm = document.createElement('div');
                    editForm.className = 'haayal-notes-edit-form';

                    var editEditor = createRichEditor(comment.content);
                    if (parseInt(comment.is_private)) editEditor.setMentionsDisabled(true);
                    editForm.appendChild(editEditor);

                    var editActions = document.createElement('div');
                    editActions.className = 'haayal-notes-comment-form-actions';

                    function enableReplyForms() {
                        replyForms.forEach(function (f) {
                            f.classList.remove('haayal-notes-form-disabled');
                            f.querySelectorAll('.haayal-notes-editor-area').forEach(function (el) {
                                el.contentEditable = 'true';
                            });
                            f.querySelectorAll('button').forEach(function (el) {
                                el.disabled = false;
                            });
                        });
                    }

                    var editCancel = document.createElement('button');
                    editCancel.className = 'haayal-notes-btn haayal-notes-btn-secondary';
                    editCancel.textContent = haayalData.i18n.cancel;
                    editCancel.type = 'button';
                    editCancel.addEventListener('click', function () {
                        editForm.remove();
                        content.style.display = '';
                        enableReplyForms();
                    });

                    var editSave = document.createElement('button');
                    editSave.className = 'haayal-notes-btn haayal-notes-btn-primary';
                    editSave.textContent = haayalData.i18n.save;
                    editSave.type = 'button';
                    editSave.addEventListener('click', function () {
                        var newVal = editEditor.getContent();
                        if (!newVal || newVal === '<br>') return;
                        var noteId = resolveCommentId(comment);
                        if (String(noteId).indexOf('temp_') === 0) {
                            showToast(haayalData.i18n.genericError);
                            return;
                        }
                        editSave.disabled = true;
                        apiRequest('PUT', '/notes/' + noteId, { content: newVal }).then(function () {
                            editForm.remove();
                            comment.content = newVal;
                            content.innerHTML = newVal;
                            content.style.display = '';
                            enableReplyForms();
                        }).catch(function () {
                            editSave.disabled = false;
                        });
                    });

                    editActions.appendChild(editCancel);
                    editActions.appendChild(editSave);
                    editForm.appendChild(editActions);
                    div.insertBefore(editForm, content.nextSibling);
                });
                kebabMenu.appendChild(editItem);

                // Privacy toggle (parent notes only).
                if (depth === 0) {
                    var privItem = document.createElement('div');
                    privItem.className = 'haayal-notes-kebab-item';
                    privItem.setAttribute('role', 'menuitem');
                    privItem.setAttribute('tabindex', '-1');
                    var isPrivate = parseInt(comment.is_private);
                    var privLabel = isPrivate ? haayalData.i18n.makePublic : haayalData.i18n.makePrivate;
                    var privIcon = isPrivate ? 'dashicons-groups' : 'dashicons-admin-users';
                    privItem.setAttribute('aria-label', privLabel);
                    privItem.innerHTML = '<span class="dashicons ' + privIcon + '"></span> ' + privLabel;
                    privItem.addEventListener('click', function (e) {
                        e.stopPropagation();
                        closeKebabMenu();
                        var resolvedId = resolveCommentId(comment);
                        if (String(resolvedId).indexOf('temp_') === 0) {
                            showToast(haayalData.i18n.genericError);
                            return;
                        }
                        var newIsPrivate = isPrivate ? 0 : 1;
                        var liveComment = HAAYAL.comments.find(function (c) { return String(c.id) === String(resolvedId); });
                        if (liveComment) liveComment.is_private = newIsPrivate;
                        if (opts.onPrivacyChange) opts.onPrivacyChange();
                        apiRequest('PATCH', '/notes/' + resolvedId + '/privacy', { is_private: !isPrivate })
                            .catch(function () {
                                if (liveComment) liveComment.is_private = isPrivate ? 1 : 0;
                                if (opts.onPrivacyChange) opts.onPrivacyChange();
                                showToast(haayalData.i18n.genericError);
                            });
                    });
                    kebabMenu.appendChild(privItem);
                }

                // Delete item.
                var delItem = document.createElement('div');
                delItem.className = 'haayal-notes-kebab-item haayal-notes-kebab-item-danger';
                delItem.setAttribute('role', 'menuitem');
                delItem.setAttribute('tabindex', '-1');
                var hasReplies = comment._children && comment._children.length > 0;
                var delLabel = (hasReplies && depth === 0) ? haayalData.i18n.deleteThread : haayalData.i18n.delete;
                delItem.setAttribute('aria-label', delLabel);
                delItem.innerHTML = '<span class="dashicons dashicons-trash"></span> ' + delLabel;
                delItem.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var delTrigger = activeKebabTrigger;
                    closeKebabMenu();
                    var msg = hasReplies ? haayalData.i18n.confirmDelete : haayalData.i18n.confirmDeleteSingle;
                    var confirmLabel = (hasReplies && depth === 0) ? delLabel : undefined;
                    showConfirmDialog(msg, function () {
                        if (depth === 0) {
                            closePop();
                            bangAndDetachMarker(String(resolveCommentId(comment)));
                        }
                        optimisticDelete(comment);
                        if (depth > 0 && opts.onDelete) opts.onDelete();
                    }, confirmLabel, delTrigger);
                });
                kebabMenu.appendChild(delItem);
            }

            // For pin notes: kebab goes inline in the meta row.
            // For open notes: kebab stays in a separate actions row with reply button.
            if (isOpenType(cType)) {
                meta.appendChild(date);
                div.appendChild(meta);

                var content = document.createElement('div');
                content.className = 'haayal-notes-thread-content';
                content.innerHTML = comment.content;
                div.appendChild(content);

                var actions = document.createElement('div');
                actions.className = 'haayal-notes-thread-actions';

                if (haayalData.canComment) {
                    var replyBtn = document.createElement('button');
                    replyBtn.innerHTML = '<span class="dashicons dashicons-admin-comments"></span> ' + haayalData.i18n.reply;
                    replyBtn.addEventListener('click', function () {
                        showReplyForm(div, comment, comments, container, opts);
                    });
                    actions.appendChild(replyBtn);
                }

                if (kebabTrigger) actions.appendChild(kebabTrigger);

                // Relocate button for orphaned root comments.
                if (opts.orphaned && depth === 0 && canModifyComment(comment)) {
                    var relocBtn = document.createElement('button');
                    relocBtn.innerHTML = '<span class="dashicons dashicons-move"></span> ' + haayalData.i18n.relocate;
                    relocBtn.addEventListener('click', function () {
                        var ids = [resolveCommentId(comment)];
                        if (comment._children) {
                            (function collectIds(children) {
                                children.forEach(function (ch) {
                                    ids.push(resolveCommentId(ch));
                                    if (ch._children) collectIds(ch._children);
                                });
                            })(comment._children);
                        }
                        startClickRelocate(ids);
                    });
                    actions.appendChild(relocBtn);
                }

                div.appendChild(actions);
            } else {
                // Pin type: kebab inline with meta (last child).
                meta.appendChild(date);
                if (kebabTrigger) meta.appendChild(kebabTrigger);
                div.appendChild(meta);

                var content = document.createElement('div');
                content.className = 'haayal-notes-thread-content';
                content.innerHTML = comment.content;
                div.appendChild(content);
            }

            container.appendChild(div);

            if (comment._children) {
                comment._children.forEach(function (child) {
                    renderItem(child, depth + 1);
                });
            }
        }

        tree.forEach(function (c) {
            renderItem(c, 0);
        });
    };

    function showReplyForm(afterEl, parentComment, allComments, container, opts) {
        // Hide existing reply forms and the top-level form.
        var existingReplies = container.querySelectorAll('.haayal-notes-comment-form-reply');
        existingReplies.forEach(function (f) { f.remove(); });
        var topLevelForm = container.querySelector('.haayal-notes-comment-form-toplevel');
        if (topLevelForm) topLevelForm.style.display = 'none';

        var form = createCommentForm(function (content, commentType, formIsPrivate, formTaggedUsers) {
            var resolvedParentId = resolveCommentId(parentComment);
            if (String(resolvedParentId).indexOf('temp_') === 0) {
                showToast(haayalData.i18n.genericError);
                return Promise.resolve();
            }
            var data = {
                page_url: parentComment.page_url || haayalData.currentPage,
                page_title: getPageTitle(),
                css_selector: parentComment.css_selector || '',
                pos_x: parentComment.pos_x || 0,
                pos_y: parentComment.pos_y || 0,
                content: content,
                comment_type: parentComment.comment_type || 'pin',
                is_private: parseInt(parentComment.is_private) ? true : false,
                parent_id: resolvedParentId,
                tagged_users: formTaggedUsers || [],
            };
            closePop();
            optimisticCreate(data);
            return Promise.resolve();
        }, {
            mode: 'reply',
            onCancel: function () {
                if (topLevelForm) topLevelForm.style.display = '';
            },
        });
        form.classList.add('haayal-notes-comment-form-reply');

        afterEl.after(form);
    }

    function buildPrivateRow(richEditor, defaultPrivate, onIsPrivateChange) {
        var privateRow = document.createElement('label');
        privateRow.className = 'haayal-notes-comment-private-row';

        var privateCbId = 'haayal-notes-private-' + Date.now();
        var privateCb = document.createElement('input');
        privateCb.type = 'checkbox';
        privateCb.id = privateCbId;
        privateCb.checked = defaultPrivate;
        privateRow.appendChild(privateCb);

        var privateText = document.createElement('label');
        privateText.className = 'haayal-notes-private-label';
        privateText.setAttribute('for', privateCbId);
        privateText.textContent = haayalData.i18n.privateLabel;
        privateRow.appendChild(privateText);

        var privateNote = document.createElement('span');
        privateNote.className = 'haayal-notes-private-note';
        privateNote.textContent = haayalData.i18n.privateNote;
        privateRow.appendChild(privateNote);

        var privateHint = document.createElement('span');
        privateHint.className = 'haayal-notes-private-hint';
        privateHint.textContent = haayalData.i18n.privateDisabledHint;
        privateRow.appendChild(privateHint);

        var mentionHint = document.createElement('span');
        mentionHint.className = 'haayal-notes-mention-hint';
        mentionHint.textContent = haayalData.i18n.mentionsDisabledHint;
        privateRow.appendChild(mentionHint);

        function updateState() {
            var hasTags = richEditor.hasTags();
            privateCb.disabled = hasTags;
            privateRow.classList.toggle('haayal-notes-private-has-tags', hasTags);
            richEditor.setMentionsDisabled(privateCb.checked);
            privateRow.classList.toggle('haayal-notes-private-checked', privateCb.checked);
            if (onIsPrivateChange) onIsPrivateChange(privateCb.checked);
        }

        privateCb.addEventListener('change', updateState);
        richEditor.onTagsChange(updateState);
        updateState();

        return privateRow;
    }

    function createCommentForm(onSubmit, formOpts) {
        formOpts = formOpts || {};
        var mode = formOpts.mode || 'pin'; // 'open' | 'pin' | 'reply'
        var form = document.createElement('div');
        form.className = 'haayal-notes-comment-form';

        var richEditor = createRichEditor();
        var placeholderText = (mode === 'reply' && haayalData.i18n.replyPlaceholder) ? haayalData.i18n.replyPlaceholder : haayalData.i18n.placeholder;
        richEditor.editorEl.setAttribute('data-placeholder', placeholderText);
        form.appendChild(richEditor);

        var selectedType = mode === 'open' ? 'open_info' : 'pin';

        // Color selector for open notes only.
        var typeRow = null;
        if (mode === 'open') {
            typeRow = document.createElement('div');
            typeRow.className = 'haayal-notes-color-selector-row';
            typeRow.setAttribute('role', 'radiogroup');
            typeRow.setAttribute('aria-labelledby', 'color-selector-row-legend');

            var legend = document.createElement('p');
            legend.id = 'color-selector-row-legend';
            legend.className = 'screen-reader-text';
            legend.textContent = haayalData.i18n.selectType;
            typeRow.appendChild(legend);

            var colorTypes = [
                { value: 'open_warning', icon: '\u26A0', label: haayalData.i18n.typeWarning },
                { value: 'open_important', icon: '\u26A0', label: haayalData.i18n.typeImportant },
                { value: 'open_info', icon: '\u2139', label: haayalData.i18n.typeInfo },
                { value: 'open_tip', icon: '', label: haayalData.i18n.typeTip, dashicon: 'dashicons-lightbulb' },
            ];

            colorTypes.forEach(function (ct) {
                var isSelected = ct.value === selectedType;
                var swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'haayal-notes-color-selector-swatch haayal-notes-swatch-' + ct.value + (isSelected ? ' active' : '');
                swatch.setAttribute('role', 'radio');
                swatch.setAttribute('aria-checked', isSelected ? 'true' : 'false');
                var iconHtml = ct.dashicon
                    ? '<span class="haayal-notes-color-selector-icon dashicons ' + ct.dashicon + '"></span> '
                    : '<span class="haayal-notes-color-selector-icon">' + ct.icon + '</span> ';
                swatch.innerHTML = iconHtml + ct.label;
                swatch.addEventListener('click', function () {
                    selectedType = ct.value;
                    typeRow.querySelectorAll('.haayal-notes-color-selector-swatch').forEach(function (s) {
                        s.classList.remove('active');
                        s.setAttribute('aria-checked', 'false');
                    });
                    swatch.classList.add('active');
                    swatch.setAttribute('aria-checked', 'true');
                });
                typeRow.appendChild(swatch);
            });

            form.appendChild(typeRow);
        }

        // Scope selector (for pages with entity IDs like post edit, term edit).
        if (formOpts.showScopeRow) {
            var scopeRow = document.createElement('div');
            scopeRow.className = 'haayal-notes-comment-scope-row';

            var scopeLabel = document.createElement('span');
            scopeLabel.className = 'haayal-notes-comment-scope-label';
            scopeLabel.textContent = haayalData.i18n.scopeLabel;
            scopeRow.appendChild(scopeLabel);

            var scopes = [
                { value: 'specific', label: formOpts.scopeSpecificLabel },
                { value: 'generic', label: formOpts.scopeGenericLabel },
            ];

            scopes.forEach(function (s) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'haayal-notes-scope-opt' + (s.value === 'specific' ? ' active' : '');
                btn.textContent = s.label;
                btn.addEventListener('click', function () {
                    scopeRow.querySelectorAll('.haayal-notes-scope-opt').forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    if (formOpts.onScopeChange) formOpts.onScopeChange(s.value);
                });
                scopeRow.appendChild(btn);
            });

            form.appendChild(scopeRow);
        }

        // Private checkbox (only for new top-level comments, not replies).
        var isPrivate = false;
        if (formOpts.showPrivateOption) {
            isPrivate = haayalData.defaultPrivacy === 'private';
            var privateRow = buildPrivateRow(richEditor, isPrivate, function (val) { isPrivate = val; });
            form.appendChild(privateRow);
        }

        // Banner position (determined by line indicator click position for open notes).
        var bannerLayout = 'full';
        var bannerPosition = formOpts.bannerPosition || 'before';

        var actions = document.createElement('div');
        actions.className = 'haayal-notes-comment-form-actions';

        if (!formOpts.isTopLevel && mode !== 'reply') {
            var cancelBtn = document.createElement('button');
            cancelBtn.className = 'haayal-notes-btn haayal-notes-btn-secondary';
            cancelBtn.textContent = haayalData.i18n.cancel;
            cancelBtn.type = 'button';
            cancelBtn.addEventListener('click', function () {
                form.remove();
                if (formOpts.onCancel) formOpts.onCancel();
            });
            actions.appendChild(cancelBtn);
        }

        var submitBtn = document.createElement('button');
        submitBtn.className = 'haayal-notes-btn haayal-notes-btn-primary';
        submitBtn.textContent = (mode === 'reply' && haayalData.i18n.submitReply) ? haayalData.i18n.submitReply : haayalData.i18n.submit;
        submitBtn.type = 'button';
        submitBtn.addEventListener('click', function () {
            var val = richEditor.getContent();
            if (!val || val === '<br>') return;
            submitBtn.disabled = true;
            onSubmit(val, selectedType, isPrivate, richEditor.getTaggedUsers(), bannerLayout, bannerPosition).then(function () {
                form.remove();
            }).catch(function () {
                submitBtn.disabled = false;
            });
        });

        actions.appendChild(submitBtn);
        form.appendChild(actions);

        form.addEventListener('click', function (e) { e.stopPropagation(); });

        return form;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr.replace(' ', 'T'));
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /* ===== Rendering ===== */
    function renderAll() {
        clearMarkers();
        closePop();

        var pinComments = [];
        var fallbackComments = [];
        var alwaysVisibleComments = []; // open_warning — always visible
        var toggleComments = []; // open_important, open_info, open_tip — respect toggle
        var stickyComments = [];

        HAAYAL.comments.forEach(function (c) {
            if (parseInt(c.parent_id) !== 0) return;

            var cType = c.comment_type || 'pin';
            // Warning banners are always visible.
            if (cType === 'open_warning') {
                alwaysVisibleComments.push(c);
                return;
            }
            // Other open types respect hide/show toggle.
            if (cType === 'open_important' || cType === 'open_info' || cType === 'open_tip') {
                toggleComments.push(c);
                return;
            }
            // Sticky notes: warning always visible, others respect toggle.
            if (isStickyType(cType)) {
                if (cType === 'sticky_warning' || HAAYAL.markersVisible) {
                    stickyComments.push(c);
                }
                return;
            }

            // Pin type notes.
            if (HAAYAL.excludeSelectors.indexOf(c.css_selector) !== -1) return;

            if (!c.css_selector) {
                fallbackComments.push(c);
                return;
            }

            try {
                var target = document.querySelector(c.css_selector);
                if (!target) {
                    fallbackComments.push(c);
                    return;
                }
            } catch (e) {
                fallbackComments.push(c);
                return;
            }

            pinComments.push(c);
        });

        // Always render warning banners and unanchored comments.
        renderInlineComments(alwaysVisibleComments);
        renderFallback(fallbackComments);
        setupOrphanObserver();

        if (!HAAYAL.markersVisible) return;

        // Other open notes only when markers visible.
        renderInlineComments(toggleComments);

        // Render individual pin markers (one per top-level note).
        renderPinMarkers(pinComments);

        // Render free-floating sticky notes.
        renderStickyNotes(stickyComments);
    }

    function getThreadComments(topLevelIds) {
        // Convert all IDs to strings for consistent comparison (handles
        // both numeric server IDs and temporary optimistic IDs like 'temp_1').
        var ids = topLevelIds.map(String);
        return HAAYAL.comments.filter(function (c) {
            if (ids.indexOf(String(c.id)) !== -1) return true;
            var pid = String(c.parent_id);
            while (pid && pid !== '0') {
                if (ids.indexOf(pid) !== -1) return true;
                var parent = HAAYAL.comments.find(function (p) { return String(p.id) === pid; });
                pid = parent ? String(parent.parent_id) : '0';
            }
            return false;
        });
    }

    /* ===== Inline open note comments ===== */
    var OPEN_TYPE_ICONS = {
        open_warning: '\u26A0',
        open_important: '\u26A0',
        open_info: '\u2139',
    };
    var OPEN_TYPE_DASHICONS = {
        open_tip: 'dashicons-lightbulb',
    };

    /* ===== Sticky notes ===== */
    var STICKY_TYPE_ICONS = {
        sticky_warning: '\u26A0',
        sticky_important: '\u26A0',
        sticky_info: '\u2139',
    };
    var STICKY_TYPE_DASHICONS = {
        sticky_tip: 'dashicons-lightbulb',
    };
    var STICKY_COLOR_TYPES = [
        { value: 'sticky_warning',   icon: '\u26A0', label: function () { return haayalData.i18n.typeWarning; } },
        { value: 'sticky_important', icon: '\u26A0', label: function () { return haayalData.i18n.typeImportant; } },
        { value: 'sticky_info',      icon: '\u2139', label: function () { return haayalData.i18n.typeInfo; } },
        { value: 'sticky_tip',       icon: '',       label: function () { return haayalData.i18n.typeTip; }, dashicon: 'dashicons-lightbulb' },
    ];

    function renderInlineComments(comments) {
        if (!comments.length) return;

        comments.forEach(function (c) {
            var cType = c.comment_type || 'pin';
            var target = null;

            if (c.css_selector) {
                try { target = document.querySelector(c.css_selector); } catch (e) {}
            }

            var banner = document.createElement('div');
            var layout = c.banner_layout || 'full';
            banner.className = 'haayal-notes-inline-banner haayal-notes-inline-' + cType + (layout === 'compact' ? ' haayal-notes-inline-banner-compact' : '');

            // Drag grip for relocating inline comments (only if user has permission).
            if (canModifyComment(c)) {
                var inlineGrip = createDragGrip();
                inlineGrip.addEventListener('mousedown', function (e) {
                    startRelocateDrag([resolveCommentId(c)], e);
                });
                banner.appendChild(inlineGrip);
            }

            var bannerContent = document.createElement('div');
            bannerContent.className = 'haayal-notes-inline-banner-content';

            var typeIcon = document.createElement('span');
            typeIcon.className = 'haayal-notes-inline-banner-icon';
            if (OPEN_TYPE_DASHICONS[cType]) {
                typeIcon.classList.add('dashicons', OPEN_TYPE_DASHICONS[cType]);
            } else {
                typeIcon.textContent = OPEN_TYPE_ICONS[cType] || '\u2139';
            }
            bannerContent.appendChild(typeIcon);

            var textWrap = document.createElement('div');
            textWrap.className = 'haayal-notes-inline-banner-text';

            var text = document.createElement('span');
            text.innerHTML = c.content;
            textWrap.appendChild(text);

            var authorInfo = document.createElement('span');
            authorInfo.className = 'haayal-notes-inline-banner-author';
            authorInfo.textContent = ' \u2014 ' + (c.author_name || 'Unknown') + ', ' + formatDate(c.created_at);
            textWrap.appendChild(authorInfo);

            if (parseInt(c.is_private)) {
                var privateBadge = document.createElement('span');
                privateBadge.className = 'haayal-notes-private-badge';
                privateBadge.textContent = haayalData.i18n.privateLabel;
                textWrap.appendChild(privateBadge);
            }

            bannerContent.appendChild(textWrap);
            banner.appendChild(bannerContent);

            // Action buttons container for inline banners.
            var bannerActions = document.createElement('div');
            bannerActions.className = 'haayal-notes-inline-banner-actions';

            if (canModifyComment(c)) {
                // 3-dots kebab menu for edit/delete.
                var kebabTrigger = document.createElement('div');
                kebabTrigger.className = 'haayal-notes-kebab-trigger';
                kebabTrigger.setAttribute('role', 'button');
                kebabTrigger.setAttribute('tabindex', '0');
                kebabTrigger.setAttribute('aria-label', haayalData.i18n.edit);
                kebabTrigger.setAttribute('aria-haspopup', 'true');
                kebabTrigger.setAttribute('aria-expanded', 'false');
                kebabTrigger.innerHTML = '<span class="dashicons dashicons-ellipsis"></span>';

                var kebabMenu = document.createElement('div');
                kebabMenu.className = 'haayal-notes-kebab-menu';
                kebabMenu.setAttribute('role', 'menu');

                kebabTrigger.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (activeKebabMenu === kebabMenu) {
                        closeKebabMenu();
                    } else {
                        openKebabMenu(kebabTrigger, kebabMenu);
                    }
                });

                // Edit item.
                var editItem = document.createElement('div');
                editItem.className = 'haayal-notes-kebab-item';
                editItem.setAttribute('role', 'menuitem');
                editItem.setAttribute('tabindex', '-1');
                editItem.innerHTML = '<span class="dashicons dashicons-edit"></span> ' + haayalData.i18n.edit;
                editItem.addEventListener('click', function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    closeKebabMenu();
                    // Replace text with inline edit.
                    bannerActions.style.display = 'none';
                    text.style.display = 'none';
                    authorInfo.style.display = 'none';

                    var inlineEditor = createRichEditor(c.content);
                    if (parseInt(c.is_private)) inlineEditor.setMentionsDisabled(true);
                    textWrap.appendChild(inlineEditor);

                    // Color type selector for changing note type on edit.
                    var editSelectedType = cType;
                    var editTypeRow = document.createElement('div');
                    editTypeRow.className = 'haayal-notes-color-selector-row';
                    editTypeRow.setAttribute('role', 'radiogroup');
                    editTypeRow.setAttribute('aria-labelledby', 'edit-color-selector-row-legend');

                    var editLegend = document.createElement('p');
                    editLegend.id = 'edit-color-selector-row-legend';
                    editLegend.className = 'screen-reader-text';
                    editLegend.textContent = haayalData.i18n.selectType;
                    editTypeRow.appendChild(editLegend);

                    var editColorTypes = [
                        { value: 'open_warning', icon: '\u26A0', label: haayalData.i18n.typeWarning },
                        { value: 'open_important', icon: '\u26A0', label: haayalData.i18n.typeImportant },
                        { value: 'open_info', icon: '\u2139', label: haayalData.i18n.typeInfo },
                        { value: 'open_tip', icon: '', label: haayalData.i18n.typeTip, dashicon: 'dashicons-lightbulb' },
                    ];

                    editColorTypes.forEach(function (ct) {
                        var isSelected = ct.value === editSelectedType;
                        var sw = document.createElement('button');
                        sw.type = 'button';
                        sw.className = 'haayal-notes-color-selector-swatch haayal-notes-swatch-' + ct.value + (isSelected ? ' active' : '');
                        sw.setAttribute('role', 'radio');
                        sw.setAttribute('aria-checked', isSelected ? 'true' : 'false');
                        var swIconHtml = ct.dashicon
                            ? '<span class="haayal-notes-color-selector-icon dashicons ' + ct.dashicon + '"></span> '
                            : '<span class="haayal-notes-color-selector-icon">' + ct.icon + '</span> ';
                        sw.innerHTML = swIconHtml + ct.label;
                        sw.addEventListener('click', function (ev) {
                            ev.stopPropagation();
                            editSelectedType = ct.value;
                            editTypeRow.querySelectorAll('.haayal-notes-color-selector-swatch').forEach(function (s) {
                                s.classList.remove('active');
                                s.setAttribute('aria-checked', 'false');
                            });
                            sw.classList.add('active');
                            sw.setAttribute('aria-checked', 'true');
                        });
                        editTypeRow.appendChild(sw);
                    });

                    var editBtns = document.createElement('div');
                    editBtns.className = 'haayal-notes-inline-edit-btn-group';

                    var saveBtn = document.createElement('div');
                    saveBtn.className = 'haayal-notes-btn haayal-notes-btn-primary';
                    saveBtn.setAttribute('role', 'button');
                    saveBtn.setAttribute('tabindex', '0');
                    saveBtn.textContent = haayalData.i18n.save;
                    saveBtn.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        ev.preventDefault();
                        var newVal = inlineEditor.getContent();
                        if (!newVal || newVal === '<br>') return;
                        var noteId = resolveCommentId(c);
                        if (String(noteId).indexOf('temp_') === 0) {
                            showToast(haayalData.i18n.genericError);
                            return;
                        }
                        saveBtn.style.pointerEvents = 'none';
                        saveBtn.style.opacity = '0.6';
                        apiRequest('PUT', '/notes/' + noteId, {
                            content: newVal,
                            comment_type: editSelectedType,
                        }).then(function () {
                            loadComments();
                        }).catch(function () {
                            saveBtn.style.pointerEvents = '';
                            saveBtn.style.opacity = '';
                        });
                    });

                    var cancelBtn = document.createElement('div');
                    cancelBtn.className = 'haayal-notes-btn haayal-notes-btn-secondary';
                    cancelBtn.setAttribute('role', 'button');
                    cancelBtn.setAttribute('tabindex', '0');
                    cancelBtn.textContent = haayalData.i18n.cancel;
                    cancelBtn.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        ev.preventDefault();
                        inlineEditor.remove();
                        editActionsRow.remove();
                        text.style.display = '';
                        authorInfo.style.display = '';
                        bannerActions.style.display = '';
                    });

                    editBtns.appendChild(cancelBtn);
                    editBtns.appendChild(saveBtn);

                    var editActionsRow = document.createElement('div');
                    editActionsRow.className = 'haayal-notes-inline-edit-actions';
                    editActionsRow.appendChild(editTypeRow);
                    editActionsRow.appendChild(editBtns);
                    textWrap.appendChild(editActionsRow);
                    inlineEditor.focus();
                });
                kebabMenu.appendChild(editItem);

                // Privacy toggle for inline banners (always parent notes).
                var inlinePrivItem = document.createElement('div');
                inlinePrivItem.className = 'haayal-notes-kebab-item';
                inlinePrivItem.setAttribute('role', 'menuitem');
                inlinePrivItem.setAttribute('tabindex', '-1');
                var inlineIsPrivate = parseInt(c.is_private);
                var inlinePrivLabel = inlineIsPrivate ? haayalData.i18n.makePublic : haayalData.i18n.makePrivate;
                var inlinePrivIcon = inlineIsPrivate ? 'dashicons-groups' : 'dashicons-admin-users';
                inlinePrivItem.setAttribute('aria-label', inlinePrivLabel);
                inlinePrivItem.innerHTML = '<span class="dashicons ' + inlinePrivIcon + '"></span> ' + inlinePrivLabel;
                inlinePrivItem.addEventListener('click', function (e) {
                    e.stopPropagation();
                    closeKebabMenu();
                    var resolvedId = resolveCommentId(c);
                    if (String(resolvedId).indexOf('temp_') === 0) {
                        showToast(haayalData.i18n.genericError);
                        return;
                    }
                    var newInlineIsPrivate = inlineIsPrivate ? 0 : 1;
                    var liveComment = HAAYAL.comments.find(function (cc) { return String(cc.id) === String(resolvedId); });
                    if (liveComment) liveComment.is_private = newInlineIsPrivate;
                    renderAll();
                    apiRequest('PATCH', '/notes/' + resolvedId + '/privacy', { is_private: !inlineIsPrivate })
                        .catch(function () {
                            if (liveComment) liveComment.is_private = inlineIsPrivate ? 1 : 0;
                            renderAll();
                            showToast(haayalData.i18n.genericError);
                        });
                });
                kebabMenu.appendChild(inlinePrivItem);

                // Delete item.
                var delItem = document.createElement('div');
                delItem.className = 'haayal-notes-kebab-item haayal-notes-kebab-item-danger';
                delItem.setAttribute('role', 'menuitem');
                delItem.setAttribute('tabindex', '-1');
                var hasReplies = HAAYAL.comments.some(function (r) { return parseInt(r.parent_id) === parseInt(c.id); });
                var delLabel = hasReplies ? haayalData.i18n.deleteThread : haayalData.i18n.delete;
                delItem.setAttribute('aria-label', delLabel);
                delItem.innerHTML = '<span class="dashicons dashicons-trash"></span> ' + delLabel;
                delItem.addEventListener('click', function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var delTrigger = activeKebabTrigger;
                    closeKebabMenu();
                    var msg = hasReplies ? haayalData.i18n.confirmDelete : haayalData.i18n.confirmDeleteSingle;
                    showConfirmDialog(msg, function () {
                        optimisticDelete(c);
                    }, hasReplies ? delLabel : undefined, delTrigger);
                });
                kebabMenu.appendChild(delItem);

                bannerActions.appendChild(kebabTrigger);
            }

            banner.appendChild(bannerActions);

            if (target) {
                var position = c.banner_position || 'before';
                if (position === 'after') {
                    target.parentElement.insertBefore(banner, target.nextSibling);
                } else {
                    target.parentElement.insertBefore(banner, target);
                }
            } else {
                // Relocate button for orphaned inline banners.
                if (canModifyComment(c)) {
                    var relocBtn = document.createElement('div');
                    relocBtn.className = 'haayal-notes-inline-banner-action';
                    relocBtn.setAttribute('role', 'button');
                    relocBtn.setAttribute('tabindex', '0');
                    relocBtn.innerHTML = '<span class="dashicons dashicons-move"></span> ' + haayalData.i18n.relocate;
                    relocBtn.title = haayalData.i18n.relocate;
                    relocBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        var cRealId = resolveCommentId(c);
                        var ids = [cRealId];
                        HAAYAL.comments.forEach(function (r) {
                            if (String(r.parent_id) === String(cRealId)) ids.push(resolveCommentId(r));
                        });
                        startClickRelocate(ids);
                    });
                    bannerActions.appendChild(relocBtn);
                }

                // Add orphaned badge for inline banners whose target is missing.
                var orphanTag = createOrphanBadge();
                orphanTag.style.marginLeft = '0';
                orphanTag.style.marginRight = '8px';
                bannerContent.insertBefore(orphanTag, bannerContent.firstChild);

                var wpbody = document.getElementById('wpbody-content');
                if (wpbody) wpbody.insertBefore(banner, wpbody.firstChild);
            }

            HAAYAL.inlineElements.push(banner);
        });
    }

    /* ===== Sticky note rendering ===== */

    function stickyPctToPixX(pct) { return pct / 100 * document.body.clientWidth; }
    function stickyPixToPctX(px)  { return px / document.body.clientWidth * 100; }

    function getStickyContainer() {
        var el = document.getElementById('haayal-notes-sticky-container');
        if (!el) {
            el = document.createElement('div');
            el.id = 'haayal-notes-sticky-container';
            document.body.appendChild(el);
        }
        return el;
    }

    function buildStickyColorSwatchRow(selectedType, onSelect) {
        var row = document.createElement('div');
        row.className = 'haayal-notes-color-selector-row';
        row.setAttribute('role', 'radiogroup');

        var legend = document.createElement('p');
        legend.className = 'screen-reader-text';
        legend.textContent = haayalData.i18n.selectType;
        row.appendChild(legend);

        STICKY_COLOR_TYPES.forEach(function (ct) {
            var isSelected = ct.value === selectedType;
            var sw = document.createElement('button');
            sw.type = 'button';
            sw.className = 'haayal-notes-color-selector-swatch haayal-notes-swatch-' + ct.value + (isSelected ? ' active' : '');
            sw.setAttribute('role', 'radio');
            sw.setAttribute('aria-checked', isSelected ? 'true' : 'false');
            var iconHtml = ct.dashicon
                ? '<span class="haayal-notes-color-selector-icon dashicons ' + ct.dashicon + '"></span> '
                : '<span class="haayal-notes-color-selector-icon">' + ct.icon + '</span> ';
            sw.innerHTML = iconHtml + ct.label();
            sw.addEventListener('click', function (ev) {
                ev.stopPropagation();
                row.querySelectorAll('.haayal-notes-color-selector-swatch').forEach(function (s) {
                    s.classList.remove('active');
                    s.setAttribute('aria-checked', 'false');
                });
                sw.classList.add('active');
                sw.setAttribute('aria-checked', 'true');
                onSelect(ct.value);
            });
            row.appendChild(sw);
        });

        return row;
    }

    function attachStickyOverflow(c, card, contentEl) {
        requestAnimationFrame(function () {
            if (contentEl.scrollHeight <= contentEl.clientHeight) return;

            contentEl.classList.add('haayal-notes-sticky-content-clipped');

            function openOverflowModal() {
                showModal({
                    title: haayalData.i18n.stickyNote,
                    wide: true,
                    closeOnBackdrop: true,
                    body: function (container) {
                        var d = document.createElement('div');
                        d.className = 'haayal-notes-sticky-modal-content';
                        d.innerHTML = c.content;
                        container.appendChild(d);
                        var a = document.createElement('p');
                        a.className = 'haayal-notes-sticky-modal-author';
                        a.textContent = '— ' + (c.author_name || '') + ', ' + formatDate(c.created_at);
                        container.appendChild(a);
                    },
                });
            }

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'haayal-notes-sticky-overflow-btn';
            btn.textContent = haayalData.i18n.stickyNoteExpanded;
            btn.addEventListener('click', function (e) { e.stopPropagation(); openOverflowModal(); });

            var body = card.querySelector('.haayal-notes-sticky-body');
            body.classList.add('haayal-notes-sticky-body-overflow');
            body.addEventListener('click', function (e) {
                if (e.target.closest('.haayal-notes-sticky-header-actions, .haayal-notes-sticky-overflow-btn, .haayal-notes-rich-editor')) return;
                openOverflowModal();
            });
            body.appendChild(btn);
        });
    }

    function startStickyDrag(c, card, e) {
        e.preventDefault();
        e.stopPropagation();

        var wrapEl = card.parentElement;
        var rect = card.getBoundingClientRect();
        var offsetX = e.clientX - rect.left;
        var offsetY = e.clientY - rect.top;

        wrapEl.classList.add('haayal-notes-sticky-dragging');
        var origRot = parseFloat(wrapEl.style.getPropertyValue('--haayal-sticky-rotation')) || 0;
        origRot = Math.min(Math.max(origRot, -4), 4);
        wrapEl.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        wrapEl.style.transform = 'rotate(' + (-origRot) + 'deg) scale(0.97)';

        function onMove(ev) {
            var scrollLeft = window.scrollX || document.documentElement.scrollLeft;
            var scrollTop  = window.scrollY || document.documentElement.scrollTop;
            var newLeft = ev.clientX - offsetX + scrollLeft;
            var newTop  = ev.clientY - offsetY + scrollTop;
            newLeft = Math.min(Math.max(0, newLeft), window.innerWidth - 290);
            newTop  = Math.min(Math.max(40, newTop), scrollTop + window.innerHeight - 280);
            wrapEl.style.left = newLeft + 'px';
            wrapEl.style.top  = newTop  + 'px';
        }

        function onUp() {
            document.removeEventListener('mousemove', onMove, true);
            document.removeEventListener('mouseup',   onUp,   true);
            wrapEl.classList.remove('haayal-notes-sticky-dragging');
            wrapEl.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
            wrapEl.style.transform = '';
            wrapEl.addEventListener('transitionend', function clearTrans() {
                wrapEl.removeEventListener('transitionend', clearTrans);
                wrapEl.style.transition = '';
            });

            var finalLeft   = parseFloat(wrapEl.style.left) || 0;
            var finalTop    = parseFloat(wrapEl.style.top)  || 0;
            var finalXPct   = stickyPixToPctX(finalLeft);
            wrapEl._posXPct = finalXPct;

            var resolvedId = resolveCommentId(c);
            var liveComment = HAAYAL.comments.find(function (cc) { return String(cc.id) === String(resolvedId); });
            if (liveComment) {
                liveComment.pos_x = finalXPct;
                liveComment.pos_y = finalTop;
            }

            if (String(resolvedId).indexOf('temp_') !== 0) {
                apiRequest('PATCH', '/notes/' + resolvedId, {
                    css_selector: '',
                    pos_x: finalXPct,
                    pos_y: finalTop,
                }).catch(function () {
                    showToast(haayalData.i18n.genericError);
                });
            }
        }

        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup',   onUp,   true);
    }

    function renderStickyNotes(comments) {
        if (!comments.length) return;

        comments.forEach(function (c) {
            var cType = c.comment_type || 'sticky_info';

            var card = document.createElement('div');
            card.className = 'haayal-notes-sticky haayal-notes-sticky-' + cType;
            card.dataset.commentId = String(c.id);

            var posXPct = parseFloat(c.pos_x) || 0;
            var topPx   = Math.min(Math.max(40, parseFloat(c.pos_y) || (window.scrollY || document.documentElement.scrollTop) + 80), (window.scrollY || document.documentElement.scrollTop) + window.innerHeight - 280);
            var leftPx  = Math.min(posXPct ? stickyPctToPixX(posXPct) : Math.max(0, Math.round(window.innerWidth / 2 - 150)), window.innerWidth - 290);

            // Header
            var cardHeader = document.createElement('div');
            cardHeader.className = 'haayal-notes-sticky-header';

            var stickyGrip = document.createElement('span');
            stickyGrip.className = 'haayal-notes-drag-grip';
            stickyGrip.setAttribute('aria-hidden', 'true');
            stickyGrip.innerHTML = '&#x2807;&#x2807;';
            cardHeader.appendChild(stickyGrip);

            var typeIcon = document.createElement('span');
            typeIcon.className = 'haayal-notes-sticky-type-icon';
            if (STICKY_TYPE_DASHICONS[cType]) {
                typeIcon.classList.add('dashicons', STICKY_TYPE_DASHICONS[cType]);
            } else {
                typeIcon.textContent = STICKY_TYPE_ICONS[cType] || 'ℹ';
            }
            cardHeader.appendChild(typeIcon);

            var cardMeta = document.createElement('span');
            cardMeta.className = 'haayal-notes-sticky-meta';
            cardMeta.textContent = (c.author_name || '') + ', ' + formatDate(c.created_at);
            cardHeader.appendChild(cardMeta);

            if (parseInt(c.is_private)) {
                var privBadge = document.createElement('span');
                privBadge.className = 'haayal-notes-private-badge';
                privBadge.textContent = haayalData.i18n.privateLabel;
                cardHeader.appendChild(privBadge);
            }

            var headerActions = document.createElement('div');
            headerActions.className = 'haayal-notes-sticky-header-actions';

            if (canModifyComment(c)) {
                var kebabTrigger = document.createElement('div');
                kebabTrigger.className = 'haayal-notes-kebab-trigger';
                kebabTrigger.setAttribute('role', 'button');
                kebabTrigger.setAttribute('tabindex', '0');
                kebabTrigger.setAttribute('aria-label', haayalData.i18n.edit);
                kebabTrigger.setAttribute('aria-haspopup', 'true');
                kebabTrigger.setAttribute('aria-expanded', 'false');
                kebabTrigger.innerHTML = '<span class="dashicons dashicons-ellipsis"></span>';

                var kebabMenu = document.createElement('div');
                kebabMenu.className = 'haayal-notes-kebab-menu';
                kebabMenu.setAttribute('role', 'menu');

                kebabTrigger.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (activeKebabMenu === kebabMenu) {
                        closeKebabMenu();
                    } else {
                        openKebabMenu(kebabTrigger, kebabMenu);
                    }
                });

                // Edit item
                var editItem = document.createElement('div');
                editItem.className = 'haayal-notes-kebab-item';
                editItem.setAttribute('role', 'menuitem');
                editItem.setAttribute('tabindex', '-1');
                editItem.innerHTML = '<span class="dashicons dashicons-edit"></span> ' + haayalData.i18n.edit;
                editItem.addEventListener('click', function (e) {
                    e.stopPropagation();
                    closeKebabMenu();

                    var cardBody = card.querySelector('.haayal-notes-sticky-body');
                    var contentEl = card.querySelector('.haayal-notes-sticky-content');
                    var overflowBtn = card.querySelector('.haayal-notes-sticky-overflow-btn');
                    var privBadge = card.querySelector('.haayal-notes-private-badge');
                    contentEl.style.display = 'none';
                    if (overflowBtn) overflowBtn.style.display = 'none';
                    if (privBadge) privBadge.style.display = 'none';
                    kebabTrigger.style.display = 'none';

                    var editSelectedType = cType;
                    var inlineEditor = createRichEditor(c.content);
                    if (parseInt(c.is_private)) inlineEditor.setMentionsDisabled(true);

                    var typeRow = buildStickyColorSwatchRow(editSelectedType, function (val) {
                        editSelectedType = val;
                    });

                    var editBtns = document.createElement('div');
                    editBtns.className = 'haayal-notes-inline-edit-btn-group';

                    var saveBtn = document.createElement('div');
                    saveBtn.className = 'haayal-notes-btn haayal-notes-btn-primary';
                    saveBtn.setAttribute('role', 'button');
                    saveBtn.setAttribute('tabindex', '0');
                    saveBtn.textContent = haayalData.i18n.save;
                    saveBtn.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        var newVal = inlineEditor.getContent();
                        if (!newVal || newVal === '<br>') return;
                        var noteId = resolveCommentId(c);
                        if (String(noteId).indexOf('temp_') === 0) {
                            showToast(haayalData.i18n.genericError);
                            return;
                        }
                        saveBtn.style.pointerEvents = 'none';
                        saveBtn.style.opacity = '0.6';
                        apiRequest('PUT', '/notes/' + noteId, {
                            content: newVal,
                            comment_type: editSelectedType,
                        }).then(function () {
                            loadComments();
                        }).catch(function () {
                            saveBtn.style.pointerEvents = '';
                            saveBtn.style.opacity = '';
                        });
                    });

                    var cancelBtn = document.createElement('div');
                    cancelBtn.className = 'haayal-notes-btn haayal-notes-btn-secondary';
                    cancelBtn.setAttribute('role', 'button');
                    cancelBtn.setAttribute('tabindex', '0');
                    cancelBtn.textContent = haayalData.i18n.cancel;
                    cancelBtn.addEventListener('click', function (ev) {
                        ev.stopPropagation();
                        inlineEditor.remove();
                        editActionsRow.remove();
                        contentEl.style.display = '';
                        if (overflowBtn) overflowBtn.style.display = '';
                        if (privBadge) privBadge.style.display = '';
                        kebabTrigger.style.display = '';
                        card.classList.remove('haayal-notes-sticky-expanded');
                    });

                    editBtns.appendChild(cancelBtn);
                    editBtns.appendChild(saveBtn);

                    var editActionsRow = document.createElement('div');
                    editActionsRow.className = 'haayal-notes-inline-edit-actions';
                    editActionsRow.appendChild(typeRow);
                    editActionsRow.appendChild(editBtns);

                    card.classList.add('haayal-notes-sticky-expanded');
                    card.addEventListener('transitionend', function onEditExpand(ev) {
                        if (ev.propertyName !== 'width') return;
                        card.removeEventListener('transitionend', onEditExpand);
                        cardBody.insertBefore(inlineEditor, contentEl);
                        cardBody.appendChild(editActionsRow);
                        inlineEditor.focus();
                    });
                });
                kebabMenu.appendChild(editItem);

                // Privacy toggle
                var isPrivate = parseInt(c.is_private);
                var privLabel = isPrivate ? haayalData.i18n.makePublic : haayalData.i18n.makePrivate;
                var privIcon  = isPrivate ? 'dashicons-groups' : 'dashicons-admin-users';
                var privItem = document.createElement('div');
                privItem.className = 'haayal-notes-kebab-item';
                privItem.setAttribute('role', 'menuitem');
                privItem.setAttribute('tabindex', '-1');
                privItem.innerHTML = '<span class="dashicons ' + privIcon + '"></span> ' + privLabel;
                privItem.addEventListener('click', function (e) {
                    e.stopPropagation();
                    closeKebabMenu();
                    var resolvedId = resolveCommentId(c);
                    if (String(resolvedId).indexOf('temp_') === 0) {
                        showToast(haayalData.i18n.genericError);
                        return;
                    }
                    var newIsPrivate = isPrivate ? 0 : 1;
                    var liveComment = HAAYAL.comments.find(function (cc) { return String(cc.id) === String(resolvedId); });
                    if (liveComment) liveComment.is_private = newIsPrivate;
                    renderAll();
                    apiRequest('PATCH', '/notes/' + resolvedId + '/privacy', { is_private: !isPrivate })
                        .catch(function () {
                            if (liveComment) liveComment.is_private = isPrivate ? 1 : 0;
                            renderAll();
                            showToast(haayalData.i18n.genericError);
                        });
                });
                kebabMenu.appendChild(privItem);

                // Delete item
                var delItem = document.createElement('div');
                delItem.className = 'haayal-notes-kebab-item haayal-notes-kebab-item-danger';
                delItem.setAttribute('role', 'menuitem');
                delItem.setAttribute('tabindex', '-1');
                delItem.innerHTML = '<span class="dashicons dashicons-trash"></span> ' + haayalData.i18n.delete;
                delItem.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var delTrigger = activeKebabTrigger;
                    closeKebabMenu();
                    showConfirmDialog(haayalData.i18n.confirmDeleteSingle, function () {
                        optimisticDelete(c);
                    }, undefined, delTrigger);
                });
                kebabMenu.appendChild(delItem);

                headerActions.appendChild(kebabTrigger);
                headerActions.appendChild(kebabMenu);
            }
            cardHeader.appendChild(headerActions);
            card.appendChild(cardHeader);

            // Body
            var cardBody = document.createElement('div');
            cardBody.className = 'haayal-notes-sticky-body';

            var contentEl = document.createElement('div');
            contentEl.className = 'haayal-notes-sticky-content';
            contentEl.innerHTML = c.content;
            cardBody.appendChild(contentEl);

            card.appendChild(cardBody);

            // Wrap card in a shadow wrapper; filter: drop-shadow on wrapper follows clip-path shape.
            var _h1 = (c.id * 2654435761) >>> 0;
            var _h2 = (c.id * 2246822519) >>> 0;
            var stickyRotation = ((_h2 & 1) ? 1 : -1) * (2 + (_h1 % 201) / 100);
            var wrap = document.createElement('div');
            wrap.className = 'haayal-notes-sticky-wrap';
            wrap.style.left = leftPx + 'px';
            wrap.style.top  = topPx  + 'px';
            wrap.style.setProperty('--haayal-sticky-rotation', stickyRotation + 'deg');
            wrap._posXPct = posXPct || stickyPixToPctX(leftPx);
            wrap.appendChild(card);
            getStickyContainer().appendChild(wrap);

            attachStickyOverflow(c, card, contentEl);

            if (canModifyComment(c)) {
                cardHeader.addEventListener('mousedown', function (e) {
                    if (e.button !== 0) return;
                    if (e.target.closest('.haayal-notes-sticky-header-actions')) return;
                    startStickyDrag(c, card, e);
                });
            } else {
                stickyGrip.style.opacity = '0.2';
                cardHeader.style.cursor = 'default';
            }

            HAAYAL.stickyElements.push(wrap);
        });
    }

    function enterStickyMode() {
        var posState = {
            left: Math.min(Math.max(0, Math.round(window.innerWidth / 2 - 150)), window.innerWidth - 290),
            top:  Math.min(Math.max(40, (window.scrollY || document.documentElement.scrollTop) + 80), (window.scrollY || document.documentElement.scrollTop) + window.innerHeight - 280),
        };
        var selectedType = 'sticky_info';
        var selectedScope = 'specific';
        var ctx = haayalData.pageContext;
        var showScopeRow = ctx && ctx.hasId && ctx.genericUrl;
        var isPrivate = haayalData.defaultPrivacy === 'private';

        // Build a card directly in the DOM in creation/edit mode.
        var card = document.createElement('div');
        card.className = 'haayal-notes-sticky haayal-notes-sticky-' + selectedType + ' haayal-notes-sticky-creation';
        card.style.left = posState.left + 'px';
        card.style.top  = posState.top  + 'px';

        // Header (draggable)
        var cardHeader = document.createElement('div');
        cardHeader.className = 'haayal-notes-sticky-header';

        var grip = document.createElement('span');
        grip.className = 'haayal-notes-drag-grip';
        grip.setAttribute('aria-hidden', 'true');
        grip.innerHTML = '&#x2807;&#x2807;';
        cardHeader.appendChild(grip);

        var typeIcon = document.createElement('span');
        typeIcon.className = 'haayal-notes-sticky-type-icon';
        typeIcon.textContent = STICKY_TYPE_ICONS['sticky_info'] || 'ℹ';
        cardHeader.appendChild(typeIcon);

        card.appendChild(cardHeader);

        // Body (uses comment-form class for uniform form styling)
        var cardBody = document.createElement('div');
        cardBody.className = 'haayal-notes-comment-form';

        // Scope selector
        if (showScopeRow) {
            var scopeRow = document.createElement('div');
            scopeRow.className = 'haayal-notes-comment-scope-row';
            var scopeLabel = document.createElement('span');
            scopeLabel.className = 'haayal-notes-comment-scope-label';
            scopeLabel.textContent = haayalData.i18n.scopeLabel;
            scopeRow.appendChild(scopeLabel);
            var entityLabel = ctx.entityLabel || '';
            [
                { value: 'specific', label: haayalData.i18n.scopeSpecific.replace('%s', entityLabel) },
                { value: 'generic',  label: haayalData.i18n.scopeGeneric.replace('%s', entityLabel) },
            ].forEach(function (s) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'haayal-notes-scope-opt' + (s.value === 'specific' ? ' active' : '');
                btn.textContent = s.label;
                btn.addEventListener('click', function () {
                    scopeRow.querySelectorAll('.haayal-notes-scope-opt').forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    selectedScope = s.value;
                });
                scopeRow.appendChild(btn);
            });
            cardBody.appendChild(scopeRow);
        }

        // Rich editor
        var editor = createRichEditor();
        editor.editorEl.setAttribute('data-placeholder', haayalData.i18n.placeholder);
        cardBody.appendChild(editor);

        // Color type selector (below editor; swatches update header icon + card color)
        var typeRow = buildStickyColorSwatchRow(selectedType, function (val) {
            selectedType = val;
            STICKY_COLOR_TYPES.forEach(function (ct) {
                card.classList.remove('haayal-notes-sticky-' + ct.value);
            });
            card.classList.add('haayal-notes-sticky-' + val);
            if (STICKY_TYPE_DASHICONS[val]) {
                typeIcon.className = 'haayal-notes-sticky-type-icon dashicons ' + STICKY_TYPE_DASHICONS[val];
                typeIcon.textContent = '';
            } else {
                typeIcon.className = 'haayal-notes-sticky-type-icon';
                typeIcon.textContent = STICKY_TYPE_ICONS[val] || 'ℹ';
            }
        });
        cardBody.appendChild(typeRow);

        // Private + mentions (shared helper — mutual exclusion included)
        var privateRow = buildPrivateRow(editor, isPrivate, function (val) { isPrivate = val; });
        cardBody.appendChild(privateRow);

        // Save / Cancel buttons
        var btnRow = document.createElement('div');
        btnRow.className = 'haayal-notes-comment-form-actions';

        var cancelBtn = document.createElement('div');
        cancelBtn.className = 'haayal-notes-btn haayal-notes-btn-secondary';
        cancelBtn.setAttribute('role', 'button');
        cancelBtn.setAttribute('tabindex', '0');
        cancelBtn.textContent = haayalData.i18n.cancel;
        cancelBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var idx = HAAYAL.stickyElements.indexOf(card);
            if (idx !== -1) HAAYAL.stickyElements.splice(idx, 1);
            if (card.parentElement) card.parentElement.removeChild(card);
        });

        var saveBtn = document.createElement('div');
        saveBtn.className = 'haayal-notes-btn haayal-notes-btn-primary';
        saveBtn.setAttribute('role', 'button');
        saveBtn.setAttribute('tabindex', '0');
        saveBtn.textContent = haayalData.i18n.submit;
        saveBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var content = editor.getContent();
            if (!content || content === '<br>') return;

            var pageUrl, pageTitle;
            if (showScopeRow && selectedScope === 'generic') {
                pageUrl   = ctx.genericUrl;
                pageTitle = ctx.genericTitle || ctx.entityLabel || '';
            } else {
                pageUrl   = haayalData.currentPage;
                pageTitle = getPageTitle();
            }

            var idx = HAAYAL.stickyElements.indexOf(card);
            if (idx !== -1) HAAYAL.stickyElements.splice(idx, 1);
            if (card.parentElement) card.parentElement.removeChild(card);

            optimisticCreate({
                page_url:        pageUrl,
                page_title:      pageTitle,
                css_selector:    '',
                pos_x:           stickyPixToPctX(posState.left),
                pos_y:           posState.top,
                content:         content,
                comment_type:    selectedType,
                is_private:      isPrivate,
                tagged_users:    editor.getTaggedUsers(),
                parent_id:       0,
                banner_layout:   'full',
                banner_position: 'before',
            });
        });

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);
        cardBody.appendChild(btnRow);

        // Hide form content until expansion animation completes.
        editor.style.display = 'none';
        typeRow.style.display = 'none';
        privateRow.style.display = 'none';
        btnRow.style.display = 'none';

        card.appendChild(cardBody);
        document.body.appendChild(card);
        HAAYAL.stickyElements.push(card);

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                card.classList.add('haayal-notes-sticky-expanded');
                card.addEventListener('transitionend', function onCreationExpand(ev) {
                    if (ev.propertyName !== 'width') return;
                    card.removeEventListener('transitionend', onCreationExpand);
                    card.style.height = 'auto';
                    editor.style.display = '';
                    typeRow.style.display = '';
                    privateRow.style.display = '';
                    btnRow.style.display = '';
                    editor.focus();
                });
            });
        });

        // Make entire header draggable (updates posState so save uses final position)
        cardHeader.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (e.target.closest('input, button, .haayal-notes-btn')) return;
            e.preventDefault();
            e.stopPropagation();

            var rect = card.getBoundingClientRect();
            var offsetX = e.clientX - rect.left;
            var offsetY = e.clientY - rect.top;
            cardHeader.style.cursor = 'grabbing';
            card.classList.add('haayal-notes-sticky-dragging');

            function onMove(ev) {
                var scrollLeft = window.scrollX || document.documentElement.scrollLeft;
                var scrollTop  = window.scrollY || document.documentElement.scrollTop;
                posState.left = Math.min(Math.max(0, ev.clientX - offsetX + scrollLeft), window.innerWidth - 290);
                posState.top  = Math.min(Math.max(40, ev.clientY - offsetY + scrollTop), scrollTop + window.innerHeight - 280);
                card.style.left = posState.left + 'px';
                card.style.top  = posState.top  + 'px';
            }

            function onUp() {
                document.removeEventListener('mousemove', onMove, true);
                document.removeEventListener('mouseup',   onUp,   true);
                cardHeader.style.cursor = '';
                card.classList.remove('haayal-notes-sticky-dragging');
            }

            document.addEventListener('mousemove', onMove, true);
            document.addEventListener('mouseup',   onUp,   true);
        });

        requestAnimationFrame(function () { editor.focus(); });
    }

    /**
     * Render individual pin markers. Each top-level pin gets its own marker.
     * Pins at overlapping positions on the same element are offset with a gap.
     */
    function renderPinMarkers(pins) {
        // Group by selector for overlap detection.
        var bySelector = {};
        pins.forEach(function (c) {
            if (!bySelector[c.css_selector]) bySelector[c.css_selector] = [];
            bySelector[c.css_selector].push(c);
        });

        Object.keys(bySelector).forEach(function (selector) {
            var group = bySelector[selector];
            var target;
            try { target = document.querySelector(selector); } catch (e) { return; }
            if (!target) return;

            if (getComputedStyle(target).position === 'static') {
                target.style.position = 'relative';
            }

            // Cluster pins at overlapping positions (within 3% threshold).
            var clusters = [];
            group.forEach(function (c) {
                var px = parseFloat(c.pos_x) || 0;
                var py = parseFloat(c.pos_y) || 0;
                var added = false;
                for (var i = 0; i < clusters.length; i++) {
                    if (Math.abs(clusters[i].x - px) < 0.03 && Math.abs(clusters[i].y - py) < 0.03) {
                        clusters[i].items.push(c);
                        added = true;
                        break;
                    }
                }
                if (!added) {
                    clusters.push({ x: px, y: py, items: [c] });
                }
            });

            clusters.forEach(function (cluster) {
                cluster.items.forEach(function (c, idx) {
                    renderPinMarker(target, selector, c, idx, cluster.items.length);
                });
            });

            // Enforce minimum 20px distance between all markers on this target.
            resolveMarkerOverlaps(target);
        });
    }

    /**
     * Push apart markers on the same target so no two are closer than 20px.
     */
    function resolveMarkerOverlaps(target) {
        var MIN_DIST = 20;
        var markers = Array.prototype.slice.call(
            target.querySelectorAll('.haayal-notes-marker')
        );
        if (markers.length < 2) return;

        // Read current rendered centers.
        var rects = markers.map(function (m) {
            var r = m.getBoundingClientRect();
            return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        });

        // Track cumulative pixel offsets (dx, dy) per marker.
        var offsets = markers.map(function () { return { dx: 0, dy: 0 }; });

        // Iterative relaxation (cap iterations to avoid infinite loops).
        for (var iter = 0; iter < 10; iter++) {
            var moved = false;
            for (var i = 0; i < rects.length; i++) {
                for (var j = i + 1; j < rects.length; j++) {
                    var ax = rects[i].cx + offsets[i].dx;
                    var ay = rects[i].cy + offsets[i].dy;
                    var bx = rects[j].cx + offsets[j].dx;
                    var by = rects[j].cy + offsets[j].dy;
                    var dx = bx - ax;
                    var dy = by - ay;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MIN_DIST) {
                        var overlap = (MIN_DIST - dist) / 2 + 0.5;
                        // Nudge along the connecting axis; default to horizontal if coincident.
                        var nx, ny;
                        if (dist < 0.1) {
                            nx = 1; ny = 0;
                        } else {
                            nx = dx / dist; ny = dy / dist;
                        }
                        offsets[i].dx -= nx * overlap;
                        offsets[i].dy -= ny * overlap;
                        offsets[j].dx += nx * overlap;
                        offsets[j].dy += ny * overlap;
                        moved = true;
                    }
                }
            }
            if (!moved) break;
        }

        // Apply offsets via transform.
        markers.forEach(function (m, i) {
            if (offsets[i].dx !== 0 || offsets[i].dy !== 0) {
                m.style.transform = 'translate(calc(-50% + ' + Math.round(offsets[i].dx) + 'px), calc(-50% + ' + Math.round(offsets[i].dy) + 'px))';
            }
        });
    }

    function renderPinMarker(target, selector, comment, indexInCluster, clusterSize) {
        var marker = document.createElement('div');
        marker.className = 'haayal-notes-marker';
        marker.setAttribute('role', 'button');
        marker.setAttribute('tabindex', '0');
        marker.setAttribute('aria-label', haayalData.i18n.pinnedNote);
        marker.setAttribute('aria-haspopup', 'dialog');
        marker.dataset.commentId = comment.id;
        var icon = document.createElement('span');
        icon.className = 'dashicons dashicons-admin-comments';
        marker.appendChild(icon);

        var posX = parseFloat(comment.pos_x) || 0;
        var posY = parseFloat(comment.pos_y) || 0;

        marker.style.left = (posX * 100) + '%';
        marker.style.top = (posY * 100) + '%';

        // Offset overlapping markers horizontally with a small gap.
        if (clusterSize > 1 && indexInCluster > 0) {
            var offsetPx = indexInCluster * 22;
            marker.style.transform = 'translate(calc(-50% + ' + offsetPx + 'px), -50%)';
        } else {
            marker.style.transform = 'translate(-50%, -50%)';
        }

        marker.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            // Read ID from the DOM attribute at click time so it stays
            // correct after optimistic-create swaps temp→server ID.
            var liveId = marker.dataset.commentId;
            var threadComments = getThreadComments([liveId]);
            var liveComment = HAAYAL.comments.find(function (c) { return String(c.id) === liveId; }) || comment;
            showPopover(marker, threadComments, selector, liveComment);
        });

        target.appendChild(marker);
        HAAYAL.markerElements.push(marker);
    }

    function bangAndDetachMarker(resolvedId) {
        var idx = -1;
        for (var i = 0; i < HAAYAL.markerElements.length; i++) {
            if (HAAYAL.markerElements[i].dataset.commentId === String(resolvedId)) {
                idx = i;
                break;
            }
        }
        if (idx === -1) return;
        var markerEl = HAAYAL.markerElements.splice(idx, 1)[0];
        markerEl.classList.add('haayal-notes-marker-bang');
        markerEl.addEventListener('animationend', function () { markerEl.remove(); }, { once: true });
        setTimeout(function () { if (markerEl.parentElement) markerEl.remove(); }, 800);
    }

    function clearMarkers() {
        HAAYAL.markerElements.forEach(function (m) {
            if (m.parentElement) m.parentElement.removeChild(m);
        });
        HAAYAL.markerElements = [];

        // Remove inline banners.
        HAAYAL.inlineElements.forEach(function (el) {
            if (el.parentElement) el.parentElement.removeChild(el);
        });
        HAAYAL.inlineElements = [];

        // Remove sticky note cards.
        HAAYAL.stickyElements.forEach(function (el) {
            if (el.parentElement) el.parentElement.removeChild(el);
        });
        HAAYAL.stickyElements = [];

        var fb = document.querySelector('.haayal-notes-fallback-area');
        if (fb) fb.remove();
    }

    /* ===== Orphan observer ===== */

    function getOrphanSelectors() {
        var selectors = [];
        HAAYAL.comments.forEach(function (c) {
            if (parseInt(c.parent_id) !== 0) return;
            if (HAAYAL.excludeSelectors.indexOf(c.css_selector) !== -1) return;
            if (!c.css_selector) return;
            try {
                if (!document.querySelector(c.css_selector)) {
                    selectors.push(c.css_selector);
                }
            } catch (e) { /* invalid selector — skip */ }
        });
        return selectors.filter(function (s, i, arr) { return arr.indexOf(s) === i; });
    }

    function teardownOrphanObserver() {
        if (_orphanObserver) { _orphanObserver.disconnect(); _orphanObserver = null; }
        clearTimeout(_orphanDebounceTimer); _orphanDebounceTimer = null;
        clearTimeout(_orphanTimeoutHandle); _orphanTimeoutHandle = null;
        _orphanSelectors = [];
    }

    function setupOrphanObserver() {
        teardownOrphanObserver();

        var selectors = getOrphanSelectors();
        if (!selectors.length) return;
        _orphanSelectors = selectors;

        _orphanObserver = new MutationObserver(function (mutations) {
            if (_observerRendering) return;

            var hasAddedNodes = mutations.some(function (m) {
                return m.type === 'childList' && m.addedNodes.length > 0;
            });
            if (!hasAddedNodes) return;

            var anyResolved = _orphanSelectors.some(function (sel) {
                try { return !!document.querySelector(sel); } catch (e) { return false; }
            });
            if (!anyResolved) return;

            clearTimeout(_orphanDebounceTimer);
            _orphanDebounceTimer = setTimeout(function () {
                _orphanDebounceTimer = null;
                teardownOrphanObserver(); // disconnect BEFORE renderAll touches DOM
                _observerRendering = true;
                try {
                    document.dispatchEvent(new CustomEvent('haayal-notes-dom-updated'));
                } finally {
                    _observerRendering = false;
                }
            }, ORPHAN_DEBOUNCE_MS);
        });

        _orphanObserver.observe(document.body, { childList: true, subtree: true });

        _orphanTimeoutHandle = setTimeout(teardownOrphanObserver, ORPHAN_TIMEOUT_MS);
    }

    /* ===== Popover ===== */
    function showPopover(anchor, threadComments, selector, refComment, opts) {
        opts = opts || {};
        closePop();

        var overlay = document.createElement('div');
        overlay.className = 'haayal-notes-overlay';
        overlay.addEventListener('click', function () { closePop(); });
        document.body.appendChild(overlay);

        var pop = document.createElement('div');
        pop.className = 'haayal-notes-popover';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-modal', 'true');
        pop.setAttribute('aria-label', haayalData.i18n.pinnedNote);

        var header = document.createElement('div');
        header.className = 'haayal-notes-popover-header';

        // Drag grip for relocating (only if user has relocate/delete permission).
        var topLevelThreadComments = threadComments
            .filter(function (c) { return parseInt(c.parent_id) === 0; });
        var topLevelIds = topLevelThreadComments
            .map(function (c) { return resolveCommentId(c); });
        var canRelocateAny = topLevelThreadComments.some(function (c) { return canModifyComment(c); });
        if (canRelocateAny) {
            var grip = createDragGrip();
            grip.addEventListener('mousedown', function (e) {
                startRelocateDrag(topLevelIds, e);
            });
            header.appendChild(grip);
        }

        var titleWrap = document.createElement('div');
        titleWrap.className = 'haayal-notes-popover-header-title-wrap';
        var title = document.createElement('span');
        title.className = 'haayal-notes-popover-header-title';
        title.textContent = haayalData.i18n.addComment;
        titleWrap.appendChild(title);
        var isThreadPrivate = threadComments.some(function (c) { return parseInt(c.parent_id) === 0 && parseInt(c.is_private); });
        if (isThreadPrivate) {
            var privateBadge = document.createElement('span');
            privateBadge.className = 'haayal-notes-private-badge';
            privateBadge.textContent = haayalData.i18n.privateLabel;
            titleWrap.appendChild(privateBadge);
        }
        header.appendChild(titleWrap);

        var closeBtn = document.createElement('button');
        closeBtn.className = 'haayal-notes-popover-close';
        closeBtn.setAttribute('aria-label', haayalData.i18n.cancel);
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', function () { closePop(); });
        header.appendChild(closeBtn);
        pop.appendChild(header);

        var body = document.createElement('div');
        body.className = 'haayal-notes-popover-body';

        function reopenAfterReload() {
            var resolvedId = String(resolveCommentId(refComment));
            loadComments().then(function () {
                var freshAnchor = HAAYAL.markerElements.filter(function (m) {
                    return m.dataset.commentId === resolvedId;
                })[0] || anchor;
                var threadComments = getThreadComments([resolvedId]);
                var liveRef = HAAYAL.comments.find(function (c) { return String(c.id) === resolvedId; }) || refComment;
                if (threadComments.length) {
                    showPopover(freshAnchor, threadComments, selector, liveRef, { scrollToBottom: true });
                }
            });
        }

        function reopenInPlace() {
            var resolvedId = String(resolveCommentId(refComment));
            var freshAnchor = HAAYAL.markerElements.filter(function (m) {
                return m.dataset.commentId === resolvedId;
            })[0] || anchor;
            var freshThread = getThreadComments([resolvedId]);
            var liveRef = HAAYAL.comments.find(function (c) { return String(c.id) === resolvedId; }) || refComment;
            if (freshThread.length) {
                showPopover(freshAnchor, freshThread, selector, liveRef);
            }
        }

        HAAYAL.renderThread(threadComments, body, {
            onReply: reopenAfterReload,
            onDelete: reopenInPlace,
            onPrivacyChange: reopenInPlace,
        });

        if (haayalData.canComment) {
            var popIsGlobal = isGlobalSelector(selector) || (anchor && isGlobalElement(anchor));
            var popPageUrl = popIsGlobal ? HAAYAL_GLOBAL_PAGE : haayalData.currentPage;
            var form = createCommentForm(function (content, commentType, formIsPrivate, formTaggedUsers) {
                // Resolve the parent ID at reply time — it may have changed
                // from a temp ID to a real server ID since the popover opened.
                var resolvedParentId = refComment ? resolveCommentId(refComment) : 0;
                if (String(resolvedParentId).indexOf('temp_') === 0) {
                    showToast(haayalData.i18n.genericError);
                    return Promise.resolve();
                }
                var liveParent = HAAYAL.comments.find(function (c) { return String(c.id) === String(resolvedParentId); }) || refComment;
                var data = {
                    page_url: popPageUrl,
                    page_title: popIsGlobal ? 'Global (site-wide)' : getPageTitle(),
                    css_selector: selector,
                    pos_x: liveParent ? liveParent.pos_x : 0,
                    pos_y: liveParent ? liveParent.pos_y : 0,
                    content: content,
                    comment_type: liveParent ? (liveParent.comment_type || 'pin') : 'pin',
                    is_private: liveParent && parseInt(liveParent.is_private) ? true : false,
                    parent_id: resolvedParentId,
                    tagged_users: formTaggedUsers || [],
                };
                // Save popover position before renderAll destroys it.
                var popEl = pop;
                var popRect = popEl.getBoundingClientRect();
                var savedX = popRect.left;
                var savedY = popRect.top;
                optimisticCreate(data, function () {
                    // Re-open popover with the updated thread (including the new reply).
                    var parentId = String(resolvedParentId);
                    var freshAnchor = HAAYAL.markerElements.filter(function (m) {
                        return m.dataset.commentId === parentId;
                    })[0] || anchor;
                    var freshThread = getThreadComments([parentId]);
                    var liveRef = HAAYAL.comments.find(function (c) { return String(c.id) === parentId; }) || refComment;
                    if (freshThread.length) {
                        showPopover(freshAnchor, freshThread, selector, liveRef, { scrollToBottom: true, fixedX: savedX, fixedY: savedY });
                    }
                });
                return Promise.resolve();
            }, { mode: 'reply', showPrivateOption: false });
            form.classList.add('haayal-notes-comment-form-toplevel');
            body.appendChild(form);
        }

        pop.appendChild(body);
        pop.addEventListener('click', function (e) {
            e.stopPropagation();
            // Close kebab when clicking inside popover but outside the kebab.
            if (!e.target.closest('.haayal-notes-kebab-trigger, .haayal-notes-kebab-menu')) {
                closeKebabMenu();
            }
        });

        document.body.appendChild(pop);

        var popW = pop.offsetWidth;
        var left, top;
        if (opts.fixedX !== undefined && opts.fixedY !== undefined) {
            left = opts.fixedX;
            top = opts.fixedY;
        } else {
            var anchorRect = anchor.getBoundingClientRect();
            left = anchorRect.right + 8;
            top = anchorRect.top;
            if (left + popW > window.innerWidth) {
                left = anchorRect.left - popW - 8;
            }
        }
        if (top + pop.offsetHeight > window.innerHeight) {
            top = Math.max(8, window.innerHeight - pop.offsetHeight - 8);
        }

        pop.style.position = 'fixed';
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';

        var popResizeObserver = new ResizeObserver(function () {
            var t = parseFloat(pop.style.top) || 0;
            var max = window.innerHeight - pop.offsetHeight - 8;
            if (t > max) pop.style.top = Math.max(8, max) + 'px';
        });
        popResizeObserver.observe(pop);

        var popTrigger = document.activeElement;
        var releaseFocusTrap = trapFocus(pop, closePop);
        HAAYAL.openPopover = { popover: pop, overlay: overlay, releaseFocusTrap: releaseFocusTrap, trigger: popTrigger, resizeObserver: popResizeObserver };

        // Auto-focus first focusable element.
        var firstFocusable = pop.querySelector(FOCUSABLE_SELECTOR);
        if (firstFocusable) firstFocusable.focus();

        if (opts.scrollToBottom) {
            var topLevelForm = pop.querySelector('.haayal-notes-comment-form-toplevel');
            if (topLevelForm) {
                topLevelForm.scrollIntoView({ behavior: 'smooth', block: 'end' });
            } else {
                pop.scrollTop = pop.scrollHeight;
            }
        }
    }

    function closePop() {
        if (HAAYAL.openPopover) {
            var trigger = HAAYAL.openPopover.trigger;
            if (HAAYAL.openPopover.releaseFocusTrap) HAAYAL.openPopover.releaseFocusTrap();
            if (HAAYAL.openPopover.resizeObserver) HAAYAL.openPopover.resizeObserver.disconnect();
            if (HAAYAL.openPopover.popover.parentElement) HAAYAL.openPopover.popover.remove();
            if (HAAYAL.openPopover.overlay.parentElement) HAAYAL.openPopover.overlay.remove();
            HAAYAL.openPopover = null;
            if (trigger && trigger.focus) trigger.focus();
        }
    }

    /* ===== Fallback area ===== */
    function renderFallback(comments) {
        var existing = document.querySelector('.haayal-notes-fallback-area');
        if (existing) existing.remove();

        if (!comments.length) return;

        var wpbody = document.getElementById('wpbody-content');
        if (!wpbody) return;

        var area = document.createElement('div');
        area.className = 'haayal-notes-fallback-area';

        var header = document.createElement('div');
        header.className = 'haayal-notes-fallback-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');

        var title = document.createElement('span');
        title.className = 'haayal-notes-fallback-title';
        title.textContent = haayalData.i18n.fallbackTitle + ' (' + comments.length + ')';

        var toggle = document.createElement('span');
        toggle.className = 'haayal-notes-fallback-toggle';
        toggle.setAttribute('aria-hidden', 'true');
        toggle.innerHTML = '&#10095;';

        header.appendChild(title);
        header.appendChild(toggle);

        var list = document.createElement('div');
        list.className = 'haayal-notes-fallback-list';

        comments.forEach(function (c) {
            var topLevelIds = [String(c.id)];
            var threadComments = getThreadComments(topLevelIds);

            var item = document.createElement('div');
            item.className = 'haayal-notes-fallback-item';

            HAAYAL.renderThread(threadComments, item, { orphaned: true });

            // Relocate button for orphaned pin notes.
            if (canModifyComment(c)) {
                var relocBtn = document.createElement('div');
                relocBtn.className = 'haayal-notes-fallback-relocate';
                relocBtn.setAttribute('role', 'button');
                relocBtn.setAttribute('tabindex', '0');
                relocBtn.innerHTML = '<span class="dashicons dashicons-move"></span> ' + haayalData.i18n.relocate;
                relocBtn.title = haayalData.i18n.relocate;
                relocBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var cRealId = resolveCommentId(c);
                    var ids = [cRealId];
                    HAAYAL.comments.forEach(function (r) {
                        if (String(r.parent_id) === String(cRealId)) ids.push(resolveCommentId(r));
                    });
                    startClickRelocate(ids);
                });
                item.appendChild(relocBtn);
            }

            list.appendChild(item);
        });

        function toggleFallback() {
            var expanded = list.classList.toggle('visible');
            toggle.classList.toggle('expanded', expanded);
            header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }

        header.addEventListener('click', toggleFallback);
        header.addEventListener('keydown', function (e) {
            if (e.key === ' ') {
                e.preventDefault();
                toggleFallback();
            }
        });

        area.appendChild(header);
        area.appendChild(list);
        wpbody.insertBefore(area, wpbody.firstChild);
    }

    /* ===== Gap detection for placement line indicator ===== */

    // Tags that can serve as valid parents for note placement.
    var CONTAINER_TAGS = [
        'DIV','SECTION','ARTICLE','ASIDE','MAIN','HEADER','FOOTER','NAV',
        'FIGURE','FIGCAPTION','BLOCKQUOTE','DETAILS','FIELDSET','FORM',
        'TD','TH',
        'UL','OL','LI','DL','DD','DT',
        'P','PRE','ADDRESS','H1','H2','H3','H4','H5','H6',
        'DIALOG','BODY'
    ];

    function isValidContainer(el) {
        return CONTAINER_TAGS.indexOf(el.tagName) !== -1;
    }

    // Elements that should be skipped when collecting children for gap detection.
    function isExcludedChild(el) {
        return el.classList.contains('row-actions');
    }

    function findInsertionGap(clientX, clientY) {
        var elUnder = document.elementFromPoint(clientX, clientY);
        if (!elUnder || isHaayalElement(elUnder)) return null;

        // If cursor is inside an excluded element, walk up past it.
        var excluded = elUnder.closest('.row-actions');
        if (excluded) elUnder = excluded.parentElement;
        if (!elUnder) return null;



        // Walk from elUnder upward to find a parent with 2+ visible children.
        // The parent's rect must contain the cursor.
        // Start above void/non-container elements so we never try to insert inside them.
        var candidate = elUnder;
        while (candidate && candidate !== document.body && !isValidContainer(candidate)) {
            candidate = candidate.parentElement;
        }
        if (!candidate || candidate === document.body) candidate = elUnder;
        var parent = null;
        var items = [];

        // First check if the valid container we landed on has visible children.
        if (isValidContainer(candidate)) {
            var ownKids = [];
            for (var oi = 0; oi < candidate.children.length; oi++) {
                var och = candidate.children[oi];
                if (!isHaayalElement(och) && !isExcludedChild(och) && och.offsetHeight > 0) ownKids.push(och);
            }
            if (ownKids.length >= 2) {
                parent = candidate;
                for (var oj = 0; oj < ownKids.length; oj++) {
                    items.push({ el: ownKids[oj], rect: ownKids[oj].getBoundingClientRect() });
                }
            } else if (ownKids.length === 1) {
                // Single visible child — use single-child fallback at this container level.
                var singleEl = ownKids[0];
                var sr = singleEl.getBoundingClientRect();
                var sMidY = (sr.top + sr.bottom) / 2;
                var sPos = clientY < sMidY ? 'before' : 'after';
                var sLineY = sPos === 'before' ? sr.top : sr.bottom;
                return {
                    parent: candidate,
                    referenceChild: singleEl,
                    position: sPos,
                    isHorizontal: true,
                    lineRect: { x: sr.left, y: sLineY - 1.5, width: sr.width, height: 3 }
                };
            }
        }

        // Otherwise walk up to find a valid container parent with 2+ children.
        if (!parent) {
            while (candidate && candidate !== document.body && candidate !== document.documentElement) {
                var p = candidate.parentElement;
                if (!p || p === document.body || p === document.documentElement) break;

                var pRect = p.getBoundingClientRect();
                if (clientX < pRect.left - 5 || clientX > pRect.right + 5 ||
                    clientY < pRect.top - 5 || clientY > pRect.bottom + 5) break;

                var kids = [];
                for (var i = 0; i < p.children.length; i++) {
                    var ch = p.children[i];
                    if (!isHaayalElement(ch) && !isExcludedChild(ch) && ch.offsetHeight > 0) kids.push(ch);
                }
                if (kids.length >= 2 && isValidContainer(p)) {
                    parent = p;
                    items = [];
                    for (var j = 0; j < kids.length; j++) {
                        items.push({ el: kids[j], rect: kids[j].getBoundingClientRect() });
                    }
                    break;
                }
                candidate = p;
            }
        }

        // If no multi-child parent found, treat element as single child —
        // show line at its top or bottom edge depending on cursor position.
        if (!parent || items.length < 2) {
            var el = elUnder;
            while (el && el !== document.body && !isValidContainer(el)) {
                el = el.parentElement;
            }
            if (!el || el === document.body) el = elUnder;
            var r = el.getBoundingClientRect();
            var midY = (r.top + r.bottom) / 2;
            var pos = clientY < midY ? 'before' : 'after';
            var lineY = pos === 'before' ? r.top : r.bottom;
            return {
                parent: el.parentElement,
                referenceChild: el,
                position: pos,
                isHorizontal: true,
                lineRect: { x: r.left, y: lineY - 1.5, width: r.width, height: 3 }
            };
        }

        // Only horizontal (block) gaps — no vertical/inline placement.
        var bestGap = null;
        var bestDist = Infinity;

        for (var k = 0; k < items.length; k++) {
            var cur = items[k];
            var prev = k > 0 ? items[k - 1] : null;

            if (prev) {
                var gapY = (prev.rect.bottom + cur.rect.top) / 2;
                var dist = Math.abs(clientY - gapY);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestGap = {
                        parent: parent,
                        referenceChild: cur.el,
                        position: 'before',
                        isHorizontal: true,
                        lineRect: {
                            x: Math.min(prev.rect.left, cur.rect.left),
                            y: gapY - 1.5,
                            width: Math.max(prev.rect.right, cur.rect.right) - Math.min(prev.rect.left, cur.rect.left),
                            height: 3
                        }
                    };
                }
            }

            // Top edge of first child
            if (k === 0) {
                var distTop = Math.abs(clientY - cur.rect.top);
                if (distTop < bestDist) {
                    bestDist = distTop;
                    bestGap = {
                        parent: parent,
                        referenceChild: cur.el,
                        position: 'before',
                        isHorizontal: true,
                        lineRect: {
                            x: cur.rect.left, y: cur.rect.top - 1.5,
                            width: cur.rect.width, height: 3
                        }
                    };
                }
            }

            // Bottom edge of last child
            if (k === items.length - 1) {
                var distBot = Math.abs(clientY - cur.rect.bottom);
                if (distBot < bestDist) {
                    bestDist = distBot;
                    bestGap = {
                        parent: parent,
                        referenceChild: cur.el,
                        position: 'after',
                        isHorizontal: true,
                        lineRect: {
                            x: cur.rect.left, y: cur.rect.bottom - 1.5,
                            width: cur.rect.width, height: 3
                        }
                    };
                }
            }
        }

        return bestGap;
    }

    /* ===== Placement mode ===== */
    var currentGap = null;
    var placementLine = null;

    function createPlacementLine() {
        var line = document.createElement('div');
        line.className = 'haayal-notes-placement-line';
        line.style.display = 'none';
        document.body.appendChild(line);
        return line;
    }

    function showPlacementLine(line, gap) {
        if (!gap) {
            line.style.display = 'none';
            return;
        }
        var r = gap.lineRect;
        line.style.display = 'block';
        line.style.left = r.x + 'px';
        line.style.top = r.y + 'px';
        line.style.width = r.width + 'px';
        line.style.height = r.height + 'px';
        line.className = 'haayal-notes-placement-line ' + (gap.isHorizontal ? 'is-horizontal' : 'is-vertical');
    }

    function enterOpenPlacementMode() {
        HAAYAL.placementMode = true;
        HAAYAL.placementType = 'open';
        document.body.classList.add('haayal-notes-placement-mode');

        var banner = document.createElement('div');
        banner.className = 'haayal-notes-placement-banner';
        banner.id = 'haayal-notes-placement-banner';
        banner.innerHTML = haayalData.i18n.placementBannerOpen +
            '<span class="haayal-notes-placement-esc">' + haayalData.i18n.exitPlacement + '</span>';
        document.body.appendChild(banner);

        placementLine = createPlacementLine();
        currentGap = null;

        document.addEventListener('mousemove', onPlacementHover, true);
        document.addEventListener('click', onPlacementClick, true);
        document.addEventListener('keydown', onPlacementKeydown, true);
    }

    var pinHighlightEl = null;

    function enterPinPlacementMode() {
        HAAYAL.placementMode = true;
        HAAYAL.placementType = 'pin';
        document.body.classList.add('haayal-notes-placement-mode');

        var banner = document.createElement('div');
        banner.className = 'haayal-notes-placement-banner';
        banner.id = 'haayal-notes-placement-banner';
        banner.innerHTML = haayalData.i18n.placementBannerPin +
            '<span class="haayal-notes-placement-esc">' + haayalData.i18n.exitPlacement + '</span>';
        document.body.appendChild(banner);

        // Pin mode: no line indicator, just element highlight.
        currentGap = null;

        document.addEventListener('mousemove', onPlacementHover, true);
        document.addEventListener('click', onPlacementClick, true);
        document.addEventListener('keydown', onPlacementKeydown, true);
    }

    function exitPlacementMode() {
        HAAYAL.placementMode = false;
        HAAYAL.placementType = null;
        document.body.classList.remove('haayal-notes-placement-mode');

        var banner = document.getElementById('haayal-notes-placement-banner');
        if (banner) banner.remove();

        if (placementLine) {
            placementLine.remove();
            placementLine = null;
        }
        if (pinHighlightEl) {
            pinHighlightEl.classList.remove('haayal-notes-highlight-outline');
            pinHighlightEl = null;
        }
        currentGap = null;

        document.removeEventListener('mousemove', onPlacementHover, true);
        document.removeEventListener('click', onPlacementClick, true);
        document.removeEventListener('keydown', onPlacementKeydown, true);

        updateFabState();
    }

    function onPlacementHover(e) {
        if (isHaayalElement(e.target)) return;

        if (HAAYAL.placementType === 'open') {
            var gap = findInsertionGap(e.clientX, e.clientY);
            currentGap = gap;
            showPlacementLine(placementLine, gap);
        } else {
            // Pin mode: highlight element under cursor.
            var el = e.target;
            while (el && el !== document.body && !isValidContainer(el)) {
                el = el.parentElement;
            }
            if (pinHighlightEl && pinHighlightEl !== el) {
                pinHighlightEl.classList.remove('haayal-notes-highlight-outline');
            }
            if (el && el !== document.body) {
                el.classList.add('haayal-notes-highlight-outline');
                pinHighlightEl = el;
            }
            // Still compute gap for selector/position.
            var gap = findInsertionGap(e.clientX, e.clientY);
            currentGap = gap;
        }
    }

    function onPlacementClick(e) {
        var el = e.target;
        if (isHaayalElement(el)) return;

        e.preventDefault();
        e.stopPropagation();

        if (!currentGap) return;

        var refEl = currentGap.referenceChild;
        while (refEl && refEl !== document.body && !isValidContainer(refEl)) {
            refEl = refEl.parentElement;
        }
        if (!refEl || refEl === document.body) return;
        var selector = generateSelector(refEl);
        var refRect = refEl.getBoundingClientRect();
        var posX = Math.max(0, Math.min(1, (e.clientX - refRect.left) / refRect.width));
        var posY = Math.max(0, Math.min(1, (e.clientY - refRect.top) / refRect.height));
        var bannerPosition = currentGap.position;

        var global = isGlobalElement(el);
        var globalLabel = global ? getGlobalLabel(el) : null;

        var placementType = HAAYAL.placementType;
        exitPlacementMode();

        if (placementType === 'open') {
            showNewOpenNotePopover(e.clientX, e.clientY, selector, posX, posY, global, globalLabel, bannerPosition);
        } else {
            showNewPinPopover(e.clientX, e.clientY, selector, posX, posY, global, globalLabel);
        }
    }

    function onPlacementKeydown(e) {
        if (e.key === 'Escape') exitPlacementMode();
    }

    function isHaayalElement(el) {
        return el.closest('.haayal-notes-fab, .haayal-notes-popover, .haayal-notes-marker, .haayal-notes-overlay, .haayal-notes-placement-banner, .haayal-notes-fallback-area, .haayal-notes-inline-banner, .haayal-notes-drag-grip, .haayal-notes-fab-menu, .haayal-notes-sticky, .haayal-notes-sticky-wrap, .haayal-notes-modal-overlay');
    }

    // === Orphan badge ===
    function createOrphanBadge() {
        var btn = document.createElement('button');
        btn.className = 'haayal-notes-orphaned-badge';
        btn.type = 'button';
        btn.setAttribute('aria-haspopup', 'dialog');

        var icon = document.createElement('span');
        icon.className = 'haayal-notes-orphaned-badge-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'ℹ';

        var label = document.createElement('span');
        label.textContent = haayalData.i18n.orphanBadge;

        btn.appendChild(icon);
        btn.appendChild(label);

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var i18n = haayalData.i18n;
            showModal({
                title:          i18n.orphanModalTitle,
                wide:           true,
                closeOnBackdrop: true,
                trigger:        btn,
                body: function (container) {
                    var intro = document.createElement('p');
                    intro.textContent = i18n.orphanModalIntro;
                    container.appendChild(intro);

                    var whyHeading = document.createElement('p');
                    whyHeading.className = 'haayal-notes-modal-subheading';
                    whyHeading.textContent = i18n.orphanModalWhy;
                    container.appendChild(whyHeading);

                    var list = document.createElement('ul');
                    list.className = 'haayal-notes-modal-reasons';
                    [
                        { title: i18n.orphanReason1Title, desc: i18n.orphanReason1Desc, fix: i18n.orphanReason1Fix },
                        { title: i18n.orphanReason2Title, desc: i18n.orphanReason2Desc, fix: i18n.orphanReason2Fix },
                    ].forEach(function (reason) {
                        var li = document.createElement('li');
                        li.className = 'haayal-notes-modal-reason';

                        var t = document.createElement('strong');
                        t.textContent = reason.title;

                        var d = document.createElement('p');
                        d.textContent = reason.desc;

                        var f = document.createElement('p');
                        f.className = 'haayal-notes-modal-reason-fix';
                        f.textContent = reason.fix;

                        li.appendChild(t);
                        li.appendChild(d);
                        li.appendChild(f);
                        list.appendChild(li);
                    });
                    container.appendChild(list);
                }
            });
        });

        return btn;
    }

    function createNewNotePopover(x, y, mode, selector, posX, posY, isGlobal, globalLabel, bannerPosition) {
        closePop();

        var overlay = document.createElement('div');
        overlay.className = 'haayal-notes-overlay';
        overlay.addEventListener('click', closePop);
        document.body.appendChild(overlay);

        var pop = document.createElement('div');
        pop.className = 'haayal-notes-popover';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-modal', 'true');
        var popLabel = mode === 'open' ? haayalData.i18n.openNote : haayalData.i18n.pinnedNote;
        pop.setAttribute('aria-label', popLabel);

        var header = document.createElement('div');
        header.className = 'haayal-notes-popover-header';
        var title = document.createElement('span');
        title.className = 'haayal-notes-popover-header-title';
        title.textContent = popLabel;
        header.appendChild(title);

        var closeBtn = document.createElement('button');
        closeBtn.className = 'haayal-notes-popover-close';
        closeBtn.setAttribute('aria-label', haayalData.i18n.cancel);
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', closePop);
        header.appendChild(closeBtn);
        pop.appendChild(header);

        var body = document.createElement('div');
        body.className = 'haayal-notes-popover-body';

        var selectedScope = 'specific';
        var ctx = haayalData.pageContext;
        var showScope = !isGlobal && ctx && ctx.hasId && ctx.genericUrl;

        var form = createCommentForm(function (content, commentType, formIsPrivate, formTaggedUsers, formBannerLayout, formBannerPosition) {
            var pageUrl, pageTitle;
            if (isGlobal) {
                pageUrl = HAAYAL_GLOBAL_PAGE;
                pageTitle = globalLabel || 'Global (site-wide)';
            } else if (selectedScope === 'generic') {
                pageUrl = ctx.genericUrl;
                pageTitle = ctx.genericTitle || ctx.entityLabel;
            } else {
                pageUrl = haayalData.currentPage;
                pageTitle = getPageTitle();
            }
            var data = {
                page_url: pageUrl,
                page_title: pageTitle,
                css_selector: selector,
                pos_x: posX,
                pos_y: posY,
                content: content,
                comment_type: commentType,
                is_private: formIsPrivate,
                parent_id: 0,
                tagged_users: formTaggedUsers || [],
                banner_layout: formBannerLayout || 'full',
                banner_position: formBannerPosition || bannerPosition || 'before',
            };
            // Remember position before closing the creation popover.
            var popRect = pop.getBoundingClientRect();
            var anchorX = popRect.left;
            var anchorY = popRect.top;
            closePop();
            if (mode === 'pin') {
                optimisticCreate(data, function (tempId) {
                    // Re-open as thread view at the same screen position.
                    var tempComment = HAAYAL.comments.find(function (c) { return String(c.id) === tempId; });
                    if (!tempComment) return;
                    var marker = HAAYAL.markerElements.filter(function (m) {
                        return m.dataset.commentId === tempId;
                    })[0];
                    var threadComments = getThreadComments([tempId]);
                    if (!threadComments.length) return;
                    // Use the marker if available, otherwise create a temporary anchor.
                    var anchor = marker || document.createElement('span');
                    showPopover(anchor, threadComments, selector, tempComment, { fixedX: anchorX, fixedY: anchorY });
                });
            } else {
                optimisticCreate(data);
            }
            return Promise.resolve();
        }, {
            mode: mode,
            showScopeRow: showScope,
            scopeSpecificLabel: showScope ? haayalData.i18n.scopeSpecific.replace('%s', ctx.entityLabel) : '',
            scopeGenericLabel: showScope ? haayalData.i18n.scopeGeneric.replace('%s', ctx.entityLabel) : '',
            onScopeChange: function (scope) { selectedScope = scope; },
            onCancel: closePop,
            showPrivateOption: true,
            bannerPosition: mode === 'open' ? (bannerPosition || null) : null,
        });

        body.appendChild(form);
        pop.appendChild(body);
        pop.addEventListener('click', function (e) { e.stopPropagation(); });

        document.body.appendChild(pop);

        var popW = pop.offsetWidth;
        var left = x + 12;
        if (left + popW > window.innerWidth) left = x - popW - 12;
        var top = y;
        if (top + pop.offsetHeight > window.innerHeight) top = Math.max(8, window.innerHeight - pop.offsetHeight - 8);

        pop.style.position = 'fixed';
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';

        var popResizeObserver = new ResizeObserver(function () {
            var t = parseFloat(pop.style.top) || 0;
            var max = window.innerHeight - pop.offsetHeight - 8;
            if (t > max) pop.style.top = Math.max(8, max) + 'px';
        });
        popResizeObserver.observe(pop);

        var popTrigger = document.activeElement;
        var releaseFocusTrap = trapFocus(pop, closePop);
        HAAYAL.openPopover = { popover: pop, overlay: overlay, releaseFocusTrap: releaseFocusTrap, trigger: popTrigger, resizeObserver: popResizeObserver };

        // Auto-focus first focusable element.
        var firstFocusable = pop.querySelector(FOCUSABLE_SELECTOR);
        if (firstFocusable) firstFocusable.focus();
    }

    function showNewOpenNotePopover(x, y, selector, posX, posY, isGlobal, globalLabel, bannerPosition) {
        createNewNotePopover(x, y, 'open', selector, posX, posY, isGlobal, globalLabel, bannerPosition);
    }

    function showNewPinPopover(x, y, selector, posX, posY, isGlobal, globalLabel) {
        createNewNotePopover(x, y, 'pin', selector, posX, posY, isGlobal, globalLabel, null);
    }

    /* ===== Page title helper ===== */
    function getPageTitle() {
        var t = document.title || '';
        // WordPress admin titles are like "Plugins ‹ Site — WordPress"
        var sep = t.indexOf(' \u2039 ');
        if (sep !== -1) return t.substring(0, sep);
        sep = t.indexOf(' \u2014 ');
        if (sep !== -1) return t.substring(0, sep);
        sep = t.indexOf(' - ');
        if (sep !== -1) return t.substring(0, sep);
        return t;
    }

    /* ===== Drag-to-relocate system ===== */

    function createDragGrip() {
        var grip = document.createElement('span');
        grip.className = 'haayal-notes-drag-grip';
        grip.title = 'Drag to relocate';
        // 6-dot grid (2 cols × 3 rows)
        grip.innerHTML = '\u2807\u2807';
        return grip;
    }

    function startRelocateDrag(commentIds, e) {
        e.preventDefault();
        e.stopPropagation();
        closePop();

        var ghost = document.createElement('div');
        ghost.className = 'haayal-notes-marker haayal-notes-marker-dragging';
        ghost.style.position = 'fixed';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '100002';
        ghost.textContent = '\u2725';
        document.body.appendChild(ghost);

        var dragGap = null;
        var dragLine = createPlacementLine();

        document.body.classList.add('haayal-notes-placement-mode');

        var banner = document.createElement('div');
        banner.className = 'haayal-notes-placement-banner';
        banner.id = 'haayal-notes-relocate-banner';
        banner.textContent = 'Drop on any element to relocate this note. Press Escape to cancel.';
        document.body.appendChild(banner);

        function onMove(ev) {
            ghost.style.left = (ev.clientX - 12) + 'px';
            ghost.style.top = (ev.clientY - 12) + 'px';

            // Temporarily hide ghost to find element underneath.
            ghost.style.display = 'none';
            if (!isHaayalElement(document.elementFromPoint(ev.clientX, ev.clientY))) {
                var gap = findInsertionGap(ev.clientX, ev.clientY);
                dragGap = gap;
                showPlacementLine(dragLine, gap);
            } else {
                dragGap = null;
                showPlacementLine(dragLine, null);
            }
            ghost.style.display = '';
        }

        function cleanup() {
            document.removeEventListener('mousemove', onMove, true);
            document.removeEventListener('mouseup', onUp, true);
            document.removeEventListener('keydown', onKey, true);
            if (ghost.parentElement) ghost.remove();
            if (dragLine) dragLine.remove();
            document.body.classList.remove('haayal-notes-placement-mode');
            var b = document.getElementById('haayal-notes-relocate-banner');
            if (b) b.remove();
        }

        function onUp(ev) {
            ghost.style.display = 'none';
            // Re-detect gap at drop point
            if (!isHaayalElement(document.elementFromPoint(ev.clientX, ev.clientY))) {
                dragGap = findInsertionGap(ev.clientX, ev.clientY);
            }
            ghost.style.display = '';

            cleanup();

            if (!dragGap) return;

            var refEl = dragGap.referenceChild;
            while (refEl && refEl !== document.body && !isValidContainer(refEl)) {
                refEl = refEl.parentElement;
            }
            if (!refEl || refEl === document.body) return;
            var newSelector = generateSelector(refEl);
            var refRect = refEl.getBoundingClientRect();
            var newX = Math.max(0, Math.min(1, (ev.clientX - refRect.left) / refRect.width));
            var newY = Math.max(0, Math.min(1, (ev.clientY - refRect.top) / refRect.height));
            var newBannerPos = dragGap.position;

            var promises = commentIds.map(function (cid) {
                return apiRequest('PATCH', '/notes/' + cid, {
                    css_selector: newSelector,
                    pos_x: newX,
                    pos_y: newY,
                    banner_position: newBannerPos,
                });
            });
            Promise.all(promises).then(function () {
                loadComments();
            });
        }

        function onKey(ev) {
            if (ev.key === 'Escape') cleanup();
        }

        // Position ghost at initial mouse position.
        ghost.style.left = (e.clientX - 12) + 'px';
        ghost.style.top = (e.clientY - 12) + 'px';

        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
        document.addEventListener('keydown', onKey, true);
    }

    /* ===== Click-to-place relocate (for unanchored comments) ===== */
    function startClickRelocate(commentIds) {
        document.body.classList.add('haayal-notes-placement-mode');

        var banner = document.createElement('div');
        banner.className = 'haayal-notes-placement-banner';
        banner.id = 'haayal-notes-relocate-banner';
        banner.innerHTML = haayalData.i18n.relocatePrompt +
            '<span class="haayal-notes-placement-esc">' + haayalData.i18n.exitPlacement + '</span>';
        document.body.appendChild(banner);

        var relocGap = null;
        var relocLine = createPlacementLine();

        function onHover(ev) {
            if (isHaayalElement(ev.target)) return;

            var gap = findInsertionGap(ev.clientX, ev.clientY);
            relocGap = gap;
            showPlacementLine(relocLine, gap);
        }

        function cleanup() {
            document.removeEventListener('mousemove', onHover, true);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onKey, true);
            if (relocLine) relocLine.remove();
            document.body.classList.remove('haayal-notes-placement-mode');
            var b = document.getElementById('haayal-notes-relocate-banner');
            if (b) b.remove();
        }

        function onClick(ev) {
            var el = ev.target;
            if (isHaayalElement(el)) return;
            ev.preventDefault();
            ev.stopPropagation();

            if (!relocGap) return;

            cleanup();

            var refEl = relocGap.referenceChild;
            while (refEl && refEl !== document.body && !isValidContainer(refEl)) {
                refEl = refEl.parentElement;
            }
            if (!refEl || refEl === document.body) return;
            var newSelector = generateSelector(refEl);
            var refRect = refEl.getBoundingClientRect();
            var newX = Math.max(0, Math.min(1, (ev.clientX - refRect.left) / refRect.width));
            var newY = Math.max(0, Math.min(1, (ev.clientY - refRect.top) / refRect.height));
            var newBannerPos = relocGap.position;

            var promises = commentIds.map(function (cid) {
                return apiRequest('PATCH', '/notes/' + cid, {
                    css_selector: newSelector,
                    pos_x: newX,
                    pos_y: newY,
                    banner_position: newBannerPos,
                });
            });
            Promise.all(promises).then(function () {
                loadComments();
            });
        }

        function onKey(ev) {
            if (ev.key === 'Escape') cleanup();
        }

        document.addEventListener('mousemove', onHover, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKey, true);
    }

    /* ===== FAB ===== */
    function createFab() {
        var fab = document.createElement('div');
        fab.className = 'haayal-notes-fab';

        // Restore saved position (stored as vw/vh percentages).
        var savedPos = localStorage.getItem('haayal_fab_position');
        if (savedPos) {
            try {
                var pos = JSON.parse(savedPos);
                // Only restore if it uses the vw/vh format and is within bounds.
                if (typeof pos.leftVw === 'number' && typeof pos.topVh === 'number'
                    && pos.leftVw >= 0 && pos.leftVw <= 95
                    && pos.topVh >= 0 && pos.topVh <= 95) {
                    fab.style.right = 'auto';
                    fab.style.bottom = 'auto';
                    fab.style.left = pos.leftVw + 'vw';
                    fab.style.top = pos.topVh + 'vh';
                } else {
                    // Clear invalid/old-format data.
                    localStorage.removeItem('haayal_fab_position');
                }
            } catch (e) {
                localStorage.removeItem('haayal_fab_position');
            }
        }

        // Drag handle (6-dot grip).
        var grip = document.createElement('div');
        grip.className = 'haayal-notes-fab-grip';
        grip.innerHTML = '&#x2807;'; // ⠇ braille 6-dot pattern
        grip.title = 'Drag to move';

        var dragging = false, dragOffsetX, dragOffsetY;
        grip.addEventListener('mousedown', function (e) {
            e.preventDefault();
            dragging = true;
            var rect = fab.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            fab.classList.add('haayal-notes-fab-dragging');
        });
        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var newLeft = e.clientX - dragOffsetX;
            var newTop = e.clientY - dragOffsetY;
            // Clamp within viewport.
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - fab.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - fab.offsetHeight));
            fab.style.right = 'auto';
            fab.style.bottom = 'auto';
            fab.style.left = (newLeft / window.innerWidth * 100) + 'vw';
            fab.style.top = (newTop / window.innerHeight * 100) + 'vh';
        });
        document.addEventListener('mouseup', function () {
            if (!dragging) return;
            dragging = false;
            fab.classList.remove('haayal-notes-fab-dragging');
            // Save as vw/vh percentages for responsive restore.
            var rect = fab.getBoundingClientRect();
            localStorage.setItem('haayal_fab_position', JSON.stringify({
                leftVw: rect.left / window.innerWidth * 100,
                topVh: rect.top / window.innerHeight * 100,
            }));
        });

        fab.appendChild(grip);

        if (haayalData.canComment) {
            // Main button wrapper (contains button + sub-menu).
            var mainWrap = document.createElement('div');
            mainWrap.style.position = 'relative';

            var mainBtn = document.createElement('button');
            mainBtn.className = 'haayal-notes-fab-btn';
            mainBtn.id = 'haayal-notes-fab-main';
            mainBtn.setAttribute('aria-haspopup', 'true');
            mainBtn.setAttribute('aria-expanded', 'false');
            mainBtn.innerHTML = '<span class="haayal-notes-fab-icon">+</span> ' + haayalData.i18n.addComment + ' \u25BE';

            // Sub-menu.
            var subMenu = document.createElement('div');
            subMenu.className = 'haayal-notes-fab-menu';
            subMenu.setAttribute('role', 'menu');

            var releaseFabTrap = null;

            function openFabMenu() {
                subMenu.classList.add('visible');
                mainBtn.setAttribute('aria-expanded', 'true');
                var items = Array.from(subMenu.querySelectorAll('[role="menuitem"]'));
                if (items.length) {
                    items.forEach(function (it) { it.setAttribute('tabindex', '-1'); });
                    items[0].setAttribute('tabindex', '0');
                    items[0].focus();
                }
                var fabEntry = {
                    onEscape: function () {
                        closeFabMenu();
                        mainBtn.focus();
                    },
                    isMenubar: true,
                    getItems: function () {
                        return Array.from(subMenu.querySelectorAll('[role="menuitem"]'));
                    },
                };
                focusTrapStack.push(fabEntry);
                releaseFabTrap = function () {
                    var idx = focusTrapStack.indexOf(fabEntry);
                    if (idx !== -1) focusTrapStack.splice(idx, 1);
                };
            }

            function closeFabMenu() {
                subMenu.classList.remove('visible');
                mainBtn.setAttribute('aria-expanded', 'false');
                if (releaseFabTrap) {
                    releaseFabTrap();
                    releaseFabTrap = null;
                }
            }

            var openItem = document.createElement('div');
            openItem.className = 'haayal-notes-fab-menu-item';
            openItem.setAttribute('role', 'menuitem');
            openItem.setAttribute('tabindex', '-1');
            openItem.setAttribute('aria-label', haayalData.i18n.addOpenNote);
            openItem.innerHTML = '<span class="haayal-notes-fab-menu-item-icon">\uD83D\uDCCB</span> ' + haayalData.i18n.addOpenNote;
            openItem.addEventListener('click', function (e) {
                e.stopPropagation();
                closeFabMenu();
                enterOpenPlacementMode();
            });
            subMenu.appendChild(openItem);

            var pinItem = document.createElement('div');
            pinItem.className = 'haayal-notes-fab-menu-item';
            pinItem.setAttribute('role', 'menuitem');
            pinItem.setAttribute('tabindex', '-1');
            pinItem.setAttribute('aria-label', haayalData.i18n.addPinNote);
            pinItem.innerHTML = '<span class="haayal-notes-fab-menu-item-icon">\uD83D\uDCCC</span> ' + haayalData.i18n.addPinNote;
            pinItem.addEventListener('click', function (e) {
                e.stopPropagation();
                closeFabMenu();
                enterPinPlacementMode();
            });
            subMenu.appendChild(pinItem);

            var stickyItem = document.createElement('div');
            stickyItem.className = 'haayal-notes-fab-menu-item';
            stickyItem.setAttribute('role', 'menuitem');
            stickyItem.setAttribute('tabindex', '-1');
            stickyItem.setAttribute('aria-label', haayalData.i18n.addStickyNote);
            stickyItem.innerHTML = '<span class="haayal-notes-fab-menu-item-icon">\uD83D\uDFE8</span> ' + haayalData.i18n.addStickyNote;
            stickyItem.addEventListener('click', function (e) {
                e.stopPropagation();
                closeFabMenu();
                enterStickyMode();
            });
            subMenu.appendChild(stickyItem);

            mainBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (HAAYAL.placementMode) {
                    exitPlacementMode();
                } else if (subMenu.classList.contains('visible')) {
                    closeFabMenu();
                } else {
                    openFabMenu();
                }
            });

            // Close sub-menu on outside click.
            document.addEventListener('click', function () {
                closeFabMenu();
            });

            mainWrap.appendChild(mainBtn);
            mainWrap.appendChild(subMenu);
            fab.appendChild(mainWrap);
        }

        var visBtn = document.createElement('button');
        visBtn.className = 'haayal-notes-visibility-btn' + (HAAYAL.markersVisible ? '' : ' hidden');
        visBtn.innerHTML = '<span class="haayal-notes-vis-icon">&#128065;</span> ' + (HAAYAL.markersVisible ? haayalData.i18n.hide : haayalData.i18n.show);
        visBtn.addEventListener('click', function () {
            HAAYAL.markersVisible = !HAAYAL.markersVisible;
            visBtn.classList.toggle('hidden');
            visBtn.innerHTML = '<span class="haayal-notes-vis-icon">&#128065;</span> ' + (HAAYAL.markersVisible ? haayalData.i18n.hide : haayalData.i18n.show);
            renderAll();
            apiRequest('POST', '/user/visibility', { visible: HAAYAL.markersVisible });
        });
        fab.appendChild(visBtn);

        document.body.appendChild(fab);
    }

    function updateFabState() {
        var btn = document.getElementById('haayal-notes-fab-main');
        if (!btn) return;
        if (HAAYAL.placementMode) {
            btn.classList.add('active');
            btn.innerHTML = '<span class="haayal-notes-fab-icon">&times;</span> ' + haayalData.i18n.cancel;
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<span class="haayal-notes-fab-icon">+</span> ' + haayalData.i18n.addComment + ' \u25BE';
        }
    }

    /* ===== Init ===== */
    // Close kebab menus on outside click.
    document.addEventListener('click', function () {
        closeKebabMenu();
    });

    function animateLineToFab(fromEl, toEl) {
        var existing = document.getElementById('haayal-notes-line-canvas');
        if (existing) existing.remove();

        var canvas = document.createElement('canvas');
        canvas.id = 'haayal-notes-line-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);

        var ctx = canvas.getContext('2d');
        var fromRect = fromEl.getBoundingClientRect();
        var toRect = toEl.getBoundingClientRect();

        var startX = fromRect.left + fromRect.width / 2;
        var startY = fromRect.top + fromRect.height / 2;
        var rawEndX = toRect.left + toRect.width / 2;
        var rawEndY = toRect.top + toRect.height / 2;

        var dist = Math.sqrt((rawEndX - startX) * (rawEndX - startX) + (rawEndY - startY) * (rawEndY - startY));
        var gap = Math.min(70, dist * 0.4);
        var endX = rawEndX - (rawEndX - startX) / dist * gap;
        var endY = rawEndY - (rawEndY - startY) / dist * gap;

        var startTime = null;
        var duration = 600;
        var midX = (startX + endX) / 2;
        var midY = (startY + endY) / 2;
        var dx = endX - startX;
        var dy = endY - startY;
        var cpX = midX - dy * 0.2;
        var cpY = midY + dx * 0.2;
        var brand = getComputedStyle(document.documentElement).getPropertyValue('--haayal-notes-brand').trim() || '#7c3aed';

        function draw(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.moveTo(startX, startY);

            var steps = Math.floor(ease * 100);
            for (var i = 1; i <= steps; i++) {
                var t = i / 100;
                var x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cpX + t * t * endX;
                var y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * cpY + t * t * endY;
                ctx.lineTo(x, y);
            }

            ctx.strokeStyle = brand;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.stroke();

            if (steps > 1) {
                var tCur = steps / 100;
                var tPrev = (steps - 1) / 100;
                var tipX = (1 - tCur) * (1 - tCur) * startX + 2 * (1 - tCur) * tCur * cpX + tCur * tCur * endX;
                var tipY = (1 - tCur) * (1 - tCur) * startY + 2 * (1 - tCur) * tCur * cpY + tCur * tCur * endY;
                var prevX = (1 - tPrev) * (1 - tPrev) * startX + 2 * (1 - tPrev) * tPrev * cpX + tPrev * tPrev * endX;
                var prevY = (1 - tPrev) * (1 - tPrev) * startY + 2 * (1 - tPrev) * tPrev * cpY + tPrev * tPrev * endY;
                var angle = Math.atan2(tipY - prevY, tipX - prevX);
                var arrowLen = 10;
                ctx.beginPath();
                ctx.setLineDash([]);
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(tipX - arrowLen * Math.cos(angle - 0.4), tipY - arrowLen * Math.sin(angle - 0.4));
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(tipX - arrowLen * Math.cos(angle + 0.4), tipY - arrowLen * Math.sin(angle + 0.4));
                ctx.strokeStyle = brand;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            if (progress < 1) {
                requestAnimationFrame(draw);
            } else {
                toEl.classList.add('haayal-notes-fab-pulse');
                setTimeout(function () {
                    toEl.classList.remove('haayal-notes-fab-pulse');
                    canvas.style.transition = 'opacity 0.4s';
                    canvas.style.opacity = '0';
                    setTimeout(function () { canvas.remove(); }, 400);
                }, 1200);
            }
        }
        requestAnimationFrame(draw);
    }

    /* ===== Admin bar button bindings (FAB disabled mode) ===== */
    function updateAdminBarVisLabel() {
        var el = document.querySelector('#wp-admin-bar-haayal-notes-toggle-vis .ab-item');
        if (!el) return;
        el.textContent = HAAYAL.markersVisible ? haayalData.i18n.hideNotes : haayalData.i18n.showNotes;
    }

    function bindAdminBarButtons() {
        function bindClick(id, handler) {
            var el = document.querySelector('#wp-admin-bar-' + id + ' .ab-item');
            if (!el) return;
            el.addEventListener('click', function (e) {
                e.preventDefault();
                handler();
            });
        }

        if (haayalData.canComment) {
            bindClick('haayal-notes-add-open', function () {
                if (HAAYAL.placementMode) {
                    exitPlacementMode();
                } else {
                    enterOpenPlacementMode();
                }
            });

            bindClick('haayal-notes-add-pin', function () {
                if (HAAYAL.placementMode) {
                    exitPlacementMode();
                } else {
                    enterPinPlacementMode();
                }
            });

            bindClick('haayal-notes-add-sticky', function () {
                enterStickyMode();
            });
        }

        bindClick('haayal-notes-toggle-vis', function () {
            HAAYAL.markersVisible = !HAAYAL.markersVisible;
            renderAll();
            updateAdminBarVisLabel();
            apiRequest('POST', '/user/visibility', { visible: HAAYAL.markersVisible });
        });

        // Set correct initial label (JS state may differ from server-rendered text in edge cases).
        updateAdminBarVisLabel();
    }

    function init() {
        if (haayalData.showFloatingButtons) {
            createFab();
        } else {
            bindAdminBarButtons();
        }

        // Activation notice CTA — draw arrow to the active trigger (FAB or admin bar item).
        var activationCta = document.querySelector('.haayal-notes-activation-cta');
        if (activationCta) {
            activationCta.addEventListener('click', function () {
                var target = haayalData.showFloatingButtons
                    ? document.getElementById('haayal-notes-fab-main')
                    : document.querySelector('#wp-admin-bar-haayal-notes > .ab-item');
                if (target) animateLineToFab(activationCta, target);
            });
        }

        loadComments();
    }

    // Accessibility: Enter key activates role="button" elements.
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.getAttribute('role') === 'button') {
            e.preventDefault();
            e.target.click();
        }
    });

    document.addEventListener('haayal-notes-changed', function (e) {
        if (e.detail && e.detail.source !== 'main') {
            loadComments();
        }
    });

    // Re-render markers when another script (e.g. dashboard) rebuilds its DOM,
    // since pin markers attached to old elements would have been destroyed.
    document.addEventListener('haayal-notes-dom-updated', function () {
        renderAll();
    });

    // Reposition sticky notes proportionally on viewport resize / zoom.
    (function () {
        var _resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(_resizeTimer);
            _resizeTimer = setTimeout(function () {
                HAAYAL.stickyElements.forEach(function (el) {
                    if (el._posXPct == null) return;
                    el.style.left = Math.min(stickyPctToPixX(el._posXPct), window.innerWidth - 290) + 'px';
                });
            }, 80);
        });
    }());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.HAAYAL = HAAYAL;
})();
