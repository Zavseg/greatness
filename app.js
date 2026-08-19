/**
 * ==========================================================================
 * INTERACTIVE CONTROLLER - GREATNESS FAMILY WEB PORTAL
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SINGLE-PAGE APP NAVIGATION / TABS ---
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const logoBtn = document.getElementById('logo-btn');
    const burgerMenu = document.getElementById('burger-menu');
    const navMenu = document.getElementById('nav-menu');

    function switchTab(tabId) {
        // Remove active class from all links and sections
        navLinks.forEach(link => link.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Add active to the target
        const targetLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
        const targetContent = document.getElementById(tabId);

        if (targetLink && targetContent) {
            targetLink.classList.add('active');
            targetContent.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Close mobile menu if open
        burgerMenu.classList.remove('active');
        navMenu.classList.remove('active');
    }

    // Nav Links Event Listener
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');
            switchTab(tabId);
            window.location.hash = tabId;
        });
    });

    // Logo Click returns to Home
    logoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('home');
        window.location.hash = 'home';
    });

    // Initial load tab checker (based on hash)
    const initialHash = window.location.hash.substring(1);
    if (initialHash) {
        switchTab(initialHash);
    } else {
        switchTab('home');
    }

    // --- 2. MOBILE MENU BURGER TOGGLE ---
    burgerMenu.addEventListener('click', () => {
        burgerMenu.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!burgerMenu.contains(e.target) && !navMenu.contains(e.target)) {
            burgerMenu.classList.remove('active');
            navMenu.classList.remove('active');
        }
    });


    // --- 3. TRANSPORT COMPANY (TC) FLEET SLIDER ---
    const slides = document.querySelectorAll('#fleet-slider .slide');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    const dotsContainer = document.getElementById('slider-dots');
    let currentSlide = 0;
    let slideInterval;

    // Generate dots dynamically based on slides count
    dotsContainer.innerHTML = '';
    slides.forEach((_, idx) => {
        const dot = document.createElement('span');
        dot.classList.add('dot');
        if (idx === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(idx));
        dotsContainer.appendChild(dot);
    });

    const dots = document.querySelectorAll('#slider-dots .dot');

    function updateSlider() {
        const slider = document.getElementById('fleet-slider');
        slider.style.transform = `translateX(-${currentSlide * 100}%)`;
        
        // Update dots active class
        dots.forEach((dot, idx) => {
            if (idx === currentSlide) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function goToSlide(index) {
        currentSlide = index;
        updateSlider();
        resetTimer();
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        updateSlider();
    }

    function prevSlide() {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        updateSlider();
    }

    if (nextBtn && prevBtn) {
        nextBtn.addEventListener('click', () => {
            nextSlide();
            resetTimer();
        });
        prevBtn.addEventListener('click', () => {
            prevSlide();
            resetTimer();
        });
    }

    function startTimer() {
        slideInterval = setInterval(nextSlide, 4000);
    }

    function resetTimer() {
        clearInterval(slideInterval);
        startTimer();
    }

    // Start auto slider
    if (slides.length > 0) {
        startTimer();
    }


    // --- 4. JOBS CATALOG INTERACTIVE SYSTEM ---
    const jobsData = {
        trucker: {
            category: "Транспорт / Логістика",
            title: "Далекобійник (ТК GREATNESS LOGISTICS)",
            level: "4 рівень",
            license: "Категорія C",
            income: "350,000 - 550,000 UAH/год",
            difficulty: "Середня (довгі поїздки)",
            iconClass: "fa-solid fa-truck",
            desc: "Далекобійник — одна з найбільш прибуткових робіт у грі. Ви отримуєте замовлення на перевезення вантажів між містами на вантажівках ТК. Зарплата напряму залежить від відстані та ваги вантажу. Працюючи в ТК GREATNESS LOGISTICS, ви отримуєте величезні бонуси до заробітку.",
            tips: [
                "Орендуйте Steelbilt 389 або Ceterpilort ST680 з великим багажником для отримання максимального прибутку.",
                "Плануйте маршрут уникаючи заторів біля постів, щоб економити час.",
                "Працюйте стабільно та оновлюйте кваліфікацію в логістичному центрі, щоб брати дорожчі замовлення."
            ]
        },
        bus: {
            category: "Громадський транспорт",
            title: "Водій автобуса",
            level: "2 рівень",
            license: "Категорія D",
            income: "60,000 - 90,000 UAH/год",
            difficulty: "Низька (циклічний маршрут)",
            iconClass: "fa-solid fa-bus",
            desc: "Водій автобуса — чудова стартова робота. Ви будете перевозити пасажирів за встановленими маршрутами в межах міст. Робота спокійна, вимагає лише акуратного водіння за чекпоінтами.",
            tips: [
                "Завжди обирайте міські маршрути з багатьма зупинками для максимального досвіду.",
                "Уникайте ДТП — штрафи за пошкодження автобуса списуються з вашої зарплати.",
                "Намагайтеся працювати у години пік, коли трафік пасажирів більший."
            ]
        },
        builder: {
            category: "Будівництво",
            title: "Будівельник",
            level: "1 рівень",
            license: "Не потрібно",
            income: "45,000 - 70,000 UAH/год",
            difficulty: "Низька (міні-ігри)",
            iconClass: "fa-solid fa-helmet-safety",
            desc: "Робота будівельника доступна відразу після прибуття в область. Ви будете переносити мішки з цементом, розвантажувати цеглу та виконувати прості механічні дії на будівельному майданчику.",
            tips: [
                "Швидко виконуйте QTE міні-ігри — успішні дії без помилок дають бонус до швидкості роботи.",
                "Не розмовляйте під час перенесення мішків, щоб не збивати анімацію бігу.",
                "Це найкраща робота для перших годин гри, щоб назбирати на перші права."
            ]
        },
        lumberjack: {
            category: "Видобуток ресурсів",
            title: "Дроворуб",
            level: "1 рівень",
            license: "Не потрібно",
            income: "50,000 - 80,000 UAH/год",
            difficulty: "Низька (активна робота)",
            iconClass: "fa-solid fa-tree",
            desc: "Робота дроворуба полягає у вирубці дерев у лісництві, розпилюванні колод та навантаженні їх у спецтранспорт. Вимагає бігу та швидких кліків.",
            tips: [
                "Купіть власну покращену сокиру в магазині інструментів — це пришвидшить вирубку на 30%.",
                "Працюйте поблизу точок здачі колод, щоб не витрачати час на біг через весь ліс.",
                "Здавайте ресурси оптом, коли скупник пропонує вищі ціни."
            ]
        },
        collector: {
            category: "Фінанси / Безпека",
            title: "Інкасатор",
            level: "5 рівень",
            license: "Категорія C, Ліцензія на зброю",
            income: "180,000 - 300,000 UAH/год",
            difficulty: "Висока (ризик нападу)",
            iconClass: "fa-solid fa-vault",
            desc: "Інкасатори перевозять великі суми грошей між банкоматами та відділеннями банків. Робота є престижною, але небезпечною, оскільки інші угруповання можуть спробувати вчинити напад для пограбування.",
            tips: [
                "Завжди працюйте в парі з напарником (бажано з нашої сім'ї) для прикриття та прискорення завантаження.",
                "Тримайте зброю напоготові та стежте за підозрілими авто на хвості.",
                "У разі нападу негайно повідомляйте в рацію сім'ї — наш старший склад швидко приїде на допомогу."
            ]
        }
    };

    const jobButtons = document.querySelectorAll('.job-menu-btn');
    const jobDetailsPanel = document.getElementById('job-details');

    function renderJobDetails(jobKey) {
        const job = jobsData[jobKey];
        if (!job) return;

        let tipsHtml = job.tips.map(tip => `<li><i class="fa-solid fa-lightbulb text-accent-yellow"></i> ${tip}</li>`).join('');

        jobDetailsPanel.innerHTML = `
            <div class="job-detail-content">
                <div class="job-detail-header">
                    <div class="job-icon-large"><i class="${job.iconClass}"></i></div>
                    <div>
                        <span class="job-tag-category">${job.category}</span>
                        <h3>${job.title}</h3>
                    </div>
                </div>
                
                <div class="job-meta-grid">
                    <div class="meta-item">
                        <span class="meta-lbl">Необхідний рівень:</span>
                        <span class="meta-val">${job.level}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-lbl">Ліцензії:</span>
                        <span class="meta-val">${job.license}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-lbl">Середній дохід:</span>
                        <span class="meta-val highlight-green">${job.income}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-lbl">Складність:</span>
                        <span class="meta-val">${job.difficulty}</span>
                    </div>
                </div>

                <div class="job-description-block">
                    <h4>Опис роботи:</h4>
                    <p>${job.desc}</p>
                    
                    <h4>Поради від сім'ї:</h4>
                    <ul class="tips-list">
                        ${tipsHtml}
                    </ul>
                </div>
            </div>
        `;
    }

    jobButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            jobButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const jobKey = btn.getAttribute('data-job');
            
            // Add subtle fade-out/fade-in animation
            jobDetailsPanel.style.opacity = '0';
            jobDetailsPanel.style.transform = 'translateY(5px)';
            setTimeout(() => {
                renderJobDetails(jobKey);
                jobDetailsPanel.style.opacity = '1';
                jobDetailsPanel.style.transform = 'translateY(0)';
            }, 150);
        });
    });


    // --- 5. VEHICLE FLEET FILTER ---
    const filterButtons = document.querySelectorAll('.filter-btn');
    const carCards = document.querySelectorAll('.car-card');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filterValue = btn.getAttribute('data-filter');

            carCards.forEach(card => {
                const category = card.getAttribute('data-category');
                
                // Reset card styling
                card.style.display = 'none';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.95)';

                if (filterValue === 'all' || category === filterValue) {
                    // Show matching cards with transition delay
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'scale(1)';
                    }, 50);
                }
            });
        });
    });


    // --- 6. PRICE DATABASE & PROFIT CALCULATOR ---
    const priceData = {
        veg: [
            { id: "potato", name: "Картопля", price: 120, unit: "кг" },
            { id: "tomato", name: "Томати", price: 180, unit: "кг" },
            { id: "cabbage", name: "Капуста", price: 90, unit: "кг" },
            { id: "onion", name: "Цибуля", price: 110, unit: "кг" },
            { id: "carrot", name: "Морква", price: 100, unit: "кг" },
            { id: "beet", name: "Буряк", price: 95, unit: "кг" }
        ],
        mushrooms: [
            { id: "porcini", name: "Білий гриб", price: 450, unit: "шт" },
            { id: "boletus", name: "Підберезовик", price: 280, unit: "шт" },
            { id: "chanterelle", name: "Лисичка", price: 320, unit: "шт" },
            { id: "suillus", name: "Маслюк", price: 250, unit: "шт" },
            { id: "flyagaric", name: "Мухомор (цінний для медиків)", price: 600, unit: "шт" }
        ],
        fish: [
            { id: "carp", name: "Короп", price: 350, unit: "кг" },
            { id: "crucian", name: "Карась", price: 180, unit: "кг" },
            { id: "zander", name: "Судак", price: 500, unit: "кг" },
            { id: "catfish", name: "Сом", price: 850, unit: "кг" },
            { id: "pike", name: "Щука", price: 420, unit: "кг" },
            { id: "perch", name: "Окунь", price: 240, unit: "кг" }
        ],
        trash: [
            { id: "plastic", name: "Пластик", price: 40, unit: "шт" },
            { id: "metal", name: "Метал", price: 75, unit: "шт" },
            { id: "glass", name: "Скло", price: 30, unit: "шт" },
            { id: "paper", name: "Папір", price: 20, unit: "шт" },
            { id: "organic", name: "Органіка", price: 15, unit: "шт" }
        ],
        valuables: [
            { id: "gold_bar", name: "Золотий злиток", price: 15000, unit: "шт" },
            { id: "silver_coin", name: "Срібна монета", price: 2500, unit: "шт" },
            { id: "diamond", name: "Алмаз", price: 45000, unit: "шт" },
            { id: "antique_vase", name: "Старовинна ваза", price: 12000, unit: "шт" },
            { id: "amber", name: "Бурштин", price: 8000, unit: "шт" }
        ]
    };

    let activePriceCategory = "veg";
    const pricesTbody = document.getElementById('prices-tbody');
    const priceSearch = document.getElementById('price-search');
    const catButtons = document.querySelectorAll('.cat-btn');

    // Calculator inputs
    const calcItemSelect = document.getElementById('calc-item-select');
    const calcQuantity = document.getElementById('calc-quantity');
    const calcVip = document.getElementById('calc-vip');
    const calcFamilyPerk = document.getElementById('calc-family-perk');

    // Calculator outputs
    const resBase = document.getElementById('res-base');
    const resBonus = document.getElementById('res-bonus');
    const resTotal = document.getElementById('res-total');

    // Flatten all items for the calculator dropdown
    const allItems = [];
    Object.keys(priceData).forEach(cat => {
        priceData[cat].forEach(item => {
            allItems.push({ ...item, category: cat });
        });
    });

    // Populate calculator dropdown
    function populateCalcDropdown() {
        calcItemSelect.innerHTML = '';
        allItems.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = `${item.name} (${item.price} UAH / ${item.unit})`;
            calcItemSelect.appendChild(opt);
        });
    }

    // Calculate profit function
    function calculateProfit() {
        const selectedId = calcItemSelect.value;
        const item = allItems.find(i => i.id === selectedId);
        if (!item) return;

        const quantity = parseFloat(calcQuantity.value) || 0;
        const basePrice = item.price * quantity;
        
        let multiplier = 1.0;
        let bonusPercentage = 0;
        
        if (calcVip.checked) {
            multiplier += 0.15;
            bonusPercentage += 15;
        }
        if (calcFamilyPerk.checked) {
            multiplier += 0.10;
            bonusPercentage += 10;
        }

        const totalPrice = basePrice * multiplier;
        const bonusPrice = totalPrice - basePrice;

        // Render values
        resBase.textContent = `${basePrice.toLocaleString()} UAH`;
        resBonus.textContent = `+${bonusPrice.toLocaleString()} UAH (${bonusPercentage}%)`;
        resTotal.textContent = `${totalPrice.toLocaleString()} UAH`;
    }

    // Set calc values & focus
    function loadIntoCalculator(itemId) {
        calcItemSelect.value = itemId;
        calculateProfit();
        
        // Scroll slightly to the calculator or pulse it
        const calcCard = document.querySelector('.calculator-card');
        calcCard.classList.add('pulse-glow');
        setTimeout(() => {
            calcCard.classList.remove('pulse-glow');
        }, 1000);
    }

    // Render price table
    function renderPriceTable(category, searchQuery = "") {
        pricesTbody.innerHTML = '';
        const items = priceData[category];
        if (!items) return;

        const query = searchQuery.trim().toLowerCase();

        items.forEach(item => {
            if (query && !item.name.toLowerCase().includes(query)) return;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td class="text-accent-yellow">${item.price.toLocaleString()} UAH</td>
                <td>${item.unit}</td>
                <td><button class="btn-calc-add" data-id="${item.id}"><i class="fa-solid fa-calculator"></i> Рахувати</button></td>
            `;
            pricesTbody.appendChild(tr);
        });

        // Add event listeners to the new rows
        const calcAddButtons = pricesTbody.querySelectorAll('.btn-calc-add');
        calcAddButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.getAttribute('data-id');
                loadIntoCalculator(itemId);
            });
        });
    }

    // Price Category Switcher
    catButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            catButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activePriceCategory = btn.getAttribute('data-category');
            renderPriceTable(activePriceCategory, priceSearch.value);
        });
    });

    // Search input event
    priceSearch.addEventListener('input', () => {
        renderPriceTable(activePriceCategory, priceSearch.value);
    });

    // Calculator inputs event listeners
    calcItemSelect.addEventListener('change', calculateProfit);
    calcQuantity.addEventListener('input', calculateProfit);
    calcVip.addEventListener('change', calculateProfit);
    calcFamilyPerk.addEventListener('change', calculateProfit);

    // Init price app components
    populateCalcDropdown();
    renderPriceTable(activePriceCategory);
    calculateProfit();


    // --- 7. LIGHTBOX MODAL FOR GALLERY ---
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    let activeGalleryIdx = 0;
    const galleryImages = [];

    // Parse image elements
    galleryItems.forEach((item, index) => {
        const img = item.querySelector('.gallery-img');
        const title = item.querySelector('h4').textContent;
        const desc = item.querySelector('p').textContent;
        
        galleryImages.push({
            src: img.src,
            caption: `<strong>${title}</strong> — ${desc}`
        });

        item.addEventListener('click', () => {
            activeGalleryIdx = index;
            openLightbox(activeGalleryIdx);
        });
    });

    function openLightbox(index) {
        const item = galleryImages[index];
        if (!item) return;

        lightboxImg.src = item.src;
        lightboxCaption.innerHTML = item.caption;
        lightbox.style.display = 'flex';
    }

    function closeLightbox() {
        lightbox.style.display = 'none';
        lightboxImg.src = '';
    }

    function navLightbox(direction) {
        activeGalleryIdx = (activeGalleryIdx + direction + galleryImages.length) % galleryImages.length;
        openLightbox(activeGalleryIdx);
    }

    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }

    if (lightboxPrev && lightboxNext) {
        lightboxPrev.addEventListener('click', () => navLightbox(-1));
        lightboxNext.addEventListener('click', () => navLightbox(1));
    }

    // Close lightbox when clicking the overlay (background)
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Keyboard support for Lightbox and Tabs
    document.addEventListener('keydown', (e) => {
        if (lightbox.style.display === 'flex') {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') navLightbox(1);
            if (e.key === 'ArrowLeft') navLightbox(-1);
        }
    });

    // --- 8. EXTENDED ROSTER TOGGLE ---
    const btnToggleRoster = document.getElementById('btn-toggle-roster');
    const extendedRoster = document.getElementById('extended-roster');
    
    if (btnToggleRoster && extendedRoster) {
        btnToggleRoster.addEventListener('click', () => {
            if (extendedRoster.style.display === 'none') {
                extendedRoster.style.display = 'block';
                btnToggleRoster.innerHTML = '<i class="fa-solid fa-users-slash"></i> Приховати склад організації';
                // Smooth scroll to the newly opened list
                extendedRoster.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                extendedRoster.style.display = 'none';
                btnToggleRoster.innerHTML = '<i class="fa-solid fa-users-viewfinder"></i> Показати весь склад організації';
            }
        });
    }

});

// Add dynamic CSS class animation triggers
const style = document.createElement('style');
style.textContent = `
    @keyframes pulseGlow {
        0% { box-shadow: 0 0 15px rgba(255, 204, 0, 0.2); }
        50% { box-shadow: 0 0 30px rgba(255, 204, 0, 0.6), inset 0 0 10px rgba(255, 204, 0, 0.2); border-color: var(--accent-yellow); }
        100% { box-shadow: 0 0 15px rgba(255, 204, 0, 0.2); }
    }
    .pulse-glow {
        animation: pulseGlow 1s ease-in-out;
    }
`;
document.head.appendChild(style);
