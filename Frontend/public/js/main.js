import { ThemeManager } from './modules/themeManager.js';
import { ExcelMappingApp } from './modules/excelMappingApp.js';

document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingOverlayText');

    loadingOverlay?.classList.add('active');
    loadingOverlay?.setAttribute('aria-hidden', 'false');

    let progress = 0;
    const totalDuration = 2000;
    const intervalDuration = Math.floor(totalDuration / 100);

    const progressTimer = setInterval(() => {
        progress += 1;
        if (loadingText) {
            loadingText.textContent = `Loading ${progress}%`;
        }

        if (progress >= 100) {
            clearInterval(progressTimer);
            loadingOverlay?.classList.remove('active');
            loadingOverlay?.setAttribute('aria-hidden', 'true');

            const themeManager = new ThemeManager();
            themeManager.initialize();

            const app = new ExcelMappingApp();
            window.app = app;
        }
    }, intervalDuration);
});
