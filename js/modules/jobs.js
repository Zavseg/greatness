/**
 * Interactive jobs catalog and job detail rendering.
 *
 * This module owns only the DOM behavior for its feature area. Keeping feature
 * logic isolated makes the site easier to debug and change without touching
 * unrelated functionality.
 */
window.GreatnessApp = window.GreatnessApp || {};

window.GreatnessApp.initJobsCatalog = function initJobsCatalog() {
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
        if (jobKey !== 'trucker') {
            jobDetailsPanel.innerHTML = `
                <div class="job-detail-content" style="text-align: center; padding: 60px 20px;">
                    <div class="dev-icon" style="font-size: 56px; color: var(--accent-yellow); margin-bottom: 24px;">
                        <i class="fa-solid fa-screwdriver-wrench"></i>
                    </div>
                    <h3 style="font-size: 26px; margin-bottom: 16px;">Розділ в розробці</h3>
                    <p style="color: var(--text-secondary); line-height: 1.6; max-width: 440px; margin: 0 auto;">
                        Детальний опис цієї вакансії, корисні поради та інтеграція з калькулятором наразі знаходяться в розробці.
                    </p>
                </div>
            `;
            return;
        }

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

                    <h4>Поради від компанії:</h4>
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
};
