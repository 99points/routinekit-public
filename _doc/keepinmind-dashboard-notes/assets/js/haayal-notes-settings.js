(function () {
    'use strict';

    if (typeof haayalSettingsData === 'undefined') return;

    var state = {
        settings: null,
        savedShowFab: null,
        searchResults: [],
        searchTimeout: null,
    };

    function apiRequest(method, endpoint, data) {
        var opts = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': haayalSettingsData.nonce,
            },
        };
        if (data) opts.body = JSON.stringify(data);
        return fetch(haayalSettingsData.restUrl + endpoint, opts).then(function (r) { return r.json(); });
    }

    function loadSettings() {
        apiRequest('GET', '/settings').then(function (data) {
            state.settings = data;
            state.savedShowFab = data.show_floating_buttons !== false;
            render();
        });
    }

    function saveSettings() {
        var fabChanging = (state.settings.show_floating_buttons !== false) !== state.savedShowFab;
        var btns = document.querySelectorAll('.haayal-notes-section-save-btn');
        btns.forEach(function (b) { b.disabled = true; });
        apiRequest('POST', '/settings', state.settings).then(function (data) {
            state.savedShowFab = data.show_floating_buttons !== false;
            state.settings = data;
            document.body.classList.toggle('haayal-notes-vivid-colors', data.vivid_colors === true);
            btns.forEach(function (b) { b.disabled = false; });
            if (fabChanging) {
                window.location.reload();
            } else {
                showNotice('success', haayalSettingsData.i18n.saved);
            }
        }).catch(function () {
            btns.forEach(function (b) { b.disabled = false; });
            showNotice('error', haayalSettingsData.i18n.saveError);
        });
    }

    function createToggleRow(labelText, descText, checked, onChange) {
        var row = document.createElement('div');
        row.className = 'haayal-notes-toggle-row';

        var textWrap = document.createElement('div');
        textWrap.className = 'haayal-notes-toggle-row-text';

        var labelSpan = document.createElement('span');
        labelSpan.className = 'haayal-notes-toggle-row-label';
        labelSpan.textContent = labelText;
        textWrap.appendChild(labelSpan);

        if (descText) {
            var desc = document.createElement('p');
            desc.className = 'haayal-notes-settings-description';
            desc.textContent = descText;
            textWrap.appendChild(desc);
        }

        var switchLabel = document.createElement('label');
        switchLabel.className = 'haayal-notes-toggle-switch';
        switchLabel.setAttribute('aria-label', labelText);

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        cb.addEventListener('change', function () { onChange(this.checked); });

        var track = document.createElement('span');
        track.className = 'haayal-notes-toggle-track';
        track.setAttribute('aria-hidden', 'true');

        switchLabel.appendChild(cb);
        switchLabel.appendChild(track);

        row.appendChild(textWrap);
        row.appendChild(switchLabel);

        return row;
    }

    function appendSectionSave(section) {
        var wrap = document.createElement('div');
        wrap.className = 'haayal-notes-section-save';

        var btn = document.createElement('button');
        btn.className = 'haayal-notes-btn haayal-notes-btn-primary haayal-notes-section-save-btn';
        btn.textContent = haayalSettingsData.i18n.save;
        btn.addEventListener('click', saveSettings);

        wrap.appendChild(btn);
        section.appendChild(wrap);
    }

    function render() {
        var app = document.getElementById('haayal-notes-settings-app');
        if (!app || !state.settings) return;

        app.innerHTML = '';

        var form = document.createElement('div');
        form.className = 'haayal-notes-settings-form';

        // === Access group ===
        var accessSection = document.createElement('div');
        accessSection.className = 'haayal-notes-settings-section';

        var accessGroupTitle = document.createElement('h2');
        accessGroupTitle.className = 'haayal-notes-settings-group-title';
        accessGroupTitle.textContent = haayalSettingsData.i18n.accessGroupLabel;
        accessSection.appendChild(accessGroupTitle);

        var rolesTitle = document.createElement('h3');
        rolesTitle.textContent = haayalSettingsData.i18n.rolesLabel;
        accessSection.appendChild(rolesTitle);

        var rolesDiv = document.createElement('div');
        rolesDiv.className = 'haayal-notes-settings-roles';

        var allRoles = haayalSettingsData.allRoles || [];
        allRoles.forEach(function (roleObj) {
            var slug = roleObj.slug;
            var label = document.createElement('label');
            var isAdmin = slug === 'administrator';
            if (isAdmin) label.className = 'disabled';

            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = slug;
            cb.checked = state.settings.allowed_roles.indexOf(slug) !== -1;
            if (isAdmin) cb.disabled = true;

            cb.addEventListener('change', function () {
                if (this.checked) {
                    if (state.settings.allowed_roles.indexOf(slug) === -1) {
                        state.settings.allowed_roles.push(slug);
                    }
                } else {
                    state.settings.allowed_roles = state.settings.allowed_roles.filter(function (r) { return r !== slug; });
                }
            });

            label.appendChild(cb);
            label.appendChild(document.createTextNode(' ' + roleObj.name));
            rolesDiv.appendChild(label);
        });

        accessSection.appendChild(rolesDiv);

        var separator1 = document.createElement('hr');
        separator1.className = 'haayal-notes-settings-separator';
        accessSection.appendChild(separator1);

        var usersTitle = document.createElement('h3');
        usersTitle.textContent = haayalSettingsData.i18n.usersLabel;
        accessSection.appendChild(usersTitle);

        var usersDesc = document.createElement('p');
        usersDesc.className = 'haayal-notes-settings-description';
        usersDesc.textContent = haayalSettingsData.i18n.usersDesc;
        accessSection.appendChild(usersDesc);

        // User chips.
        var chipsDiv = document.createElement('div');
        chipsDiv.className = 'haayal-notes-user-chips';
        chipsDiv.id = 'haayal-notes-user-chips';
        renderUserChips(chipsDiv);
        accessSection.appendChild(chipsDiv);

        // User search.
        var searchWrap = document.createElement('div');
        searchWrap.className = 'haayal-notes-user-search-wrap';

        var searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'haayal-notes-user-search-input';
        searchInput.placeholder = haayalSettingsData.i18n.searchUsers;

        var resultsDiv = document.createElement('div');
        resultsDiv.className = 'haayal-notes-user-search-results';
        resultsDiv.id = 'haayal-notes-user-search-results';

        searchInput.addEventListener('input', function () {
            var q = this.value.trim();
            clearTimeout(state.searchTimeout);
            if (q.length < 2) {
                resultsDiv.classList.remove('visible');
                return;
            }
            state.searchTimeout = setTimeout(function () {
                searchUsers(q, resultsDiv);
            }, 300);
        });

        searchWrap.appendChild(searchInput);
        searchWrap.appendChild(resultsDiv);
        accessSection.appendChild(searchWrap);
        appendSectionSave(accessSection);

        // === Visibility group ===
        var visSection = document.createElement('div');
        visSection.className = 'haayal-notes-settings-section';

        var visGroupTitle = document.createElement('h2');
        visGroupTitle.className = 'haayal-notes-settings-group-title';
        visGroupTitle.textContent = haayalSettingsData.i18n.visibilityGroupLabel;
        visSection.appendChild(visGroupTitle);

        visSection.appendChild(createToggleRow(
            haayalSettingsData.i18n.visibleLabel,
            haayalSettingsData.i18n.visibleDesc,
            state.settings.markers_visible_default !== false,
            function (val) { state.settings.markers_visible_default = val; }
        ));

        var separatorVis = document.createElement('hr');
        separatorVis.className = 'haayal-notes-settings-separator';
        visSection.appendChild(separatorVis);

        visSection.appendChild(createToggleRow(
            haayalSettingsData.i18n.showFabLabel,
            haayalSettingsData.i18n.showFabDesc,
            state.settings.show_floating_buttons !== false,
            function (val) { state.settings.show_floating_buttons = val; }
        ));

        var separatorVisFab = document.createElement('hr');
        separatorVisFab.className = 'haayal-notes-settings-separator';
        visSection.appendChild(separatorVisFab);

        visSection.appendChild(createToggleRow(
            haayalSettingsData.i18n.defaultPrivacyToggleLabel,
            haayalSettingsData.i18n.defaultPrivacyToggleDesc,
            state.settings.default_privacy === 'private',
            function (val) { state.settings.default_privacy = val ? 'private' : 'public'; }
        ));

        var separatorVivid = document.createElement('hr');
        separatorVivid.className = 'haayal-notes-settings-separator';
        visSection.appendChild(separatorVivid);

        var palettePreview = document.createElement('div');
        palettePreview.className = 'haayal-notes-palette-preview' + (state.settings.vivid_colors ? ' haayal-notes-palette-preview--vivid' : '');
        ['default', 'vivid'].forEach(function (palette) {
            var row = document.createElement('div');
            row.className = 'haayal-notes-palette-row haayal-notes-palette-row--' + palette;
            ['warning', 'important', 'info', 'tip'].forEach(function (type) {
                var swatch = document.createElement('span');
                swatch.className = 'haayal-notes-palette-swatch haayal-notes-palette-swatch--' + type;
                row.appendChild(swatch);
            });
            palettePreview.appendChild(row);
        });

        var vividToggleRow = createToggleRow(
            haayalSettingsData.i18n.vividColorsLabel,
            haayalSettingsData.i18n.vividColorsDesc,
            state.settings.vivid_colors === true,
            function (val) {
                state.settings.vivid_colors = val;
                palettePreview.classList.toggle('haayal-notes-palette-preview--vivid', val);
            }
        );

        vividToggleRow.querySelector('.haayal-notes-toggle-row-text').insertAdjacentElement('afterend', palettePreview);
        visSection.appendChild(vividToggleRow);

        appendSectionSave(visSection);
        form.appendChild(accessSection);

        // === Permissions group ===
        var permSection = document.createElement('div');
        permSection.className = 'haayal-notes-settings-section';

        var permGroupTitle = document.createElement('h2');
        permGroupTitle.className = 'haayal-notes-settings-group-title';
        permGroupTitle.textContent = haayalSettingsData.i18n.permissionsGroupLabel;
        permSection.appendChild(permGroupTitle);

        var delTitle = document.createElement('h3');
        delTitle.textContent = haayalSettingsData.i18n.deletePolicyLabel;
        permSection.appendChild(delTitle);

        var currentPolicy = state.settings.delete_policy || 'own_only';
        var policies = [
            { value: 'own_only', label: haayalSettingsData.i18n.deletePolicyOwnOnly, desc: haayalSettingsData.i18n.deletePolicyOwnOnlyDesc },
            { value: 'role_hierarchy_strict', label: haayalSettingsData.i18n.deletePolicyRoleHierarchyStrict, desc: haayalSettingsData.i18n.deletePolicyRoleHierarchyStrictDesc },
            { value: 'role_hierarchy', label: haayalSettingsData.i18n.deletePolicyRoleHierarchy, desc: haayalSettingsData.i18n.deletePolicyRoleHierarchyDesc },
            { value: 'everybody', label: haayalSettingsData.i18n.deletePolicyEverybody, desc: haayalSettingsData.i18n.deletePolicyEverybodyDesc },
        ];

        var delDiv = document.createElement('div');
        delDiv.className = 'haayal-notes-settings-roles';

        policies.forEach(function (p) {
            var label = document.createElement('label');
            label.className = 'haayal-notes-policy-label';

            var radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'haayal_delete_policy';
            radio.value = p.value;
            radio.checked = currentPolicy === p.value;
            radio.addEventListener('change', function () {
                if (this.checked) {
                    state.settings.delete_policy = p.value;
                }
            });

            var textWrap = document.createElement('span');
            textWrap.className = 'haayal-notes-policy-text';

            var nameSpan = document.createElement('span');
            nameSpan.className = 'haayal-notes-policy-name';
            nameSpan.textContent = p.label;
            textWrap.appendChild(nameSpan);

            var descSpan = document.createElement('span');
            descSpan.className = 'haayal-notes-policy-desc';
            descSpan.textContent = p.desc;
            textWrap.appendChild(descSpan);

            label.appendChild(radio);
            label.appendChild(textWrap);
            delDiv.appendChild(label);
        });

        permSection.appendChild(delDiv);
        appendSectionSave(permSection);
        form.appendChild(permSection);
        form.appendChild(visSection);

        // === Data Management group ===
        var dataSection = document.createElement('div');
        dataSection.className = 'haayal-notes-settings-section';

        var dataGroupTitle = document.createElement('h2');
        dataGroupTitle.className = 'haayal-notes-settings-group-title';
        dataGroupTitle.textContent = haayalSettingsData.i18n.dataGroupLabel;
        dataSection.appendChild(dataGroupTitle);

        dataSection.appendChild(createToggleRow(
            haayalSettingsData.i18n.uninstallToggleLabel,
            haayalSettingsData.i18n.uninstallToggleDesc,
            state.settings.uninstall_action === 'delete',
            function (val) { state.settings.uninstall_action = val ? 'delete' : 'keep'; }
        ));

        var separator3 = document.createElement('hr');
        separator3.className = 'haayal-notes-settings-separator';
        dataSection.appendChild(separator3);

        dataSection.appendChild(createToggleRow(
            haayalSettingsData.i18n.deletedUserToggleLabel,
            haayalSettingsData.i18n.deletedUserToggleDesc,
            state.settings.deleted_user_action === 'delete',
            function (val) { state.settings.deleted_user_action = val ? 'delete' : 'keep'; }
        ));
        appendSectionSave(dataSection);
        form.appendChild(dataSection);

        app.appendChild(form);
    }

    function renderUserChips(container) {
        container.innerHTML = '';
        if (!state.settings.allowed_users || !state.settings.allowed_users.length) return;

        state.settings.allowed_users.forEach(function (userId) {
            var chip = document.createElement('span');
            chip.className = 'haayal-notes-user-chip';
            chip.textContent = 'User #' + userId + ' ';

            // Try to load display name.
            fetch(haayalSettingsData.wpRestUrl + '/users/' + userId, {
                headers: { 'X-WP-Nonce': haayalSettingsData.nonce },
            }).then(function (r) { return r.json(); }).then(function (user) {
                if (user.name) {
                    chip.childNodes[0].textContent = user.name + ' ';
                }
            }).catch(function () {});

            var removeBtn = document.createElement('button');
            removeBtn.className = 'haayal-notes-user-chip-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', function () {
                state.settings.allowed_users = state.settings.allowed_users.filter(function (id) {
                    return id !== userId;
                });
                chip.remove();
            });

            chip.appendChild(removeBtn);
            container.appendChild(chip);
        });
    }

    function searchUsers(query, resultsDiv) {
        fetch(haayalSettingsData.wpRestUrl + '/users?search=' + encodeURIComponent(query) + '&per_page=10', {
            headers: { 'X-WP-Nonce': haayalSettingsData.nonce },
        }).then(function (r) { return r.json(); }).then(function (users) {
            resultsDiv.innerHTML = '';
            if (!users.length) {
                resultsDiv.classList.remove('visible');
                return;
            }

            users.forEach(function (user) {
                // Skip already-added users.
                if (state.settings.allowed_users.indexOf(user.id) !== -1) return;

                var item = document.createElement('div');
                item.className = 'haayal-notes-user-search-item';
                item.textContent = user.name + ' (' + user.slug + ')';
                item.addEventListener('click', function () {
                    state.settings.allowed_users.push(user.id);
                    resultsDiv.classList.remove('visible');

                    var chipsDiv = document.getElementById('haayal-notes-user-chips');
                    if (chipsDiv) renderUserChips(chipsDiv);
                });
                resultsDiv.appendChild(item);
            });

            resultsDiv.classList.add('visible');
        });
    }

    function showNotice(type, message) {
        var existing = document.querySelector('.haayal-notes-settings-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.className = 'haayal-notes-settings-toast' + (type === 'error' ? ' haayal-notes-settings-toast-error' : '');
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () { toast.remove(); }, 400);
        }, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadSettings);
    } else {
        loadSettings();
    }
})();
