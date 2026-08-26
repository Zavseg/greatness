/**
 * Buyer price database and profit calculator.
 *
 * This module owns only the DOM behavior for its feature area. Keeping feature
 * logic isolated makes the site easier to debug and change without touching
 * unrelated functionality.
 */
window.GreatnessApp = window.GreatnessApp || {};

window.GreatnessApp.initPrices = function initPrices() {
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
};
