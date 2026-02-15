// Saforia - Safety Analyzer Module
// Default module. Analyzes AI-generated text across 6 safety categories.

import { t, onLocaleChange } from '../i18n.js';
import { analyzeText, CATEGORY_KEYS, getSeverityLabel } from '../lib/analyzer-engine.js';
import { exportJSON, exportCSV } from '../lib/export.js';
import { radarChart } from '../lib/charts.js';

let state = { text: '', results: null, analyzing: false, activeTab: null };
let container = null;
let unsubLocale = null;

const CATEGORY_I18N = {
    toxicity: 'analyzer.toxicity',
    bias: 'analyzer.bias',
    manipulation: 'analyzer.manipulation',
    hallucination_indicators: 'analyzer.hallucination',
    security: 'analyzer.security',
    privacy: 'analyzer.privacy'
};

function getWordCount(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function renderInput() {
    const words = getWordCount(state.text);
    const chars = state.text.length;

    return `
        <section class="container" style="padding-top: var(--space-6);">
            <h1>${t('analyzer.title')}</h1>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--space-4);">${t('analyzer.subtitle')}</p>

            <div class="card" style="padding: var(--space-4);">
                <label class="label" for="analyzer-input">${t('analyzer.input_label')}</label>
                <textarea class="textarea" id="analyzer-input" rows="8"
                    placeholder="${t('analyzer.input_placeholder')}"
                    style="min-height: 150px;">${state.text}</textarea>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-2);">
                    <span style="font-size: 0.8125rem; color: var(--color-text-muted);">
                        ${chars} ${t('analyzer.characters') || 'chars'} / ${words} ${t('analyzer.words')}
                    </span>
                    <button class="btn btn-primary btn-lg" id="analyze-btn" ${state.analyzing ? 'disabled' : ''}>
                        ${state.analyzing ? `<span class="spinner" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;"></span>${t('analyzer.analyzing')}` : t('analyzer.analyze_btn')}
                    </button>
                </div>
            </div>
        </section>
    `;
}

function severityBadgeClass(severity) {
    const map = { safe: 'badge-safe', low: 'badge-info', medium: 'badge-caution', high: 'badge-danger', critical: 'badge-danger' };
    return map[severity] || 'badge-caution';
}

function severityLabel(score) {
    const sev = getSeverityLabel(score);
    const labels = {
        safe: t('analyzer.safe'),
        low: t('analyzer.low_risk'),
        medium: t('analyzer.medium_risk'),
        high: t('analyzer.high_risk'),
        critical: t('analyzer.critical_risk')
    };
    return labels[sev] || sev;
}

function renderResults() {
    if (!state.results) return '';
    const r = state.results;

    // Score cards
    const categoryCards = CATEGORY_KEYS.map(key => {
        const cat = r.categories[key];
        return `<saforia-score-card score="${cat.score}" label="${t(CATEGORY_I18N[key])}" size="90"></saforia-score-card>`;
    }).join('');

    // Radar chart
    const radarData = CATEGORY_KEYS.map(k => r.categories[k].score);
    const radarLabels = CATEGORY_KEYS.map(k => t(CATEGORY_I18N[k]));
    const radar = radarChart(radarData, { size: 280, labels: radarLabels, ariaLabel: t('analyzer.category_breakdown') });

    // Active tab
    const activeTab = state.activeTab || CATEGORY_KEYS[0];

    // Tabs
    const tabs = CATEGORY_KEYS.map(key =>
        `<button class="tab${activeTab === key ? ' active' : ''}" data-tab="${key}">${t(CATEGORY_I18N[key])} (${r.categories[key].count})</button>`
    ).join('');

    // Tab content
    const activeCat = r.categories[activeTab];
    let tabContent = '';
    if (activeCat.count === 0) {
        tabContent = `<p style="color: var(--color-text-muted); padding: var(--space-3);">${t('analyzer.no_indicators')}</p>`;
    } else {
        tabContent = `
            <div class="progress" style="margin: var(--space-3) 0;">
                <div class="progress-bar" style="width: ${100 - activeCat.score}%; background: var(--color-danger);"></div>
            </div>
            <table class="table-wrapper">
                <thead><tr>
                    <th>${t('analyzer.indicators_found')}</th>
                    <th>${t('redteam.severity')}</th>
                    <th>Context</th>
                </tr></thead>
                <tbody>
                    ${activeCat.matches.map(m => {
                        // Extract context around the match
                        const pos = m.position || 0;
                        const start = Math.max(0, pos - 40);
                        const end = Math.min(state.text.length, pos + m.term.length + 40);
                        const before = state.text.slice(start, pos);
                        const matched = state.text.slice(pos, pos + m.term.length);
                        const after = state.text.slice(pos + m.term.length, end);
                        const context = `${start > 0 ? '...' : ''}${escapeHtml(before)}<mark style="background: ${m.severity >= 4 ? 'var(--color-danger-light, #fee2e2)' : 'var(--color-warning-light, #fef3c7)'}">${escapeHtml(matched)}</mark>${escapeHtml(after)}${end < state.text.length ? '...' : ''}`;

                        return `<tr>
                            <td><code>${escapeHtml(m.term)}</code> <span class="badge badge-info">${m.category}</span></td>
                            <td>${'&#9632;'.repeat(m.severity)}${'&#9633;'.repeat(5 - m.severity)}</td>
                            <td style="font-size:0.8125rem;">${context}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    return `
        <section class="container" style="margin-top: var(--space-6);">
            <h2>${t('analyzer.results_title')}</h2>

            <div style="display: flex; flex-wrap: wrap; gap: var(--space-6); align-items: flex-start; margin: var(--space-4) 0;">
                <div style="text-align: center;">
                    <saforia-score-card score="${r.overallScore}" label="${t('analyzer.overall_score')}" size="160"></saforia-score-card>
                    <div style="margin-top: var(--space-2);">
                        <span class="badge ${severityBadgeClass(r.severity)}">${severityLabel(r.overallScore)}</span>
                    </div>
                </div>
                <div style="flex: 1; min-width: 280px;">
                    ${radar}
                </div>
            </div>

            <div class="grid-3" style="margin: var(--space-4) 0;">
                ${categoryCards}
            </div>

            <h3 style="margin-top: var(--space-6);">${t('analyzer.category_breakdown')}</h3>
            <div class="tabs" style="margin-bottom: var(--space-3);">
                ${tabs}
            </div>
            <div class="card" style="padding: var(--space-3);" id="tab-content">
                ${tabContent}
            </div>

            <details style="margin-top: var(--space-4);">
                <summary style="cursor: pointer; font-weight: 600;">${t('analyzer.methodology')}</summary>
                <div class="card" style="padding: var(--space-3); margin-top: var(--space-2);">
                    <p style="font-size: 0.875rem; color: var(--color-text-secondary);">${t('analyzer.methodology_text')}</p>
                    <div style="margin-top: var(--space-3);">
                        <strong>${t('analyzer.confidence_level')}:</strong>
                        <span class="badge badge-info">${r.metadata.confidence}</span>
                        <span style="font-size:0.8125rem; color: var(--color-text-muted); margin-left: var(--space-2);">
                            (${r.metadata.textLength} ${t('analyzer.words')})
                        </span>
                    </div>
                    <div style="margin-top: var(--space-2);">
                        <strong>${t('analyzer.version')}:</strong> ${r.metadata.version}
                    </div>
                    <div style="margin-top: var(--space-2);">
                        <strong>${t('analyzer.timestamp')}:</strong> ${r.metadata.timestamp}
                    </div>
                </div>
            </details>

            <div class="card" style="padding: var(--space-3); margin-top: var(--space-3);">
                <strong>${t('analyzer.reproducibility')}:</strong>
                <div style="display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-1);">
                    <code style="font-size: 0.75rem; word-break: break-all; flex: 1; background: var(--color-bg-tertiary); padding: var(--space-2); border-radius: var(--radius-sm);">${r.metadata.hash}</code>
                    <button class="btn btn-secondary btn-sm" id="copy-hash-btn">Copy</button>
                </div>
            </div>

            <div style="display: flex; gap: var(--space-2); margin-top: var(--space-4); justify-content: flex-end;">
                <button class="btn btn-secondary" id="export-json-btn">${t('analyzer.export_json')}</button>
                <button class="btn btn-secondary" id="export-csv-btn">${t('analyzer.export_csv')}</button>
            </div>
        </section>
    `;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function wireEvents() {
    const input = container.querySelector('#analyzer-input');
    if (input) {
        input.addEventListener('input', (e) => {
            state.text = e.target.value;
            // Update counter
            const counter = container.querySelector('.card span[style*="color: var(--color-text-muted)"]');
            if (counter) {
                const words = getWordCount(state.text);
                counter.textContent = `${state.text.length} ${t('analyzer.characters') || 'chars'} / ${words} ${t('analyzer.words')}`;
            }
        });
    }

    const analyzeBtn = container.querySelector('#analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            if (!state.text.trim() || state.analyzing) return;
            state.analyzing = true;
            render(container);

            try {
                state.results = await analyzeText(state.text);
                state.activeTab = CATEGORY_KEYS[0];
            } catch (err) {
                console.error('Analysis failed:', err);
            }

            state.analyzing = false;
            render(container);
        });
    }

    // Tab switching
    container.querySelectorAll('[data-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            state.activeTab = tab.dataset.tab;
            render(container);
        });
    });

    // Copy hash
    const copyBtn = container.querySelector('#copy-hash-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(state.results.metadata.hash).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
            });
        });
    }

    // Export buttons
    const jsonBtn = container.querySelector('#export-json-btn');
    if (jsonBtn) {
        jsonBtn.addEventListener('click', () => {
            exportJSON(state.results, `saforia-analysis-${Date.now()}.json`);
        });
    }

    const csvBtn = container.querySelector('#export-csv-btn');
    if (csvBtn) {
        csvBtn.addEventListener('click', () => {
            const rows = state.results.matches.map(m => ({
                category: m.mainCategory,
                subcategory: m.category,
                term: m.term,
                severity: m.severity,
                type: m.type,
                position: m.position
            }));
            exportCSV(rows, null, `saforia-analysis-${Date.now()}.csv`);
        });
    }
}

export async function render(el) {
    container = el;

    // Preserve scroll position if re-rendering
    const scrollY = window.scrollY;

    container.innerHTML = `
        ${renderInput()}
        ${renderResults()}
    `;

    wireEvents();

    // Restore scroll
    window.scrollTo(0, scrollY);

    // Subscribe to locale changes (once)
    if (!unsubLocale) {
        unsubLocale = onLocaleChange(() => {
            if (container) render(container);
        });
    }
}
