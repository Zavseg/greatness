/**
 * Vehicle fleet category filtering.
 *
 * This module owns only the DOM behavior for its feature area. Keeping feature
 * logic isolated makes the site easier to debug and change without touching
 * unrelated functionality.
 */
window.GreatnessApp = window.GreatnessApp || {};

window.GreatnessApp.initFleetFilter = function initFleetFilter() {
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
};
