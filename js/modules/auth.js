/** Supabase authentication + Vercel-enforced role access for GREATNESS v1.14.0. */
window.GreatnessApp = window.GreatnessApp || {};
window.GreatnessAuth = {
    user: null,
    ready: false,
    canAccessContracts() { return Boolean(this.user?.nickname) && ['contracts', 'admin'].includes(this.user?.role || ''); },
    async getAccessToken() { return ''; }
};

window.GreatnessApp.initAuth = function initAuth() {
    const auth = window.GreatnessAuth;
    const trigger = document.getElementById('auth-trigger');
    const modal = document.getElementById('auth-modal');
    const loginPanel = document.getElementById('auth-login-panel');
    const registerPanel = document.getElementById('auth-register-panel');
    const accountPanel = document.getElementById('auth-account-panel');
    const tabs = [...document.querySelectorAll('.auth-tab')];
    const message = document.getElementById('auth-message');
    const adminPanel = document.getElementById('auth-admin-panel');
    const usersList = document.getElementById('auth-user-list');
    const usersSearch = document.getElementById('auth-user-search');
    const adminStats = document.getElementById('auth-admin-stats');
    const refreshUsersButton = document.getElementById('auth-refresh-users');
    let adminUsersCache = [];
    const socialButtons = [...document.querySelectorAll('[data-auth-provider]')];
    const socialNotes = [...document.querySelectorAll('[data-social-auth-note]')];
    let supabaseClient = null;
    let supabaseAuthEnabled = false;
    const callbackSnapshot = { hash: location.hash || '', search: location.search || '' };
    const callbackParams = new URLSearchParams(callbackSnapshot.hash.replace(/^#/, ''));
    const callbackQuery = new URLSearchParams(callbackSnapshot.search);
    const callbackType = callbackParams.get('type') || callbackQuery.get('type') || '';
    const callbackError = callbackParams.get('error_description') || callbackQuery.get('error_description') || callbackParams.get('error') || callbackQuery.get('error') || '';
    const isEmailConfirmationCallback = callbackType === 'signup' || callbackType === 'email_change';

    const api = async (path, options = {}) => {
        const config = window.GREATNESS_CONFIG || {};
        const base = String(config.apiBaseUrl || '').replace(/\/$/, '');
        const url = /^https?:\/\//i.test(path) ? path : `${base}${path}`;
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (supabaseClient) {
            const { data } = await supabaseClient.auth.getSession();
            const accessToken = data?.session?.access_token;
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        }
        const response = await fetch(url, { headers, ...options });
        let payload = {};
        try { payload = await response.json(); } catch (_) {}
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
        return payload;
    };

    function setAuthAvailability(enabled) {
        supabaseAuthEnabled = !!enabled;
        socialButtons.forEach(button => {
            button.disabled = !supabaseAuthEnabled;
            button.title = supabaseAuthEnabled ? '' : 'Supabase Auth тимчасово недоступний';
        });
        document.querySelectorAll('#auth-login-form input, #auth-register-form input, #auth-login-form button[type="submit"], #auth-register-form button[type="submit"]').forEach(el => {
            el.disabled = !supabaseAuthEnabled;
        });
        socialNotes.forEach(note => {
            note.hidden = supabaseAuthEnabled;
            if (!supabaseAuthEnabled) note.textContent = 'Авторизація тимчасово недоступна.';
        });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    }

    function roleLabel(role) {
        return ({ member: 'Учасник', contracts: 'Family', admin: 'Адмін' })[role] || 'Гість';
    }

    function providerLabel(provider) {
        return ({ google: 'Google', discord: 'Discord', email: 'Email' })[provider] || provider || 'Supabase';
    }

    function setMessage(text = '', success = false) {
        if (!message) return;
        message.textContent = text;
        message.classList.toggle('success', success);
    }

    function dispatchAuthChanged() {
        window.dispatchEvent(new CustomEvent('greatness:auth-changed', { detail: { user: auth.user } }));
    }

    function showCallbackResult(success, title, text) {
        const overlay = document.getElementById('auth-callback');
        const icon = document.getElementById('auth-callback-icon');
        const titleEl = document.getElementById('auth-callback-title');
        const textEl = document.getElementById('auth-callback-text');
        const button = document.getElementById('auth-callback-continue');
        const countdown = document.getElementById('auth-callback-countdown');
        if (!overlay || !icon || !titleEl || !textEl || !button) return;

        overlay.hidden = false;
        overlay.classList.toggle('is-error', !success);
        icon.innerHTML = success ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-xmark"></i>';
        titleEl.textContent = title;
        textEl.textContent = text;
        document.body.style.overflow = 'hidden';

        let seconds = 5;
        const goHome = () => {
            overlay.hidden = true;
            document.body.style.overflow = '';
            history.replaceState(null, '', `${location.pathname}#home`);
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            document.querySelector('.nav-link[data-tab="home"]')?.click();
        };
        button.onclick = goHome;
        if (countdown) countdown.textContent = `Автоматичний перехід через ${seconds} с`;
        const timer = setInterval(() => {
            if (overlay.hidden) return clearInterval(timer);
            seconds -= 1;
            if (seconds <= 0) {
                clearInterval(timer);
                goHome();
            } else if (countdown) {
                countdown.textContent = `Автоматичний перехід через ${seconds} с`;
            }
        }, 1000);
    }

    function avatarMarkup(user, compact = false) {
        const cls = compact ? 'auth-avatar' : 'auth-avatar auth-avatar-large';
        if (user?.avatarUrl) return `<span class="${cls}"><img src="${escapeHtml(user.avatarUrl)}" alt="" referrerpolicy="no-referrer"></span>`;
        const initial = escapeHtml((user?.nickname || 'G').trim().charAt(0).toUpperCase());
        return `<span class="${cls}"><span class="auth-avatar-letter">${initial}</span></span>`;
    }

    function render() {
        const user = auth.user;
        if (!trigger) return;
        if (user) {
            trigger.classList.add('is-authenticated');
            trigger.innerHTML = `${avatarMarkup(user, true)}<span class="auth-trigger-copy"><span class="auth-trigger-name">${escapeHtml(user.nickname || 'Акаунт')}</span><span class="auth-trigger-role">${roleLabel(user.role)}</span></span>`;
        } else {
            trigger.classList.remove('is-authenticated');
            trigger.innerHTML = '<i class="fa-solid fa-user-shield"></i><span class="auth-trigger-copy"><span class="auth-trigger-name">Увійти</span><span class="auth-trigger-role">Акаунт</span></span>';
        }
        const contractsLink = document.querySelector('.nav-link[data-tab="contracts"]');
        if (contractsLink) contractsLink.hidden = !['contracts', 'admin'].includes(user?.role || '');
        dispatchAuthChanged();
    }

    async function refreshRemoteUser() {
        if (!supabaseClient) {
            auth.user = null;
            render();
            return null;
        }
        const { data } = await supabaseClient.auth.getSession();
        if (!data?.session?.access_token) {
            auth.user = null;
            render();
            return null;
        }
        const payload = await api('/api/me', { method: 'GET' });
        auth.user = payload.user || null;
        render();
        return auth.user;
    }

    async function initSupabase() {
        const config = window.GREATNESS_CONFIG || {};
        if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase?.createClient) {
            setAuthAvailability(false);
            return;
        }
        supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        auth.getAccessToken = async () => { const { data } = await supabaseClient.auth.getSession(); return data?.session?.access_token || ''; };
        setAuthAvailability(true);

        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (data?.session) await refreshRemoteUser();

        if (callbackError) {
            showCallbackResult(false, 'Не вдалося підтвердити email', decodeURIComponent(callbackError.replace(/\+/g, ' ')));
        } else if (isEmailConfirmationCallback) {
            if (data?.session) {
                showCallbackResult(true, 'Email успішно підтверджено', 'Акаунт активовано. Ви вже увійшли та можете користуватися сайтом.');
            } else {
                showCallbackResult(false, 'Посилання не спрацювало', 'Не вдалося підтвердити сесію. Спробуйте відкрити лист ще раз або увійти вручну.');
            }
        }

        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                auth.user = null;
                render();
                return;
            }
            if (session && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
                setTimeout(() => refreshRemoteUser().catch(err => console.warn('Role refresh failed:', err)), 0);
            }
        });
    }

    async function startSocialAuth(provider, button) {
        if (!supabaseClient || !supabaseAuthEnabled) return setMessage('Supabase Auth ще не підключений.');
        const original = button.innerHTML;
        socialButtons.forEach(x => x.disabled = true);
        button.classList.add('auth-social-loading');
        button.querySelector('.auth-social-arrow')?.classList.replace('fa-arrow-right', 'fa-spinner');
        setMessage(`Відкриваємо ${provider === 'google' ? 'Google' : 'Discord'}...`);
        try {
            const redirectTo = `${location.origin}${location.pathname}`;
            const { error } = await supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo } });
            if (error) throw error;
        } catch (err) {
            button.innerHTML = original;
            button.classList.remove('auth-social-loading');
            socialButtons.forEach(x => x.disabled = !supabaseAuthEnabled);
            setMessage(err.message || 'Не вдалося почати соціальний вхід.');
        }
    }

    function selectTab(name) {
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.authTab === name));
        loginPanel.hidden = name !== 'login';
        registerPanel.hidden = name !== 'register';
        accountPanel.hidden = true;
        setMessage('');
    }

    async function openModal(forceTab) {
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        setMessage('');
        if (auth.user && !forceTab) {
            loginPanel.hidden = true;
            registerPanel.hidden = true;
            tabs.forEach(x => x.hidden = true);
            accountPanel.hidden = false;
            renderAccount();
            if (auth.user.role === 'admin') await loadUsers();
        } else {
            tabs.forEach(x => x.hidden = false);
            selectTab(forceTab || 'login');
        }
    }

    function closeModal() {
        modal.hidden = true;
        document.body.style.overflow = '';
        setMessage('');
    }

    function renderAccount() {
        const user = auth.user;
        if (!user) return;
        const card = accountPanel.querySelector('.auth-profile-card');
        if (card) card.querySelector('.auth-avatar')?.remove();
        if (card) card.insertAdjacentHTML('afterbegin', avatarMarkup(user));
        document.getElementById('auth-account-name').textContent = user.nickname || 'Нік не вказано';
        document.getElementById('auth-account-email').textContent = user.nickname ? `GREATNESS ID #${user.publicId}` : 'Створіть ігровий нік. Реальне ім’я та email іншим користувачам не показуються.';
        document.getElementById('auth-account-role').textContent = roleLabel(user.role);
        const nicknameInput = document.getElementById('auth-nickname-input');
        const nicknameHint = document.getElementById('auth-nickname-hint');
        if (nicknameInput) nicknameInput.value = user.nickname || '';
        if (nicknameHint) nicknameHint.textContent = user.nickname
            ? 'Цей нік використовується всередині GREATNESS і в розділі контрактів.'
            : 'Нік потрібен лише для роботи з контрактами. Він може збігатися з вашим ім’ям, якщо це ваш ігровий нік, але не повинен бути схожим на прізвище або email.';

        const contractsGranted = ['contracts', 'admin'].includes(user.role);
        const adminGranted = user.role === 'admin';
        const contractsCard = document.getElementById('auth-contracts-access-card');
        const adminCard = document.getElementById('auth-admin-access-card');
        const accessStatus = document.getElementById('auth-access-status');
        [contractsCard, adminCard].forEach(cardEl => cardEl?.classList.remove('is-granted'));
        if (contractsGranted) contractsCard?.classList.add('is-granted');
        if (adminGranted) adminCard?.classList.add('is-granted');
        if (contractsCard) contractsCard.querySelector('.auth-access-check').className = `fa-solid ${contractsGranted ? 'fa-circle-check' : 'fa-lock'} auth-access-check`;
        if (adminCard) adminCard.querySelector('.auth-access-check').className = `fa-solid ${adminGranted ? 'fa-circle-check' : 'fa-lock'} auth-access-check`;
        const contractsText = document.getElementById('auth-contracts-access-text');
        if (contractsText) contractsText.textContent = contractsGranted ? 'Доступ активний: журнал, OCR та звіти' : 'Доступ видає адміністратор';
        if (accessStatus) {
            accessStatus.textContent = adminGranted ? 'Повний доступ' : contractsGranted ? 'Family доступ' : 'Базовий доступ';
            accessStatus.className = `auth-access-status ${adminGranted ? 'is-admin' : contractsGranted ? 'is-contracts' : ''}`;
        }
        adminPanel.hidden = !adminGranted;
    }

    function renderAdminUsers(filter = '') {
        if (!usersList) return;
        const q = filter.trim().toLowerCase();
        const visible = adminUsersCache.filter(user => !q || `${user.nickname || ''} ${user.publicId || ''} ${roleLabel(user.role)}`.toLowerCase().includes(q));
        if (adminStats) {
            const counts = adminUsersCache.reduce((acc, user) => { acc.total += 1; acc[user.role] = (acc[user.role] || 0) + 1; return acc; }, { total: 0, member: 0, contracts: 0, admin: 0 });
            adminStats.innerHTML = `<span><b>${counts.total}</b><small>Всього</small></span><span><b>${counts.member}</b><small>Учасники</small></span><span><b>${counts.contracts}</b><small>Family</small></span><span><b>${counts.admin}</b><small>Адміни</small></span>`;
        }
        usersList.innerHTML = visible.map(user => `
            <div class="auth-user-row" data-public-id="${escapeHtml(user.publicId)}">
                <div class="auth-user-identity">${avatarMarkup(user, true)}<span><strong>${escapeHtml(user.nickname || 'Нік не вказано')}</strong><small>GREATNESS ID #${escapeHtml(user.publicId)}</small></span></div>
                <div class="auth-user-role-control"><span class="auth-current-role role-${escapeHtml(user.role)}">${escapeHtml(roleLabel(user.role))}</span><select class="auth-role-select" aria-label="Роль користувача ${escapeHtml(user.publicId)}">
                    <option value="member" ${user.role === 'member' ? 'selected' : ''}>Учасник</option>
                    <option value="contracts" ${user.role === 'contracts' ? 'selected' : ''}>Family</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Адмін</option>
                </select></div>
            </div>`).join('') || `<div class="auth-empty-state"><i class="fa-solid fa-user-slash"></i><span>${q ? 'Нічого не знайдено' : 'Користувачів ще немає'}</span></div>`;
        usersList.querySelectorAll('.auth-role-select').forEach(select => {
            select.addEventListener('change', async event => {
                const row = event.target.closest('.auth-user-row');
                const publicId = String(row.dataset.publicId || '');
                const target = adminUsersCache.find(x => String(x.publicId) === publicId);
                const previousRole = target?.role || 'member';
                const nextRole = event.target.value;
                if (previousRole === nextRole) return;
                event.target.disabled = true;
                row.classList.add('is-saving');
                try {
                    const payload = await api('/api/admin_users', { method: 'POST', body: JSON.stringify({ publicId, role: nextRole }) });
                    if (target) target.role = payload.user?.role || nextRole;
                    renderAdminUsers(usersSearch?.value || '');
                    setMessage(`Доступ для ${target?.nickname || `#${publicId}`} змінено: ${roleLabel(nextRole)}.`, true);
                } catch (err) {
                    event.target.value = previousRole;
                    setMessage(err.message);
                    row.classList.remove('is-saving');
                    event.target.disabled = false;
                }
            });
        });
    }

    async function loadUsers() {
        if (!usersList) return;
        usersList.innerHTML = '<div class="auth-loading-state"><i class="fa-solid fa-spinner"></i><span>Завантаження користувачів...</span></div>';
        try {
            const payload = await api('/api/admin_users', { method: 'GET' });
            adminUsersCache = payload.users || [];
            renderAdminUsers(usersSearch?.value || '');
        } catch (err) { usersList.innerHTML = `<div class="auth-hint">${escapeHtml(err.message)}</div>`; }
    }


    document.getElementById('auth-nickname-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        const input = document.getElementById('auth-nickname-input');
        const nickname = (input?.value || '').trim().replace(/\s+/g, ' ');
        const nicknameHint = document.getElementById('auth-nickname-hint');
        const showNicknameError = text => {
            if (nicknameHint) {
                nicknameHint.textContent = text;
                nicknameHint.classList.add('is-error');
            }
            input?.focus();
        };
        if (!nickname) return showNicknameError('Вкажіть ігровий нік.');
        if (!/^[\p{L}\p{N}_ -]+$/u.test(nickname)) return showNicknameError('У ніку дозволені лише літери, цифри, пробіли, _ та -.');
        if (nicknameHint) {
            nicknameHint.textContent = 'Перевіряємо та зберігаємо нік...';
            nicknameHint.classList.remove('is-error');
        }
        button.disabled = true;
        setMessage('');
        try {
            const payload = await api('/api/me', { method: 'POST', body: JSON.stringify({ nickname }) });
            auth.user = payload.user || auth.user;
            render();
            renderAccount();
            if (auth.user?.role === 'admin') await loadUsers();
            setMessage('Нік збережено.', true);
        } catch (err) {
            showNicknameError(err.message || 'Не вдалося зберегти нік.');
        } finally { button.disabled = false; }
    });


    usersSearch?.addEventListener('input', () => renderAdminUsers(usersSearch.value));
    refreshUsersButton?.addEventListener('click', async () => {
        refreshUsersButton.classList.add('is-spinning');
        try { await loadUsers(); } finally { setTimeout(() => refreshUsersButton.classList.remove('is-spinning'), 250); }
    });

    socialButtons.forEach(button => button.addEventListener('click', () => startSocialAuth(button.dataset.authProvider, button)));

    document.getElementById('auth-login-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!supabaseClient) return setMessage('Supabase Auth ще не підключений.');
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        setMessage('Входимо...');
        try {
            const email = document.getElementById('auth-login-email').value.trim();
            const password = document.getElementById('auth-login-password').value;
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await refreshRemoteUser();
            closeModal();
        } catch (err) {
            const text = /Email not confirmed/i.test(err.message || '') ? 'Підтвердіть email за посиланням у листі, а потім увійдіть.' : (err.message || 'Не вдалося увійти.');
            setMessage(text);
        } finally { button.disabled = false; }
    });

    document.getElementById('auth-register-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!supabaseClient) return setMessage('Supabase Auth ще не підключений.');
        const button = form.querySelector('button[type="submit"]');
        const password = document.getElementById('auth-register-password').value;
        const confirm = document.getElementById('auth-register-confirm').value;
        if (password !== confirm) return setMessage('Паролі не співпадають.');
        button.disabled = true;
        setMessage('Створюємо акаунт...');
        try {
            const email = document.getElementById('auth-register-email').value.trim();
            const emailRedirectTo = `${location.origin}${location.pathname}`;
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { emailRedirectTo }
            });
            if (error) throw error;
            if (data.session) {
                await refreshRemoteUser();
                closeModal();
            } else {
                form.reset();
                setMessage('Акаунт створено. Перевірте пошту та підтвердіть email. Після підтвердження поверніться на сайт.', true);
            }
        } catch (err) { setMessage(err.message || 'Не вдалося створити акаунт.'); }
        finally { button.disabled = false; }
    });

    document.getElementById('auth-logout')?.addEventListener('click', async () => {
        try { if (supabaseClient) await supabaseClient.auth.signOut(); } catch (_) {}
        auth.user = null;
        render();
        closeModal();
        if (location.hash === '#contracts') location.hash = '#home';
    });

    trigger?.addEventListener('click', () => openModal());
    modal?.querySelectorAll('[data-auth-close]').forEach(el => el.addEventListener('click', closeModal));
    tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab.dataset.authTab)));
    document.getElementById('contracts-login-button')?.addEventListener('click', () => openModal(auth.user ? null : 'login'));
    modal?.querySelectorAll('.auth-password-toggle').forEach(button => button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.target);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.innerHTML = `<i class="fa-solid fa-eye${input.type === 'password' ? '' : '-slash'}"></i>`;
    }));

    (async () => {
        setAuthAvailability(false);
        try { await initSupabase(); } catch (err) { console.warn('Supabase auth init failed:', err); setAuthAvailability(false); auth.user = null; }
        auth.ready = true;
        render();
    })();
};
