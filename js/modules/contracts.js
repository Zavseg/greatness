/**
 * Contract screenshot processing, payouts, journal analytics, and exports.
 *
 * This module owns only the DOM behavior for its feature area. Keeping feature
 * logic isolated makes the site easier to debug and change without touching
 * unrelated functionality.
 */
window.GreatnessApp = window.GreatnessApp || {};
console.info("GREATNESS Contracts build 1.12.0 loaded");

window.GreatnessApp.initContracts = function initContracts() {
    // Prevent a transient duplicate badge flash while Save All is verifying rows that were just written.
    let suppressDuplicateUi = false;
    // Preset Family Roster (Members)
    // Official GREATNESS roster used by participant selectors and reporting.
    let familyRoster = [
        "A. Banderras",
        "Ray Greatness",
        "Roma Poltos",
        "Evgesha Greatness",
        "Tony Greatness",
        "Night_Prince",
        "Kirill Greatness",
        "Jackson Teller",
        "Tony Montaro",
        "Evgeshka Greatness",
        "Cash Greatness",
        "Miles Greatness",
        "Valeria Greatness",
        "Simon Greatness",
        "NIGHT Hunt",
        "Oleksandr Grinchuk",
        "Ruslan Greatness",
        "Ares Greatness",
        "Danil Greatness",
        "Pablo Greatness",
        "Alex Greatness",
        "Kate Greatness",
        "Oleksii Otaman",
        "Dmitro Yakovliev"
    ];

    // Remove placeholder names from older localStorage versions during migration.
    const LEGACY_PLACEHOLDER_ROSTER = new Set([
        "Денис Грінченко", "Матвій Січка", "Богдан Франко", "Антон Мороз",
        "Олександр Кравченко", "Вадим Панов", "Ярослав Коваль", "Віталій Марченко"
    ]);

    // Local State
    let globalSelectedNicknames = [];
    let uploadedCards = []; // State for uploaded screenshot cards
    let activePeriodFilter = 'current-week'; // 'current-week' | 'previous-week' | 'today' | 'current-month' | 'previous-month' | 'custom'
    const journalUndoStack = [];
    const MAX_JOURNAL_UNDO_STEPS = 30;

    const LOCAL_STORAGE_KEY = 'greatness_contracts_journal';
    const ROSTER_STORAGE_KEY = 'greatness_family_roster';
    const DEMO_SEED_STORAGE_KEY = 'greatness_contracts_demo_seed_v135';

    // Google Sheets is the source of truth. localStorage is only an offline cache so
    // the UI can still render if the network is temporarily unavailable.
    let journalEntries = [];
    try {
        const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
        journalEntries = Array.isArray(cached) ? cached : [];
    } catch (_) {
        journalEntries = [];
    }
    let googleSheetReady = false;
    let googleSheetRequestId = 0;

    // Contract catalog is shared through Google Sheets. It starts with only values
    // confirmed from real screenshots and grows automatically from saved contracts.
    let contractCatalog = [
        { contractName: 'Продаж трофеїв II', baseName: 'Продаж трофеїв', level: 'II', compensation: 140000, confirmedCount: 1, aliases: [], source: 'verified-screenshot' },
        { contractName: "Переробка м'яса II", baseName: "Переробка м'яса", level: 'II', compensation: 230000, confirmedCount: 1, aliases: [], source: 'verified-screenshot' },
        { contractName: 'Полювання II', baseName: 'Полювання', level: 'II', compensation: 130000, confirmedCount: 1, aliases: [], source: 'verified-screenshot' },
        { contractName: 'Балонний транзит II', baseName: 'Балонний транзит', level: 'II', compensation: 185000, confirmedCount: 1, aliases: [], source: 'verified-screenshot' },
        { contractName: 'Доставка OG Kush I', baseName: 'Доставка OG Kush', level: 'I', compensation: 170000, confirmedCount: 1, source: 'verified-screenshot' }
    ];

    // Contracts are role-gated server-side by the Vercel API. The browser never receives
    // the Google Apps Script password or its signed token.
    const accessGate = document.getElementById('contracts-access-gate');
    const protectedContent = document.getElementById('contracts-protected-content');
    const accessCopy = document.getElementById('contracts-access-copy');
    const accessButton = document.getElementById('contracts-login-button');

    function canAccessContracts() {
        return Boolean(window.GreatnessAuth?.canAccessContracts?.());
    }

    async function secureContractsApi(action, payload = {}) {
        const base = String(window.GREATNESS_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
        const token = await window.GreatnessAuth?.getAccessToken?.();
        if (!base) throw new Error('Contracts API is not configured');
        if (!token) throw new Error('Authentication required');
        const response = await fetch(`${base}/api/contracts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ action, ...payload })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) throw new Error(data?.error || `Contracts HTTP ${response.status}`);
        return data;
    }

    function renderContractsAccess() {
        const user = window.GreatnessAuth?.user || null;
        const allowed = canAccessContracts();
        if (accessGate) accessGate.hidden = allowed;
        if (protectedContent) protectedContent.hidden = !allowed;
        if (!allowed) {
            if (accessCopy) accessCopy.textContent = user
                ? `Ви увійшли як ${user.displayName || user.email}, але роль «${user.role === 'member' ? 'Учасник' : user.role}» не має доступу до контрактів.`
                : 'Контракти доступні лише авторизованим користувачам з відповідним рівнем доступу.';
            if (accessButton) accessButton.innerHTML = user
                ? '<i class="fa-solid fa-user-shield"></i>&nbsp; Відкрити профіль'
                : '<i class="fa-solid fa-right-to-bracket"></i>&nbsp; Увійти в акаунт';
        }
    }

    async function refreshContractsAccess() {
        renderContractsAccess();
        if (!canAccessContracts()) return;
        if (accessGate) accessGate.hidden = true;
        if (protectedContent) protectedContent.hidden = false;
        setSheetStatus('syncing', 'Підключення до захищеного сховища...');
        await Promise.allSettled([loadContractCatalogFromGoogleSheet(), loadJournalFromGoogleSheet()]);
    }

    window.addEventListener('greatness:auth-changed', refreshContractsAccess);
    renderContractsAccess();

    // Load saved custom roster if present
    const savedRoster = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (savedRoster) {
        try {
            const parsed = JSON.parse(savedRoster);
            if (Array.isArray(parsed) && parsed.length > 0) {
                familyRoster = Array.from(new Set([...familyRoster, ...parsed.filter(nick => !LEGACY_PLACEHOLDER_ROSTER.has(nick))]));
            }
        } catch (e) { console.error('Error loading roster:', e); }
    }

    // Sub-tab switching inside #contracts
    const subtabButtons = document.querySelectorAll('.subtab-btn');
    const subtabContents = document.querySelectorAll('.contracts-subtab-content');

    function switchContractsSubtab(targetSubtabId) {
        subtabButtons.forEach(btn => btn.classList.remove('active'));
        subtabContents.forEach(content => content.classList.remove('active'));

        const activeBtn = document.querySelector(`.subtab-btn[data-subtab="${targetSubtabId}"]`);
        const activeContent = document.getElementById(targetSubtabId);

        if (activeBtn && activeContent) {
            activeBtn.classList.add('active');
            activeContent.classList.add('active');
        }

        if (targetSubtabId === 'contracts-sub-journal') {
            renderJournalAnalytics();
        }
    }

    subtabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-subtab');
            switchContractsSubtab(target);
        });
    });

    // Populate Roster Dropdown
    const globalNicknameSelect = document.getElementById('global-nickname-select');

    // Rank participant selectors by recent real activity: last 14 rolling days.
    // Active players come first by number of journal participations; ties and inactive players are alphabetical.
    function getRosterByRecentActivity() {
        const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);
        const activity = new Map();
        getStoredJournalEntries().forEach(entry => {
            const ts = Date.parse(entry.completedAt || entry.createdAt || '');
            if (!Number.isFinite(ts) || ts < cutoff) return;
            [...new Set(Array.isArray(entry.participants) ? entry.participants : [])].forEach(nick => {
                activity.set(nick, (activity.get(nick) || 0) + 1);
            });
        });
        return [...familyRoster].sort((a, b) => {
            const countDiff = (activity.get(b) || 0) - (activity.get(a) || 0);
            return countDiff || a.localeCompare(b, 'uk', { sensitivity: 'base' });
        });
    }

    function getRosterActivityGroups() {
        const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);
        const activity = new Map();
        getStoredJournalEntries().forEach(entry => {
            const ts = Date.parse(entry.completedAt || entry.createdAt || '');
            if (!Number.isFinite(ts) || ts < cutoff) return;
            [...new Set(Array.isArray(entry.participants) ? entry.participants : [])].forEach(nick => {
                activity.set(nick, (activity.get(nick) || 0) + 1);
            });
        });
        const ordered = getRosterByRecentActivity();
        return {
            active: ordered.filter(nick => (activity.get(nick) || 0) > 0),
            inactive: ordered.filter(nick => (activity.get(nick) || 0) === 0)
        };
    }

    function appendRosterOptions(select, excluded = []) {
        const excludedSet = new Set(excluded);
        const { active, inactive } = getRosterActivityGroups();
        active.filter(nick => !excludedSet.has(nick)).forEach(nick => {
            const opt = document.createElement('option');
            opt.value = nick;
            opt.textContent = nick;
            select.appendChild(opt);
        });
        if (active.some(nick => !excludedSet.has(nick)) && inactive.some(nick => !excludedSet.has(nick))) {
            const divider = document.createElement('option');
            divider.disabled = true;
            divider.textContent = '────────────────────';
            select.appendChild(divider);
        }
        inactive.filter(nick => !excludedSet.has(nick)).forEach(nick => {
            const opt = document.createElement('option');
            opt.value = nick;
            opt.textContent = nick;
            select.appendChild(opt);
        });
    }

    function populateRosterDropdown() {
        if (!globalNicknameSelect) return;
        globalNicknameSelect.innerHTML = '<option value="">-- Виберіть участника --</option>';
        appendRosterOptions(globalNicknameSelect);
    }
    populateRosterDropdown();

    // Global Nickname Selection handling
    const btnAddGlobalNick = document.getElementById('btn-add-global-nick');
    const btnCreateCustomNick = document.getElementById('btn-create-custom-nick');
    const newCustomNicknameInput = document.getElementById('new-custom-nickname');
    const globalSelectedTagsContainer = document.getElementById('global-selected-tags');

    function renderGlobalNickTags() {
        if (!globalSelectedTagsContainer) return;
        globalSelectedTagsContainer.innerHTML = '';

        if (globalSelectedNicknames.length === 0) {
            globalSelectedNicknamesContainerPlaceholder();
            return;
        }

        globalSelectedNicknames.forEach(nick => {
            const tag = document.createElement('span');
            tag.className = 'batch-tag';
            tag.innerHTML = `
                <i class="fa-solid fa-user"></i> ${nick}
                <i class="fa-solid fa-xmark remove-tag" data-nick="${nick}"></i>
            `;
            globalSelectedTagsContainer.appendChild(tag);
        });

        // Event listener to remove tag
        globalSelectedTagsContainer.querySelectorAll('.remove-tag').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const nickToRemove = icon.getAttribute('data-nick');
                globalSelectedNicknames = globalSelectedNicknames.filter(n => n !== nickToRemove);
                renderGlobalNickTags();
            });
        });
    }

    function globalSelectedNicknamesContainerPlaceholder() {
        globalSelectedTagsContainer.innerHTML = '<span class="text-muted" style="font-size: 13px;">Не обрано жодного ника. Виберіть із списку або введіть новий.</span>';
    }
    globalSelectedNicknamesContainerPlaceholder();

    if (btnAddGlobalNick) {
        btnAddGlobalNick.addEventListener('click', () => {
            const selected = globalNicknameSelect.value;
            if (selected && !globalSelectedNicknames.includes(selected)) {
                globalSelectedNicknames.push(selected);
                renderGlobalNickTags();
                globalNicknameSelect.value = '';
            }
        });
    }

    if (btnCreateCustomNick) {
        btnCreateCustomNick.addEventListener('click', () => {
            const customNick = newCustomNicknameInput.value.trim();
            if (customNick) {
                if (!familyRoster.includes(customNick)) {
                    familyRoster.push(customNick);
                    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(familyRoster));
                    populateRosterDropdown();
                }
                if (!globalSelectedNicknames.includes(customNick)) {
                    globalSelectedNicknames.push(customNick);
                    renderGlobalNickTags();
                }
                newCustomNicknameInput.value = '';
            }
        });
    }

    // Apply global selected nicknames to ALL current screenshot cards
    const btnApplyNicksToAll = document.getElementById('btn-apply-nicks-to-all');
    if (btnApplyNicksToAll) {
        btnApplyNicksToAll.addEventListener('click', () => {
            if (uploadedCards.length === 0) {
                alert('Спочатку завантажте хоча б один скріншот!');
                return;
            }
            if (globalSelectedNicknames.length === 0) {
                alert('Будь ласка, оберіть або додайте хоча б один нікнейм у панелі вище.');
                return;
            }

            uploadedCards.forEach(card => {
                // Combine existing card nicks with global ones uniquely
                card.participants = Array.from(new Set([...card.participants, ...globalSelectedNicknames]));
            });

            renderAllUploadedCards();
            alert(`Нікнейми (${globalSelectedNicknames.join(', ')}) успішно застосовані до всіх ${uploadedCards.length} скріншотів!`);
        });
    }

    // --- DRAG AND DROP & UPLOAD LOGIC ---
    const dropzone = document.getElementById('contract-dropzone');
    const fileInput = document.getElementById('contract-file-input');
    const cardsContainer = document.getElementById('contract-cards-container');
    const cardsHeader = document.getElementById('cards-header');
    const uploadCountSpan = document.getElementById('upload-count');
    const btnClearUploaded = document.getElementById('btn-clear-uploaded');
    const batchBar = document.getElementById('contract-batch-bar');

    if (dropzone && fileInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }

    const pasteButton = document.getElementById('btn-paste-contract-image');

    async function pasteImagesFromClipboard() {
        if (!navigator.clipboard || !navigator.clipboard.read) {
            alert('Браузер не дозволяє читати зображення з буфера кнопкою. Скопіюйте скріншот і натисніть Ctrl+V на сторінці.');
            return;
        }

        try {
            const clipboardItems = await navigator.clipboard.read();
            const imageFiles = [];
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (!imageType) continue;
                const blob = await item.getType(imageType);
                imageFiles.push(new File([blob], `clipboard-${Date.now()}.png`, { type: imageType }));
            }
            if (imageFiles.length === 0) {
                alert('У буфері обміну немає зображення.');
                return;
            }
            handleFiles(imageFiles);
        } catch (error) {
            console.warn('Clipboard image read failed:', error);
            alert('Не вдалося прочитати буфер. Спробуйте Ctrl+V або перетягніть файл.');
        }
    }

    if (pasteButton) pasteButton.addEventListener('click', pasteImagesFromClipboard);

    document.addEventListener('paste', event => {
        const contractsSection = document.getElementById('contracts');
        if (!contractsSection || !contractsSection.classList.contains('active') || protectedContent?.hidden) return;

        const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
        if (files.length === 0) return;
        event.preventDefault();
        handleFiles(files);
    });

    function handleFiles(files) {
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const cardObj = {
                    id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    fileName: file.name,
                    dataUrl: event.target.result,
                    // Never seed screenshot metadata from the browser clock. A missing OCR date
                    // must stay empty instead of silently becoming the upload time.
                    dateStr: '',
                    completedAt: null,
                    contractName: '',
                    ocrRawContractName: '',
                    compensation: 0,
                    participants: [...globalSelectedNicknames],
                    ocrStatus: 'pending' // pending | processing | success | needs-review
                };
                uploadedCards.push(cardObj);
                renderAllUploadedCards();

                // Auto OCR parser launch for newly added card
                runOcrOnCard(cardObj);
            };
            reader.readAsDataURL(file);
        });
    }


    if (btnClearUploaded) {
        btnClearUploaded.addEventListener('click', () => {
            if (uploadedCards.length > 0 && confirm('Видалити всі завантажені скріншоти зі списку обробки?')) {
                uploadedCards = [];
                renderAllUploadedCards();
            }
        });
    }

    // --- CARD RENDERER ---
    /** A contract can be saved only after the minimum report fields are valid. */
    function isCardReadyToSave(card) {
        return Boolean(
            card.completedAt &&
            card.contractName.trim() &&
            card.compensation > 0 &&
            card.participants.length > 0
        );
    }

    function renderAllUploadedCards() {
        if (!cardsContainer || !cardsHeader || !uploadCountSpan) return;

        uploadCountSpan.textContent = uploadedCards.length;
        cardsHeader.style.display = uploadedCards.length > 0 ? 'flex' : 'none';
        if (batchBar) batchBar.style.display = uploadedCards.length > 0 ? 'block' : 'none';

        cardsContainer.innerHTML = '';

        if (uploadedCards.length === 0) return;

        uploadedCards.forEach((card, idx) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'contract-card glass-card';
            cardEl.setAttribute('data-card-id', card.id);

            const payoutPerPerson = card.participants.length > 0 
                ? roundMoney(card.compensation / card.participants.length) 
                : card.compensation;

            let ocrBadge = '<span class="ocr-status pending"><i class="fa-regular fa-clock"></i> Очікує</span>';
            if (card.ocrStatus === 'processing') {
                ocrBadge = '<span class="ocr-status processing"><i class="fa-solid fa-spinner fa-spin"></i> Сканування...</span>';
            } else if (card.ocrStatus === 'success') {
                ocrBadge = '<span class="ocr-status success"><i class="fa-solid fa-circle-check"></i> Розпізнано</span>';
            } else if (card.ocrStatus === 'needs-review') {
                ocrBadge = '<span class="ocr-status needs-review"><i class="fa-solid fa-triangle-exclamation"></i> Перевірте поля</span>';
            }
            const storedDuplicate = suppressDuplicateUi ? null : findStoredDuplicate(card);
            if (storedDuplicate) {
                ocrBadge = '<span class="ocr-status needs-review"><i class="fa-solid fa-copy"></i> ДУБЛІКАТ</span>';
            }

            // Build options for card roster dropdown
            let rosterOptions = '<option value="">+ Додати учасника</option>';
            const { active: activeRoster, inactive: inactiveRoster } = getRosterActivityGroups();
            const availableActive = activeRoster.filter(nick => !card.participants.includes(nick));
            const availableInactive = inactiveRoster.filter(nick => !card.participants.includes(nick));
            availableActive.forEach(nick => {
                rosterOptions += `<option value="${nick}">${nick}</option>`;
            });
            if (availableActive.length && availableInactive.length) {
                rosterOptions += '<option disabled>────────────────────</option>';
            }
            availableInactive.forEach(nick => {
                rosterOptions += `<option value="${nick}">${nick}</option>`;
            });

            // Build participant tags
            let participantTagsHtml = '';
            if (card.participants.length === 0) {
                participantTagsHtml = '<span class="text-muted" style="font-size: 12px;">Не вказано участников</span>';
            } else {
                participantTagsHtml = card.participants.map(nick => `
                    <span class="batch-tag">
                        <i class="fa-solid fa-user"></i> ${nick}
                        <i class="fa-solid fa-xmark remove-tag" data-card-id="${card.id}" data-nick="${nick}"></i>
                    </span>
                `).join('');
            }

            cardEl.innerHTML = `
                <div class="card-top-bar">
                    <span class="card-num-badge">Скріншот #${idx + 1}</span>
                    ${ocrBadge}
                </div>

                <div class="contract-img-wrap">
                    <img src="${card.dataUrl}" alt="Скріншот контракту" title="Натисніть для перегляду" data-full-img="${card.dataUrl}">
                </div>
                ${card.ocrMode === 'phone-photo' ? '<div class="ocr-source-note"><i class="fa-solid fa-mobile-screen-button"></i> Фото з телефону: застосовано авто-нормалізацію</div>' : ''}

                <div class="card-fields-grid">
                    <div class="card-field-full ${card.ocrStatus === 'needs-review' && !card.dateStr ? 'ocr-field-missing' : ''}">
                        <label><i class="fa-regular fa-calendar-alt"></i> Дата й час</label>
                        <input type="text" class="form-control card-input-date" value="${card.dateStr}" placeholder="Не розпізнано">
                        ${card.ocrStatus === 'needs-review' && !card.dateStr ? '<div class="ocr-field-hint"><i class="fa-solid fa-triangle-exclamation"></i> Дату не розпізнано зі скріншота</div>' : ''}
                    </div>

                    <div class="card-field-full ${card.ocrStatus === 'needs-review' && !card.contractName ? 'ocr-field-missing' : ''}">
                        <label><i class="fa-solid fa-file-signature"></i> Назва контракту</label>
                        <input type="text" class="form-control card-input-title" value="${card.contractName}" placeholder="Не розпізнано">
                        ${card.ocrStatus === 'needs-review' && !card.contractName ? '<div class="ocr-field-hint"><i class="fa-solid fa-triangle-exclamation"></i> Назву не розпізнано зі скріншота</div>' : ''}
                    </div>

                    <div class="${card.ocrStatus === 'needs-review' && !card.compensation ? 'ocr-field-missing' : ''}">
                        <label><i class="fa-solid fa-money-bill-wave"></i> Компенсація ($)</label>
                        <input type="number" class="form-control card-input-money" value="${card.compensation || ''}" placeholder="Не розпізнано" step="1000">
                        ${card.ocrStatus === 'needs-review' && !card.compensation ? '<div class="ocr-field-hint"><i class="fa-solid fa-triangle-exclamation"></i> Компенсацію не розпізнано зі скріншота</div>' : ''}
                    </div>

                    <div class="card-field-full">
                        <label><i class="fa-solid fa-users"></i> Учасники контракту (${card.participants.length})</label>
                        <div class="batch-tags-container" style="margin-bottom: 8px;">
                            ${participantTagsHtml}
                        </div>
                        <select class="form-control card-select-add-nick" style="margin-top: 6px;">
                            ${rosterOptions}
                        </select>
                    </div>

                    <div class="payout-share-box">
                        <span><i class="fa-solid fa-calculator"></i> Премія на 1 люд.:</span>
                        <strong>$ ${payoutPerPerson.toLocaleString()}</strong>
                    </div>
                </div>

                ${storedDuplicate ? `
                    <div class="duplicate-warning">
                        <div><i class="fa-solid fa-copy"></i><strong> ДУБЛІКАТ</strong><span>Цей скріншот або такий самий запис уже є в журналі. Повторно він не додається.</span></div>
                        <button class="btn btn-accent card-btn-overwrite" data-id="${card.id}" data-duplicate-id="${storedDuplicate.id}"><i class="fa-solid fa-rotate"></i> Перезаписати</button>
                    </div>` : ''}

                <div class="card-actions-bar">
                    <button class="btn btn-success card-btn-save" data-id="${card.id}" ${isCardReadyToSave(card) ? '' : 'disabled title="Заповніть назву, компенсацію та учасника"'}>
                        <i class="fa-solid fa-book-medical"></i><span class="card-action-label">Додати в<br>журнал</span>
                    </button>
                    <button class="btn btn-secondary card-btn-ocr" data-id="${card.id}">
                        <i class="fa-solid fa-microchip"></i><span class="card-action-label">OCR<br>Сканування</span>
                    </button>
                    <button class="btn btn-danger-sm card-btn-remove" data-id="${card.id}">
                        <i class="fa-solid fa-trash"></i> Видалити
                    </button>
                </div>
            `;

            cardsContainer.appendChild(cardEl);
        });

        // Add event listeners to input fields & buttons inside cards
        cardsContainer.querySelectorAll('.contract-card').forEach(cardEl => {
            const cardId = cardEl.getAttribute('data-card-id');
            const cardObj = uploadedCards.find(c => c.id === cardId);
            if (!cardObj) return;

            // Inputs live change
            cardEl.querySelector('.card-input-date').addEventListener('input', (e) => { cardObj.dateStr = e.target.value; cardObj.completedAt = parseScreenshotDateToIso(cardObj.dateStr); });
            cardEl.querySelector('.card-input-date').addEventListener('change', () => renderAllUploadedCards());
            cardEl.querySelector('.card-input-title').addEventListener('input', (e) => {
                cardObj.contractName = e.target.value;
                updateCardSaveState(cardEl, cardObj);
            });
            cardEl.querySelector('.card-input-money').addEventListener('input', (e) => {
                cardObj.compensation = parseFloat(e.target.value) || 0;
                updateCardPayoutBox(cardEl, cardObj);
                updateCardSaveState(cardEl, cardObj);
            });

            // Add nickname dropdown
            const selectNick = cardEl.querySelector('.card-select-add-nick');
            // Always open the participant picker from its very first row. Native selects can
            // remember the last highlighted option/scroll position between interactions.
            const resetParticipantPickerToTop = () => {
                selectNick.selectedIndex = 0;
                selectNick.value = '';
                try { selectNick.scrollTop = 0; } catch (_) {}
            };
            selectNick.addEventListener('pointerdown', resetParticipantPickerToTop);
            selectNick.addEventListener('focus', resetParticipantPickerToTop);
            selectNick.addEventListener('change', (e) => {
                const val = e.target.value;
                if (val && !cardObj.participants.includes(val)) {
                    cardObj.participants.push(val);
                    renderAllUploadedCards();
                }
            });

            // Remove nick tag
            cardEl.querySelectorAll('.remove-tag').forEach(icon => {
                icon.addEventListener('click', () => {
                    const nickToRemove = icon.getAttribute('data-nick');
                    cardObj.participants = cardObj.participants.filter(n => n !== nickToRemove);
                    renderAllUploadedCards();
                });
            });

            // Image click lightbox preview
            const imgEl = cardEl.querySelector('img');
            imgEl.addEventListener('click', () => {
                openLightboxModalDirect(cardObj.dataUrl, `Контракт: <strong>${cardObj.contractName}</strong> (${cardObj.dateStr})`);
            });

            // Card action buttons
            cardEl.querySelector('.card-btn-save').addEventListener('click', () => saveSingleCardToJournal(cardObj));
            const overwriteButton = cardEl.querySelector('.card-btn-overwrite');
            if (overwriteButton) overwriteButton.addEventListener('click', () => overwriteDuplicate(cardObj, overwriteButton.getAttribute('data-duplicate-id')));
            cardEl.querySelector('.card-btn-ocr').addEventListener('click', () => runOcrOnCard(cardObj));
            cardEl.querySelector('.card-btn-remove').addEventListener('click', () => {
                uploadedCards = uploadedCards.filter(c => c.id !== cardId);
                renderAllUploadedCards();
            });
        });
    }

    function updateCardSaveState(cardEl, cardObj) {
        const saveButton = cardEl.querySelector('.card-btn-save');
        if (!saveButton) return;
        const ready = isCardReadyToSave(cardObj);
        saveButton.disabled = !ready;
        saveButton.title = ready ? '' : 'Потрібні дата, назва, компенсація та учасник';
    }

    function updateCardPayoutBox(cardEl, cardObj) {
        const payoutBox = cardEl.querySelector('.payout-share-box strong');
        if (payoutBox) {
            const payout = cardObj.participants.length > 0 
                ? roundMoney(cardObj.compensation / cardObj.participants.length) 
                : cardObj.compensation;
            payoutBox.textContent = `$ ${payout.toLocaleString()}`;
        }
    }

    function openLightboxModalDirect(src, captionHtml) {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const lightboxCaption = document.getElementById('lightbox-caption');
        if (lightbox && lightboxImg && lightboxCaption) {
            lightboxImg.src = src;
            lightboxCaption.innerHTML = captionHtml;
            lightbox.style.display = 'flex';
        }
    }

    function roundMoney(value) {
        return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    }

    function formatContractShare(value) {
        return Number(value.toFixed(2)).toLocaleString('uk-UA');
    }

    function parseScreenshotDateToIso(dateStr) {
        if (!dateStr) return null;

        const monthMap = {
            'січня': 0, 'лютого': 1, 'березня': 2, 'квітня': 3,
            'травня': 4, 'червня': 5, 'липня': 6, 'серпня': 7,
            'вересня': 8, 'жовтня': 9, 'листопада': 10, 'грудня': 11
        };
        const normalized = dateStr.toLowerCase().trim();
        const withTime = normalized.match(/(\d{1,2}):(\d{2})\s+[^\s]+\s+(\d{1,2})\s+([а-яіїєґ]+)/i);
        const dateOnly = normalized.match(/[^\s]+\s+(\d{1,2})\s+([а-яіїєґ]+)/i);
        const monthToken = withTime ? withTime[4] : dateOnly?.[2];
        if (!monthToken || monthMap[monthToken] === undefined) return null;

        const now = new Date();
        const day = Number(withTime ? withTime[3] : dateOnly[1]);
        const hour = withTime ? Number(withTime[1]) : 12;
        const minute = withTime ? Number(withTime[2]) : 0;
        const parsed = new Date(now.getFullYear(), monthMap[monthToken], day, hour, minute, 0, 0);
        return parsed.toISOString();
    }

    // --- OCR SCANNING LOGIC ---
    const btnProcessAllOcr = document.getElementById('btn-process-all-ocr');
    if (btnProcessAllOcr) {
        btnProcessAllOcr.addEventListener('click', () => {
            if (uploadedCards.length === 0) {
                alert('Немає завантажених скріншотів для розпізнавання.');
                return;
            }
            uploadedCards.forEach(card => runOcrOnCard(card));
        });
    }

    /** Load a screenshot into an Image object before canvas preprocessing. */
    function loadOcrImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = dataUrl;
        });
    }

    /**
     * Build a high-contrast crop for OCR.
     * Coordinates are normalized so the same logic works with desktop and mobile uploads.
     */
    async function createOcrCrop(dataUrl, crop, targetWidth = 1800) {
        const image = await loadOcrImage(dataUrl);
        const sx = Math.max(0, Math.floor(image.naturalWidth * crop.x));
        const sy = Math.max(0, Math.floor(image.naturalHeight * crop.y));
        const sw = Math.max(1, Math.floor(image.naturalWidth * crop.w));
        const sh = Math.max(1, Math.floor(image.naturalHeight * crop.h));
        const scale = Math.min(3, Math.max(1.4, targetWidth / sw));

        const canvas = document.createElement('canvas');
        canvas.width = Math.min(2400, Math.round(sw * scale));
        canvas.height = Math.min(1800, Math.round(sh * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        // Grayscale + contrast improves small gray labels and white reward values.
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = pixels.data;
        const contrast = 1.7;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const boosted = Math.max(0, Math.min(255, (gray - 128) * contrast + 150));
            data[i] = boosted;
            data[i + 1] = boosted;
            data[i + 2] = boosted;
        }
        ctx.putImageData(pixels, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.94);
    }


    /** High-resolution preprocessing for the tiny white device status line on dark background. */
    async function createHeaderOcrCrop(dataUrl, crop, targetWidth = 1800) {
        const image = await loadOcrImage(dataUrl);
        const sx = Math.max(0, Math.floor(image.naturalWidth * crop.x));
        const sy = Math.max(0, Math.floor(image.naturalHeight * crop.y));
        const sw = Math.max(1, Math.floor(image.naturalWidth * crop.w));
        const sh = Math.max(1, Math.floor(image.naturalHeight * crop.h));
        const scale = Math.min(8, Math.max(3, targetWidth / sw));
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(3200, Math.round(sw * scale));
        canvas.height = Math.min(900, Math.round(sh * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = pixels.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            // Status text is bright on a nearly black strip. A binary image removes bezel/scenery noise.
            const value = gray >= 145 ? 0 : 255;
            data[i] = value; data[i + 1] = value; data[i + 2] = value;
        }
        ctx.putImageData(pixels, 0, 0);
        return canvas.toDataURL('image/png');
    }

    /** Smooth a one-dimensional signal with a small moving-average window. */
    function smoothSignal(values, radius) {
        const prefix = new Float32Array(values.length + 1);
        for (let i = 0; i < values.length; i++) prefix[i + 1] = prefix[i] + values[i];
        return values.map((_, i) => {
            const from = Math.max(0, i - radius);
            const to = Math.min(values.length, i + radius + 1);
            return (prefix[to] - prefix[from]) / Math.max(1, to - from);
        });
    }

    /** Find the longest contiguous interval above a score threshold. */
    function longestSignalRun(values, threshold) {
        let bestStart = 0;
        let bestEnd = 0;
        let start = -1;
        for (let i = 0; i <= values.length; i++) {
            const active = i < values.length && values[i] >= threshold;
            if (active && start < 0) start = i;
            if ((!active || i === values.length) && start >= 0) {
                if (i - start > bestEnd - bestStart) {
                    bestStart = start;
                    bestEnd = i;
                }
                start = -1;
            }
        }
        return { start: bestStart, end: bestEnd, length: bestEnd - bestStart };
    }

    /**
     * Detect the dark in-game tablet surface inside a phone photo.
     * The UI is consistently much darker than the GTA world around it. We detect a broad
     * dark-density rectangle on a tiny analysis canvas, smooth over glare/reflections and then
     * add padding so the white bezel/header is not clipped. No upload bytes leave the browser.
     */
    function detectTabletBounds(image) {
        const analysisWidth = 240;
        const analysisHeight = Math.max(120, Math.round(analysisWidth * image.naturalHeight / image.naturalWidth));
        const canvas = document.createElement('canvas');
        canvas.width = analysisWidth;
        canvas.height = analysisHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, analysisWidth, analysisHeight);
        const pixels = ctx.getImageData(0, 0, analysisWidth, analysisHeight).data;

        const columnDarkness = new Array(analysisWidth).fill(0);
        const rowDarkness = new Array(analysisHeight).fill(0);
        const yFrom = Math.floor(analysisHeight * 0.05);
        const yTo = Math.ceil(analysisHeight * 0.95);
        const xFrom = Math.floor(analysisWidth * 0.02);
        const xTo = Math.ceil(analysisWidth * 0.95);

        for (let y = 0; y < analysisHeight; y++) {
            for (let x = 0; x < analysisWidth; x++) {
                const i = (y * analysisWidth + x) * 4;
                const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
                if (gray >= 130) continue;
                if (y >= yFrom && y < yTo) columnDarkness[x] += 1;
                if (x >= xFrom && x < xTo) rowDarkness[y] += 1;
            }
        }

        const usableRows = Math.max(1, yTo - yFrom);
        const usableCols = Math.max(1, xTo - xFrom);
        for (let x = 0; x < analysisWidth; x++) columnDarkness[x] /= usableRows;
        for (let y = 0; y < analysisHeight; y++) rowDarkness[y] /= usableCols;

        // Wide smoothing bridges sunlight/glare that temporarily brightens the tablet surface.
        const smoothedColumns = smoothSignal(columnDarkness, Math.max(2, Math.round(analysisWidth * 0.015)));
        const smoothedRows = smoothSignal(rowDarkness, Math.max(2, Math.round(analysisHeight * 0.02)));
        let xRun = longestSignalRun(smoothedColumns, 0.52);
        let yRun = longestSignalRun(smoothedRows, 0.50);

        // Relax once for very bright phone photos. Reject tiny detections rather than zooming into
        // a random dark panel inside the UI.
        if (xRun.length < analysisWidth * 0.58) xRun = longestSignalRun(smoothedColumns, 0.43);
        if (yRun.length < analysisHeight * 0.55) yRun = longestSignalRun(smoothedRows, 0.42);
        if (xRun.length < analysisWidth * 0.58 || yRun.length < analysisHeight * 0.55) return null;

        const padX = analysisWidth * 0.045;
        const padTop = analysisHeight * 0.12;
        const padBottom = analysisHeight * 0.055;
        const left = Math.max(0, xRun.start - padX);
        const right = Math.min(analysisWidth, xRun.end + padX);
        const top = Math.max(0, yRun.start - padTop);
        const bottom = Math.min(analysisHeight, yRun.end + padBottom);

        const width = right - left;
        const height = bottom - top;
        if (width <= 0 || height <= 0) return null;

        // GTA scenery is often dark too. If the detector claims almost the entire photo,
        // it did not actually isolate the tablet - reject it and use the calibrated
        // phone-photo crop below instead of feeding tiny UI text to OCR.
        const normalizedWidth = width / analysisWidth;
        const normalizedHeight = height / analysisHeight;
        if (normalizedWidth > 0.94 || normalizedHeight > 0.94) return null;

        return {
            x: left / analysisWidth,
            y: top / analysisHeight,
            w: width / analysisWidth,
            h: height / analysisHeight
        };
    }

    /**
     * Normalize a phone photo before applying the fixed in-game OCR zones.
     * Unlike the old hard-coded crop, this first locates the tablet surface dynamically, which
     * makes photos with different zoom, framing and moderate perspective far more consistent.
     */
    async function createPhonePhotoNormalizedSource(dataUrl) {
        const image = await loadOcrImage(dataUrl);
        const detected = detectTabletBounds(image);
        // Real phone photos in our dataset place the in-game tablet mostly in the left/central
        // part of the frame. This fallback removes GTA scenery and enlarges the UI before OCR.
        const crop = detected || { x: 0.0, y: 0.0, w: 0.88, h: 0.955 };
        const sx = Math.max(0, Math.floor(image.naturalWidth * crop.x));
        const sy = Math.max(0, Math.floor(image.naturalHeight * crop.y));
        const sw = Math.max(1, Math.floor(image.naturalWidth * crop.w));
        const sh = Math.max(1, Math.floor(image.naturalHeight * crop.h));

        const canvas = document.createElement('canvas');
        const targetWidth = Math.min(2200, Math.max(1500, sw));
        const scale = targetWidth / sw;
        canvas.width = Math.round(sw * scale);
        canvas.height = Math.round(sh * scale);

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        // Mild contrast keeps small white text readable while avoiding the destructive thresholding
        // that made bright phone photos lose the compensation value.
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = pixels.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const boosted = Math.max(0, Math.min(255, (gray - 128) * 1.16 + 132));
            data[i] = boosted;
            data[i + 1] = boosted;
            data[i + 2] = boosted;
        }
        ctx.putImageData(pixels, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.95);
    }


    /**
     * Build one normalized full-frame OCR source for difficult phone photos.
     * This is deliberately used only as a last fallback so normal screenshots stay fast.
     */
    async function createFullFrameOcrSource(dataUrl) {
        const image = await loadOcrImage(dataUrl);
        const canvas = document.createElement('canvas');
        const targetWidth = Math.min(2200, Math.max(1600, image.naturalWidth));
        const scale = targetWidth / image.naturalWidth;
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = pixels.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const boosted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 138));
            data[i] = boosted;
            data[i + 1] = boosted;
            data[i + 2] = boosted;
        }
        ctx.putImageData(pixels, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.93);
    }

    /** Return a simple score so the best OCR pass can win automatically. */
    function scoreOcrResult(found) {
        return ['date', 'title', 'compensation']
            .reduce((score, key) => score + (found[key] ? 1 : 0), 0);
    }

    /** Normalize OCR text while keeping line boundaries for label/value matching. */
    function normalizeOcrText(text) {
        return String(text || '')
            .replace(/\r/g, '')
            .replace(/[\t\u00a0]+/g, ' ')
            .replace(/[ ]{2,}/g, ' ')
            .trim();
    }

    /** Parse a numeric value from the label line or the next few OCR lines. */
    function extractNumberNearLabel(text, labelPatterns, minValue, maxValue) {
        const lines = normalizeOcrText(text).split('\n').map(line => line.trim()).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
            if (!labelPatterns.some(pattern => pattern.test(lines[i]))) continue;
            const windowText = lines.slice(i, i + 3).join(' ');
            const matches = [...windowText.matchAll(/\$?\s*(\d[\d\s.,]{1,14})/g)];
            for (const match of matches) {
                const value = Number.parseInt(match[1].replace(/\D/g, ''), 10);
                if (Number.isFinite(value) && value >= minValue && value <= maxValue) return value;
            }
        }
        return null;
    }

    /** Convert common OCR variants of Roman numerals into a stable game level. */
    function normalizeContractLevel(rawLevel) {
        const token = String(rawLevel || '')
            .trim()
            .replace(/[|!1l]/gi, 'I')
            .replace(/[^I]/gi, '')
            .toUpperCase();
        if (token === 'III') return 'III';
        if (token === 'II') return 'II';
        if (token === 'I') return 'I';
        return '';
    }

    /** Normalize a contract phrase for fuzzy matching without inventing missing data. */
    function normalizeContractPhrase(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[’`]/g, "'")
            .replace(/[|!1l]/g, 'i')
            .replace(/[^a-zа-яіїєґ0-9' ]/giu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** Small edit-distance helper used only against the known contract catalog. */
    function levenshteinDistance(a, b) {
        const left = String(a || '');
        const right = String(b || '');
        if (!left.length) return right.length;
        if (!right.length) return left.length;
        const previous = Array.from({ length: right.length + 1 }, (_, i) => i);
        for (let i = 1; i <= left.length; i++) {
            let diagonal = previous[0];
            previous[0] = i;
            for (let j = 1; j <= right.length; j++) {
                const old = previous[j];
                const cost = left[i - 1] === right[j - 1] ? 0 : 1;
                previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
                diagonal = old;
            }
        }
        return previous[right.length];
    }

    function textSimilarity(a, b) {
        const left = normalizeContractPhrase(a);
        const right = normalizeContractPhrase(b);
        if (!left || !right) return 0;
        const maxLength = Math.max(left.length, right.length);
        return maxLength ? 1 - levenshteinDistance(left, right) / maxLength : 0;
    }

    /** Resolve the tiny in-game header date without ever falling back to the browser clock. */
    function resolveScreenshotDate(dateText, timeText) {
        const months = [
            'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
            'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
        ];
        const weekdays = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'п’ятниця', 'субота'];
        const normalized = normalizeOcrText(dateText).toLowerCase().replace(/[’`]/g, "'");
        const focused = normalizeOcrText(timeText);

        // Date/time must come from the screenshot header itself. The compact regexp tolerates
        // missing spaces or a missing colon, which are common on blurred phone photos.
        const broadTime = normalized.match(/(?:^|[^\d])([01]?\d|2[0-3])[:.](\d{2})(?=[^\d]|$)/);
        const focusedTime = focused.match(/(?:^|[^\d])([01]?\d|2[0-3])[:.](\d{2})(?=[^\d]|$)/);
        const selectedTime = broadTime || focusedTime;
        const hasTime = Boolean(selectedTime);
        const hour = hasTime ? Number(selectedTime[1]) : 12;
        const minute = hasTime ? Number(selectedTime[2]) : 0;
        if (hour > 23 || minute > 59) return null;

        const tokenMatches = [...normalized.matchAll(/[а-яіїєґ']+/giu)];
        const nearestWord = (dictionary, token, threshold) => {
            let best = null;
            for (let i = 0; i < dictionary.length; i++) {
                const score = textSimilarity(token, dictionary[i]);
                if (!best || score > best.score) best = { value: dictionary[i], index: i, score };
            }
            return best && best.score >= threshold ? best : null;
        };

        let month = null;
        let monthToken = null;
        let weekday = null;
        for (const match of tokenMatches) {
            const token = match[0];
            const monthCandidate = nearestWord(months, token, 0.55);
            if (monthCandidate && (!month || monthCandidate.score > month.score)) {
                month = monthCandidate;
                monthToken = { text: token, index: match.index };
            }
            const weekdayCandidate = nearestWord(weekdays, token, 0.55);
            if (weekdayCandidate && (!weekday || weekdayCandidate.score > weekday.score)) weekday = weekdayCandidate;
        }
        if (!month || !monthToken) return null;

        // The calendar day is the number immediately before the recognized month token.
        // This prevents the hour/minute or unrelated UI numbers from becoming the day.
        const beforeMonth = normalized.slice(0, monthToken.index);
        const dayMatches = [...beforeMonth.matchAll(/(\d{1,2})\s*$/g)];
        let rawDay = dayMatches.length ? Number(dayMatches[dayMatches.length - 1][1]) : null;
        if (!rawDay) {
            const nearby = beforeMonth.slice(-10).match(/(\d{1,2})\D*$/);
            rawDay = nearby ? Number(nearby[1]) : null;
        }
        if (!rawDay || rawDay < 1 || rawDay > 31) return null;

        const now = new Date();
        const candidateYears = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
        let bestDate = null;
        for (const year of candidateYears) {
            const test = new Date(year, month.index, rawDay);
            if (test.getMonth() !== month.index || test.getDate() !== rawDay) continue;
            if (weekday && test.getDay() !== weekday.index) continue;
            const distance = Math.abs(test.getTime() - now.getTime());
            if (!bestDate || distance < bestDate.distance) bestDate = { year, day: rawDay, distance };
        }
        if (!bestDate) return null;

        const weekdayText = weekday ? weekdays[weekday.index] : weekdays[new Date(bestDate.year, month.index, bestDate.day).getDay()];
        const capitalizedWeekday = weekdayText.charAt(0).toUpperCase() + weekdayText.slice(1);
        return {
            display: `${hasTime ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ` : ''}${capitalizedWeekday} ${bestDate.day} ${months[month.index]}`,
            year: bestDate.year,
            month: month.index,
            day: bestDate.day,
            hour,
            minute,
            hasTime
        };
    }

    function splitCatalogContractName(name) {
        const match = String(name || '').trim().match(/^(.*?)(?:\s+([IV]{1,3}))$/i);
        return {
            baseName: (match?.[1] || name || '').trim(),
            level: normalizeContractLevel(match?.[2] || '')
        };
    }

    /**
     * Match OCR text only to contracts that exist in the shared catalog.
     * A fuzzy text result must include a readable level; otherwise we prefer an empty field
     * over silently assigning the wrong contract.
     */
    function extractContractName(text) {
        const lines = normalizeOcrText(text).split('\n').map(line => line.trim()).filter(Boolean);
        let best = null;

        for (const line of lines) {
            const suffixMatch = line.match(/(?:^|\s)([Iil1|!]{1,3})\s*$/);
            const detectedLevel = suffixMatch ? normalizeContractLevel(suffixMatch[1]) : '';
            if (!detectedLevel) continue;

            const lineWithoutLevel = suffixMatch ? line.slice(0, suffixMatch.index).trim() : line;
            for (const item of contractCatalog) {
                const parts = splitCatalogContractName(item.contractName);
                if (!parts.level || parts.level !== detectedLevel) continue;
                const similarity = Math.max(
                    textSimilarity(line, item.contractName),
                    textSimilarity(lineWithoutLevel, item.baseName || parts.baseName)
                );
                if (!best || similarity > best.similarity) best = { item, similarity };
            }
        }

        // Phone photos often split the title into fragments. As a second pass, compare the
        // complete OCR block against known catalog base names and require a readable level.
        if (!best || best.similarity < 0.64) {
            const joined = lines.join(' ');
            for (const item of contractCatalog) {
                const parts = splitCatalogContractName(item.contractName);
                if (!parts.level) continue;
                const levelPattern = new RegExp(`(?:^|\\s)[Iil1|!]{${parts.level.length}}(?:\\s|$)`);
                const normalizedJoined = normalizeContractPhrase(joined);
                const normalizedBase = normalizeContractPhrase(item.baseName || parts.baseName);
                const baseWords = normalizedBase.split(/\s+/).filter(word => word.length >= 4);
                const wordHits = baseWords.filter(word => normalizedJoined.includes(word.slice(0, Math.max(4, word.length - 2)))).length;
                const hasLevel = levelPattern.test(joined) || joined.includes(item.contractName);
                if (hasLevel && baseWords.length && wordHits === baseWords.length) {
                    best = { item, similarity: 0.80 };
                    break;
                }
            }
        }

        // Conservative catalog match first: low-confidence camera OCR must not become a false title.
        if (best && best.similarity >= 0.64) return best.item.contractName;

        // A brand-new contract cannot exist in the learned catalog yet. Because title OCR runs on
        // a tightly cropped right-side title block, accept exactly one plausible Cyrillic line with
        // a readable I/II/III suffix. This allows the first real screenshot to teach the catalog
        // without manual typing, while rejecting UI labels and long description text.
        const plausible = lines.map(line => {
            const suffixMatch = line.match(/(?:^|\s)([Iil1|!]{1,3})\s*$/);
            const level = suffixMatch ? normalizeContractLevel(suffixMatch[1]) : '';
            if (!level) return null;
            const base = (suffixMatch ? line.slice(0, suffixMatch.index) : line)
                .replace(/[^А-Яа-яІіЇїЄєҐґ'’ -]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (base.length < 4 || base.length > 36) return null;
            if (!/[А-Яа-яІіЇїЄєҐґ]{4}/.test(base)) return null;
            if (/^(нейтральн|доступн|контракт|прогрес|баланс)/i.test(base)) return null;
            return `${base} ${level}`;
        }).filter(Boolean);
        return plausible.length === 1 ? plausible[0] : '';
    }

    /**
     * If title OCR fails, a unique exact reward signature can identify a contract already
     * confirmed in the shared catalog. If two catalog rows share the same signature, do not guess.
     */
    function findCatalogContractByCompensation(compensation) {
        if (!(compensation > 0)) return '';
        const matches = contractCatalog.filter(item => Number(item.compensation) === Number(compensation));
        const uniqueNames = [...new Set(matches.map(item => item.contractName).filter(Boolean))];
        return uniqueNames.length === 1 ? uniqueNames[0] : '';
    }

    /**
     * Resolve a noisy OCR title against known contracts without assuming that price is unique.
     * Compensation narrows candidates; title + learned OCR aliases choose the winner.
     */
    function resolveCatalogTitle(rawTitle, compensation) {
        const normalizedRaw = normalizeContractPhrase(rawTitle);
        if (!normalizedRaw) return '';

        let candidates = contractCatalog.filter(item => item?.contractName);
        if (Number(compensation) > 0) {
            const samePrice = candidates.filter(item => Number(item.compensation) === Number(compensation));
            if (samePrice.length) candidates = samePrice;
        }

        const rawLevelMatch = String(rawTitle || '').match(/([Iil1|!]{1,3})\s*$/);
        const rawLevel = normalizeContractLevel(rawLevelMatch?.[1] || '');
        const scored = candidates.map(item => {
            const aliases = Array.isArray(item.aliases) ? item.aliases : [];
            const parts = splitCatalogContractName(item.contractName);
            const variants = [item.contractName, item.baseName || parts.baseName, ...aliases].filter(Boolean);
            const similarity = Math.max(...variants.map(value => textSimilarity(normalizedRaw, value)));
            const levelBonus = rawLevel && parts.level === rawLevel ? 0.08 : 0;
            return { item, score: Math.min(1, similarity + levelBonus) };
        }).sort((a, b) => b.score - a.score);

        if (!scored.length || scored[0].score < 0.52) return '';
        if (scored[1] && (scored[0].score - scored[1].score) < 0.10) return '';
        return scored[0].item.contractName;
    }

    /**
     * Restore compensation only from a contract value already confirmed in the shared catalog.
     * This is deliberately conservative: if the same title has conflicting known values, return null
     * instead of guessing. The catalog is populated from real saved screenshots.
     */
    function findCatalogCompensationByTitle(contractName) {
        const normalizedTitle = normalizeContractPhrase(contractName);
        if (!normalizedTitle) return null;

        const matches = contractCatalog.filter(item =>
            normalizeContractPhrase(item.contractName) === normalizedTitle && Number(item.compensation) > 0
        );
        const uniqueValues = [...new Set(matches.map(item => Number(item.compensation)).filter(Number.isFinite))];
        return uniqueValues.length === 1 ? uniqueValues[0] : null;
    }

    /** Parse a game-formatted currency token while repairing a single OCR-missed group digit. */
    function parseGameMoneyToken(rawToken) {
        const cleaned = String(rawToken || '').replace(/[$€]/g, '').trim();
        const groups = cleaned.split(/[\s.,]+/).filter(Boolean).map(group => group.replace(/\D/g, ''));
        if (!groups.length || groups.some(group => !group)) return null;

        // Ukraine GTA displays compensation with three-digit thousand groups, e.g. 230 000.
        // Camera OCR can drop the last zero and return "230 00". Repairing that malformed
        // group is based on the visible number format, not on a guessed contract value.
        if (groups.length >= 2) {
            for (let i = 1; i < groups.length; i++) {
                if (groups[i].length === 2) groups[i] += '0';
                if (groups[i].length !== 3) return null;
            }
        }

        const value = Number.parseInt(groups.join(''), 10);
        return Number.isFinite(value) ? value : null;
    }

    /** Parse OCR outputs from the focused crops and return confidence-critical flags. */
    function parseContractOcrData(fullText, detailText, titleText, dateText, timeText, metricsText, cardObj) {
        // Preserve fields already confirmed by an earlier OCR pass. Most importantly, the
        // active contract title must come ONLY from the dedicated right-side title ROI.
        // Never search detail/full-frame text for a title because the center list contains
        // several other contract names and can silently replace the selected contract.
        const found = {
            date: Boolean(cardObj.dateStr),
            title: Boolean(String(cardObj.contractName || '').trim()),
            compensation: Number(cardObj.compensation || 0) > 0
        };

        const resolvedDate = resolveScreenshotDate(dateText || fullText, timeText);
        if (resolvedDate) { cardObj.dateStr = resolvedDate.display; found.date = true; }

        const title = extractContractName(titleText);
        if (title) { cardObj.contractName = title; found.title = true; }

        const compensationLabels = [/грошов\S*\s+компенсац/i, /компенсац/i];
        let compensation = extractNumberNearLabel(detailText, compensationLabels, 1000, 5000000);
        if (compensation === null) {
            const moneyCandidates = [...normalizeOcrText(`${detailText}\n${metricsText}`).matchAll(/\$\s*(\d[\d\s.,]{2,14})/g)]
                .map(match => parseGameMoneyToken(match[1]))
                .filter(value => Number.isFinite(value) && value >= 1000 && value <= 5000000);
            const uniqueMoney = [...new Set(moneyCandidates)];
            if (uniqueMoney.length === 1) compensation = uniqueMoney[0];
        }
        if (compensation !== null) { cardObj.compensation = compensation; found.compensation = true; }

        // Known contracts give us a safe sanity check for catastrophic OCR digit loss.
        // Example: '$140 000' may become '8400' after glare/thresholding. We only repair when
        // the active title is already known and the OCR amount is wildly outside the verified value.
        if (found.title && found.compensation) {
            const knownCompensation = findCatalogCompensationByTitle(cardObj.contractName);
            if (knownCompensation !== null) {
                const ratio = cardObj.compensation / knownCompensation;
                if (ratio < 0.5 || ratio > 2.0) {
                    cardObj.compensation = knownCompensation;
                }
            }
        }

        // If camera OCR misses the small money value but the contract title was matched to a
        // verified catalog entry, restore the known compensation. This is not a guessed value:
        // conflicting catalog values deliberately disable the fallback.
        if (!found.compensation && found.title) {
            const learnedCompensation = findCatalogCompensationByTitle(cardObj.contractName);
            if (learnedCompensation !== null) {
                cardObj.compensation = learnedCompensation;
                found.compensation = true;
            }
        }

        // Compensation is the strongest cross-check for noisy camera photos when it uniquely
        // identifies one verified catalog contract. A title crop can still touch the center list
        // because of perspective, so a wrong but plausible title must not override an exact reward
        // signature. If several contracts ever share the same reward, this fallback returns empty
        // and OCR remains conservative instead of guessing.
        if (found.compensation) {
            const learnedTitle = findCatalogContractByCompensation(cardObj.compensation);
            if (learnedTitle && normalizeContractPhrase(learnedTitle) !== normalizeContractPhrase(cardObj.contractName)) {
                cardObj.contractName = learnedTitle;
                found.title = true;
            } else if (!found.title && learnedTitle) {
                cardObj.contractName = learnedTitle;
                found.title = true;
            }
        }
        return found;
    }

    let sharedOcrWorkerPromise = null;
    let sharedOcrQueue = Promise.resolve();

    /** Reuse one Tesseract worker across screenshots; worker startup is one of the slowest OCR steps. */
    async function getSharedOcrWorker() {
        if (!sharedOcrWorkerPromise) {
            sharedOcrWorkerPromise = Tesseract.createWorker('ukr+eng+rus').catch(error => {
                sharedOcrWorkerPromise = null;
                throw error;
            });
        }
        return sharedOcrWorkerPromise;
    }

    /** OCR only the tiny top-left in-game header. */
    async function recognizeHeader(worker, sourceDataUrl) {
        // The date is a very small status-line label in the upper-left corner of the tablet.
        // A single wide crop diluted it with the Contracts heading/logo. Scan several narrow
        // overlapping strips and keep all text so resolveScreenshotDate can pick the valid date.
        const crops = [
            { x: 0.000, y: 0.000, w: 0.30, h: 0.060 },
            { x: 0.000, y: 0.008, w: 0.24, h: 0.052 },
            { x: 0.008, y: 0.012, w: 0.20, h: 0.048 }
        ];
        const texts = [];
        let confidence = 0;
        for (const crop of crops) {
            const headerCrop = await createHeaderOcrCrop(sourceDataUrl, crop, 1800);
            await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, tessedit_char_whitelist: '' });
            const result = await worker.recognize(headerCrop);
            if (result.data.text) texts.push(result.data.text);
            confidence = Math.max(confidence, Number(result.data.confidence || 0));
            if (resolveScreenshotDate(result.data.text || '', '')) break;
        }
        return { data: { text: texts.join('\n'), confidence } };
    }

    /** Read only HH:MM from the far-left device status bar. Used only when the date was found without time. */
    async function recognizeHeaderTime(worker, sourceDataUrl) {
        // Time is only a few pixels wide on camera photos. Use several overlapping crops and
        // accept the strongest valid HH:MM candidate instead of requiring every crop to agree.
        // Camera photos do not place the tablet at x=0 consistently. In our real samples
        // the device clock can sit anywhere from ~1% to ~32% of the full photo width.
        // Scan overlapping top-left strips instead of assuming the clock is at the photo edge.
        const crops = [
            { x: 0.000, y: 0.000, w: 0.140, h: 0.070 },
            { x: 0.060, y: 0.000, w: 0.140, h: 0.070 },
            { x: 0.120, y: 0.000, w: 0.140, h: 0.070 },
            { x: 0.180, y: 0.000, w: 0.140, h: 0.070 },
            { x: 0.240, y: 0.000, w: 0.140, h: 0.070 },
            { x: 0.300, y: 0.000, w: 0.120, h: 0.070 },
            { x: 0.000, y: 0.008, w: 0.420, h: 0.060 }
        ];
        const candidates = [];
        let confidence = 0;
        for (const crop of crops) {
            const prepared = await createHeaderOcrCrop(sourceDataUrl, crop, 1500);
            await worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
                tessedit_char_whitelist: '0123456789:.'
            });
            const result = await worker.recognize(prepared);
            const resultConfidence = Number(result.data.confidence || 0);
            confidence = Math.max(confidence, resultConfidence);
            const raw = String(result.data.text || '').replace(/\s+/g, '');
            const normal = raw.match(/(?:^|\D)([01]?\d|2[0-3])[:.]([0-5]\d)(?:\D|$)/);
            const compact = !normal && raw.match(/(?:^|\D)([01]\d|2[0-3])([0-5]\d)(?:\D|$)/);
            const match = normal || compact;
            if (match) candidates.push({ value: `${match[1].padStart(2, '0')}:${match[2]}`, confidence: resultConfidence });
        }
        if (!candidates.length) return { text: '', confidence };
        candidates.sort((a, b) => b.confidence - a.confidence);
        return { text: candidates[0].value, confidence: Math.max(confidence, candidates[0].confidence) };
    }

    async function recognizeTitle(worker, sourceDataUrl) {
        // Selected contract title lives in the right detail card. Keep this crop to the right
        // of the center contract list so names such as "Продаж трофеїв II" cannot leak in.
        const titleCrop = await createOcrCrop(sourceDataUrl, { x: 0.55, y: 0.205, w: 0.34, h: 0.115 }, 2200);
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, tessedit_char_whitelist: '' });
        return worker.recognize(titleCrop);
    }

    async function recognizeMetrics(worker, sourceDataUrl) {
        const metricsCrop = await createOcrCrop(sourceDataUrl, { x: 0.53, y: 0.25, w: 0.45, h: 0.46 }, 2000);
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
        return worker.recognize(metricsCrop);
    }


    /**
     * Camera-photo rescue pass. Instead of trying to perfectly detect the tablet bezel, scan the
     * broad right-hand contract panel directly on the original photo. This region is stable across
     * our real phone photos and contains both the contract title and the compensation label/value.
     */
    async function recognizeCameraContractPanel(worker, sourceDataUrl) {
        const panelCrop = await createOcrCrop(sourceDataUrl, { x: 0.46, y: 0.16, w: 0.48, h: 0.58 }, 2600);
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
        return worker.recognize(panelCrop);
    }

    /**
     * Read only the selected contract title from the right detail card on camera photos.
     * These overlapping ROIs deliberately start to the right of the center list, preventing
     * a visible but non-selected contract name from winning fuzzy matching.
     */
    async function recognizeCameraActiveTitleVariants(worker, sourceDataUrl) {
        const crops = [
            { x: 0.53, y: 0.18, w: 0.34, h: 0.16 },
            { x: 0.56, y: 0.20, w: 0.31, h: 0.14 },
            { x: 0.51, y: 0.16, w: 0.38, h: 0.18 }
        ];
        const texts = [];
        let confidence = 0;
        for (const crop of crops) {
            const prepared = await createOcrCrop(sourceDataUrl, crop, 2500);
            await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, tessedit_char_whitelist: '' });
            const result = await worker.recognize(prepared);
            if (result.data.text) texts.push(result.data.text);
            confidence = Math.max(confidence, Number(result.data.confidence || 0));
        }
        return { text: texts.join('\n'), confidence };
    }

    /**
     * OCR the contract panel using several overlapping camera crops. Real phone photos are not
     * geometrically stable enough for one fixed rectangle: the tablet can be shifted, zoomed or
     * photographed with perspective. We keep the calls small and merge their text for parsing.
     */
    async function recognizeCameraPanelVariants(worker, sourceDataUrl) {
        const crops = [
            { x: 0.40, y: 0.13, w: 0.50, h: 0.55 },
            { x: 0.45, y: 0.16, w: 0.43, h: 0.50 },
            { x: 0.48, y: 0.18, w: 0.40, h: 0.43 }
        ];
        const texts = [];
        let confidence = 0;
        for (const crop of crops) {
            const prepared = await createOcrCrop(sourceDataUrl, crop, 2400);
            await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
            const result = await worker.recognize(prepared);
            if (result.data.text) texts.push(result.data.text);
            confidence = Math.max(confidence, Number(result.data.confidence || 0));
        }
        return { text: texts.join('\n'), confidence };
    }

    /**
     * Read the true top-left device header on camera photos.
     * Phone photos leave a lot of empty space around the tiny tablet status line, so one broad
     * crop makes Tesseract see the text as noise. Use several tight crops and merge them.
     */
    async function recognizeCameraHeader(worker, sourceDataUrl) {
        const crops = [
            { x: 0.000, y: 0.000, w: 0.24, h: 0.085 },
            { x: 0.000, y: 0.012, w: 0.20, h: 0.070 },
            { x: 0.010, y: 0.020, w: 0.18, h: 0.060 }
        ];
        const texts = [];
        let confidence = 0;
        for (const crop of crops) {
            const prepared = await createHeaderOcrCrop(sourceDataUrl, crop, 1800);
            await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, tessedit_char_whitelist: '' });
            const line = await worker.recognize(prepared);
            if (line.data.text) texts.push(line.data.text);
            confidence = Math.max(confidence, Number(line.data.confidence || 0));

            // A second segmentation mode helps when perspective makes the status line slightly tilted.
            if (!resolveScreenshotDate(line.data.text || '', '')) {
                await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
                const sparse = await worker.recognize(prepared);
                if (sparse.data.text) texts.push(sparse.data.text);
                confidence = Math.max(confidence, Number(sparse.data.confidence || 0));
            }
        }
        return { data: { text: texts.join('\n'), confidence } };
    }

    /** Rescue missing fields directly from the original camera photo before any geometry fallback. */
    async function runCameraPhotoRescue(worker, originalDataUrl, best) {
        const retryCard = { ...best.card };
        let headerText = '';
        let titleText = '';
        let panelText = '';
        let headerConfidence = best.headerConfidence;
        let titleConfidence = best.titleConfidence;
        let metricsConfidence = best.metricsConfidence;

        let headerTimeText = '';
        if (!best.found.date) {
            const header = await recognizeCameraHeader(worker, originalDataUrl);
            headerText = header.data.text || '';
            headerConfidence = Number(header.data.confidence || 0);
        }
        // A date without HH:MM is still incomplete. v1.7.4 treated found.date=true as final and
        // skipped the camera time rescue entirely, which is why "Субота 22 серпня" lost 22:15.
        if (best.found.date && !/\b\d{1,2}:\d{2}\b/.test(best.card.dateStr || '')) {
            const timeResult = await recognizeHeaderTime(worker, originalDataUrl);
            headerTimeText = timeResult.text || '';
            if (headerTimeText) {
                const baseDate = resolveScreenshotDate(best.card.dateStr || '', headerTimeText);
                if (baseDate) {
                    retryCard.dateStr = baseDate.display;
                    retryCard.completedAt = parseScreenshotDateToIso(baseDate.display);
                }
            }
        } else if (!best.found.date) {
            const parsedHeader = resolveScreenshotDate(headerText, '');
            if (parsedHeader && !parsedHeader.hasTime) {
                const timeResult = await recognizeHeaderTime(worker, originalDataUrl);
                headerTimeText = timeResult.text || '';
            }
        }
        if (!best.found.title) {
            const titleResult = await recognizeCameraActiveTitleVariants(worker, originalDataUrl);
            titleText = titleResult.text || '';
            titleConfidence = Math.max(titleConfidence, titleResult.confidence);
        }
        if (!best.found.compensation) {
            const panel = await recognizeCameraPanelVariants(worker, originalDataUrl);
            panelText = panel.text || '';
            metricsConfidence = Math.max(metricsConfidence, panel.confidence);
        }

        const rescueFound = parseContractOcrData('', panelText, titleText, headerText, headerTimeText, panelText, retryCard);
        const found = { ...best.found };
        for (const key of Object.keys(found)) found[key] = Boolean(found[key] || rescueFound[key]);
        return { found, card: retryCard, headerConfidence, titleConfidence, metricsConfidence };
    }

    /**
     * Last-resort single OCR call for phone photos where fixed crops miss the tablet UI.
     * One full-frame pass is cheaper than repeating many overlapping crops and lets the
     * parser recover date, known title and compensation from their labels anywhere on screen.
     */
    async function runFullFrameFallback(worker, sourceDataUrl, best) {
        const fullSource = await createFullFrameOcrSource(sourceDataUrl);
        await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, tessedit_char_whitelist: '' });
        const result = await worker.recognize(fullSource);
        const retryCard = { ...best.card };
        // Full-frame OCR may contain every contract name from the center list. It is useful
        // for date/compensation rescue, but it is intentionally forbidden from choosing title.
        const fallbackFound = parseContractOcrData(
            result.data.text, result.data.text, '',
            result.data.text, '', result.data.text, retryCard
        );
        const found = { ...best.found };
        for (const key of Object.keys(found)) found[key] = Boolean(found[key] || fallbackFound[key]);
        return {
            found,
            card: retryCard,
            headerConfidence: best.headerConfidence,
            titleConfidence: best.titleConfidence,
            metricsConfidence: Number(result.data.confidence || best.metricsConfidence || 0)
        };
    }

    /** Fast focused OCR pass with only three recognition calls. */
    async function runFocusedOcrPass(worker, sourceDataUrl) {
        const tempCard = {
            dateStr: '', completedAt: null, contractName: '', compensation: 0
        };

        // Canvas preprocessing can happen in parallel, but a shared Tesseract worker must recognize
        // sequentially. Keeping each region small is faster than scanning the complete screenshot.
        const headerResult = await recognizeHeader(worker, sourceDataUrl);
        const headerDate = resolveScreenshotDate(headerResult.data.text || '', '');
        let focusedTimeText = '';
        if (headerDate && !headerDate.hasTime) {
            const timeResult = await recognizeHeaderTime(worker, sourceDataUrl);
            focusedTimeText = timeResult.text || '';
        }
        const titleResult = await recognizeTitle(worker, sourceDataUrl);
        const metricsResult = await recognizeMetrics(worker, sourceDataUrl);

        const found = parseContractOcrData(
            '', metricsResult.data.text, titleResult.data.text,
            headerResult.data.text, focusedTimeText, metricsResult.data.text, tempCard
        );

        return {
            found,
            card: tempCard,
            headerConfidence: Number(headerResult.data.confidence || 0),
            titleConfidence: Number(titleResult.data.confidence || 0),
            metricsConfidence: Number(metricsResult.data.confidence || 0)
        };
    }

    /**
     * Retry only fields that are still missing after the fast pass.
     * This avoids repeating title + metrics OCR just because the tiny date header failed.
     */
    async function retryMissingFields(worker, sourceDataUrl, best) {
        const retryCard = { ...best.card };
        const texts = { date: '', time: '', title: '', metrics: '' };
        let headerConfidence = best.headerConfidence;
        let titleConfidence = best.titleConfidence;
        let metricsConfidence = best.metricsConfidence;

        if (!best.found.date) {
            const result = await recognizeHeader(worker, sourceDataUrl);
            texts.date = result.data.text;
            headerConfidence = Number(result.data.confidence || 0);
            const parsedHeader = resolveScreenshotDate(texts.date || '', '');
            if (parsedHeader && !parsedHeader.hasTime) {
                const timeResult = await recognizeHeaderTime(worker, sourceDataUrl);
                texts.time = timeResult.text || '';
            }
        }
        if (!best.found.title) {
            const result = await recognizeTitle(worker, sourceDataUrl);
            texts.title = result.data.text;
            titleConfidence = Number(result.data.confidence || 0);
        }
        if (!best.found.compensation) {
            const result = await recognizeMetrics(worker, sourceDataUrl);
            texts.metrics = result.data.text;
            metricsConfidence = Number(result.data.confidence || 0);
        }

        const retryFound = parseContractOcrData('', texts.metrics, texts.title, texts.date, texts.time, texts.metrics, retryCard);
        const found = { ...best.found };
        for (const key of Object.keys(found)) found[key] = Boolean(found[key] || retryFound[key]);

        return { found, card: retryCard, headerConfidence, titleConfidence, metricsConfidence };
    }

    /** Resize the source before sending it to Apps Script. Large camera photos are the main latency cost. */
    async function createVisionImage(dataUrl, options = {}) {
        const image = await loadOcrImage(dataUrl);
        const sourceX = Math.max(0, Math.round((options.x || 0) * image.naturalWidth));
        const sourceY = Math.max(0, Math.round((options.y || 0) * image.naturalHeight));
        const sourceW = Math.max(1, Math.round((options.w || 1) * image.naturalWidth));
        const sourceH = Math.max(1, Math.round((options.h || 1) * image.naturalHeight));
        const maxWidth = Number(options.maxWidth || 1600);
        const maxScale = options.upscale ? Number(options.maxScale || 2.5) : 1;
        const scale = Math.min(maxScale, maxWidth / sourceW);
        const width = Math.max(1, Math.round(sourceW * scale));
        const height = Math.max(1, Math.round(sourceH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', Number(options.quality || 0.82));
    }

    /**
     * Prepare one current Vision payload plus compatibility crops for older backend deployments.
     * The site may be opened locally while Apps Script is still on v1.5.x, so we send both
     * the v1.6+ fields (imageData + detailData) and the legacy fields
     * (headerData + compensationData). This prevents a frontend/backend version mismatch
     * from blanking every recognized field.
     */
    async function prepareVisionImages(dataUrl) {
        // Fast path: only send the two images the backend actually uses.
        // The old header/compensation compatibility crops duplicated several MB of base64
        // and made every scan much slower without improving the current backend result.
        const [contextImage, detailImage] = await Promise.all([
            createVisionImage(dataUrl, { x: 0, y: 0, w: 1, h: 1, maxWidth: 1100, quality: 0.68 }),
            createVisionImage(dataUrl, { x: 0.47, y: 0.10, w: 0.53, h: 0.66, maxWidth: 900, quality: 0.76, upscale: true, maxScale: 1.8 })
        ]);
        return { contextImage, detailImage };
    }

    /** Resolve the Vision proxy without ever exposing its server-side token.
     *  Local development uses the same-origin Python proxy. GitHub Pages uses
     *  the public serverless proxy configured in js/config.js.
     */
    function getVisionApiUrl() {
        if (location.protocol === 'file:') {
            throw new Error('Vision requires the site to be opened through HTTP/HTTPS, not file://');
        }
        const configured = String(window.GREATNESS_CONFIG && window.GREATNESS_CONFIG.visionProxyBaseUrl || '').trim();
        if (!configured || configured.includes('PASTE_') || configured.includes('YOUR_')) {
            throw new Error('Public Vision proxy is not configured');
        }
        return configured.replace(/\/$/, '') + '/api/vision';
    }

    /** Send one screenshot to Gemini Vision through the protected HTTP proxy. */
    async function analyzeScreenshotWithVision(dataUrl) {
        const prepared = await prepareVisionImages(dataUrl);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 210000);
        try {
            const accessToken = await window.GreatnessAuth?.getAccessToken?.();
            if (!accessToken) throw new Error('Authentication required');
            const response = await fetch(getVisionApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify({
                    imageData: prepared.contextImage,
                    detailData: prepared.detailImage
                }),
                signal: controller.signal
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || `Vision HTTP ${response.status}`);
            }
            return payload.result || {};
        } catch (error) {
            if (error && error.name === 'AbortError') throw new Error('Vision request timeout');
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    function applyVisionResult(cardObj, result) {
        const dateOnly = String(result.date || '').trim();
        const timeOnly = String(result.time || '').trim();
        const legacyDateTime = String(result.dateTime || '').trim();
        const dateText = [timeOnly, dateOnly].filter(Boolean).join(' ').trim() || legacyDateTime;
        const title = String(result.contractName || '').trim();
        const compensation = Number(result.compensation || 0);
        const resolved = resolveScreenshotDate(dateText, dateText);
        if (resolved) {
            cardObj.dateStr = resolved.display;
            cardObj.completedAt = parseScreenshotDateToIso(resolved.display);
        }
        if (title) {
            cardObj.ocrRawContractName = title;
            cardObj.contractName = title;
        }
        if (Number.isFinite(compensation) && compensation > 0) cardObj.compensation = compensation;

        // v1.8.10: compensation narrows the candidate set but is never a unique contract ID.
        // The final title is selected by fuzzy similarity against known names and learned aliases.
        if (cardObj.contractName) {
            const catalogTitle = resolveCatalogTitle(cardObj.contractName, cardObj.compensation);
            if (catalogTitle) cardObj.contractName = catalogTitle;
        }
        if (cardObj.contractName && !(cardObj.compensation > 0)) {
            const catalogCompensation = findCatalogCompensationByTitle(cardObj.contractName);
            if (catalogCompensation !== null) cardObj.compensation = catalogCompensation;
        }
        return Boolean(cardObj.completedAt && cardObj.contractName && cardObj.compensation > 0);
    }

    async function runOcrOnCardInternal(cardObj) {
        cardObj.ocrStatus = 'processing';
        cardObj.ocrMode = '';
        // Clear old screenshot-derived date before rescanning. Never preserve upload time.
        cardObj.dateStr = '';
        cardObj.completedAt = null;
        renderAllUploadedCards();

        try {
            // Primary path: multimodal Vision reads the whole screenshot context. This is much
            // more robust for photographed tablets, perspective, glare and tiny status-bar time.
            try {
                const visionResult = await analyzeScreenshotWithVision(cardObj.dataUrl);
                const visionComplete = applyVisionResult(cardObj, visionResult);
                // Stability mode: a partial Gemini result is still useful. Keep every field Gemini
                // actually returned and stop here instead of falling into the 30-60 second Tesseract
                // pipeline. Time is optional for reporting; the calendar date remains authoritative.
                cardObj.ocrMode = 'gemini-vision';
                const hasCoreFields = Boolean(cardObj.completedAt && cardObj.contractName && cardObj.compensation > 0);
                cardObj.ocrStatus = hasCoreFields ? 'success' : 'needs-review';
                renderAllUploadedCards();
                return;
            } catch (visionError) {
                // Do not silently start the 30-60s local OCR pipeline after a Vision failure.
                // Keep the card editable and let the user explicitly retry with the OCR button.
                console.warn('Gemini Vision unavailable:', visionError);
                cardObj.ocrMode = 'vision-error';
                cardObj.ocrStatus = 'needs-review';
                renderAllUploadedCards();
                return;
            }

            if (typeof Tesseract === 'undefined') {
                cardObj.ocrStatus = 'needs-review';
                renderAllUploadedCards();
                return;
            }

            const worker = await getSharedOcrWorker();

            // Fast path: three focused OCR calls on the original image.
            let best = await runFocusedOcrPass(worker, cardObj.dataUrl);
            cardObj.ocrMode = 'screenshot';
            let bestScore = scoreOcrResult(best.found);

            // First rescue difficult phone photos directly from the original frame. The broad right
            // panel keeps the title + compensation together and avoids failures from bad bezel detection.
            let phoneSource = null;
            if (bestScore < 3) {
                const cameraPass = await runCameraPhotoRescue(worker, cardObj.dataUrl, best);
                const cameraScore = scoreOcrResult(cameraPass.found);
                if (cameraScore > bestScore) {
                    best = cameraPass;
                    bestScore = cameraScore;
                    cardObj.ocrMode = 'camera-panel-rescue';
                }
            }

            // Only then try the normalized tablet source for fields still missing.
            if (bestScore < 3) {
                phoneSource = await createPhonePhotoNormalizedSource(cardObj.dataUrl);
                const phonePass = await retryMissingFields(worker, phoneSource, best);
                const phoneScore = scoreOcrResult(phonePass.found);
                if (phoneScore > bestScore) {
                    best = phonePass;
                    bestScore = phoneScore;
                    cardObj.ocrMode = 'phone-photo';
                }
            }

            // Full-frame fallback must scan the enlarged tablet crop, not the original camera photo.
            // Otherwise the contract title and $ reward remain only a few pixels high for Tesseract.
            if (bestScore < 3) {
                if (!phoneSource) phoneSource = await createPhonePhotoNormalizedSource(cardObj.dataUrl);
                const fullPass = await runFullFrameFallback(worker, phoneSource, best);
                const fullScore = scoreOcrResult(fullPass.found);
                if (fullScore > bestScore) {
                    best = fullPass;
                    bestScore = fullScore;
                    cardObj.ocrMode = 'full-frame-fallback';
                }
            }

            cardObj.dateStr = best.card.dateStr || '';
            cardObj.completedAt = best.found.date ? parseScreenshotDateToIso(cardObj.dateStr) : null;
            cardObj.contractName = best.found.title ? best.card.contractName : '';
            cardObj.compensation = best.found.compensation ? best.card.compensation : 0;

            cardObj.ocrStatus = bestScore === 3 && cardObj.completedAt ? 'success' : 'needs-review';
        } catch (err) {
            console.warn('OCR failed. Screenshot values were left unconfirmed:', err);
            cardObj.dateStr = '';
            cardObj.completedAt = null;
            cardObj.ocrStatus = 'needs-review';
        }

        renderAllUploadedCards();
    }


    /** Serialize OCR jobs because a single Tesseract worker cannot safely process cards in parallel. */
    function runOcrOnCard(cardObj) {
        sharedOcrQueue = sharedOcrQueue
            .catch(() => undefined)
            .then(() => runOcrOnCardInternal(cardObj));
        return sharedOcrQueue;
    }


    /** Lightweight deterministic fingerprint of the uploaded image. No image bytes leave the browser. */
    function getScreenshotHash(dataUrl) {
        const value = String(dataUrl || '');
        if (!value) return '';
        let hash = 2166136261;
        const step = Math.max(1, Math.floor(value.length / 4096));
        for (let i = 0; i < value.length; i += step) {
            hash ^= value.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return `img_${(hash >>> 0).toString(16)}_${value.length}`;
    }

    /** Normalize the timestamp to minute precision for duplicate comparison. */
    function normalizeEntryMinute(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        date.setSeconds(0, 0);
        return date.toISOString();
    }

    /** Return a stable signature for exact contract duplicates. */
    function getEntrySignature(entry) {
        const participants = Array.isArray(entry.participants) ? [...entry.participants].sort() : [];
        return [
            normalizeEntryMinute(entry.completedAt || entry.timestamp || entry.isoDate),
            String(entry.contractName || '').trim().toLowerCase(),
            Number(entry.compensation || 0),
            participants.join('|').toLowerCase()
        ].join('::');
    }

    /** Find an exact saved duplicate for a reviewed screenshot card. */
    function findStoredDuplicate(card) {
        const candidate = buildJournalEntry(card, true);
        if (!candidate) return null;
        const screenshotHash = getScreenshotHash(card.dataUrl);
        const stored = getStoredJournalEntries();
        if (screenshotHash) {
            const sameImage = stored.find(entry => entry.screenshotHash && entry.screenshotHash === screenshotHash);
            if (sameImage) return sameImage;
        }
        const signature = getEntrySignature(candidate);
        return stored.find(entry => getEntrySignature(entry) === signature) || null;
    }

    /** Validate and convert an uploaded screenshot card into a journal entry. */
    function buildJournalEntry(card, previewOnly = false) {
        if (!card.contractName.trim() || card.compensation <= 0 || card.participants.length === 0) return null;
        const participantCount = card.participants.length;
        const completedAt = card.completedAt || parseScreenshotDateToIso(card.dateStr);
        if (!completedAt) return null;
        return {
            id: previewOnly ? 'preview' : 'contract_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            dateStr: card.dateStr,
            completedAt,
            isoDate: new Date().toISOString(),
            contractName: card.contractName.trim(),
            ocrAlias: card.ocrRawContractName && normalizeContractPhrase(card.ocrRawContractName) !== normalizeContractPhrase(card.contractName) ? card.ocrRawContractName.trim() : '',
            compensation: card.compensation,
            participants: [...card.participants],
            participantCount,
            sharePerPerson: 1 / participantCount,
            payoutPerPerson: roundMoney(card.compensation / participantCount),
            paidByPlayer: Object.fromEntries(card.participants.map(nick => [nick, false])),
            timestamp: previewOnly ? new Date(completedAt).getTime() : Date.now(),
            source: 'screenshot',
            screenshotHash: getScreenshotHash(card.dataUrl),
            datePrecision: /\d{1,2}:\d{2}/.test(card.dateStr) ? 'minute' : 'day'
        };
    }

    /** Open the journal only when the saved card was the last screenshot in the current batch. */
    function finishSingleCardSave(card, successMessage) {
        const keepUploadOpen = uploadedCards.length > 1;
        uploadedCards = uploadedCards.filter(item => item.id !== card.id);
        renderAllUploadedCards();

        if (keepUploadOpen) {
            showContractToast(`${successMessage} Залишилось скріншотів: ${uploadedCards.length}.`);
            return;
        }

        switchContractsSubtab('contracts-sub-journal');
        renderJournalAnalytics();
        document.getElementById('contracts-sub-journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showContractToast(`${successMessage} Відкрито журнал.`);
    }

    /** Replace an exact duplicate instead of creating a second journal row. */
    function overwriteDuplicate(card, duplicateId) {
        const entry = buildJournalEntry(card);
        if (!entry || !duplicateId) return;
        const journal = getStoredJournalEntries();
        const previous = journal.find(item => item.id === duplicateId);
        if (previous?.paidByPlayer) entry.paidByPlayer = { ...entry.paidByPlayer, ...previous.paidByPlayer };
        const next = journal.map(item => item.id === duplicateId ? { ...entry, id: duplicateId } : item);
        saveJournalEntries(next, { label: 'Перезапис контракту' });
        finishSingleCardSave(card, 'Дублікат перезаписано.');
    }

    /** Save one reviewed screenshot. With 2+ cards, keep the user on the upload screen. */
    function saveSingleCardToJournal(card) {
        const entry = buildJournalEntry(card);
        if (!entry) {
            alert('Перевірте дані: потрібні назва контракту, грошова компенсація та хоча б один учасник.');
            return;
        }
        const duplicate = findStoredDuplicate(card);
        if (duplicate) {
            card.duplicateId = duplicate.id;
            renderAllUploadedCards();
            return;
        }
        const journal = [entry, ...getStoredJournalEntries()];
        saveJournalEntries(journal, { label: 'Додано контракт' });
        finishSingleCardSave(card, 'Контракт додано.');
    }

    /** Small non-blocking confirmation so the next screenshot can be processed immediately. */
    function showContractToast(message) {
        let toast = document.getElementById('contract-save-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'contract-save-toast';
            toast.className = 'contract-save-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
        toast.classList.add('show');
        clearTimeout(showContractToast.timer);
        showContractToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    /**
     * Save only the newly reviewed batch and verify every Entry ID remotely.
     * Do not route Save All through the generic journal diff sync: older cached rows may differ
     * after normalization and can delay/interrupt a multi-card save. Each new contract gets its
     * own acknowledged write with targeted retries, then the shared sheet is reloaded once.
     */
    async function saveAllEntriesWithVerification(newEntries, nextJournal) {
        const MAX_ATTEMPTS = 3;
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const failed = [];

        // Keep the full batch locally immediately, but do not start the generic remote diff sync.
        saveJournalEntries(nextJournal, {
            label: `Додано ${newEntries.length} контрактів`,
            skipRemote: true
        });

        for (let index = 0; index < newEntries.length; index += 1) {
            const entry = newEntries[index];
            let confirmed = false;
            let lastError = null;

            for (let attempt = 1; attempt <= MAX_ATTEMPTS && !confirmed; attempt += 1) {
                try {
                    const response = await googleSheetJsonpWrite('upsert', { entries: [entry] });
                    const received = Number(response?.result?.received ?? response?.received ?? 0);
                    if (received < 1) throw new Error('Google Sheets acknowledged request without receiving the contract');
                    confirmed = true;
                } catch (error) {
                    lastError = error;
                    console.warn(`Save All: contract ${index + 1}/${newEntries.length}, attempt ${attempt}/${MAX_ATTEMPTS} failed`, error);
                    if (attempt < MAX_ATTEMPTS) await sleep(700 * attempt);
                }
            }

            if (!confirmed) failed.push({ entry, error: lastError });
        }

        if (failed.length) {
            throw new Error(`Google Sheets did not acknowledge ${failed.length} of ${newEntries.length} contracts`);
        }

        // Reload only after every write was explicitly acknowledged.
        await loadJournalFromGoogleSheet({ silent: true });
        const storedIds = new Set(getStoredJournalEntries().map(entry => String(entry.id)));
        const missing = newEntries.filter(entry => !storedIds.has(String(entry.id)));

        if (missing.length) {
            console.warn('Save All: acknowledged rows missing after reload, retrying exact missing IDs', missing.map(entry => entry.id));
            for (const entry of missing) {
                await googleSheetJsonpWrite('upsert', { entries: [entry] });
            }
            await loadJournalFromGoogleSheet({ silent: true });
            const finalIds = new Set(getStoredJournalEntries().map(entry => String(entry.id)));
            const stillMissing = newEntries.filter(entry => !finalIds.has(String(entry.id)));
            if (stillMissing.length) {
                throw new Error(`Google Sheets did not confirm ${stillMissing.length} of ${newEntries.length} new contracts after verification`);
            }
        }

        await loadContractCatalogFromGoogleSheet({ silent: true }).catch(() => {});
        return true;
    }

    // --- SAVE TO JOURNAL DATABASE LOGIC ---
    const btnSaveAllToJournal = document.getElementById('btn-save-all-to-journal');
    if (btnSaveAllToJournal) {
        btnSaveAllToJournal.addEventListener('click', async () => {
            if (uploadedCards.length === 0) {
                alert('Немає завантажених скріншотів для збереження.');
                return;
            }

            const invalidCards = uploadedCards.filter(card => !card.contractName.trim() || card.compensation <= 0 || card.participants.length === 0);
            if (invalidCards.length > 0) {
                alert(`Перевірте ${invalidCards.length} скріншот(и): потрібні назва контракту, компенсація та хоча б один учасник.`);
                return;
            }

            // Build the whole batch first. Contracts that share the same minute are valid separate
            // records when their contract names differ (for example Trophy Sale I and III at 07:30).
            // Duplicate checks are therefore exact: same screenshot OR same minute + name + price + players.
            const storedBeforeSave = getStoredJournalEntries();
            const preparedBatch = uploadedCards.map(card => ({ card, entry: buildJournalEntry(card) })).filter(item => item.entry);
            const duplicateItems = [];
            const newItems = [];

            preparedBatch.forEach(item => {
                const screenshotHash = getScreenshotHash(item.card.dataUrl);
                const signature = getEntrySignature(item.entry);
                const duplicate = storedBeforeSave.find(saved =>
                    (screenshotHash && saved.screenshotHash && saved.screenshotHash === screenshotHash) ||
                    getEntrySignature(saved) === signature
                );
                if (duplicate) duplicateItems.push({ ...item, duplicate });
                else newItems.push(item);
            });

            // Do not abort Save All because one screenshot is already stored. Save every genuinely
            // new contract and leave only exact duplicates on screen for manual overwrite/review.
            duplicateItems.forEach(item => { item.card.duplicateId = item.duplicate.id; });
            if (newItems.length === 0) {
                renderAllUploadedCards();
                alert(`Усі ${duplicateItems.length} контракт(и) вже є в журналі. Нових записів немає.`);
                return;
            }

            const cardsToSave = newItems.map(item => item.card);
            const newEntries = newItems.map(item => item.entry);
            const nextJournal = [...newEntries, ...storedBeforeSave];

            btnSaveAllToJournal.disabled = true;
            const originalButtonHtml = btnSaveAllToJournal.innerHTML;
            btnSaveAllToJournal.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Зберігаю всі...';

            try {
                // During remote verification the just-written entries are already present in the
                // local journal. Keep duplicate UI suppressed until those saved cards are removed,
                // otherwise every successful card briefly flashes as "ДУБЛІКАТ" before navigation.
                suppressDuplicateUi = true;
                // Wait for every Google Sheets batch to be acknowledged before opening the journal.
                // This prevents the user from seeing only the first row while the remaining rows are still syncing.
                await saveAllEntriesWithVerification(newEntries, nextJournal);

                // "Save all and open journal" must immediately show the rows that were just saved.
                // If their dates fall outside the currently selected journal period (for example 16 Aug
                // while "Previous week" is 17-23 Aug), automatically switch to a custom range spanning
                // the saved batch. This avoids the false impression that Save All lost the contracts.
                const savedDates = newEntries
                    .map(entry => new Date(entry.completedAt || entry.timestamp || entry.isoDate))
                    .filter(date => !Number.isNaN(date.getTime()));
                if (savedDates.length) {
                    const toLocalInputDate = date => {
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        return `${y}-${m}-${d}`;
                    };
                    const minDate = new Date(Math.min(...savedDates.map(date => date.getTime())));
                    const maxDate = new Date(Math.max(...savedDates.map(date => date.getTime())));
                    if (rangeStartDate) rangeStartDate.value = toLocalInputDate(minDate);
                    if (rangeEndDate) rangeEndDate.value = toLocalInputDate(maxDate);
                    activePeriodFilter = 'custom';
                    periodButtons.forEach(button => button.classList.toggle('active', button.getAttribute('data-period') === 'custom'));
                    if (customRangeSelector) customRangeSelector.style.display = 'flex';
                    if (journalSearchInput) journalSearchInput.value = '';
                }

                const savedCardIds = new Set(cardsToSave.map(card => card.id));
                uploadedCards = uploadedCards.filter(card => !savedCardIds.has(card.id));
                suppressDuplicateUi = false;
                renderAllUploadedCards();
                switchContractsSubtab('contracts-sub-journal');
                renderJournalAnalytics();
                document.getElementById('contracts-sub-journal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                const duplicateNote = duplicateItems.length ? ` Дублікатів пропущено: ${duplicateItems.length}.` : '';
                showContractToast(`Збережено ${newEntries.length} контрактів.${duplicateNote} Відкрито журнал.`);
            } catch (error) {
                suppressDuplicateUi = false;
                renderAllUploadedCards();
                console.error('Save all contracts failed to confirm remote sync:', error);
                // Local cache already contains all entries. Keep screenshots visible so the user can retry remote sync safely.
                alert(`Локально збережено ${newEntries.length} контрактів, але Google Sheets не підтвердив усі записи. Не видаляю скріншоти - перевірте статус синхронізації та повторіть.`);
            } finally {
                btnSaveAllToJournal.disabled = false;
                btnSaveAllToJournal.innerHTML = originalButtonHtml;
            }
        });
    }


    // --- JOURNAL ANALYTICS & FILTERING ENGINE ---
    const periodButtons = document.querySelectorAll('#journal-period-buttons .period-btn');
    const customRangeSelector = document.getElementById('custom-range-selector');
    const rangeStartDate = document.getElementById('range-start-date');
    const rangeEndDate = document.getElementById('range-end-date');
    const btnApplyCustomRange = document.getElementById('btn-apply-custom-range');
    const journalSearchInput = document.getElementById('journal-search-input');
    const activePeriodLabel = document.getElementById('journal-active-period-label');
    const markAllPaidCheckbox = document.getElementById('mark-all-paid-checkbox');
    const btnSeedDemo = document.getElementById('btn-seed-demo-contracts');
    const btnOpenRangeStart = document.getElementById('btn-open-range-start');
    const btnOpenRangeEnd = document.getElementById('btn-open-range-end');
    const btnMarkVisiblePlayersPaid = document.getElementById('btn-mark-visible-players-paid');

    periodButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            periodButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activePeriodFilter = btn.getAttribute('data-period');

            if (activePeriodFilter === 'custom') {
                customRangeSelector.style.display = 'flex';
                // Keep this call inside the original user gesture. Some browsers reject showPicker() after setTimeout.
                openNativeDatePicker(rangeStartDate);
            } else {
                customRangeSelector.style.display = 'none';
                renderJournalAnalytics();
            }
        });
    });

    if (btnApplyCustomRange) {
        btnApplyCustomRange.addEventListener('click', () => renderJournalAnalytics());
    }

    /** Open the browser's native calendar where supported, with a safe mobile fallback. */
    function openNativeDatePicker(input) {
        if (!input) return;
        input.focus({ preventScroll: true });
        if (typeof input.showPicker === 'function') {
            try { input.showPicker(); return; } catch (e) { /* A browser can require a direct user gesture. */ }
        }
        input.click();
    }

    btnOpenRangeStart?.addEventListener('click', () => openNativeDatePicker(rangeStartDate));
    btnOpenRangeEnd?.addEventListener('click', () => openNativeDatePicker(rangeEndDate));

    // The date field itself must also open the calendar, even when it is empty.
    // Chromium requires showPicker() to run during a direct user gesture.
    [rangeStartDate, rangeEndDate].forEach(input => {
        input?.addEventListener('click', () => {
            if (typeof input.showPicker === 'function') {
                try { input.showPicker(); } catch (e) { /* Native click remains the fallback. */ }
            }
        });
    });

    // Native date inputs open a calendar on supported desktop/mobile browsers.
    // After selecting the start date, immediately move the user to the end date.
    if (rangeStartDate) {
        rangeStartDate.addEventListener('change', () => {
            if (rangeEndDate && rangeStartDate.value) {
                rangeEndDate.min = rangeStartDate.value;
                if (rangeEndDate.value && rangeEndDate.value < rangeStartDate.value) rangeEndDate.value = rangeStartDate.value;
                // Move straight to the end-date picker after the start date is selected.
                window.setTimeout(() => openNativeDatePicker(rangeEndDate), 50);
            }
        });
    }

    if (rangeEndDate) {
        rangeEndDate.addEventListener('change', () => {
            if (rangeStartDate?.value && rangeEndDate.value) renderJournalAnalytics();
        });
    }

    if (journalSearchInput) {
        journalSearchInput.addEventListener('input', () => renderJournalAnalytics());
    }

    const btnResetJournalFilter = document.getElementById('btn-reset-journal-filter');
    if (btnResetJournalFilter) btnResetJournalFilter.addEventListener('click', () => {
        if (journalSearchInput) journalSearchInput.value = '';
        renderJournalAnalytics();
    });

    function normalizeJournalEntries(entries) {
        return (Array.isArray(entries) ? entries : []).map(entry => ({
            ...entry,
            participants: Array.isArray(entry.participants) ? entry.participants : [],
            paidByPlayer: entry.paidByPlayer || Object.fromEntries((entry.participants || []).map(nick => [nick, false]))
        }));
    }

    function getStoredJournalEntries() {
        return normalizeJournalEntries(journalEntries);
    }

    function setSheetStatus(state, message) {
        const status = document.getElementById('google-sheet-status');
        if (!status) return;
        status.dataset.state = state;
        status.innerHTML = `<i class="fa-solid ${state === 'online' ? 'fa-circle-check' : state === 'syncing' ? 'fa-arrows-rotate fa-spin' : 'fa-triangle-exclamation'}"></i> ${message}`;
    }

    /** Load the shared OCR learning catalog from the same Google Sheet backend. */
    async function loadContractCatalogFromGoogleSheet({ silent = true } = {}) {
        try {
            const payload = await secureContractsApi('catalog');
            const remoteCatalog = Array.isArray(payload?.catalog) ? payload.catalog.filter(item => item?.contractName) : [];
            if (remoteCatalog.length) {
                const merged = new Map(contractCatalog.map(item => [item.contractName, item]));
                remoteCatalog.forEach(item => {
                    const current = merged.get(item.contractName) || {};
                    const aliases = [...new Set([...(current.aliases || []), ...(Array.isArray(item.aliases) ? item.aliases : [])].map(String).filter(Boolean))];
                    merged.set(item.contractName, { ...current, ...item, aliases });
                });
                contractCatalog = [...merged.values()];
            }
            return contractCatalog;
        } catch (error) {
            if (!silent) console.warn('Contract catalog unavailable:', error);
            throw error;
        }
    }

    async function loadJournalFromGoogleSheet({ silent = false } = {}) {
        try {
            const payload = await secureContractsApi('list');
            const entries = normalizeJournalEntries(payload?.entries || []);
            journalEntries = entries;
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
            googleSheetReady = true;
            setSheetStatus('online', `Захищене сховище підключено · ${entries.length} записів`);
            populateRosterDropdown();
            if (uploadedCards.length) renderAllUploadedCards();
            renderJournalAnalytics();
            return entries;
        } catch (error) {
            if (!silent) setSheetStatus('offline', 'Сховище недоступне - показано локальний кеш');
            throw error;
        }
    }

    async function googleSheetJsonpWrite(action, payload = {}) {
        return secureContractsApi(action, payload);
    }

    function entriesEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    /** Sync only changed journal rows so one user's save cannot wipe another user's new records. */
    async function syncJournalToGoogleSheet(previousEntries, nextEntries) {
        setSheetStatus('syncing', 'Синхронізація з Google Sheets...');
        try {
            const previousById = new Map((previousEntries || []).map(entry => [String(entry.id), entry]));
            const nextById = new Map((nextEntries || []).map(entry => [String(entry.id), entry]));

            const removedIds = [...previousById.keys()].filter(id => !nextById.has(id));
            const changedEntries = [...nextById.values()].filter(entry => {
                const previous = previousById.get(String(entry.id));
                return !previous || !entriesEqual(previous, entry);
            });

            if (removedIds.length) {
                for (let i = 0; i < removedIds.length; i += 1) {
                    await googleSheetJsonpWrite('delete', { ids: [removedIds[i]] });
                }
            }

            // Keep each URL comfortably below browser/proxy limits.
            for (let i = 0; i < changedEntries.length; i += 1) {
                // One journal row per JSONP request keeps URLs small and makes multi-card saves deterministic.
                await googleSheetJsonpWrite('upsert', { entries: changedEntries.slice(i, i + 1) });
            }

            await loadJournalFromGoogleSheet({ silent: true });
            // Newly saved contract names/levels/prices are learned by the backend during upsert.
            // Refresh the catalog immediately so the next OCR card can use the new canonical data.
            await loadContractCatalogFromGoogleSheet({ silent: true }).catch(() => {});
        } catch (error) {
            console.error('Google Sheets write failed:', error);
            setSheetStatus('offline', 'Зміни є локально, але Google Sheets не підтвердив збереження');
            throw error;
        }
    }

    const btnUndoJournal = document.getElementById('btn-undo-journal');

    function updateUndoButton() {
        if (!btnUndoJournal) return;
        const latest = journalUndoStack[journalUndoStack.length - 1];
        btnUndoJournal.disabled = journalUndoStack.length === 0;
        btnUndoJournal.title = latest ? `Скасувати: ${latest.label}` : 'Немає дій для скасування';
        const label = btnUndoJournal.querySelector('.undo-label');
        if (label) label.textContent = latest ? `UNDO: ${latest.label}` : 'UNDO';
    }

    function pushJournalUndoSnapshot(label = 'Зміна журналу') {
        journalUndoStack.push({
            label,
            entries: getStoredJournalEntries()
        });
        if (journalUndoStack.length > MAX_JOURNAL_UNDO_STEPS) journalUndoStack.shift();
        updateUndoButton();
    }

    function saveJournalEntries(entries, options = {}) {
        const { skipUndo = false, label = 'Зміна журналу', skipRemote = false, requireRemote = false } = options;
        const previousEntries = getStoredJournalEntries();
        if (!skipUndo) pushJournalUndoSnapshot(label);
        journalEntries = normalizeJournalEntries(entries);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(journalEntries));
        updateUndoButton();
        renderJournalAnalytics();
        if (skipRemote) return Promise.resolve();

        const syncPromise = syncJournalToGoogleSheet(previousEntries, journalEntries);
        // Most journal edits remain offline-first. Batch Save All explicitly opts into remote confirmation.
        if (requireRemote) return syncPromise;
        return syncPromise.catch(() => {
            // Keep the local version visible. A later manual refresh can retry after connectivity is restored.
        });
    }

    function undoLastJournalAction() {
        const snapshot = journalUndoStack.pop();
        if (!snapshot) {
            showContractToast('Немає дій для скасування');
            updateUndoButton();
            return;
        }
        const currentEntries = getStoredJournalEntries();
        journalEntries = normalizeJournalEntries(snapshot.entries);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(journalEntries));
        syncJournalToGoogleSheet(currentEntries, journalEntries).catch(() => {});
        renderJournalAnalytics();
        updateUndoButton();
        showContractToast(`Скасовано: ${snapshot.label}`);
    }

    btnUndoJournal?.addEventListener('click', undoLastJournalAction);

    // Ctrl/Cmd+Z mirrors the visible UNDO button, but does not hijack native text editing undo.
    document.addEventListener('keydown', event => {
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey) return;
        const target = event.target;
        const isEditable = target instanceof HTMLElement && (
            target.isContentEditable || target.matches('input, textarea, select')
        );
        if (isEditable || journalUndoStack.length === 0) return;
        event.preventDefault();
        undoLastJournalAction();
    });

    updateUndoButton();

    function formatDateRangeLabel(start, end) {
        if (!start && !end) return 'Усі записи';
        const formatter = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
        if (start && end) return `${formatter.format(start)} - ${formatter.format(end)}`;
        if (start) return `з ${formatter.format(start)}`;
        return `до ${formatter.format(end)}`;
    }

    function getPeriodName() {
        const labels = {
            'current-week': 'Поточний тиждень', 'previous-week': 'Минулий тиждень',
            'today': 'Сьогодні', 'current-month': 'Поточний місяць',
            'previous-month': 'Минулий місяць', 'custom': 'Обраний період'
        };
        return labels[activePeriodFilter] || 'Усі записи';
    }

    function formatJournalDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const pad = n => String(n).padStart(2, '0');
        return `${pad(date.getDate())}.${pad(date.getMonth()+1)}.${String(date.getFullYear()).slice(-2)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function contractSortKey(name) {
        const match = String(name || '').trim().match(/^(.*?)(?:\s+([IVXLCDM]+))?$/i);
        const base = (match?.[1] || name || '').trim();
        const roman = (match?.[2] || '').toUpperCase();
        const values = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
        let level = 0, prev = 0;
        for (const ch of [...roman].reverse()) { const v=values[ch]||0; level += v < prev ? -v : v; prev=Math.max(prev,v); }
        return { base, level };
    }

    function compareContractNames(a, b) {
        const ka=contractSortKey(a), kb=contractSortKey(b);
        const baseCmp=ka.base.localeCompare(kb.base, 'uk', {sensitivity:'base'});
        return baseCmp || ka.level-kb.level || String(a).localeCompare(String(b), 'uk');
    }

    function getPlayerPaidState(entry, nick) {
        return Boolean(entry.paidByPlayer && entry.paidByPlayer[nick]);
    }

    /** Return the start of a local calendar day. */
    function startOfDay(date) {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        return result;
    }

    /** Return the end of a local calendar day. */
    function endOfDay(date) {
        const result = new Date(date);
        result.setHours(23, 59, 59, 999);
        return result;
    }

    /**
     * Return Monday 00:00 for the week containing the supplied date.
     * JavaScript uses Sunday = 0, so Sunday has to be shifted back six days.
     */
    function startOfWeekMonday(date) {
        const result = startOfDay(date);
        const day = result.getDay();
        const daysSinceMonday = day === 0 ? 6 : day - 1;
        result.setDate(result.getDate() - daysSinceMonday);
        return result;
    }

    /** Parse an HTML date input as a local date instead of UTC. */
    function parseLocalDateInput(value) {
        if (!value) return null;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }

    /** Resolve the selected journal period to inclusive local date boundaries. */
    function getActivePeriodRange(now = new Date()) {
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);

        if (activePeriodFilter === 'today') {
            return { start: todayStart, end: todayEnd };
        }

        if (activePeriodFilter === 'current-week') {
            const start = startOfWeekMonday(now);
            const end = endOfDay(new Date(start));
            end.setDate(start.getDate() + 6);
            return { start, end };
        }

        if (activePeriodFilter === 'previous-week') {
            const currentWeekStart = startOfWeekMonday(now);
            const start = new Date(currentWeekStart);
            start.setDate(start.getDate() - 7);
            const end = endOfDay(new Date(start));
            end.setDate(start.getDate() + 6);
            return { start, end };
        }

        if (activePeriodFilter === 'current-month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
            return { start, end };
        }

        if (activePeriodFilter === 'previous-month') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
            return { start, end };
        }

        if (activePeriodFilter === 'custom') {
            const startDate = parseLocalDateInput(rangeStartDate?.value);
            const endDate = parseLocalDateInput(rangeEndDate?.value);
            return {
                start: startDate ? startOfDay(startDate) : null,
                end: endDate ? endOfDay(endDate) : null
            };
        }

        return { start: null, end: null };
    }

    function filterJournalEntries(entries) {
        const searchQuery = (journalSearchInput ? journalSearchInput.value : '').trim().toLowerCase();
        const { start, end } = getActivePeriodRange();

        return entries.filter(item => {
            const itemDate = new Date(item.completedAt || item.timestamp || item.isoDate);

            // 1. Period filter. All predefined ranges use calendar boundaries, not rolling durations.
            if (Number.isNaN(itemDate.getTime())) return false;
            if (start && itemDate < start) return false;
            if (end && itemDate > end) return false;

            // 2. Search query filter.
            if (searchQuery) {
                const contractName = String(item.contractName || '').toLowerCase();
                const participants = Array.isArray(item.participants) ? item.participants : [];
                const matchName = contractName.includes(searchQuery);
                const matchParticipant = participants.some(p => String(p).toLowerCase().includes(searchQuery));
                if (!matchName && !matchParticipant) return false;
            }

            return true;
        });
    }

    function updateJournalSearchSuggestions(entries) {
        const datalist = document.getElementById('journal-search-suggestions');
        if (!datalist) return;
        const values = new Set();
        entries.forEach(item => {
            if (item.contractName) values.add(String(item.contractName));
            (item.participants || []).forEach(nick => nick && values.add(String(nick)));
        });
        datalist.innerHTML = [...values].sort((a, b) => a.localeCompare(b, 'uk', { sensitivity: 'base' }))
            .map(value => `<option value="${value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"></option>`).join('');
    }

    /** Parse visible table cell text into a sortable number/date when possible. */
    function getSortableCellValue(cell) {
        const raw = (cell?.dataset?.sortValue || cell?.textContent || '').trim();
        const dateMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{2})(?:\s+(\d{2}):(\d{2}))?$/);
        if (dateMatch) {
            const [, day, month, year, hour = '00', minute = '00'] = dateMatch;
            return { type: 'number', value: new Date(2000 + Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).getTime() };
        }
        const cleaned = raw.replace(/\s/g, '').replace(/[$,+★]/g, '').replace(/[^0-9.,-]/g, '');
        if (cleaned && /^-?\d+(?:[.,]\d+)?$/.test(cleaned)) {
            return { type: 'number', value: Number(cleaned.replace(',', '.')) };
        }
        return { type: 'text', value: raw.toLocaleLowerCase('uk-UA') };
    }

    /** Excel-like ASC/DESC sorting for every data column in journal tables. */
    function sortJournalTableByColumn(table, columnIndex, header) {
        const tbody = table?.tBodies?.[0];
        if (!tbody) return;
        const rows = Array.from(tbody.rows).filter(row => !row.querySelector('.text-muted[colspan]') && row.cells.length > columnIndex);
        if (rows.length < 2) return;
        const currentColumn = Number(table.dataset.sortColumn ?? -1);
        const nextDirection = currentColumn === columnIndex && table.dataset.sortDirection === 'asc' ? 'desc' : 'asc';
        rows.sort((a, b) => {
            const av = getSortableCellValue(a.cells[columnIndex]);
            const bv = getSortableCellValue(b.cells[columnIndex]);
            let result;
            if (av.type === 'number' && bv.type === 'number') result = av.value - bv.value;
            else result = String(av.value).localeCompare(String(bv.value), 'uk', { numeric: true, sensitivity: 'base' });
            return nextDirection === 'asc' ? result : -result;
        });
        rows.forEach(row => tbody.appendChild(row));
        table.dataset.sortColumn = String(columnIndex);
        table.dataset.sortDirection = nextDirection;
        table.querySelectorAll('th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
        header.classList.add(nextDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }

    document.getElementById('contracts-sub-journal')?.addEventListener('click', event => {
        const header = event.target.closest('.sortable-table th');
        if (!header || header.dataset.sortDisabled === 'true') return;
        const table = header.closest('table');
        const headers = Array.from(header.parentElement.children);
        sortJournalTableByColumn(table, headers.indexOf(header), header);
    });

    function renderJournalAnalytics() {
        const allEntries = getStoredJournalEntries();
        updateJournalSearchSuggestions(allEntries);
        const filteredEntries = filterJournalEntries(allEntries);
        const { start, end } = getActivePeriodRange();
        const rangeText = formatDateRangeLabel(start, end);
        const fullPeriodLabel = `${getPeriodName()}: ${rangeText}`;
        if (activePeriodLabel) activePeriodLabel.textContent = fullPeriodLabel;
        document.querySelectorAll('[data-period-label]').forEach(el => el.textContent = fullPeriodLabel);

        let paidPayouts = 0;
        let duePayouts = 0;
        filteredEntries.forEach(item => {
            (item.participants || []).forEach(nick => {
                const payout = Number(item.payoutPerPerson || 0);
                if (getPlayerPaidState(item, nick)) paidPayouts += payout;
                else duePayouts += payout;
            });
        });

        document.getElementById('stat-paid-payouts').textContent = `$ ${paidPayouts.toLocaleString()}`;
        document.getElementById('stat-due-payouts').textContent = `$ ${duePayouts.toLocaleString()}`;
        document.getElementById('stat-total-contracts').textContent = `${filteredEntries.length} шт`;

        // Build matrix columns from the actual journal rows in the active period.
        // Normalize whitespace so the same contract cannot split into duplicate columns,
        // then keep levels grouped in natural order: Base I, Base II, Base III, etc.
        const contractNames = Array.from(new Set(
            filteredEntries
                .map(item => String(item.contractName || '').replace(/\s+/g, ' ').trim())
                .filter(Boolean)
        )).sort(compareContractNames);

        // Matrix accounting must be derived from the actual participant count, not from a stale
        // saved share value. One contract is always split equally: 1 player = 1, 2 = 0.5, 3 = 0.33.
        // This also repairs older rows where Contract Share was accidentally stored as 1.
        const getMatrixShare = item => {
            const participants = Array.isArray(item.participants) ? item.participants.filter(Boolean) : [];
            if (participants.length > 0) return 1 / participants.length;
            const storedShare = Number(item.sharePerPerson || 0);
            return Number.isFinite(storedShare) && storedShare > 0 ? storedShare : 0;
        };

        const matrixPlayers = {};
        filteredEntries.forEach(item => {
            const participants = item.participants || [];
            const share = getMatrixShare(item);
            participants.forEach(nick => {
                if (!matrixPlayers[nick]) matrixPlayers[nick] = { total: 0, money: 0, byContract: {} };
                matrixPlayers[nick].byContract[item.contractName] = (matrixPlayers[nick].byContract[item.contractName] || 0) + share;
                matrixPlayers[nick].total += share;
                matrixPlayers[nick].money += Number(item.payoutPerPerson || 0);
            });
        });

        const matrixHead = document.getElementById('contract-matrix-head');
        const matrixBody = document.getElementById('contract-matrix-body');
        if (matrixHead && matrixBody) {
            matrixHead.innerHTML = `<tr><th>Нікнейм</th>${contractNames.map(name => `<th>${name}</th>`).join('')}<th>Всього</th><th class="matrix-money">Сума гравця ($)</th></tr>`;
            const rows = Object.entries(matrixPlayers).sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]));
            matrixBody.innerHTML = rows.length ? rows.map(([nick, data]) => `
                <tr><td><strong>${nick}</strong></td>${contractNames.map(name => `<td>${data.byContract[name] ? formatContractShare(data.byContract[name]) : '-'}</td>`).join('')}<td class="matrix-total"><strong>${formatContractShare(data.total)}</strong></td><td class="matrix-money"><strong>$ ${Math.round(data.money).toLocaleString()}</strong></td></tr>
            `).join('') : `<tr><td colspan="${contractNames.length + 3}" class="text-center text-muted">За обраний період даних немає.</td></tr>`;
        }

        const memberSummaryMap = {};
        filteredEntries.forEach(item => {
            const participants = item.participants || [];
            participants.forEach(nick => {
                if (!memberSummaryMap[nick]) memberSummaryMap[nick] = { nickname: nick, contractsCount: 0, accrued: 0, paid: 0, due: 0 };
                const payout = Number(item.payoutPerPerson || 0);
                memberSummaryMap[nick].contractsCount += getMatrixShare(item);
                memberSummaryMap[nick].accrued += payout;
                if (getPlayerPaidState(item, nick)) memberSummaryMap[nick].paid += payout;
                else memberSummaryMap[nick].due += payout;
            });
        });

        const summaryTbody = document.getElementById('summary-payouts-tbody');
        if (summaryTbody) {
            const membersList = Object.values(memberSummaryMap).sort((a, b) => b.due - a.due || b.accrued - a.accrued);
            summaryTbody.innerHTML = membersList.length ? '' : '<tr><td colspan="4" class="text-center text-muted">За обраний період даних немає.</td></tr>';
            membersList.forEach(m => {
                const fullyPaid = m.due < 0.01;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${m.nickname}</strong></td>
                    <td><span class="badge-nick">${formatContractShare(m.contractsCount)}</span></td>
                    <td class="payout-due"><strong>$ ${m.due.toLocaleString()}</strong></td>
                    <td><label class="paid-toggle"><input type="checkbox" class="player-period-paid" data-nick="${m.nickname}" ${fullyPaid ? 'checked' : ''}><span>${fullyPaid ? 'Виплачено' : 'Позначити виплаченим'}</span></label></td>`;
                summaryTbody.appendChild(tr);
            });
            summaryTbody.querySelectorAll('.player-period-paid').forEach(checkbox => checkbox.addEventListener('change', () => {
                const nick = checkbox.getAttribute('data-nick');
                const ids = new Set(filteredEntries.filter(entry => (entry.participants || []).includes(nick)).map(entry => entry.id));
                const next = getStoredJournalEntries().map(entry => ids.has(entry.id)
                    ? { ...entry, paidByPlayer: { ...(entry.paidByPlayer || {}), [nick]: checkbox.checked } }
                    : entry);
                saveJournalEntries(next, { label: `Зміна виплати: ${nick}` });
                renderJournalAnalytics();
            }));
        }

        if (btnMarkVisiblePlayersPaid) {
            const unpaidPlayers = Object.values(memberSummaryMap).filter(m => m.due > 0.01);
            btnMarkVisiblePlayersPaid.disabled = unpaidPlayers.length === 0;
            btnMarkVisiblePlayersPaid.onclick = () => {
                if (!unpaidPlayers.length) return;
                if (!confirm(`Позначити виплаченими премії для всіх гравців (${unpaidPlayers.length}) за обраний період?`)) return;
                const visibleNicks = new Set(unpaidPlayers.map(player => player.nickname));
                const visibleIds = new Set(filteredEntries.map(entry => entry.id));
                const next = getStoredJournalEntries().map(entry => {
                    if (!visibleIds.has(entry.id)) return entry;
                    const paidByPlayer = { ...(entry.paidByPlayer || {}) };
                    (entry.participants || []).forEach(nick => { if (visibleNicks.has(nick)) paidByPlayer[nick] = true; });
                    return { ...entry, paidByPlayer };
                });
                saveJournalEntries(next, { label: 'Позначено всіх гравців виплаченими' });
                renderJournalAnalytics();
                showContractToast('Усіх гравців за обраний період позначено виплаченими');
            };
        }

        const payoutRows = Object.values(memberSummaryMap).filter(m => m.due > 0.01).sort((a,b) => b.due-a.due || a.nickname.localeCompare(b.nickname));
        const payoutBody = document.getElementById('payout-handoff-tbody');
        const payoutTotal = document.getElementById('payout-handoff-total');
        if (payoutBody) payoutBody.innerHTML = payoutRows.length ? payoutRows.map(m => `<tr><td><strong>${m.nickname}</strong></td><td class="payout-due"><strong>$ ${m.due.toLocaleString()}</strong></td></tr>`).join('') : '<tr><td colspan="2" class="text-center text-muted">Немає невиплачених премій.</td></tr>';
        if (payoutTotal) payoutTotal.textContent = `$ ${payoutRows.reduce((sum,m)=>sum+m.due,0).toLocaleString()}`;

        // Contract value reference. Never invent values: use only values present in stored screenshot-derived entries.
        const contractValuesBody = document.getElementById('contract-values-tbody');
        if (contractValuesBody) {
            const valuesMap = new Map();
            filteredEntries.forEach(item => {
                if (!item.contractName) return;
                const key = item.contractName;
                if (!valuesMap.has(key)) valuesMap.set(key, { name: key, compensation: Number(item.compensation || 0), count: 0 });
                const value = valuesMap.get(key);
                value.count += 1;
                // Keep the latest non-zero screenshot-derived value when older OCR records were incomplete.
                if (Number(item.compensation || 0) > 0) value.compensation = Number(item.compensation);
            });
            const rows = [...valuesMap.values()].sort((a, b) => compareContractNames(a.name, b.name));
            contractValuesBody.innerHTML = rows.length ? rows.map(v => `<tr><td><strong>${v.name}</strong></td><td>${v.compensation ? '$ ' + v.compensation.toLocaleString() : '-'}</td><td>${v.count}</td></tr>`).join('') : `<tr><td colspan="3" class="text-center text-muted">Дані з'являться після додавання реальних контрактів зі скріншотів.</td></tr>`;
        }

        const historyTbody = document.getElementById('history-contracts-tbody');
        if (historyTbody) {
            historyTbody.innerHTML = '';
            // Full journal default order: newest completed contract first.
            // Keep this independent from storage order so remote/local sync cannot change the visible order.
            const historyEntries = [...filteredEntries].sort((a, b) => {
                const aTime = new Date(a.completedAt || a.timestamp || a.isoDate).getTime();
                const bTime = new Date(b.completedAt || b.timestamp || b.isoDate).getTime();
                return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
            });
            const historyTable = document.getElementById('history-contracts-table');
            if (historyTable) {
                historyTable.dataset.sortColumn = '0';
                historyTable.dataset.sortDirection = 'desc';
                historyTable.querySelectorAll('th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
                historyTable.querySelector('th:first-child')?.classList.add('sort-desc');
            }
            if (!historyEntries.length) {
                historyTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Журнал порожній або немає збігів за фільтром.</td></tr>';
            } else {
                historyEntries.forEach(item => {
                    const participants = item.participants || [];
                    const paidCount = participants.filter(nick => getPlayerPaidState(item, nick)).length;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><span class="text-muted">${formatJournalDate(item.completedAt || item.timestamp || item.isoDate)}</span></td>
                        <td><strong>${item.contractName}</strong></td>
                        <td>${participants.map(nick => `<span class="badge-nick">${nick}</span>`).join(' ') || '<span class="text-muted">Немає</span>'}</td>
                        <td><strong>${formatContractShare(item.sharePerPerson || (participants.length ? 1 / participants.length : 0))}</strong></td>
                        <td class="highlight-green"><strong>$ ${Number(item.payoutPerPerson || 0).toLocaleString()}</strong></td>
                        <td><span class="${paidCount === participants.length && participants.length ? 'payment-paid' : 'payment-pending'}">${paidCount}/${participants.length} випл.</span></td>
                                                <td><button class="btn-danger-sm btn-delete-journal-entry" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button></td>`;
                    historyTbody.appendChild(tr);
                });
                historyTbody.querySelectorAll('.btn-delete-journal-entry').forEach(btn => btn.addEventListener('click', () => {
                    if (!confirm('Видалити цей запис з журналу?')) return;
                    saveJournalEntries(getStoredJournalEntries().filter(entry => entry.id !== btn.getAttribute('data-id')), { label: 'Видалення контракту' });
                    renderJournalAnalytics();
                }));
            }
        }
    }

    async function copyTextReliable(text) {
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) { /* Fall through to execCommand for HTTP/mobile edge cases. */ }
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        let copied = false;
        try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
        textarea.remove();
        return copied;
    }

    const btnCopyPayoutReport = document.getElementById('btn-copy-payout-report');
    if (btnCopyPayoutReport) btnCopyPayoutReport.addEventListener('click', async () => {
        const filteredEntries = filterJournalEntries(getStoredJournalEntries());
        const map = {};
        filteredEntries.forEach(item => (item.participants || []).forEach(nick => {
            if (getPlayerPaidState(item,nick)) return;
            map[nick] = (map[nick] || 0) + Number(item.payoutPerPerson || 0);
        }));
        const rows = Object.entries(map).sort((a,b)=>b[1]-a[1]);
        const {start,end}=getActivePeriodRange();
        const period = `${getPeriodName()}: ${formatDateRangeLabel(start,end)}`;
        const total=rows.reduce((sum,[,v])=>sum+v,0);
        const text=[`ПЕРІОД: ${period}`, '', ...rows.map(([nick,sum])=>`${nick} - $ ${sum.toLocaleString()}`), '', `ВСЬОГО: $ ${total.toLocaleString()}`].join('\n');
        const copied = await copyTextReliable(text);
        if (copied) alert('Звіт для видачі премій скопійовано разом із періодом.');
        else window.prompt('Не вдалося автоматично скопіювати. Скопіюйте звіт вручну:', text);
    });

    if (markAllPaidCheckbox) {
        markAllPaidCheckbox.addEventListener('change', () => {
            if (!markAllPaidCheckbox.checked) return;
            const filteredEntries = filterJournalEntries(getStoredJournalEntries());
            if (!filteredEntries.length) {
                markAllPaidCheckbox.checked = false;
                return;
            }
            if (!confirm('Позначити всі премії за обраний період як виплачені?')) {
                markAllPaidCheckbox.checked = false;
                return;
            }
            const ids = new Set(filteredEntries.map(entry => entry.id));
            const next = getStoredJournalEntries().map(entry => ids.has(entry.id)
                ? { ...entry, paidByPlayer: Object.fromEntries((entry.participants || []).map(nick => [nick, true])) }
                : entry);
            saveJournalEntries(next, { label: 'Усі виплати за період' });
            renderJournalAnalytics();
            markAllPaidCheckbox.checked = false;
            showContractToast('Усі виплати за період позначено виплаченими');
        });
    }

    function createDemoEntries() {
        const now = new Date();
        const currentMonday = startOfWeekMonday(now);
        const previousMonday = new Date(currentMonday); previousMonday.setDate(previousMonday.getDate() - 7);
        const contracts = [
            ['Продаж трофеїв I', 175000, 160, 130], ['Продаж трофеїв II', 140000, 150, 130],
            ["Переробка м'яса III", 270000, 280, 190], ['Полювання III', 220000, 210, 170], ['Грибний збір II', 120000, 110, 90]
        ];
        const groups = [
            ['Tony Greatness'], ['NIGHT Hunt'], ['Kirill Greatness'], ['Kate Greatness', 'Oleksii Otaman'],
            ['Danil Greatness', 'Pablo Greatness', 'Alex Greatness'], ['Cash Greatness', 'Miles Greatness'],
            ['Ares Greatness'], ['Ray Greatness', 'Roma Poltos']
        ];
        return Array.from({ length: 20 }, (_, i) => {
            let date;
            if (i < 9) { date = new Date(currentMonday); date.setDate(currentMonday.getDate() + (i % 5)); }
            else if (i < 15) { date = new Date(previousMonday); date.setDate(previousMonday.getDate() + (i % 6)); }
            else if (i < 18) { date = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 12 - (i - 15)), 20, 10); }
            else { date = new Date(now.getFullYear(), now.getMonth() - 1, 12 + (i - 18), 20, 10); }
            date.setHours(18 + (i % 4), 5 + i, 0, 0);
            const [contractName, compensation, reputation, experience] = contracts[i % contracts.length];
            const participants = groups[i % groups.length];
            const count = participants.length;
            return {
                id: `demo_${i + 1}`,
                dateStr: date.toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'long' }).replace(',', ''),
                completedAt: date.toISOString(), isoDate: date.toISOString(), contractName, compensation, reputation, experience,
                participants: [...participants], participantCount: count, sharePerPerson: 1 / count,
                payoutPerPerson: roundMoney(compensation / count), paidByPlayer: Object.fromEntries(participants.map(nick => [nick, i % 4 === 0])),
                timestamp: date.getTime(), source: 'demo'
            };
        });
    }

    function seedDemoEntries(force = false, skipUndo = false) {
        const current = getStoredJournalEntries();
        if (!force && current.length > 0) return;
        const demos = createDemoEntries();
        saveJournalEntries(force ? [...demos, ...current.filter(entry => !String(entry.id).startsWith('demo_'))] : demos, { skipUndo, label: 'Додано тестові записи' });
        localStorage.setItem(DEMO_SEED_STORAGE_KEY, '1');
        renderJournalAnalytics();
    }

    if (btnSeedDemo) btnSeedDemo.addEventListener('click', () => { seedDemoEntries(true); showContractToast('Додано 20 тестових контрактів'); });
    // Demo rows are now explicit only. Never auto-seed a shared Google Sheet.

    // --- EXPORT TO GOOGLE DOCS / DISCORD TEXT COPY ---
    const btnCopyGdocs = document.getElementById('btn-copy-gdocs');
    if (btnCopyGdocs) {
        btnCopyGdocs.addEventListener('click', () => {
            const allEntries = getStoredJournalEntries();
            const filteredEntries = filterJournalEntries(allEntries);

            if (filteredEntries.length === 0) {
                alert('Немає даних для експорту.');
                return;
            }

                let totalPayouts = 0;
            const memberSummaryMap = {};

            filteredEntries.forEach(item => {
                totalCompensation += item.compensation;
                totalPayouts += (item.payoutPerPerson * item.participants.length);

                item.participants.forEach(nick => {
                    if (!memberSummaryMap[nick]) {
                        memberSummaryMap[nick] = { contracts: 0, payout: 0 };
                    }
                    memberSummaryMap[nick].contracts += item.sharePerPerson || (1 / item.participants.length);
                    memberSummaryMap[nick].payout += item.payoutPerPerson;
                });
            });

            const dateToday = new Date().toLocaleDateString('uk-UA');

            let docText = `===========================================\n`;
            docText += `📊 ЗВІТ ПО КОНТРАКТАХ ТК GREATNESS LOGISTICS\n`;
            docText += `Дата створення: ${dateToday} | Записів: ${filteredEntries.length} шт.\n`;
            docText += `===========================================\n\n`;

            docText += `💰 Загальна компенсація: $ ${totalCompensation.toLocaleString()}\n`;
            docText += `💵 Виплачено премій: $ ${totalPayouts.toLocaleString()}\n`;
            docText += `\n`;

            docText += `-------------------------------------------\n`;
            docText += `👥 ЗВОДКА ВИПЛАТ ПО УЧАСНИКАХ:\n`;
            docText += `-------------------------------------------\n`;

            const membersList = Object.entries(memberSummaryMap).sort((a, b) => b[1].payout - a[1].payout);
            membersList.forEach(([nick, stats], idx) => {
                docText += `${idx + 1}. ${nick} — ${formatContractShare(stats.contracts)} контр. | Премія: $ ${stats.payout.toLocaleString()}\n`;
            });

            docText += `\n-------------------------------------------\n`;
            docText += `📋 ДЕТАЛЬНИЙ СПИСОК КОНТРАКТІВ:\n`;
            docText += `-------------------------------------------\n`;

            filteredEntries.forEach((item, idx) => {
                docText += `${idx + 1}. [${item.dateStr}] ${item.contractName} — $ ${item.compensation.toLocaleString()} | Учасники: ${item.participants.join(', ') || 'Немає'} (Премія: $ ${item.payoutPerPerson.toLocaleString()})\n`;
            });

            docText += `\n===========================================`;

            navigator.clipboard.writeText(docText).then(() => {
                alert('Звіт успішно скопійовано у буфер обміну! Тепер ви можете вставити його в Google Docs або Discord (Ctrl+V).');
            }).catch(err => {
                console.error('Clipboard copy failed:', err);
                prompt('Скопіюйте звіт вручну:', docText);
            });
        });
    }

    // --- EXPORT TO CSV (FOR GOOGLE SHEETS / EXCEL) ---
    const btnExportCsv = document.getElementById('btn-export-csv');
    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => {
            const allEntries = getStoredJournalEntries();
            const filteredEntries = filterJournalEntries(allEntries);

            if (filteredEntries.length === 0) {
                alert('Немає даних для експорту.');
                return;
            }

            // One row per player is easier to aggregate in Google Sheets.
            let csvContent = "\uFEFF";
            csvContent += "Дата й час;Нікнейм;Контракт;Частка контракту;Загальна компенсація ($);Премія гравця ($);Кількість учасників;Усі учасники\n";

            filteredEntries.forEach(item => {
                const participantCount = item.participants.length || 1;
                const share = item.sharePerPerson || (1 / participantCount);
                item.participants.forEach(nick => {
                    const participantsStr = `"${item.participants.join(', ')}"`;
                    csvContent += `"${item.dateStr}";"${nick}";"${item.contractName}";${share};${item.compensation};${item.payoutPerPerson};${participantCount};${participantsStr}\n`;
                });
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `greatness_contracts_report_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }


    // --- SHARED GOOGLE SHEETS DATABASE ---
    // The Apps Script deployment is embedded in the site. Visitors never need
    // direct access to the spreadsheet or a Google sign-in.
    const btnRefreshGoogleSheet = document.getElementById('btn-refresh-google-sheet');
    const btnMigrateLocalToGoogle = document.getElementById('btn-migrate-local-to-google');

    btnRefreshGoogleSheet?.addEventListener('click', () => {
        setSheetStatus('syncing', 'Оновлення даних з Google Sheets...');
        loadJournalFromGoogleSheet().catch(error => console.error('Google Sheets refresh failed:', error));
    });

    btnMigrateLocalToGoogle?.addEventListener('click', async () => {
        const cached = getStoredJournalEntries();
        if (!cached.length) {
            alert('У локальному кеші немає записів для перенесення.');
            return;
        }
        if (!confirm(`Перенести ${cached.length} локальних записів у спільну Google Sheet? Поточні записи в таблиці буде замінено.`)) return;
        await syncJournalToGoogleSheet(cached);
        showContractToast(`Надіслано ${cached.length} записів у Google Sheets`);
    });

    // Render cache immediately. Auth change event will load authoritative data
    // only for users whose server-side role is contracts/admin.
    renderJournalAnalytics();
    if (canAccessContracts()) {
        refreshContractsAccess().catch(error => console.warn('Protected contracts init failed:', error));
    } else {
        setSheetStatus('offline', 'Потрібна авторизація');
    }



};
