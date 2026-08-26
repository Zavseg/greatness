# GREATNESS Contracts v1.9.18

Stable OCR from v1.9.15 plus batch journal UX, payout matrix visibility, reliable multi-card Sheets saving, and safer I/II/III catalog learning.

> Current contracts/OCR build: **v1.9.13** (Apps Script backend **1.7.6**).

# GREATNESS Family — Ukraine GTA5 Web Portal

Сучасний, адаптивний веб-сайт (сайт-візитка) для сім'ї **GREATNESS** на сервері **Ukraine GTA 5**.

Сайт розроблено з урахуванням сучасних стандартів веб-дизайну: темна тема, неонові акценти в національних кольорах України (синій та жовтий), плавні мікроанімації та повна адаптивність під мобільні пристрої.

## 🌟 Основні розділи сайту

1. **Головний екран (Hero Section)**:
   - Назва сім'ї з фірмовим ефектом світіння.
   - Кнопки для зв'язку (Discord, Telegram, Forum) та умови вступу.
   - Рейтинг сім'ї (ТОП-3) серед усіх на сервері.
   - Презентаційне фото/скріншот сім'ї.
   - **Блок Транспортної Компанії (ТК GREATNESS)**: рівень (5 MAX), діючі бонуси, очікуваний заробіток за годину, галерея автопарку ТК та умови працевлаштування.

2. **Категорія "Сім'я"**:
   - Інформація про історію та цілі сім'ї.
   - Детальні вимоги та правила для новачків.
   - Інтерактивний склад сім'ї (Керівництво, Заступники, Старший склад та Учасники).

3. **Категорія "Робота"**:
   - Загальний огляд прибуткових робіт на сервері Ukraine GTA.
   - Опис та вимоги для популярних робіт (Далекобійник, Водій автобуса, Будівельник, Дроворуб, Інкасатор тощо).

4. **Категорія "Автопарк"**:
   - Перегляд автотранспорту сім'ї, розділеного на категорії: **Легкові** та **Вантажні / Спецтранспорт**.
   - Характеристики автомобілів (швидкість, місткість багажника, ціна оренди/використання).

5. **Категорія "Скупники (Ціни)"**:
   - База актуальних цін на товари у скупників: Овочі, Гриби, Риба, Сміття, Цінні товари.
   - Зручний **Калькулятор прибутку**: введіть кількість товару і відразу дізнайтеся суму заробітку в гривнях (UAH).

6. **Галерея (Скріншоти)**:
   - Фотогалерея життя сім'ї, спільних сходів та розваг з можливістю повноекранного перегляду (Lightbox).

## 🛠️ Технологічний стек

- **HTML5**: Семантична та SEO-оптимізована розмітка.
- **CSS3 (Vanilla)**: Сучасні Grid та Flexbox лейаути, змінні (CSS Variables), плавні переходи, кастомні скроллбари та ефект матового скла (Glassmorphism).
- **JavaScript (Vanilla)**: Логіка навігації, інтерактивні фільтри автопарку та робіт, динамічний калькулятор цін та слайдер автопарку ТК.

## 🚀 Як запустити проект локально

Проект є повністю статичним сайтом, тому його можна відкрити безпосередньо:
1. Двічі клацніть на файл `index.html` у вашому провіднику, щоб відкрити його в браузері.
2. Або запустіть будь-який локальний сервер (наприклад, VS Code Live Server або python: `python -m http.server 8000`).


## Code structure

The frontend stays dependency-free, but the code is split by responsibility so a change in one feature does not require editing a 1,500-2,500 line monolith. Feature scripts use a small shared registry instead of ES module imports, so the site still works when `index.html` is opened directly from disk.

```text
GREATNESS/
├── index.html                  # Semantic page markup and feature sections
├── css/
│   ├── main.css                # Stylesheet entry point
│   ├── base.css                # Design tokens and shared UI primitives
│   ├── lightbox.css            # Gallery modal
│   ├── footer.css              # Footer styles
│   ├── responsive.css          # Cross-feature responsive rules
│   └── sections/               # Feature-specific styles
│       ├── home.css
│       ├── family.css
│       ├── jobs.css
│       ├── fleet.css
│       ├── prices.css
│       ├── gallery.css
│       └── contracts.css
├── js/
│   ├── app.js                  # Application bootstrap and feature initialization
│   └── modules/                # Feature-specific behavior
│       ├── navigation.js
│       ├── fleet-slider.js
│       ├── jobs.js
│       ├── fleet-filter.js
│       ├── prices.js
│       ├── gallery.js
│       ├── roster.js
│       └── contracts.js
└── assets/                     # Images and SVG assets
```

### Maintenance rules

- Keep comments in English and explain intent or non-obvious behavior, not obvious syntax.
- Put new feature behavior in its own module under `js/modules/`.
- Put feature-specific styles under `css/sections/`; shared primitives belong in `css/base.css`.
- Keep `js/app.js` limited to application startup and module initialization.
- Avoid adding new inline styles in HTML; prefer reusable CSS classes.
- Do not add a framework or build step unless the project complexity actually requires it.


### Mobile contract workflow
- Contract screenshot processing is responsive and designed for touch input.
- OCR uses focused screenshot regions and high-contrast preprocessing before parsing values.
- Keep OCR parsing defensive: uncertain critical fields must require manual review instead of inventing data.


## Contracts OCR note (v1.3.2)
The contracts OCR uses focused screen regions, including a values-only metrics crop, to improve compensation, reputation, and XP extraction while keeping the flow mobile-friendly. In v1.3.2 the metrics crop was extended lower to capture the XP row more reliably, and the "recognized" state now requires all reporting fields. The temporary PIN gate auto-unlocks when the correct three-digit PIN is entered.


### OCR фото з телефону
Якщо звичайне розпізнавання не знаходить усі поля, модуль контрактів автоматично запускає другий OCR-прохід із нормалізацією фото екрана. Це дозволяє обробляти не лише скріншоти, а й фотографії планшета/монітора, зроблені смартфоном.


## Contract reporting model (v1.4.0)

- One saved contract keeps the contract-level data plus the list of participating players.
- Each participant receives a fractional contract share: `1 / participant count`.
- The reporting matrix uses players as rows and contract names as columns.
- Payout status is stored per player, not only per contract, so a multi-player contract can be paid partially.
- Journal filters control the matrix, payout summary, KPI cards, full log, and exports.
- The default report period is the current calendar week (Monday-Sunday).
- v1.4.0 includes 20 local demo records for testing filters and payout states. They are temporary until Google Sheets becomes the source of truth.
- Exact duplicates are detected using minute-level completion time, contract name, compensation, and the sorted participant list.


### Contracts reporting v1.4.4
- Native date-picker buttons for custom ranges, automatic From -> To flow, sortable report tables, bulk payout marking, and player money totals in the contract matrix.

## Shared Contracts database

The Contracts journal uses Google Sheets as the shared source of truth through a Google Apps Script Web App. The deployed API URL is embedded in `js/modules/contracts.js`. Browser `localStorage` is only an offline cache.

The backend source is in `google-apps-script/Code.gs`. After changing backend code, update the existing Apps Script deployment to a new version so the current `/exec` URL remains unchanged.

### OCR Contract Catalog

Contract recognition uses a shared `Contract Catalog` tab in the same Google Sheet. The catalog stores only confirmed contract names and reward values. Real saved journal entries automatically update the catalog, so OCR improves over time without guessing unknown contracts.


## v1.9.14 Vision
Fast single-pass Gemini 3.6 Flash OCR. Run via run_local.bat. Backend health should report 1.7.7.
