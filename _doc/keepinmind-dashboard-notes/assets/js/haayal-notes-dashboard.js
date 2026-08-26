(function () {
    'use strict';

    if (typeof haayalDashboardData === 'undefined') return;

    var currentUserId = parseInt(haayalDashboardData.currentUserId) || 0;
    var currentRoleLevel = parseInt(haayalDashboardData.currentUserRoleLevel) || 0;
    var deletePolicy = haayalDashboardData.deletePolicy || 'own_only';

    var state = {
        comments: [],
        total: 0,
        page: 1,
        perPage: 20,
        totalPages: 1,
        search: '',
        searchTimeout: null,
    };

    function canModifyComment(c) {
        if (parseInt(c.user_id) === currentUserId) return true;
        if (deletePolicy === 'everybody') return true;
        if (deletePolicy === 'own_only') return false;
        var commentRoleLevel = parseInt(c.user_role_level) || 0;
        if (deletePolicy === 'role_hierarchy_strict') return currentRoleLevel > commentRoleLevel;
        if (deletePolicy === 'role_hierarchy') return currentRoleLevel >= commentRoleLevel;
        return false;
    }

    function cannotDeleteReason(c) {
        if (deletePolicy === 'own_only') return haayalDashboardData.i18n.cannotDeleteOwn;
        return haayalDashboardData.i18n.cannotDeleteRole;
    }

    function apiRequest(method, endpoint, data) {
        var opts = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': haayalDashboardData.nonce,
            },
        };
        if (data) opts.body = JSON.stringify(data);
        return fetch(haayalDashboardData.restUrl + endpoint, opts).then(function (r) { return r.json(); }).then(function (json) {
            if (method !== 'GET') {
                document.dispatchEvent(new CustomEvent('haayal-notes-changed', { detail: { source: 'dashboard' } }));
            }
            return json;
        });
    }

    var FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex="0"], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"]';

    function showConfirmDialog(message, onConfirm, confirmLabel) {
        var overlay = document.createElement('div');
        overlay.className = 'haayal-notes-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        var card = document.createElement('div');
        card.className = 'haayal-notes-modal-card';

        var msg = document.createElement('div');
        msg.className = 'haayal-notes-modal-message';
        msg.textContent = message;
        card.appendChild(msg);

        var actions = document.createElement('div');
        actions.className = 'haayal-notes-modal-actions';

        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'haayal-notes-btn haayal-notes-btn-secondary';
        cancelBtn.textContent = haayalDashboardData.i18n.cancel;
        cancelBtn.type = 'button';
        cancelBtn.addEventListener('click', function () {
            releaseTrap();
            overlay.remove();
        });

        var confirmBtn = document.createElement('button');
        confirmBtn.className = 'haayal-notes-btn haayal-notes-btn-danger';
        confirmBtn.textContent = confirmLabel || haayalDashboardData.i18n.delete;
        confirmBtn.type = 'button';
        confirmBtn.addEventListener('click', function () {
            releaseTrap();
            overlay.remove();
            onConfirm();
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        card.appendChild(actions);
        overlay.appendChild(card);

        // Focus trap.
        var releaseTrap = function () {};
        setTimeout(function () {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) { releaseTrap(); overlay.remove(); }
            });
            document.body.appendChild(overlay);
            cancelBtn.focus();

            function handleKeyDown(e) {
                if (e.key === 'Escape') { releaseTrap(); overlay.remove(); return; }
                if (e.key !== 'Tab') return;
                var focusable = Array.from(card.querySelectorAll(FOCUSABLE_SELECTOR));
                if (!focusable.length) return;
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
                } else {
                    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
            document.addEventListener('keydown', handleKeyDown);
            releaseTrap = function () { document.removeEventListener('keydown', handleKeyDown); };
        }, 0);
    }

    function showToast(message, duration) {
        var existing = document.querySelector('.haayal-notes-dashboard-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'haayal-notes-dashboard-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () { toast.remove(); }, 400);
        }, duration || 4000);
    }

    function renderSkeleton() {
        var app = document.getElementById('haayal-notes-dashboard-app');
        if (!app) return;
        app.innerHTML = '';

        var dashboard = document.createElement('div');
        dashboard.className = 'haayal-notes-dashboard';

        var table = document.createElement('table');
        table.className = 'haayal-notes-dashboard-table';

        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');
        var thCheck = document.createElement('th');
        thCheck.className = 'haayal-notes-col-check';
        headerRow.appendChild(thCheck);
        [haayalDashboardData.i18n.colTags, haayalDashboardData.i18n.colNote, haayalDashboardData.i18n.colPage, haayalDashboardData.i18n.colAuthor, haayalDashboardData.i18n.colDate, haayalDashboardData.i18n.colActions].forEach(function (h) {
            var th = document.createElement('th');
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        var tbody = document.createElement('tbody');
        [[64,200,130,80,72,40],[72,160,110,90,72,40],[56,220,90,75,72,40],[68,180,120,85,72,40],[60,140,100,78,72,40]].forEach(function (cols) {
            var tr = document.createElement('tr');
            var tdCheck = document.createElement('td');
            tdCheck.className = 'haayal-notes-col-check';
            var skelCheck = document.createElement('span');
            skelCheck.className = 'haayal-notes-skel';
            skelCheck.style.cssText = 'width:14px;height:14px;border-radius:2px;';
            tdCheck.appendChild(skelCheck);
            tr.appendChild(tdCheck);
            cols.forEach(function (w) {
                var td = document.createElement('td');
                var bar = document.createElement('span');
                bar.className = 'haayal-notes-skel';
                bar.style.cssText = 'width:' + w + 'px;height:12px;';
                td.appendChild(bar);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        dashboard.appendChild(table);
        app.appendChild(dashboard);
    }

    function loadComments(showSkeleton) {
        if (showSkeleton !== false) renderSkeleton();
        var params = '?page=' + state.page + '&per_page=' + state.perPage;
        if (state.search) params += '&search=' + encodeURIComponent(state.search);

        apiRequest('GET', '/notes/all' + params).then(function (data) {
            var comments = data.comments || [];
            var total = data.total || 0;
            var totalPages = data.total_pages || 1;
            if (comments.length === 0 && total > 0) {
                state.total = total;
                state.totalPages = totalPages;
                state.page = totalPages;
                loadComments(false);
                return;
            }
            state.comments = comments;
            state.total = total;
            state.totalPages = totalPages;
            render();
        });
    }

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

        // Stop 40px before the FAB center.
        var dist = Math.sqrt((rawEndX - startX) * (rawEndX - startX) + (rawEndY - startY) * (rawEndY - startY));
        var gap = Math.min(70, dist * 0.4);
        var endX = rawEndX - (rawEndX - startX) / dist * gap;
        var endY = rawEndY - (rawEndY - startY) / dist * gap;

        var progress = 0;
        var duration = 600;
        var startTime = null;

        // Compute a control point for a slight curve.
        var midX = (startX + endX) / 2;
        var midY = (startY + endY) / 2;
        var dx = endX - startX;
        var dy = endY - startY;
        var cpX = midX - dy * 0.2;
        var cpY = midY + dx * 0.2;

        var brand = getComputedStyle(document.documentElement).getPropertyValue('--haayal-notes-brand').trim() || '#7c3aed';

        function draw(timestamp) {
            if (!startTime) startTime = timestamp;
            progress = Math.min((timestamp - startTime) / duration, 1);
            var ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.moveTo(startX, startY);

            // Partial quadratic bezier up to current progress.
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

            // Draw arrowhead at the tip.
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
                // Pulse the FAB then fade out.
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

    function render() {
        var app = document.getElementById('haayal-notes-dashboard-app');
        if (!app) return;
        app.innerHTML = '';

        var dashboard = document.createElement('div');
        dashboard.className = 'haayal-notes-dashboard';

        // Toolbar: bulk actions + search.
        var toolbar = document.createElement('div');
        toolbar.className = 'haayal-notes-toolbar';

        var bulkBar = document.createElement('div');
        bulkBar.className = 'haayal-notes-bulk-bar';

        var bulkBtn = document.createElement('button');
        bulkBtn.className = 'haayal-notes-btn haayal-notes-btn-danger haayal-notes-bulk-delete-btn';
        bulkBtn.innerHTML = '<span class="dashicons dashicons-trash"></span> ' + haayalDashboardData.i18n.bulkDelete;
        bulkBtn.setAttribute('aria-haspopup', 'dialog');
        bulkBtn.disabled = true;
        bulkBtn.addEventListener('click', function () {
            var checked = tbody.querySelectorAll('.haayal-notes-row-checkbox:checked');
            if (!checked.length) return;
            showConfirmDialog(haayalDashboardData.i18n.confirmBulkDelete, function () {
                var ids = Array.from(checked).map(function (cb) { return cb.value; });

                // Optimistic: remove rows from DOM immediately.
                ids.forEach(function (id) {
                    tbody.querySelectorAll('tr[data-note-id="' + id + '"], tr[data-parent-id="' + id + '"]').forEach(function (r) {
                        r.remove();
                    });
                });

                showToast(haayalDashboardData.i18n.bulkDeleted.replace('%d', String(ids.length)));

                // Fire API requests, reload fresh data on completion.
                var promises = ids.map(function (id) {
                    return apiRequest('DELETE', '/notes/' + id);
                });
                Promise.all(promises).then(function () {
                    loadComments(false);
                }).catch(function () {
                    loadComments(false);
                    showToast(haayalDashboardData.i18n.bulkDeleteError || haayalDashboardData.i18n.confirmBulkDelete);
                });
            });
        });
        bulkBar.appendChild(bulkBtn);
        toolbar.appendChild(bulkBar);

        var searchDiv = document.createElement('div');
        searchDiv.className = 'haayal-notes-dashboard-search';
        searchDiv.setAttribute('role', 'search');

        var searchLabel = document.createElement('label');
        searchLabel.className = 'screen-reader-text';
        searchLabel.setAttribute('for', 'haayal-notes-search-input');
        searchLabel.textContent = haayalDashboardData.i18n.search;
        searchDiv.appendChild(searchLabel);

        var searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.id = 'haayal-notes-search-input';
        searchInput.placeholder = haayalDashboardData.i18n.search;
        searchInput.value = state.search;
        searchInput.addEventListener('input', function () {
            clearTimeout(state.searchTimeout);
            var val = this.value;
            state.searchTimeout = setTimeout(function () {
                state.search = val;
                state.page = 1;
                loadComments();
            }, 400);
        });
        var searchIcon = document.createElement('span');
        searchIcon.className = 'dashicons dashicons-search haayal-notes-search-icon';
        searchIcon.setAttribute('aria-hidden', 'true');

        searchDiv.appendChild(searchIcon);
        searchDiv.appendChild(searchInput);
        toolbar.appendChild(searchDiv);

        dashboard.appendChild(toolbar);

        if (!state.comments.length) {
            toolbar.style.display = 'none';

            var empty = document.createElement('div');
            empty.className = 'haayal-notes-empty';

            var emptyHeading = document.createElement('h2');
            emptyHeading.className = 'haayal-notes-empty-heading';
            emptyHeading.textContent = haayalDashboardData.i18n.noComments;
            empty.appendChild(emptyHeading);

            var emptyDesc = document.createElement('p');
            emptyDesc.className = 'haayal-notes-empty-desc';
            emptyDesc.textContent = haayalDashboardData.i18n.emptyDesc;
            empty.appendChild(emptyDesc);

            var fab = document.getElementById('haayal-notes-fab-main');
            if (fab) {
                var cta = document.createElement('button');
                cta.className = 'haayal-notes-btn haayal-notes-btn-primary haayal-notes-empty-cta';
                cta.type = 'button';
                cta.textContent = haayalDashboardData.i18n.emptyCta;
                cta.addEventListener('click', function () { animateLineToFab(cta, fab); });
                empty.appendChild(cta);
            }

            dashboard.appendChild(empty);
            app.appendChild(dashboard);
            return;
        }

        function updateBulkBtn() {
            var anyChecked = tbody.querySelectorAll('.haayal-notes-row-checkbox:checked').length > 0;
            bulkBtn.disabled = !anyChecked;
        }

        // Table.
        var table = document.createElement('table');
        table.className = 'haayal-notes-dashboard-table';

        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');

        // Select-all checkbox header.
        var thCheck = document.createElement('th');
        thCheck.className = 'haayal-notes-col-check';
        var selectAll = document.createElement('input');
        selectAll.type = 'checkbox';
        selectAll.title = haayalDashboardData.i18n.selectAll;
        selectAll.addEventListener('change', function () {
            var boxes = tbody.querySelectorAll('.haayal-notes-row-checkbox');
            boxes.forEach(function (cb) { cb.checked = selectAll.checked; });
            updateBulkBtn();
        });
        thCheck.appendChild(selectAll);
        headerRow.appendChild(thCheck);

        [haayalDashboardData.i18n.colTags, haayalDashboardData.i18n.colNote, haayalDashboardData.i18n.colPage, haayalDashboardData.i18n.colAuthor, haayalDashboardData.i18n.colDate, haayalDashboardData.i18n.colActions].forEach(function (h) {
            var th = document.createElement('th');
            th.textContent = h;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        var tbody = document.createElement('tbody');
        state.comments.forEach(function (c) {
            var isReply = parseInt(c.parent_id) > 0;
            var tr = document.createElement('tr');
            if (isReply) tr.className = 'haayal-notes-reply-row';
            tr.dataset.noteId = c.id;
            tr.dataset.parentId = c.parent_id;

            // Checkbox.
            var tdCheck = document.createElement('td');
            tdCheck.className = 'haayal-notes-col-check';
            if (canModifyComment(c)) {
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'haayal-notes-row-checkbox';
                cb.value = c.id;
                cb.addEventListener('change', updateBulkBtn);
                tdCheck.appendChild(cb);
            }
            tr.appendChild(tdCheck);

            // Tags column.
            var tdTags = document.createElement('td');
            tdTags.className = 'haayal-notes-col-tags';
            if (isReply) {
                var replyIcon = document.createElement('span');
                replyIcon.className = 'haayal-notes-reply-icon';
                replyIcon.textContent = document.documentElement.dir === 'rtl' ? '\u21A9' : '\u21AA';
                tdTags.appendChild(replyIcon);
            } else {
                var cType = c.comment_type || 'pin';
                var hasPrivate = parseInt(c.is_private);
                var typeLabels = {
                    open_warning: haayalDashboardData.i18n.tagWarning,
                    open_important: haayalDashboardData.i18n.tagImportant,
                    open_info: haayalDashboardData.i18n.tagInfo,
                    open_tip: haayalDashboardData.i18n.tagTip,
                    pin: haayalDashboardData.i18n.tagPinned,
                    sticky_warning: haayalDashboardData.i18n.tagStickyWarning,
                    sticky_important: haayalDashboardData.i18n.tagStickyImportant,
                    sticky_info: haayalDashboardData.i18n.tagStickyInfo,
                    sticky_tip: haayalDashboardData.i18n.tagStickyTip,
                };
                if (typeLabels[cType]) {
                    var typeBadge = document.createElement('span');
                    typeBadge.className = 'haayal-notes-dash-badge haayal-notes-dash-badge-' + cType;
                    typeBadge.textContent = typeLabels[cType];
                    tdTags.appendChild(typeBadge);
                }
                if (hasPrivate) {
                    var privateBadge = document.createElement('span');
                    privateBadge.className = 'haayal-notes-dash-badge haayal-notes-dash-badge-private';
                    privateBadge.textContent = haayalDashboardData.i18n.tagPrivate;
                    tdTags.appendChild(privateBadge);
                }
            }
            tr.appendChild(tdTags);

            // Content (truncated with expand).
            var tdContent = document.createElement('td');
            tdContent.className = 'haayal-notes-col-content';
            var fullContent = c.content || '';
            var plainContent = fullContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
            if (plainContent.length > 80) {
                var truncSpan = document.createElement('span');
                truncSpan.className = 'haayal-notes-content-truncated';
                truncSpan.textContent = plainContent.substring(0, 80) + '...';

                var fullSpan = document.createElement('span');
                fullSpan.className = 'haayal-notes-content-full';
                fullSpan.style.display = 'none';
                fullSpan.innerHTML = fullContent;

                var chevron = document.createElement('span');
                chevron.className = 'haayal-notes-content-chevron dashicons dashicons-arrow-down-alt2';

                tdContent.appendChild(truncSpan);
                tdContent.appendChild(fullSpan);
                tdContent.appendChild(chevron);
                tdContent.classList.add('haayal-notes-content-expandable');
                tdContent.addEventListener('click', function () {
                    var isExpanded = fullSpan.style.display !== 'none';
                    truncSpan.style.display = isExpanded ? '' : 'none';
                    fullSpan.style.display = isExpanded ? 'none' : '';
                    tdContent.classList.toggle('haayal-notes-content-expanded', !isExpanded);
                    chevron.classList.toggle('haayal-notes-chevron-open', !isExpanded);
                });
            } else {
                tdContent.innerHTML = fullContent;
            }
            tr.appendChild(tdContent);

            // Page (dimmed for replies).
            var tdPage = document.createElement('td');
            tdPage.className = 'haayal-notes-col-page';
            if (isReply) {
                tdPage.classList.add('haayal-notes-reply-dim');
            }
            var isSpecial = c.page_url.indexOf('__') === 0;
            if (isSpecial) {
                // Global or generic-scoped comment — no link.
                var titleOnly = document.createElement('span');
                titleOnly.className = 'haayal-notes-page-title';
                titleOnly.textContent = c.page_title || c.page_url;
                tdPage.appendChild(titleOnly);
            } else {
                var pageLink = document.createElement('a');
                pageLink.href = haayalDashboardData.adminUrl.replace(/\/$/, '') + c.page_url.replace(/^\/wp-admin/, '');
                pageLink.target = '_blank';
                if (c.page_title) {
                    var titleSpan = document.createElement('span');
                    titleSpan.className = 'haayal-notes-page-title';
                    titleSpan.textContent = c.page_title;
                    pageLink.appendChild(titleSpan);
                    var urlSpan = document.createElement('span');
                    urlSpan.className = 'haayal-notes-page-url haayal-notes-url-truncate';
                    urlSpan.textContent = c.page_url;
                    urlSpan.title = c.page_url;
                    pageLink.appendChild(urlSpan);
                } else {
                    var urlOnlySpan = document.createElement('span');
                    urlOnlySpan.className = 'haayal-notes-page-url haayal-notes-url-truncate';
                    urlOnlySpan.textContent = c.page_url;
                    urlOnlySpan.title = c.page_url;
                    pageLink.appendChild(urlOnlySpan);
                }
                tdPage.appendChild(pageLink);
            }
            tr.appendChild(tdPage);

            // Author.
            var tdAuthor = document.createElement('td');
            tdAuthor.textContent = c.author_name || 'User #' + c.user_id;
            tr.appendChild(tdAuthor);

            // Date.
            var tdDate = document.createElement('td');
            tdDate.textContent = formatDate(c.created_at);
            tr.appendChild(tdDate);

            // Actions.
            var tdActions = document.createElement('td');
            tdActions.className = 'haayal-notes-col-actions';

            if (canModifyComment(c)) {
                var hasChildren = !isReply && state.comments.some(function (r) { return parseInt(r.parent_id) === parseInt(c.id); });
                var delLabel = hasChildren ? haayalDashboardData.i18n.deleteThread : haayalDashboardData.i18n.delete;
                var confirmMsg = hasChildren ? haayalDashboardData.i18n.confirmDelete : haayalDashboardData.i18n.confirmDeleteSingle;

                var delBtn = document.createElement('button');
                delBtn.innerHTML = '<span class="dashicons dashicons-trash"></span> ' + delLabel;
                delBtn.setAttribute('aria-haspopup', 'dialog');
                delBtn.addEventListener('click', (function (noteId, msg, label) {
                    return function () {
                        showConfirmDialog(msg, function () {
                            tbody.querySelectorAll('tr[data-note-id="' + noteId + '"], tr[data-parent-id="' + noteId + '"]').forEach(function (r) {
                                r.remove();
                            });

                            apiRequest('DELETE', '/notes/' + noteId).then(function () {
                                loadComments(false);
                            }).catch(function () {
                                loadComments(false);
                            });
                        }, label);
                    };
                })(c.id, confirmMsg, delLabel));
                tdActions.appendChild(delBtn);
            } else {
                var hint = document.createElement('span');
                hint.className = 'haayal-notes-no-delete-hint';
                hint.textContent = cannotDeleteReason(c);
                tdActions.appendChild(hint);
            }
            tr.appendChild(tdActions);

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        dashboard.appendChild(table);

        // Pagination.
        if (state.totalPages > 1) {
            var pag = document.createElement('div');
            pag.className = 'haayal-notes-pagination';

            var prevBtn = document.createElement('button');
            prevBtn.innerHTML = haayalDashboardData.i18n.prev;
            prevBtn.disabled = state.page <= 1;
            prevBtn.addEventListener('click', function () {
                if (state.page > 1) {
                    state.page--;
                    loadComments();
                }
            });
            pag.appendChild(prevBtn);

            var pageInfo = document.createElement('span');
            pageInfo.textContent = haayalDashboardData.i18n.page + ' ' + state.page + ' ' + haayalDashboardData.i18n.of + ' ' + state.totalPages;
            pag.appendChild(pageInfo);

            var nextBtn = document.createElement('button');
            nextBtn.innerHTML = haayalDashboardData.i18n.next;
            nextBtn.disabled = state.page >= state.totalPages;
            nextBtn.addEventListener('click', function () {
                if (state.page < state.totalPages) {
                    state.page++;
                    loadComments();
                }
            });
            pag.appendChild(nextBtn);

            dashboard.appendChild(pag);
        }

        app.appendChild(dashboard);

        // Notify main script that the dashboard DOM has been rebuilt,
        // so it can re-render pin markers on the new elements.
        document.dispatchEvent(new CustomEvent('haayal-notes-dom-updated'));
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr.replace(' ', 'T'));
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    document.addEventListener('haayal-notes-changed', function (e) {
        if (!e.detail || e.detail.source !== 'dashboard') {
            loadComments();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadComments);
    } else {
        loadComments();
    }
})();
