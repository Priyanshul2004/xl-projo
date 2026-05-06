const DEFAULT_THEME = 'dark';
const LIGHT_THEME = 'light';
const STORAGE_KEY = 'excel-mapping-theme';

export class ThemeManager {
    constructor(toggleButtonId = 'themeToggleBtn') {
        this.toggleButton = document.getElementById(toggleButtonId);
        this.currentTheme = this.getSavedTheme() || DEFAULT_THEME;
    }

    initialize() {
        this.applyTheme(this.currentTheme);
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => this.toggleTheme());
        }
        this.updateToggleLabel();
    }

    getSavedTheme() {
        return localStorage.getItem(STORAGE_KEY);
    }

    saveTheme(theme) {
        localStorage.setItem(STORAGE_KEY, theme);
    }

    applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.saveTheme(theme);
        this.updateToggleLabel();
    }

    toggleTheme() {
        const nextTheme = this.currentTheme === DEFAULT_THEME ? LIGHT_THEME : DEFAULT_THEME;
        this.applyTheme(nextTheme);
    }

    updateToggleLabel() {
        if (!this.toggleButton) return;
        this.toggleButton.textContent = this.currentTheme === DEFAULT_THEME
            ? 'Switch to light'
            : 'Switch to default';
    }
}
