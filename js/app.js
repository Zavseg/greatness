/**
 * GREATNESS portal application bootstrap.
 *
 * Feature scripts register their initializer on window.GreatnessApp. This keeps
 * the project modular while preserving direct file:// usage with no build step.
 */
document.addEventListener('DOMContentLoaded', () => {
    const app = window.GreatnessApp || {};

    [
        app.initNavigation,
        app.initFleetSlider,
        app.initJobsCatalog,
        app.initFleetFilter,
        app.initPrices,
        app.initGallery,
        app.initRosterToggle,
        app.initContracts,
    ].forEach((initializeFeature) => {
        if (typeof initializeFeature === 'function') {
            initializeFeature();
        }
    });
});
