# v1.9.39 - Vision proxy timeout fix

- Increased Vercel Vision function max duration from 60s to 300s.
- Increased the proxy wait for Google Apps Script/Gemini from 55s to 240s.
- Fixes public OCR failing with `502 Bad Gateway` / `The read operation timed out` while Apps Script is still processing Gemini fallback models.
- No secrets are exposed in the frontend.

## v1.9.38 - Vercel Vision connected
- Connected GitHub Pages frontend to `https://greatness-two.vercel.app`.
- No API keys or proxy tokens are stored in public frontend config.

# v1.9.37 - GitHub Pages Vision proxy

- Fixed OCR architecture for GitHub Pages: the browser no longer calls the nonexistent same-origin `/api/vision` endpoint in production.
- Added `api/vision.py` for a Vercel serverless proxy.
- `VISION_PROXY_TOKEN` and `GEMINI_API_KEY` remain server-side and are never bundled into public JavaScript.
- Added strict production-origin CORS and a request-size limit on the proxy.
- Local OCR still uses the existing `server.py` same-origin proxy.
- Added `js/config.js` for the public proxy URL and `VERCEL_VISION_SETUP.md` with deployment steps.

# v1.9.36 - Security/local Vision hotfix

- Fixed `.env.local` variable mismatch: local proxy now accepts `VISION_PROXY_TOKEN` (and legacy `GREATNESS_VISION_PROXY_TOKEN`).
- Updated build markers to v1.9.36 so the actually loaded frontend/server version is visible in diagnostics.
- Preserved v1.9.35 security hardening and existing project behavior.

## v1.9.35 - Security UX / local Vision fix

- Added `.gitignore` so local server/batch files, secrets, caches and scratch files are not published to GitHub.
- Restored automatic password submission: no Enter/click required after typing stops.
- Local Vision proxy now reads `GREATNESS_VISION_PROXY_TOKEN` from ignored `.env.local` as well as the environment.
- Added safe `.env.local.example` template without a real secret.
- No OCR recognition, matrix, payout, Save All or journal business logic changed.

# v1.9.33 - Safety: remove full journal clear

- Removed the **Очистити журнал** button from the journal UI.
- Removed the frontend handler that could replace the full journal with an empty set.
- Per-record deletion remains available.
- OCR, Save All, Gemini fallback, matrix, payouts, and Google Sheets sync logic were not changed.

## v1.9.32 - Contract card action UX
- Two primary actions are shown side by side with equal width.
- Delete action is moved to a separate full-width row.
- Font size is unchanged; no OCR/journal/business logic changes.

# v1.9.30 - Card action readability

- Кнопки «Додати в журнал» і «OCR Сканування» тепер мають дворядкові підписи.
- Розмір шрифту не зменшувався - 14px для всіх трьох дій.
- Збільшена висота action-кнопок, щоб текст читався на вузьких картках і телефонах.
- Логіка OCR, Save All, журналу, дедуплікації та матриці не змінювалась.

# v1.9.29

- UI fix: кнопки дій у картці контракту тепер завжди залишаються всередині картки.
- Зменшено gap/padding та зафіксовано безпечну ширину кнопки «Видалити».
- Функціональну логіку OCR, Save All, журналу, матриці та Google Sheets не змінено.

# v1.9.28

- Покращено desktop UX верхньої навігації: пункти меню більше не переносяться на два рядки, активний розділ компактніший і чистіший.
- Покращено блок дій картки контракту: три кнопки тепер мають стабільну сітку, однакову висоту та не ламають текст на 2-3 рядки.
- Логіку OCR, Save All, дедуплікацію, журнал, матрицю та Google Sheets не змінено.

# v1.9.27

- UI: Save All no longer flashes "ДУБЛІКАТ" on contracts that were just successfully saved.
- UX: participant dropdown resets to the first row/top position whenever it opens.
- No changes to OCR, Gemini fallback, journal persistence, matrix, payouts, or duplicate matching rules.

# v1.9.26

- Fixed Save All when two different contracts have the same screenshot date/time.
- Duplicate detection is exact: screenshot hash OR minute + contract name + compensation + participants.
- Save All no longer aborts the whole batch because one exact duplicate exists; genuinely new contracts are still saved.
- After a successful batch save, only saved cards are removed; exact duplicates remain available for review/overwrite.
- Kept the v1.9.25 per-entry Google Sheets acknowledgement/retry/verification hardfix unchanged.

# v1.9.25
- Fixed `Зберегти всі та відкрити журнал`: Save All now sends only the newly reviewed contracts instead of running the generic full journal diff sync.
- Every new contract is written separately and must receive an explicit Google Sheets acknowledgement. Failed writes are retried up to 3 times.
- The journal is reloaded only after all batch rows are acknowledged, then every new Entry ID is verified against the shared sheet.
- Screenshots are still kept on screen if even one contract cannot be confirmed remotely.
- OCR, Gemini fallback, journal filters/sorting, matrix and payouts are unchanged.

# v1.9.24

- Повний журнал за замовчуванням сортується за датою й часом DESC - найновіші виконані контракти зверху.
- Виправлено UX для `Зберегти всі та відкрити журнал`: після підтвердженого batch-save журнал автоматично відкриває custom-період, який охоплює дати щойно збережених контрактів.
- Це усуває кейс, коли контракт за 16.08 успішно збережений, але його не видно під активним фільтром `Минулий тиждень: 17.08-23.08`.
- Перевірка remote-save з v1.9.22 збережена: скріншоти очищаються тільки після підтвердження всіх нових Entry ID з Google Sheets.
- OCR, Gemini fallback, матриця, каталог і backend не змінювалися. Backend залишається 1.7.11.

# v1.9.21 - Vision fallback timeout fix

- Frontend waits up to 210 seconds for the complete backend fallback chain.
- Local proxy waits up to 195 seconds for Apps Script.
- No journal, matrix, catalog, saving, OCR prompt, parser, or Apps Script logic changes.

# v1.9.20 - Multi-model Gemini Vision fallback

- Expanded OCR model fallback without changing the proven OCR prompt, parsing, journal, matrix, catalog, or saving logic.
- Model chain: Gemini 3.6 Flash -> 3.7 Flash -> 3.5 Flash -> 3.5 Flash-Lite -> 3.1 Flash-Lite -> Gemini 3 Flash Preview -> 2.5 Flash-Lite.
- HTTP 429 automatically moves to the next model and temporarily caches the blocked model for 5 minutes.
- HTTP 5xx gets one short retry, then automatically moves to the next model.
- HTTP 404 marks that model unavailable for 30 minutes and continues the chain.
- Backend health version: 1.7.11. Frontend build marker: 1.9.20.

# v1.9.19 - Dynamic matrix columns + level sorting

- Matrix columns are built from the actual saved journal contracts in the selected period.
- New contract types automatically appear as new matrix columns.
- Contract names are whitespace-normalized before grouping to avoid duplicate columns caused by OCR spacing.
- Roman levels are sorted inside the same base contract in natural order: I -> II -> III -> IV.
- Example: `Полювання I`, `Полювання II`, `Полювання III`.
- Fractional shares from v1.9.18 remain unchanged.
- OCR, Gemini fallback, journal saving, payouts and backend logic are unchanged.
- Backend remains 1.7.10. Frontend build marker: 1.9.19.

# v1.9.18 - Fractional contract shares in matrix

- Fixed the completed-contract matrix so shared contracts are counted fractionally for every participant.
- Matrix share is now derived from the actual participant count: 1 player = 1, 2 players = 0.5 each, 3 players = 0.33 each.
- Multiple contracts continue to add up normally, e.g. 1 + 0.5 = 1.5.
- Older journal rows with an incorrect stored `Contract Share` value are displayed correctly because the matrix recalculates the share from participants.
- Player summary contract totals use the same calculation as the matrix.
- Gemini/OCR, model fallback, Google Sheets writes, catalog learning, payouts and journal storage are unchanged.
- Backend remains 1.7.10. Frontend build marker: 1.9.18.

# v1.9.17 - Gemini quota model fallback

- OCR extraction logic from Stable v1.9.15 remains unchanged.
- Gemini Vision now starts with `gemini-3.6-flash` and automatically falls back to `gemini-3.7-flash` when the current model returns HTTP 429 (quota/rate limit) or a temporary 5xx error.
- Non-retryable errors (for example auth/configuration errors) still fail immediately instead of hiding the real problem.
- If both models are unavailable/exhausted, the final Gemini error is shown normally.
- Backend health version: 1.7.10. Frontend build marker: 1.9.17.

# v1.9.16 - Batch journal UX + payout matrix + catalog safety

- When 2+ screenshot cards are loaded, saving one card keeps the user on the upload screen; the journal opens only after the last remaining card is saved.
- The matrix now keeps `Сума гравця ($)` as the final, sticky right-side column so total player payout stays visible even with many contract columns.
- `Зберегти всі та відкрити журнал` is now truly batch-safe: it waits for every Google Sheets upsert batch to be acknowledged before clearing screenshots and opening the journal.
- Local batch data is preserved if remote Sheets confirmation fails; screenshots are not cleared so the user can retry safely.
- After a successful Sheets write, the shared contract catalog is reloaded immediately so newly learned contract names/levels/prices are available to the next OCR scan.
- Contract Catalog learning now canonicalizes Roman levels I/II/III and uses base-name + level as the catalog key.
- A single conflicting OCR compensation can no longer silently overwrite a previously confirmed price for the same exact contract level.
- Backend health version: 1.7.9. Frontend build marker: 1.9.16.
- Stable Gemini/OCR path from v1.9.15 is unchanged.

# v1.9.15 - Low-thinking structured Vision

- Fixed the actual v1.9.14 failure where Gemini returned only conversational text such as `Let...`.
- Gemini 3.6 Flash now uses `thinkingLevel: low` so OCR spends minimal time on reasoning.
- Increased output allowance to 1024 tokens so the final answer is not starved by model thinking.
- Restored GenerateContent structured JSON with `responseMimeType` + `responseSchema`.
- Backend now has defensive JSON/prose parsing and, critically, always returns the successful Vision result to the local proxy.
- Frontend build marker corrected to 1.9.15.
- Backend health version: 1.7.8.
- Journal, catalog, payouts, participants, reports and saved data remain unchanged.

# v1.9.14 - Fast Vision path

- Replaced multi-retry structured-JSON OCR with one fast Gemini 3.6 Flash request.
- Vision response now uses a simple four-line protocol (DATE/TIME/TITLE/COMP) instead of fragile JSON generation.
- Removed two unused compatibility image crops from the browser-to-proxy payload.
- Reduced Vision image sizes/quality to cut upload and processing latency while keeping the active panel readable.
- Browser Vision timeout is now 60 seconds and the local proxy upstream timeout is 70 seconds.
- Backend health version: 1.7.7.
- Journal, catalog, payouts, participants and reports are unchanged.

# v1.9.13 - Gemini JSON recovery

- Fixes HTTP 200 Gemini replies that prepend prose before JSON or return a non-JSON answer.
- Parses the first balanced JSON object and retries Vision on an alternate model when a 200 response still contains no valid JSON.
- Raises max output tokens to 512 to reduce truncated structured responses.

- Fixed frontend aborting Vision requests after 45 seconds while the local proxy/backend could continue for up to 180 seconds.
- Frontend Vision timeout is now 150 seconds.
- `gemini-3.6-flash` is now the primary OCR model; `gemini-3.7-flash` is fallback only for temporary 429/5xx failures.
- Journal, catalog, payouts, screenshot parsing rules, and saved data model are unchanged.
- Backend health version: `1.7.6`. Frontend build marker: `1.9.13`.

# v1.9.11 - Gemini overload retry + fallback

- Handles temporary Gemini HTTP 429/500/502/503/504 errors automatically instead of failing OCR immediately.
- Retries `gemini-3.7-flash` once after a short delay.
- Falls back to `gemini-3.6-flash` if 3.7 Flash is still overloaded.
- Keeps the existing GenerateContent structured JSON format, defensive JSON parser, OCR prompt, catalog, journal and payout logic unchanged.
- Backend health version: `1.7.4`. Frontend build marker: `1.9.11`.

# v1.9.10 - GenerateContent structured JSON fix

- Restored the supported `generateContent` structured-output fields: `generationConfig.responseMimeType` + `responseSchema`.
- Removed the incompatible `responseFormat.text.mimeType` approach used by the previous attempted fix.
- Gemini model updated to `gemini-3.7-flash` to match the current GenerateContent documentation.
- Added defensive JSON parsing if Gemini wraps the JSON in markdown/prose.
- Local proxy timeout increased from 40s to 180s.
- Backend health version: `1.7.3`. Frontend build marker: `1.9.10`.
- Journal, catalog, alias learning, payout logic and existing data model are unchanged.

# v1.9.8 - Gemini model compatibility fix

- Updated the Apps Script Vision model from `gemini-2.5-flash` to `gemini-3.6-flash` because the Gemini API returns HTTP 404 for `gemini-2.5-flash` for new users.
- No OCR, crop, catalog, journal, payout, or local proxy logic was changed.
- Apps Script backend version is now `1.7.1`.
- Frontend build marker is now `1.9.8` only for cache/version verification.

## [1.9.7a] - 2026-08-24
### Локальний запуск
- Виправлено конфлікт локального сервера зі старою запущеною версією: тестовий сервер тепер використовує порт `8767` замість `8765`.
- У консоль сервера додано явний номер збірки та шлях папки, з якої реально віддаються файли.
- У браузерній консолі збірка позначається як `1.9.7a`, щоб одразу бачити, що відкрито саме нову папку.
- Backend та Vision-логіку не змінено.

# v1.9.7 - Authenticated local proxy + JSON Vision endpoint
- Root cause from DevTools: local HTTP transport works, but the current Apps Script deployment returns HTTP 401 to the Python proxy because it requires a signed-in Google session.
- Vision proxy now uses a dedicated token and expects a direct JSON response from Apps Script; iframe/postMessage is not used.
- Included Apps Script backend v1.7.0. It must be deployed as Web app with access = Anyone so the local server can call it without browser Google cookies.
- Gemini API key remains only in Apps Script Properties.
- OCR parsing, crops, journal, Sheets sync, reports and data model are unchanged.
- Previous patch notes are preserved below.

# v1.9.6 - Local HTTP Vision transport
- Removed the hidden iframe/postMessage Vision transport from the frontend.
- Added `run_local.bat` + `server.py`: the site now runs on `http://127.0.0.1:8765` for local testing.
- Browser sends Vision requests to same-origin `/api/vision`; the local proxy forwards them to the existing Apps Script deployment and returns JSON.
- This removes the `file://` unique-origin / iframe security failure seen in Chrome.
- Gemini prompt, screenshot crops, OCR fallback, journal, Sheets sync, reports and data model are unchanged.
- Apps Script deployment does not need to be changed for this build.

# v1.9.5 - Local file iframe target fix

- Fixed the Chrome `file://` unique-origin error shown in DevTools when Vision creates its hidden response iframe.
- The hidden iframe now explicitly starts at `about:blank` before the Apps Script POST targets it.
- Kept the existing Apps Script/Gemini bridge, OCR logic, contract parsing, journal, reports, and data model unchanged.
- Increased only the bridge wait timeout to 30 seconds so a valid Apps Script response is not discarded too early.
- No previous patch notes were removed.

## [1.9.4] - 2026-08-24

### Виправлено втрату Vision response у вкладеному Apps Script sandbox
- За Console trace підтверджено: frontend build `1.9.3` завантажений, POST `vision` отримує HTTP 200, але frontend завершує очікування помилкою `Vision request timeout`.
- Apps Script HtmlService виконує HTML у sandbox, тому bridge тепер надсилає результат не лише через `window.parent`, а й через `window.top`, щоб відповідь дійшла до сторінки GREATNESS.
- Frontend продовжує приймати лише відповідь з власним унікальним `requestId`.
- `XFrameOptionsMode.ALLOWALL` збережено.
- OCR/Vision prompt, crops, каталог, дата, назва, компенсація, журнал і звіти не змінювались.
- Backend version піднято до `1.6.3`; frontend build - `1.9.4`.
- Історію PATCHNOTES збережено повністю.

## [1.9.3] - 2026-08-24

### Виправлено блокування Vision bridge браузером
- За фактичним Network trace підтверджено: POST `vision` доходить до Apps Script, але HTML-відповідь `exec` блокується всередині прихованого iframe (`blocked:other`).
- Причина: Apps Script HtmlService response не дозволяв вбудовування у cross-origin iframe, через який frontend очікує `postMessage`.
- `visionBridgeResponse()` тепер явно використовує `HtmlService.XFrameOptionsMode.ALLOWALL`, щоб response bridge міг завантажитися у прихованому iframe та повернути результат у сайт через `window.parent.postMessage`.
- OCR/Vision prompt, crops, каталог контрактів, компенсація, дата, журнал і звіти не змінювались.
- Backend version піднято до `1.6.2`; frontend build - `1.9.3`.
- Історію PATCHNOTES збережено повністю.

## [1.9.2] - 2026-08-24

### Виправлено повний збій Vision через кеш / неповний payload
- За фактичним Network payload підтверджено: браузер відправляв лише `imageData`, хоча актуальний frontend мав також передавати `detailData`, `headerData` і `compensationData`.
- Додано cache-busting для `contracts.js` та `app.js`, щоб локальний Chrome гарантовано завантажував актуальний parser після зміни версії.
- Backend більше не валить весь Vision-запит, якщо `detailData` відсутній: у такому випадку він використовує повний `imageData` як fallback-контекст.
- Backend сумісний зі старими/закешованими frontend-версіями й не повинен повертати порожні одразу дату, назву та компенсацію через одне відсутнє поле payload.
- Додано console marker `GREATNESS Contracts build 1.9.2 loaded` для швидкої перевірки реально завантаженої версії.
- Історію PATCHNOTES не скорочено та не перезаписано.

## [1.9.1] - 2026-08-24

### Виправлено сумісність Vision frontend/backend
- Виправлено критичний кейс, коли після оновлення frontend усі поля OCR ставали порожніми через невідповідність версії Google Apps Script backend.
- Frontend тепер одночасно передає актуальні поля Vision (`imageData`, `detailData`) і сумісні поля попереднього backend (`headerData`, `compensationData`).
- Одна й та сама локальна збірка тепер працює як з backend v1.5.x, так і з v1.6.x; зайві поля безпечно ігноруються.
- Зменшено розмір Vision-зображень, щоб не збільшувати час POST-запиту.
- Логіку журналу, виплат, alias-learning, фільтрів та Google Sheets не змінено.

## [1.9.0] - 2026-08-24

### Змінено OCR/Vision pipeline
- Прибрано залежність від жорсткого crop для компенсації, який ламався на фото з іншим масштабом або положенням планшета.
- Gemini тепер отримує повний контекст скріншота та окремо збільшену праву панель активного контракту.
- Праву панель дозволено реально збільшувати перед відправкою у Vision, щоб краще читати рівень I/II/III та суму компенсації.
- Назва контракту читається тільки з великого заголовка активної правої панелі; назви зі списку зліва/по центру ігноруються.
- Компенсація читається тільки навпроти підпису «Грошова компенсація» у тій самій активній панелі.
- Якщо Vision-запит не спрацював, сайт більше не запускає автоматично повільний Tesseract на 30-60+ секунд. Картка залишається на перевірку без додаткового очікування.
- Каталог та alias-learning збережені як допоміжна валідація, але не замінюють візуальне читання активної панелі.

## [1.8.11] - 2026-08-23
### Виправлено розпізнавання компенсації
- Компенсація більше не визначається за випадковим числом у правій панелі.
- Додано окремий компактний crop саме навколо рядка `Грошова компенсація` і він передається в той самий Vision-запит.
- Gemini отримав жорстке правило: брати суму тільки з рядка `Грошова компенсація`; баланс, прогрес, репутація, XP, таймери та інші числа ігноруються.
- Якщо точну суму з цього рядка неможливо прочитати, повертається `0` / поле на перевірку замість вигаданої суми.
- Логіку назв, alias-learning, дати, журналу та звітів не змінено.
- Попередня історія PATCHNOTES збережена повністю.

## [1.8.10] - 2026-08-23
### Покращено навчання назв контрактів
- Ціна контракту більше не використовується як унікальний ідентифікатор назви. Вона лише звужує список кандидатів.
- Якщо декілька контрактів мають однакову компенсацію, система порівнює OCR-текст із назвами та навченими OCR-аліасами й обирає тільки впевнений варіант.
- Якщо два кандидати мають близьку оцінку, назва не вгадується та залишається на ручну перевірку.
- Після ручного виправлення OCR-назви та збереження контракту початковий OCR-текст запам'ятовується як alias для правильної назви у спільному Contract Catalog.
- Vision/OCR pipeline, дата, компенсація та швидкість обробки цією версією не змінювались.

## [1.8.9] - 2026-08-23

### Точковий catalog fix без зміни OCR pipeline
- Базою залишено стабільну v1.8.7; Vision/OCR crops, модель, timeout, дата та компенсація не переписувалися.
- До перевіреного локального каталогу додано `Доставка OG Kush I` з компенсацією `$170 000`.
- Після Vision результат звіряється з перевіреним каталогом: унікальна компенсація `$170 000` відновлює повну назву `Доставка OG Kush I`, навіть якщо OCR повернув скорочену/шумну назву.
- Попередня історія PATCHNOTES збережена повністю.

## [1.8.7] - 2026-08-23

### Швидкість Vision та повна назва контракту
- Vision більше не відправляє великий повний GTA-кадр: перед запитом браузер вирізає праву панель активного контракту та верхній status bar.
- Зменшено розмір і JPEG-якість службових Vision-зображень, щоб скоротити upload та час обробки.
- Назва контракту читається саме з активної правої панелі; назви з центрального списку не повинні впливати на результат.
- Roman level `I / II / III` явно зафіксовано як обов'язкову частину назви, щоб `Доставка OG Kush I` не перетворювалась на `Доставка OG Kush`.
- Логіку дати, компенсації, журналу, Google Sheets та дублікати не змінено.
- Попередні patch notes збережено без видалення.

## [1.8.6] - 2026-08-23

### Стабілізація OCR
- Повернено стабільну схему Vision-запиту з v1.8.2 без експериментальних clock-crop змін.
- Якщо Gemini повернув дату, назву контракту та компенсацію, результат одразу приймається без запуску повільного Tesseract fallback.
- Час `HH:MM` тимчасово став необов'язковим для збереження і звітності: якщо він прочитаний - показується, якщо ні - використовується календарна дата зі скріншота.
- Скорочено розмір зображень у Vision-запиті та знижено timeout до 15 секунд.
- Жодні попередні patch notes не видалено.

## [1.8.2] - 2026-08-23

### Швидкість та розпізнавання часу
- Прибрано локальний Tesseract time-rescue після успішного Gemini Vision, який міг додавати 30-60+ секунд до обробки одного фото.
- Перед відправкою у Vision велике фото стискається до робочого розміру, що значно зменшує POST payload і час передачі через Apps Script.
- В один Gemini-запит тепер передаються два зображення: повний кадр для назви/компенсації та окремо збільшена верхня смуга для дати й `HH:MM`.
- Gemini повертає `date` і `time` окремими структурованими полями, щоб дрібний час не губився всередині загального `dateTime`.
- Назва активного контракту та компенсація як і раніше читаються тільки з правої панелі.
- Повна попередня історія PATCHNOTES збережена без видалень.

## [1.8.1] - 2026-08-23

### Виправлено
- Якщо Gemini Vision правильно розпізнав дату, назву контракту та компенсацію, але не повернув `HH:MM`, запускається окремий локальний OCR тільки для часу.
- Time rescue не перезапускає розпізнавання назви контракту, компенсації або дати і не може перезаписати вже коректні значення.
- Поточна робоча логіка `Продаж трофеїв II` / `$140000` залишена без змін.
- Повна попередня історія PATCHNOTES збережена без видалень.

## [1.8.0] - 2026-08-23

### Додано / Змінено
- Gemini Vision тепер є основним парсером скріншотів контрактів.
- Модель читає дату/час пристрою, назву активного контракту з правої панелі та грошову компенсацію з повного контексту зображення.
- Gemini API key зберігається тільки в Google Apps Script Script Properties і не передається у frontend/GitHub Pages.
- Для статичного GitHub Pages додано серверний bridge через Google Apps Script Web App.
- Tesseract OCR залишено автоматичним fallback, якщо Vision API недоступний або не повернув валідні дані.
- Журнал, Google Sheets sync, фільтри, виплати та поточна модель даних не змінені.

## [1.7.6] - 2026-08-23

### Fixed
- Time rescue now runs when the screenshot date is recognized but HH:MM is missing.
- Time OCR uses wider overlapping crops and keeps the strongest valid HH:MM candidate.
- Contract title, compensation, and existing date recognition logic are unchanged.

## [1.7.4] - 2026-08-23

### Виправлено
- Додано окреме OCR-читання часу `HH:MM` з крайньої лівої частини системного рядка. Воно запускається лише якщо дата вже розпізнана, але час загубився.
- Виправлено регресію компенсації на складних фото: якщо для вже підтвердженого контракту OCR втрачає цифри та повертає явно нереальне значення (наприклад `8400` замість `140000`), значення звіряється з підтвердженим Contract Catalog.
- Робоче розпізнавання назви та дати не перезапускається без потреби.

# v1.7.3

- Перероблено OCR дати для фото екрана: замість одного широкого фрагмента верхньої панелі система перевіряє три вузькі області саме у верхньому лівому куті планшета.
- Збільшено масштаб OCR для дрібного рядка з датою та часом.
- OCR припиняє додаткові проходи одразу після знаходження валідної дати, щоб не збільшувати час обробки без потреби.
- Логіку назви контракту та грошової компенсації не змінено.

# v1.7.1

- Покращено розпізнавання дати та часу на фото екрана, зроблених телефоном.
- Замість однієї широкої OCR-зони верхнього лівого кута використовуються три вузькі зони, де фактично знаходиться системний рядок планшета.
- Для складних фото додано другий режим OCR, якщо перший не зміг прочитати дату.
- Невдала спроба OCR більше не підміняє дату іншими значеннями - поле залишається «Не розпізнано».

## [1.7.0] - 2026-08-23
### Виправлено відображення нерозпізнаних полів OCR
- Прибрано оманливі приклади `22:56 Вівторок 18 серпня` та `Полювання III` з порожніх OCR-полів. Вони були лише placeholder, але виглядали як реально розпізнані дані.
- Якщо дата зі скріншота не розпізнана, поле тепер явно показує `Не розпізнано` та окреме попередження саме під датою.
- Аналогічне точкове попередження додано для назви контракту та компенсації, якщо конкретно цього поля бракує.
- Поточна дата/час браузера не використовуються як fallback; невдалий OCR залишається порожнім і не може тихо потрапити в журнал.
- Кнопка збереження тепер явно вимагає дату, назву, компенсацію та учасника.

## [1.6.9] - 2026-08-23
### Виправлено помилкову назву на фото під кутом
- Додано перехресну перевірку назви контракту за грошовою компенсацією з підтвердженого каталогу.
- Якщо OCR заголовка через перспективу випадково захопив контракт із центрального списку, але компенсація однозначно відповідає іншому підтвердженому контракту, використовується контракт за компенсацією.
- Перевірка безпечна: якщо однакова компенсація зустрінеться у кількох контрактах, сайт не буде вгадувати назву.
- Кейс `$140 000` тепер коректно повертає `Продаж трофеїв II`, навіть якщо title-crop прочитав сусідній контракт.

## [1.6.8] - 2026-08-23
### Виправлено вибір активного контракту
- Назва контракту тепер зчитується тільки з правої картки активного контракту. Центральний список контрактів більше не бере участі у виборі назви.
- Для фото з телефону додано окремі перекривні OCR-зони саме для заголовка правої картки.
- Full-frame OCR більше не може підмінити активний контракт назвою з центрального списку; він використовується лише для відновлення дати та компенсації.
- Підтверджені дані з попереднього OCR-проходу зберігають пріоритет під час fallback-сканування.
- До навчального каталогу додано підтверджений реальним скріншотом контракт `Балонний транзит II` з компенсацією `$185 000`.

## [1.6.7] - 2026-08-23
### Виправлено OCR телефонних фото
- Додано окремий rescue-прохід по правій панелі контракту без залежності від визначення рамки планшета.
- Назва контракту та грошова компенсація тепер повторно зчитуються разом із великої області оригінального фото.
- Для дати додано окреме збільшення верхнього лівого заголовка.
- Час приймається тільки якщо OCR реально бачить роздільник `:` або `.`, тому значення на кшталт `100/100` більше не можуть перетворитися на `01:00`.
- Попередня нормалізація планшета залишена як наступний fallback, а не єдина надія для складних фото.

## [1.6.5] - 2026-08-23
### Покращено OCR фото з телефону
- Додано автоматичне визначення області ігрового планшета перед повторним OCR. Сайт більше не покладається на один жорстко заданий crop для всіх фото.
- Межі планшета визначаються локально в браузері за щільністю темної області інтерфейсу; відблиски та засвічення згладжуються перед пошуком меж.
- До знайденої області додається безпечний запас зверху та по краях, щоб не обрізати дату, назву контракту або компенсацію.
- Якщо планшет на фото не вдалося надійно знайти, використовується консервативний fallback без підстановки вигаданих значень.
- Зменшено агресивність контрастної обробки фото, щоб дрібні світлі цифри компенсації не зникали на засвічених кадрах.
- Швидкий OCR для нормальних скріншотів залишився без змін; детектор запускається тільки в phone-photo fallback.

## [1.6.3] - 2026-08-23
### Додано / Змінено (Fallback OCR для складних фото)
- Якщо стандартні OCR-зони не знаходять усі ключові поля, сайт виконує один додатковий OCR-прохід по всьому фото.
- Full-frame fallback використовується лише як останній крок, тому звичайні скріншоти не сповільнюються.
- Повний прохід дозволяє знайти дату, назву контракту та компенсацію навіть коли планшет на фото сильно зміщений або має інший масштаб.
- Замість багатьох додаткових crop-проходів використовується лише один fallback, щоб зберегти прийнятну швидкість.
- Поточна дата/час браузера як і раніше ніколи не використовуються для підміни OCR.

## [1.6.2] - 2026-08-23
### Виправлено OCR дати та нових назв контрактів
- Розширено й зміщено OCR-зону верхнього заголовка для фото з телефону, де дата знаходиться нижче через рамку екрана.
- Розширено OCR-зону назви контракту, щоб стабільніше захоплювати заголовок у правій панелі при різному кадруванні фото.
- Додано безпечний fallback для першої появи нового контракту: якщо в ізольованій зоні є рівно одна схожа на назву кирилична строка з рівнем I/II/III, її можна використати для навчання каталогу без ручного вводу.
- До підтвердженого локального каталогу додано реальний контракт `Полювання II` з компенсацією `$130 000` на основі наданого скріншота.
- Поточний час/дата браузера як і раніше не використовуються для підміни невдалого OCR.

## [1.6.0] - 2026-08-23

### Додано / Змінено
- **Статус дублікату:** повторно завантажений скріншот тепер явно позначається статусом **ДУБЛІКАТ**.
- **Захист від повторного запису:** для нових записів зберігається локальний fingerprint скріншота; однакове зображення не додається вдруге, але його можна свідомо перезаписати.
- **Розпізнавання назви:** посилено fuzzy matching для фото з телефону, де назва контракту розбивається або частково псується OCR.
- **Дата без часу:** якщо час на фото обрізаний, система більше не вигадує його. Зберігається видима дата, а запис має точність `day`.
- **Фільтри:** записи без розпізнаного часу використовують технічний полудень лише для коректного потрапляння у потрібний календарний день.

## [1.5.9] - 2026-08-23
### Спрощено OCR та звітність
- Репутацію та досвід (XP) прибрано з картки розпізнавання, повного журналу, таблиці цінності контрактів і текстового звіту.
- OCR більше не витрачає час на окреме визначення REP/XP і не вимагає цих значень для статусу «Розпізнано».
- Для контрактів залишено тільки потрібні зараз дані: дата/час, назва контракту, грошова компенсація та учасники.
- Fallback назви контракту тепер може використати компенсацію лише якщо вона однозначно відповідає одному контракту в каталозі.

## [1.5.8] - 2026-08-23
### Виправлено / Оптимізовано
- Перероблено OCR дати для фото екрана: використовується вузька зона лише з верхнім рядком гри, без логотипа та меню нижче.
- Парсер дати тепер допускає злиплий текст на кшталт `Субота22серпня` і пропущений OCR двокрапки у часі.
- Число місяця береться тільки безпосередньо перед назвою місяця, тому час або інші цифри інтерфейсу не можуть стати датою.
- Поточна дата/час браузера як fallback не використовуються. Якщо заголовок не прочитаний, дата залишається порожньою.
- Повторний phone-photo OCR тепер запускається тільки для полів, яких бракує. Якщо не зчиталась лише дата, назва та нагороди повторно не скануються. Це скорочує час обробки проблемних фото.

## [1.5.7] - 2026-08-23
### OCR та швидкодія
- Повністю прибрано підстановку поточної дати й часу браузера, якщо дата на скріншоті не розпізнана. Поле залишається порожнім, а запис не можна зберегти до валідного розпізнавання.
- Повторне OCR-сканування спочатку очищає попередню дату, щоб помилкове значення не залишалося після нового проходу.
- Оптимізовано OCR: замість сканування всього зображення та великої кількості зон використовуються три цільові області - заголовок дати, назва контракту та блок нагород.
- Другий прохід з нормалізацією фото телефону запускається лише тоді, коли перший прохід не знайшов усі необхідні поля.
- Один Tesseract worker повторно використовується для наступних скріншотів, що прибирає повторне завантаження OCR-моделі.
- OCR-завдання виконуються послідовно через спільну чергу, щоб кілька одночасно завантажених фото не конфліктували за один worker.

## [1.5.6] - 2026-08-23
### Виправлено
- Розпізнавання дати й часу на фото екрана більше не обирає OCR-варіант лише за confidence.
- Пріоритет має повний верхній рядок гри: час + день тижня + число + місяць.
- Окремий digits-only OCR часу використовується лише як fallback, якщо час не прочитано у повному заголовку.
- Це прибирає хибні значення на кшталт `09:01 Неділя 23 серпня`, коли на фото видно `22:15 Субота 22 серпня`.

## [1.5.5] — 2026-08-23
### Виправлено
- **Розпізнавання дати на фото з телефону:** дата й час тепер читаються з окремих вузьких зон заголовка замість широкого noisy-crop.
- **Перевірка календаря:** день тижня використовується як валідація числа та місяця; якщо OCR плутає сусідню цифру дня, система може виправити її лише коли це підтверджується календарем.
- **Час без домислів:** для HH:MM використовується окремий OCR-прохід з whitelist тільки цифр і `:`/`.`. Поточний час браузера не підставляється.
- **Без хибної дати:** якщо місяць/день не вдалося визначити достатньо надійно, дата не вважається успішно розпізнаною.

## [1.5.4] — 2026-08-22
### Виправлено (розпізнавання часу з фото)
- Виправлено кейс, коли OCR правильно читав дату, назву та нагороди, але помилявся у часі контракту на нечіткому фото з телефона.
- Час тепер читається окремо з двох вузьких зон: для нативного скріншота та для фото екрана. Використовується результат із вищою OCR-впевненістю.
- Широка зона заголовка використовується тільки для дня тижня, числа та місяця, а `HH:MM` уточнюється окремим проходом.
- Телефонна нормалізація тепер порівнюється навіть тоді, коли базовий OCR формально знайшов усі 5 полів; при однаковій повноті перемагає варіант із кращою впевненістю по часу.
- Час ніколи не підміняється часом завантаження файлу або поточним часом браузера.

## [1.5.3] — 2026-08-22
### Виправлено (збереження в Google Sheets та повернення в журнал)
- Виправлено критичну помилку, через яку контракт з'являвся в локальному UNDO, але після перевірки Google Sheets журнал знову ставав порожнім.
- Запис у Google Sheets тепер отримує явне підтвердження від Apps Script через JSONP перед повторним читанням бази.
- Синхронізація більше не перезаписує всю таблицю цілком: сайт відправляє тільки додані, змінені або видалені записи. Це безпечніше для одночасної роботи кількох користувачів.
- Після збереження одного контракту користувач автоматично переходить у вкладку журналу, як у попередньому UX.
- Після перезапису дубліката також автоматично відкривається журнал.
- Локально доданий контракт одразу відображається у звітах, а після підтвердження Google Sheets база перечитується з сервера.
- Backend Google Apps Script оновлено до v1.3.0 з JSONP-командами `upsert` і `delete`.

## [1.5.2] — 2026-08-22
### Додано / Змінено (Навчання OCR через каталог контрактів)
- Додано спільний каталог контрактів у Google Sheets (`Contract Catalog`).
- Каталог автоматично навчається на кожному реально збереженому контракті: назва, рівень, компенсація, репутація та досвід.
- Додано fuzzy matching назви контракту тільки проти відомого каталогу, щоб нечіткі фото не підміняли контракт випадковою назвою.
- Рівень I/II/III більше не вгадується: для текстового fuzzy match він має бути розпізнаний.
- Якщо назва не читається, але компенсація + REP + XP унікально збігаються з уже підтвердженим контрактом, назва відновлюється з каталогу.
- Додано окрему OCR-зону тільки для назви контракту, без лівого списку інших контрактів.
- У каталог початково внесені тільки два значення, підтверджені реальними скріншотами: `Продаж трофеїв II` ($140000 / 150 / 130) та `Переробка м'яса II` ($230000 / 210 / 160).
- Backend Google Apps Script оновлено до v1.2.0.

## v1.5.1 - OCR для реальних фото контрактів

- Покращено OCR для фото планшета, зроблених телефоном: зона нормалізації тепер не обрізає верхній лівий кут з датою та часом.
- Розширено OCR-зону правої панелі контракту, щоб повністю захоплювати компенсацію, репутацію та досвід.
- Для блоку нагород використовується окремий режим розпізнавання sparse text, який краще читає ізольовані числа на фото.
- Додано відновлення форматованої суми, якщо OCR пропустив одну цифру в тисячній групі (наприклад, `230 00` -> `230 000`). Значення відновлюється за форматом числа на скріншоті, а не за наперед заданою ціною контракту.
- Рівень контракту більше не вгадується за назвою: OCR-варіанти `Il`, `ll`, `11` коректно нормалізуються до `II`.
- Розпізнавання дати підтримує випадок, коли OCR пропускає двокрапку у часі (`1340` -> `13:40`).
- Прибрано кнопку створення 20 тестових записів, оскільки база перейшла на реальну експлуатацію через Google Sheets.

## v1.5.0 - Google Sheets як спільна база даних

- Підключено Google Apps Script Web App безпосередньо до сайту.
- Google Sheet тепер є основним джерелом даних для журналу контрактів.
- Під час відкриття сайту журнал автоматично завантажується з Google Sheets.
- Після додавання, перезапису, видалення контракту або зміни статусу виплати зміни автоматично відправляються в Google Sheets.
- UNDO також синхронізує відновлений стан з Google Sheets.
- `localStorage` залишено лише як тимчасовий офлайн-кеш.
- Додано видимий статус підключення та кнопку ручного оновлення даних.
- Додано ручну міграцію локального кешу в Google Sheets.
- Автоматичне створення 20 тестових записів вимкнено, щоб випадково не засмічувати спільну таблицю.
- Backend оновлено до API v1.1.0 з JSONP-читанням для сумісності з GitHub Pages.

## [1.4.4] - 2026-08-22
### Журнал контрактів - безпека дій та UX
- Додано помітну кнопку `UNDO` у закріпленій панелі фільтрів. Вона скасовує останню зміну журналу.
- Додано гарячу клавішу `Ctrl+Z` / `Cmd+Z` для скасування останньої дії, якщо користувач не редагує текстове поле.
- UNDO підтримує додавання, перезапис, видалення, зміну статусу виплати, масові виплати, тестові записи та очищення журналу.
- Поля довільного періоду `З` / `По` тепер примусово відкривають нативний календар при кліку навіть без попередньо введеної дати.
- Кнопка копіювання звіту для видачі премій тепер завжди додає період першим рядком та має резервний механізм копіювання для мобільних/HTTP-сценаріїв.
- Прибрано зайву KPI-картку `Нараховано премій`.

## [1.4.3] - 2026-08-22
### Додано / Змінено
- У блоці «Виплати гравцям за обраний період» додано кнопку **«Позначити всіх»**, яка відмічає виплати всім видимим гравцям за активним періодом.
- Для періоду «З / По» додано окремі кнопки календаря. Після вибору дати «З» сайт автоматично відкриває календар «По», а після вибору обох дат одразу оновлює звіти.
- Усі звітні таблиці отримали Excel-подібне сортування: перший клік - ASC, повторний - DESC. Активний напрямок показується стрілкою у заголовку.
- У «Матриці виконаних контрактів» після колонки «Всього» додано **«Сума ($)»** - загальна премія, зароблена гравцем за активний період.
- Сортування й нові контролли адаптовано для мобільних пристроїв.

# Історія змін (Patch Notes) — GREATNESS Family Web Portal

Усі зміни проекту фіксуються тут відповідно до версійності.


## [1.4.0] - 2026-08-21
### Додано / Змінено (матриця контрактів, дублікати та виплати)
- Додано захист від точних дублікатів: якщо збігаються дата/час, назва контракту, компенсація та склад учасників, картка показує попередження замість створення другого запису.
- Для дубліката додано явну кнопку **«Перезаписати»**, яка замінює існуючий запис і зберігає вже виставлені статуси виплат.
- Групове збереження тепер блокує дублікати й після успішного запису автоматично відкриває вкладку **«Журнал та Звіти»**.
- Перевірено й посилено фільтри періодів. Поточний тиждень залишається фільтром за замовчуванням, а над таблицями показується фактичний діапазон дат.
- Для перевірки фільтрів додано 20 тестових контрактів з актуальними нікнеймами GREATNESS, повторюваними типами контрактів і групами по 1, 2 та 3 гравці. Тестові записи розкладені між поточним тижнем, минулим тижнем, поточним та попереднім місяцем.
- Додано динамічну **матрицю виконаних контрактів**: рядки - гравці, колонки - назви контрактів, значення - частка виконання (`1`, `0.5`, `0.33` тощо). Матриця повністю залежить від обраного фільтра.
- Додано облік виплат на рівні конкретного гравця в конкретному контракті, що коректно працює і для групових контрактів.
- У звіті по гравцях тепер видно **нараховано / виплачено / до виплати** за обраний період.
- Додано чекбокс **«Позначити все виплаченим за період»** і окремі чекбокси виплати для кожного гравця.
- У повному журналі показується скільки учасників конкретного контракту вже отримали виплату.
- Кнопку масового збереження перейменовано на **«Зберегти всі та відкрити журнал»**, щоб дія була однозначною.
- Коментарі в коді залишено англійською мовою; patch notes ведуться українською.


## [1.3.4] - 2026-08-21
### Покращено (фото контрактів з телефону)
- Додано автоматичний fallback для фото екрана, зроблених телефоном: якщо звичайне OCR не знаходить усі поля, сайт повторно обробляє зображення як фото.
- Перед другим проходом автоматично відсікаються зайвий фон та рамка планшета, а центральна область інтерфейсу вирівнюється до формату, близького до звичайного скріншота.
- Для фото застосовується окреме легке підсилення контрасту, щоб компенсувати розмиття, шум і втрату різкості камери.
- Сайт порівнює результат звичайного OCR та режиму фото і автоматично залишає той, де розпізнано більше звітних полів.
- Якщо переміг режим фото, у картці показується позначка **«Фото з телефону: застосовано авто-нормалізацію»**.
- Збільшено зону OCR для колонки компенсації, репутації та досвіду, щоб краще працювати з невеликим перспективним спотворенням.
- Логіка працює без окремих дій користувача і зберігає мобільний UX: фото можна завантажувати безпосередньо зі смартфона.
- Коментарі в коді залишено англійською мовою.

## [1.3.3] - 2026-08-21
### Змінено (актуальний склад GREATNESS)
- Тестовий список учасників контрактів замінено на актуальні 24 ігрові нікнейми GREATNESS.
- Старі placeholder-імена на кшталт `Антон Мороз` автоматично відфільтровуються зі збереженого `localStorage`, тому вони не повернуться після оновлення сайту.
- Користувацькі нікнейми, додані вручну і які не належать до старого тестового списку, зберігаються.
- Коментарі в коді залишено англійською мовою.

## [1.3.2] - 2026-08-21
### Виправлено (OCR досвіду)
- Розширено та зсунено OCR-область правої колонки показників, щоб вона стабільно захоплювала не тільки компенсацію та репутацію, а й нижній рядок **досвіду (XP)**.
- Fallback для репутації та досвіду став обережнішим: дрібні звітні значення відфільтровуються окремо, щоб прогрес завдання на кшталт `800 / 800` не підміняв REP або XP.
- Статус **«Розпізнано»** тепер показується лише коли OCR знайшов усі звітні поля: дату/час, назву контракту, компенсацію, репутацію та досвід. Якщо XP не прочитався, картка залишиться у статусі **«Перевірте поля»**.

## [1.3.1] - 2026-08-21
### Виправлено / Покращено (OCR показників та вхід за PIN)
- Для **репутації** та **досвіду (XP)** додано окреме OCR-зчитування вузької правої колонки значень у картці контракту. Це дає fallback навіть тоді, коли Tesseract погано розпізнає українські підписи полів.
- Значення з fallback-області визначаються у стабільному вертикальному порядку інтерфейсу гри: **грошова компенсація → репутація → досвід**.
- Область fallback спеціально не захоплює баланс гравця та прогрес завдання, щоб не підміняти звітні показники сторонніми числами.
- Вхід у розділ контрактів тепер відбувається **автоматично одразу після введення правильного PIN `777`** - натискати Enter або кнопку входу більше не потрібно.
- Enter та кнопка входу залишені як альтернативні способи, а поведінка однаково працює на desktop і mobile.
- Коментарі в коді залишено англійською мовою.

## [1.3.0] - 2026-08-21
### Змінено (OCR контрактів та мобільний UX)
- Блок **завантаження / вставки скріншотів** перенесено в самий низ вкладки обробки контрактів.
- Панель групових дій автоматично приховується, коли ще немає завантажених скріншотів, тому перше завантаження не потребує зайвої прокрутки.
- OCR переведено на зональне розпізнавання: окремо обробляються область деталей контракту та дата/час, а потрібні області попередньо збільшуються й підсилюються за контрастом.
- Грошова компенсація шукається біля відповідного підпису в області контракту; безпечний fallback допускається лише в обрізаній області, де немає балансу гравця.
- Статус **«Розпізнано»** показується лише коли OCR знайшов критичні поля: дату/час, назву контракту та грошову компенсацію. Інакше картка позначається як така, що потребує перевірки.
- Кнопка **«Додати в журнал»** неактивна, поки не заповнені назва контракту, компенсація та хоча б один учасник.
- Покращено мобільну версію: поля картки переходять в одну колонку, кнопки стають повноширинними з більшими touch-зонами, прев'ю не обрізає скріншот, а елементи завантаження й керування коректно складаються на вузьких екранах.
- Коментарі в коді залишаються англійською мовою.

## [1.2.2] - 2026-08-21
### Змінено (UX обробки контрактів)
- Блок завантаження перенесено на початок робочого екрана, а картки з результатами розпізнавання тепер з'являються одразу під ним - без необхідності прокручувати сторінку через групові налаштування.
- До кожної картки скріншота додано основну кнопку **«Додати в журнал»**.
- Після збереження одного контракту його картка прибирається зі списку, а користувач залишається в поточному екрані та може одразу обробляти наступний скріншот.
- Замість блокуючого повідомлення для одиночного збереження додано коротке сповіщення **«Контракт додано в журнал»**.
- Групові дії залишено доступними нижче карток для сценарію з декількома скріншотами.
- Коментарі в коді залишено англійською мовою, а `PATCHNOTES.md` надалі ведеться українською.

## [1.2.1] - 2026-08-21
### Виправлено (OCR грошової компенсації)
- OCR тепер зчитує премію тільки з поля **«Грошова компенсація»** у деталях контракту.
- Видалено загальний пошук суми за символом `$`, через який баланс гравця міг помилково визначатися як сума контракту.
- Додано підтримку пробілів, переносів рядків та типових варіацій OCR біля назви поля компенсації.


## [1.1.1] - 2026-08-21
### Додано / Змінено (Contract Reporting Period Filters)
- **Фільтри звітності:** Додано 6 періодів: поточний тиждень, минулий тиждень, сьогодні, поточний місяць, минулий місяць та довільний період з/по.
- **Календарний тиждень:** Тижневі фільтри тепер рахуються строго Пн-Нд, а не як останні 7 днів.
- **Єдина логіка:** Обраний період застосовується до KPI-карток, зведення по гравцях, журналу, CSV та текстового експорту.
- **Коректні локальні дати:** Довільний діапазон обробляється у локальному часовому поясі без UTC-зсуву дати.

## [1.2.0] - 2026-08-21
### Added / Changed (Contracts Reporting MVP)
- Added a client-side password gate for the Contracts section (temporary password: `777`).
- Added screenshot paste support via the clipboard button and Ctrl+V, including multiple uploaded images.
- Removed fake OCR fallback values: failed OCR now requires manual review instead of inventing contract data.
- Added validation before saving: contract name, compensation, and at least one participant are required.
- Added fractional contract credit per player: 1 player = 1.0, 2 players = 0.5 each, 3 players = 0.333... each.
- Player payout is calculated as total contract compensation divided by participant count.
- CSV export now writes one row per player, making Google Sheets reporting and aggregation easier.
- Added optional Google Sheets synchronization through a Google Apps Script Web App endpoint.
- Added `google-apps-script/Code.gs` and `google-apps-script/SETUP.md` with setup instructions.
- Added English code comments around access control, clipboard ingestion, OCR safety, and remote sync.

## [1.1.1] - 2026-08-21
### Refactored (Frontend Structure & Maintainability)
- Split the monolithic JavaScript controller into feature modules under `js/modules/`.
- Split the large stylesheet into shared and section-specific files under `css/`.
- Added a small `js/app.js` bootstrap that makes feature initialization explicit.
- Moved the calculator pulse animation from runtime-injected JavaScript into CSS.
- Added clear English comments focused on module ownership and non-obvious behavior.
- Added architecture and maintenance rules to `README.md`.
- Kept the project framework-free and compatible with static hosting such as GitHub Pages.

## [1.1.0] — 2026-08-21
### Додано (Contract Screenshot Processing & Payout Reporting System)
- **Новий модуль «Звіти контрактів» (`#contracts`):** Додано спеціалізований розділ порталу для автоматизації звітів з виконання контрактів у грі Ukraine GTA 5.
- **Мульти-завантаження та Drag & Drop:** Зручне перетягування одного або багатьох скріншотів виконаних контрактів.
- **Розпізнавач даних (OCR + AI Fallback):** Автоматичне зчитування дати й часу з верхнього кута, назви контракту, суми грошової компенсації ($), репутації організації та досвіду (XP).
- **Масове призначення ників (Групові дії):** Вибір никнеймів учасників із списку складу сім'ї або додавання нових з кнопкою застосування в 1 клік («Застосувати ники до всіх скріншотів»).
- **Калькулятор премій:** Автоматичний розрахунок індивідуальної виплати на 1 людину (`Компенсація / Кількість учасників`).
- **Журнал та Аналітика (`localStorage`):** Збереження історії контрактів у базі браузера, статистика за період (Сьогодні, Цей тиждень, Цей місяць, Довільний період), пошук за никами.
- **Зводка виплат по учасниках:** Автоматична таблиця із сумою зароблених премій, виконаних контрактів та внеском у репутацію для кожного гравця.
- **Експорт даних:**
  - **Скопіювати для Google Docs / Discord:** Форматований текстовий звіт в 1 клік.
  - **Завантажити CSV:** Файл із UTF-8 BOM для Google Sheets та Excel.

## [1.0.2] — 2026-08-20
### Додано / Змінено (Fleet Design Mockup Integration)
- **Новий дизайн автопарку:** Інтегровано покращений макет карток техніки ТК із крупнішими зображеннями вантажівок та відсутністю зайвого тексту/виробників.
- **Вантажні бейджі:** Додано стильні інформаційні плашки для кожної вантажівки (Бензин 10т для ST680, Вантаж 5т для N2, Вантаж 10т + Бензин 5т для 389).
- **Збільшено ширину:** Оновлено сітку `.tc-grid` до пропорції `1fr 1.8fr` для запобігання переносу тексту у плашках на десктопних моніторах.

## [1.0.1] — 2026-08-20
### Додано / Змінено (Portal Rebranding Finalization)
- **Оновлення SVG-логотипу:** Текст `FAMILY` усередині кругового золотого логотипу `assets/logo.svg` замінено на `LOGISTICS`. Додано кеш-байпас версіонування `?v=1.1` у HTML, щоб браузери негайно оновлювали логотип.
- **Оновлення Hero-банера:** Повністю замінено фонове зображення з пасажирськими автомобілями сім'ї (`assets/family.png`) на нове художнє зображення в стилі GTA V (`assets/family_trucks.jpg`), на якому зображена команда ТК на фоні великих вантажівок та портових контейнерів з українською символікою на заході сонця.
- **Зміна іконок:** Змінено іконку вкладки "Автопарк" у головному навігаційному меню з пасажирського авто (`fa-car`) на вантажівку (`fa-truck-moving`).
- **Приховання кнопки "Вступити":** Повністю вилучено кнопку "Вступити" з шапки сайту для спрощення інтерфейсу під час закритих наборів.
- **Вилучення соціальних мереж:** Вилучено всі посилання на Telegram, Discord та Forum з екрану Hero та з футера сайту для створення більш стриманого та професійного корпоративного вигляду.
- **Вкладка Автопарк у розробці:** Розділ "Автопарк" у навігаційному меню переведено в статус "В розробці" з додаванням стильної скляної картки з відповідним описом про оновлення характеристик.
- **Масштабування картинок техніки:** Збільшено висоту контейнера зображень вантажівок на головній сторінці до 160px для кращої видимості на мобільних пристроях та додано плавний ефект збільшення (zoom) при наведенні.

## [1.0.0] — 2026-08-20
### Додано / Змінено (Rebranding & Refocusing)
- **Ребрендинг порталу:** Головний акцент перенесено на транспортну компанію **GREATNESS LOGISTICS**. Усі посилання на "Сім'ю" в навігації, заголовках та футері змінено на транспортну компанію.
- **Приховання інформації про сім'ю:** З міркувань безпеки повністю приховано статистику сім'ї (рівень, кількість учасників, репутацію, місце в рейтингу).
- **Видалення списку учасників:** Повністю вилучено детальний склад членів організації (ростер) та прибрано кнопку розгортання складу, щоб не світити сім'ю.
- **Зміна умов вступу:** Знижено вимоги до ігрового рівня для вступу до компанії з 10+ до **1+ LVL** (в розділі "Про нас").
- **Гумористичний опис:** У Hero-підзаголовок додано жартівливу історію про "королівську сім'ю, де є Госпожа та її раби".
- **Очищення та оновлення даних автопарку на Головній сторінці:**
  - Замість слайдера реалізовано статичну сітку з 3 картками для основних моделей вантажівок компанії (**Ceterpilort ST680**, **Fraitliner N2**, **Steelbilt 389**).
  - Використано чисті та професійно обрізані зображення автомобілів (без зелених позначок "Доступно" та тексту в дужках).
  - На картках відображається точна кількість одиниць техніки в автопарку (4 од., 1 од., 2 од.), а також загальна кількість машин у ТК — **7 вантажівок**.
  - Повністю вилучено технічну інформацію (номери в дужках, дані про паркування та паливо).
- **Тимчасове приховання розділів робіт:** Розділи вакансій у "Каталозі робіт" (водій автобуса, будівельник, дроворуб, інкасатор) переведено у статус "В розробці" — при кліці на них відображається заглушка, а активним залишається лише детальний опис далекобійника.
- **Оновлення термінології:** Перейменовано поради далекобійникам з "Поради від сім'ї" на "Поради від компанії".

## [0.0.2] — 2026-08-19
### Змінено
- Оновлено показники сім'ї згідно з актуальними даними гри: рівень сім'ї = 14, гравці 47/50, автопарк 14/15, репутація 183.5k та рейтинг 72.
- Інтегровано офіційний векторний логотип сім'ї `assets/logo.svg` в шапку сайту.
- Оновлено ТК GREATNESS LOGISTICS: підвищено рівень компанії до 7, видалено бонуси безкоштовного палива та 100% ремонту авто.
- Актуалізовано вимоги для вступу: вік 30+, рівень гри 10+, наявність мікрофону (бажано), дотримання правил сім'ї (обов'язково).
- Оновлено інформацію для далекобійників відповідно до вантажівкапарку ТК (Ceterpilort ST680, Steelbilt 389, Fraitliner N2).
- Оновлено сімейний автопарк відповідно до скріншотів (Ubermacht X7, Benefactor AWG H63 6x6, Chawrole Carvotte ZR1, Vapid GS Superia, Buntley Convidenal GT, Pfister Teycan).
- Додано повний склад членів організації (від лідера до знайомих) з інтерактивною кнопкою для розгортання всього списку.

## [0.0.1] — 2026-08-19
### Додано
- Ініціалізація проекту: базові файли `index.html`, `style.css` та `app.js`.
- Налаштування структури адаптивного сайту-візитки для сім'ї **GREATNESS** (сервер Ukraine GTA 5).
- Реалізація головного екрану (Hero Section) з назвою сім'ї, контактами, рейтингом та інформаційним блоком про Транспортну Компанію (ТК).
- Інформаційні розділи:
  - **Сім'я** (Про нас, умови вступу, склад сім'ї).
  - **Робота** (Далекобійник, водій автобуса, будівельник, дроворуб, інкасатор).
  - **Автопарк** (Розподіл на легкові та вантажні автомобілі).
  - **Скупники (Ціни)** (Таблиці актуальних цін скупників риби, грибів, овочів, сміття та цінних товарів із інтерактивним калькулятором прибутку).
  - **Галерея** (Скріншоти сім'ї з ефектом Lightbox).
- Адаптивна мобільна версія (бургер-меню, оптимізовані сітки та картки).
- Повна підтримка української мови.
- Файли документації: `README.md` та `PATCHNOTES.md`.

## [1.4.1] - 2026-08-22
### Змінено
- Дату та час у журналі скорочено до формату `21.08.26 18:01`.
- Контракти в матриці сортуються за назвою та рівнем I, II, III.
- Прибрано дублюючу колонку/показник компенсації з журналу та статистики.
- Активний період тепер показується біля кожної аналітичної таблиці.
- Додано скидання пошуку після фільтрації за конкретним гравцем.
- Усі таблиці використовують один активний фільтр періоду та пошуку.
- Додано окремий звіт для видачі премій: період, гравець, сума до виплати, загальна сума; сортування від більшої суми до меншої.
- Додано кнопку копіювання звіту для передачі відповідальному за виплати.

## [1.4.2] - 2026-08-22
### Журнал контрактів - UX та звітність
- Фільтр журналу закріплено під час прокрутки, щоб період і пошук були доступні без повернення нагору.
- У таблиці «Виплати гравцям за обраний період» прибрано колонки «Нараховано» та «Виплачено», а також окремі кнопки фільтра біля гравців.
- У «Повний журнал» додано колонку «Частка контракту»: 1 для одного учасника, 0.5 для двох, 0.33 для трьох тощо.
- Пошук отримав підказки за наявними ніками гравців і назвами контрактів під час введення.
- Додано довідкову таблицю «Контракти та їх цінність». Вона використовує тільки дані зі збережених скріншотів і не генерує значення самостійно.
- Для довільного періоду використовуються календарі. Після вибору дати «З» інтерфейс одразу переводить користувача до вибору дати «По».
- Мобільне відображення sticky-фільтра адаптовано: кнопки періодів можна горизонтально прокручувати, а блок не перекриває весь екран.

## [1.6.1] - 2026-08-23
### OCR компенсації
- Додано безпечний fallback компенсації з навчального каталогу контрактів у Google Sheets.
- Якщо назву контракту впевнено розпізнано, але сума на фото занадто дрібна або засвічена, сайт підставляє компенсацію тільки з уже підтвердженого запису цього контракту.
- Якщо для однієї назви в каталозі існують різні суми, автоматичне підставлення вимикається - значення не вгадується.
- Для `Продаж трофеїв II`, який уже підтверджено реальним скріншотом, резервне значення становить `$140 000`.

## [1.6.5] - 2026-08-23
### Виправлено
- Виправлено помилкове визначення всього темного GTA-кадру як області планшета.
- Для складних фото з телефону використовується калібрований crop планшета, якщо авто-детектор не може надійно відокремити його від темного фону гри.
- Full-frame OCR fallback тепер сканує вже збільшену область планшета, а не оригінальне фото цілком. Це суттєво збільшує текст назви контракту та грошової компенсації перед OCR.
- Логіка fallback не підставляє вигадані значення: нерозпізнані поля залишаються на перевірку.

## [1.6.7] - 2026-08-23
### Виправлено
- Для фото з телефону OCR правої панелі контракту тепер перевіряє кілька перекривних зон замість однієї фіксованої області.
- Текст із цих зон об'єднується перед визначенням назви контракту та грошової компенсації.
- Нерозпізнана назва більше не повинна виглядати як валідне значення з placeholder.
- Дата, яка вже коректно читається з верхнього лівого кута, не змінювалась.

## v1.7.6
- Fixed time rescue for camera photos where the in-game tablet is offset inside the full image.
- Time OCR now scans overlapping top status-bar strips across the first 42% of the source image instead of assuming the clock is at x=0.
- Contract title, date parsing and compensation logic are unchanged.
## v1.9.22 - Recent participant ranking + verified Save All
- Participant dropdowns are ranked by journal participation in the rolling last 14 days (descending), then alphabetically.
- Players with no activity in the last 14 days remain alphabetically sorted after active players.
- One shared contract counts as one participation for dropdown ranking, regardless of payout share.
- "Save all and open journal" now verifies every newly saved contract ID after Google Sheets reload and retries only missing rows once before clearing screenshots.
- OCR, Gemini fallback chain, journal matrix calculations, contract catalog learning, and payout logic are unchanged from v1.9.21.


## v1.9.31 - Card action button layout fix
- Rebalanced the three contract-card action buttons without reducing the 14px label font.
- The OCR button now reserves a dedicated icon column and a wider text area, preventing the icon from escaping left and `Сканування` from being clipped.
- `Додати в журнал` keeps its readable two-line label; `Видалити` stays on one line.
- No OCR, journal, Save All, duplicate, matrix, payout, or Google Sheets logic was changed.

## v1.9.34 - Security hardening
- Moved Contracts password validation from browser JavaScript to Apps Script.
- Added 12-hour signed auth tokens for list/catalog/upsert/delete.
- Removed destructive replaceAll API endpoint.
- Limited delete and upsert mutations to one record per request.
- Added Contract Audit Log for server-side mutation history.
- Removed hardcoded Vision proxy token from Code.gs and server.py; it now comes from secret configuration.
