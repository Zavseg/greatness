/**
 * Home-page transport company fleet carousel.
 *
 * This module owns only the DOM behavior for its feature area. Keeping feature
 * logic isolated makes the site easier to debug and change without touching
 * unrelated functionality.
 */
window.GreatnessApp = window.GreatnessApp || {};

window.GreatnessApp.initFleetSlider = function initFleetSlider() {
    const slides = document.querySelectorAll('#fleet-slider .slide');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    const dotsContainer = document.getElementById('slider-dots');
    let currentSlide = 0;
    let slideInterval;

    if (slides.length > 0 && dotsContainer) {
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
            if (slider) {
                slider.style.transform = `translateX(-${currentSlide * 100}%)`;
            }

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
        startTimer();
    }
};
