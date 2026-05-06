const DEFAULT_THEME = 'dark';
const LIGHT_THEME = 'light';
const STORAGE_KEY = 'excel-mapping-theme';

export function getInitialTheme() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
}

export function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
}

export function getNextTheme(currentTheme) {
    return currentTheme === DEFAULT_THEME ? LIGHT_THEME : DEFAULT_THEME;
}
