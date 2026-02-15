// Saforia - Safety Lexicon Loader
// Loads language-specific lexicons from data/lexicons/ directory.
// Lexicons contain weighted terms for safety analysis categories.

import { getLocale } from '../i18n.js';

const cache = {};

/**
 * Load the safety lexicon for the current (or specified) locale.
 * Falls back to English if the locale-specific lexicon is unavailable.
 */
export async function loadLexicon(locale) {
    locale = locale || getLocale();

    if (cache[locale]) return cache[locale];

    try {
        const url = new URL(`../../data/lexicons/${locale}.json`, import.meta.url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const lexicon = await response.json();
        cache[locale] = lexicon;
        return lexicon;
    } catch (err) {
        if (locale !== 'en') {
            console.warn(`Lexicon for ${locale} not found, falling back to English.`);
            return loadLexicon('en');
        }
        throw new Error(`Failed to load safety lexicon: ${err.message}`);
    }
}

/**
 * Clear the lexicon cache (useful for testing).
 */
export function clearLexiconCache() {
    Object.keys(cache).forEach(k => delete cache[k]);
}
