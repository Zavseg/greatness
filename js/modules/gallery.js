/**
 * Gallery lightbox, navigation, and keyboard controls.
 *
 * This module owns only the DOM behavior for its feature area. Keeping feature
 * logic isolated makes the site easier to debug and change without touching
 * unrelated functionality.
 */
window.GreatnessApp = window.GreatnessApp || {};

window.GreatnessApp.initGallery = function initGallery() {
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
};
