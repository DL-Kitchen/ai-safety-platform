// Saforia - Internationalization Engine
// Loads JSON locale files, provides t('key') translation function,
// detects browser language, falls back to English.

const SUPPORTED_LOCALES = ['en', 'es'];
const DEFAULT_LOCALE = 'en';

let currentLocale = DEFAULT_LOCALE;
let translations = {};
let listeners = [];

function detectLocale() {
    const saved = localStorage.getItem('saforia-locale');
    if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;

    const browserLangs = navigator.languages || [navigator.language];
    for (const lang of browserLangs) {
        const code = lang.split('-')[0].toLowerCase();
        if (SUPPORTED_LOCALES.includes(code)) return code;
    }
    return DEFAULT_LOCALE;
}

async function loadLocale(locale) {
    try {
        const url = new URL(`../locales/${locale}.json`, import.meta.url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        console.warn(`Failed to load locale ${locale}:`, err);
        if (locale !== DEFAULT_LOCALE) {
            return loadLocale(DEFAULT_LOCALE);
        }
        return {};
    }
}

export async function initI18n() {
    currentLocale = detectLocale();
    translations = await loadLocale(currentLocale);
    document.documentElement.lang = currentLocale;
}

export async function setLocale(locale) {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    currentLocale = locale;
    translations = await loadLocale(locale);
    localStorage.setItem('saforia-locale', locale);
    document.documentElement.lang = locale;
    listeners.forEach(fn => fn(locale));
}

export function getLocale() {
    return currentLocale;
}

export function getSupportedLocales() {
    return [...SUPPORTED_LOCALES];
}

export function onLocaleChange(fn) {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
}

/**
 * Translate a key using dot notation.
 * t('analyzer.title') looks up translations.analyzer.title
 * Supports {variable} interpolation: t('greeting', { name: 'World' })
 */
export function t(key, vars = {}) {
    const parts = key.split('.');
    let value = translations;
    for (const part of parts) {
        if (value == null || typeof value !== 'object') { value = undefined; break; }
        value = value[part];
    }

    if (typeof value !== 'string') return key;

    // Interpolate {variables}
    return value.replace(/\{(\w+)\}/g, (_, name) =>
        vars[name] !== undefined ? String(vars[name]) : `{${name}}`
    );
}
