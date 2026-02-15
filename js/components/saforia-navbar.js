// Saforia - Navigation Bar Web Component

import { t, getLocale, setLocale, getSupportedLocales, onLocaleChange } from '../i18n.js';
import { toggleTheme, getTheme } from '../app.js';

const LOCALE_LABELS = { en: 'EN', es: 'ES' };

class SaforiaNavbar extends HTMLElement {
    connectedCallback() {
        this.render();
        this._unsubLocale = onLocaleChange(() => this.render());
        window.addEventListener('hashchange', () => this.updateActive());
    }

    disconnectedCallback() {
        if (this._unsubLocale) this._unsubLocale();
    }

    render() {
        const links = [
            { path: '/analyzer', key: 'nav.analyzer' },
            { path: '/experiment', key: 'nav.experiment' },
            { path: '/observatory', key: 'nav.observatory' },
            { path: '/redteam', key: 'nav.redteam' },
            { path: '/certification', key: 'nav.certification' }
        ];

        const hash = window.location.hash || '#/analyzer';
        const currentPath = hash.startsWith('#') ? hash.slice(1) : '/analyzer';
        const locales = getSupportedLocales();
        const currentLocale = getLocale();
        const isDark = getTheme() === 'dark';

        this.innerHTML = `
            <nav class="saforia-nav" role="navigation" aria-label="Main navigation">
                <div class="nav-inner">
                    <a href="#/analyzer" class="nav-brand">
                        <img src="favicon.svg" alt="" width="24" height="24">
                        <span>${t('app.name')}</span>
                    </a>
                    <div class="nav-links" id="nav-links">
                        ${links.map(l => `
                            <a href="#${l.path}" class="nav-link${currentPath === l.path ? ' active' : ''}"
                               data-path="${l.path}">${t(l.key)}</a>
                        `).join('')}
                    </div>
                    <div class="nav-actions">
                        <div class="nav-locale">
                            ${locales.map(loc => `
                                <button class="nav-locale-btn${loc === currentLocale ? ' active' : ''}"
                                        data-locale="${loc}">${LOCALE_LABELS[loc] || loc.toUpperCase()}</button>
                            `).join('')}
                        </div>
                        <button class="btn-icon nav-theme" aria-label="${t('nav.theme_toggle')}" title="${t('nav.theme_toggle')}">
                            ${isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}
                        </button>
                        <button class="nav-hamburger btn-icon" aria-label="Menu" id="nav-hamburger">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <rect y="3" width="20" height="2" rx="1"/>
                                <rect y="9" width="20" height="2" rx="1"/>
                                <rect y="15" width="20" height="2" rx="1"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </nav>
        `;

        // Event listeners
        this.querySelectorAll('[data-locale]').forEach(btn => {
            btn.addEventListener('click', () => setLocale(btn.dataset.locale));
        });

        this.querySelector('.nav-theme').addEventListener('click', () => {
            toggleTheme();
            this.render();
        });

        const hamburger = this.querySelector('#nav-hamburger');
        const navLinks = this.querySelector('#nav-links');
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
    }

    updateActive() {
        const hash = window.location.hash || '#/analyzer';
        const currentPath = hash.startsWith('#') ? hash.slice(1) : '/analyzer';
        this.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.path === currentPath);
        });
    }
}

// Inject component styles
const style = document.createElement('style');
style.textContent = `
    .saforia-nav {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: var(--navbar-height);
        background: var(--color-bg-primary);
        border-bottom: 1px solid var(--color-border);
        z-index: 1000;
        box-shadow: var(--shadow-sm);
    }
    .nav-inner {
        max-width: var(--max-width);
        margin: 0 auto;
        padding: 0 var(--space-4);
        height: 100%;
        display: flex;
        align-items: center;
        gap: var(--space-4);
    }
    .nav-brand {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-weight: 700;
        font-size: 1.125rem;
        color: var(--color-accent);
        text-decoration: none;
        flex-shrink: 0;
    }
    .nav-links {
        display: flex;
        gap: var(--space-1);
        flex: 1;
        overflow-x: auto;
    }
    .nav-link {
        padding: var(--space-2) var(--space-3);
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        text-decoration: none;
        border-radius: var(--radius-md);
        white-space: nowrap;
        transition: all var(--transition);
    }
    .nav-link:hover {
        color: var(--color-text-primary);
        background: var(--color-bg-tertiary);
        text-decoration: none;
    }
    .nav-link.active {
        color: var(--color-accent);
        background: var(--color-accent-light);
    }
    .nav-actions {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-shrink: 0;
    }
    .nav-locale {
        display: flex;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        overflow: hidden;
    }
    .nav-locale-btn {
        padding: var(--space-1) var(--space-2);
        font-size: 0.6875rem;
        font-weight: 600;
        background: transparent;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        font-family: inherit;
    }
    .nav-locale-btn.active {
        background: var(--color-accent);
        color: var(--color-text-inverse);
    }
    .nav-hamburger {
        display: none;
    }
    @media (max-width: 768px) {
        .nav-links {
            display: none;
            position: absolute;
            top: var(--navbar-height);
            left: 0;
            right: 0;
            background: var(--color-bg-primary);
            border-bottom: 1px solid var(--color-border);
            flex-direction: column;
            padding: var(--space-2);
            box-shadow: var(--shadow-md);
        }
        .nav-links.open {
            display: flex;
        }
        .nav-hamburger {
            display: inline-flex;
        }
    }
`;
document.head.appendChild(style);

customElements.define('saforia-navbar', SaforiaNavbar);
