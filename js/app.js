// Saforia - Application Bootstrap
// Initializes i18n, registers routes, sets up theme, starts router.

import { initI18n, t, onLocaleChange } from './i18n.js';
import { registerRoute, startRouter } from './router.js';
import './components/saforia-navbar.js';
import './components/saforia-score-card.js';

// Theme management
function initTheme() {
    const saved = localStorage.getItem('saforia-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('saforia-theme', next);
}

export function getTheme() {
    return document.documentElement.getAttribute('data-theme');
}

// Disclaimer
function updateDisclaimer() {
    const el = document.getElementById('disclaimer');
    if (el) {
        el.textContent = t('disclaimer');
    }
}

// Boot
async function bootstrap() {
    initTheme();
    await initI18n();

    // Register routes with lazy-loaded modules
    registerRoute('/analyzer', () => import('./modules/analyzer.js'));
    registerRoute('/experiment', () => import('./modules/experiment.js'));
    registerRoute('/observatory', () => import('./modules/observatory.js'));
    registerRoute('/redteam', () => import('./modules/redteam.js'));
    registerRoute('/certification', () => import('./modules/certification.js'));

    // Update disclaimer on locale change
    onLocaleChange(updateDisclaimer);
    updateDisclaimer();

    // Start routing
    startRouter();

    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn('Service Worker registration failed:', err);
        });
    }
}

bootstrap().catch(err => {
    console.error('Saforia bootstrap failed:', err);
    document.getElementById('main-content').innerHTML =
        `<div class="container"><div class="alert alert-danger">Failed to initialize: ${err.message}</div></div>`;
});
