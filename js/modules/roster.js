/**
 * Extended family roster show/hide behavior.
 *
 * This module owns only the DOM behavior for its feature area. Keeping feature
 * logic isolated makes the site easier to debug and change without touching
 * unrelated functionality.
 */
window.GreatnessApp = window.GreatnessApp || {};

window.GreatnessApp.initRosterToggle = function initRosterToggle() {
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
};
