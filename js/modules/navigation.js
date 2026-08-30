/**
 * Single-page navigation and mobile menu controls.
 *
 * This module owns only the DOM behavior for its feature area. Keeping feature
 * logic isolated makes the site easier to debug and change without touching
 * unrelated functionality.
 */
window.GreatnessApp = window.GreatnessApp || {};

window.GreatnessApp.initNavigation = function initNavigation() {
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
    const knownTabs = new Set([...navLinks].map(link => link.getAttribute('data-tab')).filter(Boolean));
    if (initialHash && knownTabs.has(initialHash)) {
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
};
