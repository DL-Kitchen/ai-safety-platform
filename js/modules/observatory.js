// Saforia - Risk Observatory Module
// Educational dashboard with AI risk taxonomy, 5x5 risk matrix, and filterable risk cards.

import { t, onLocaleChange, getLocale } from '../i18n.js';
import { heatmapCell, barChart } from '../lib/charts.js';

let container = null;
let unsubLocale = null;
let taxonomy = null;

let state = {
    categoryFilter: 'all',
    sortBy: 'risk_score_desc',
    timeframeFilter: 'all'
};

async function loadTaxonomy() {
    if (taxonomy) return;
    try {
        const resp = await fetch('data/risk-taxonomy.json');
        taxonomy = await resp.json();
    } catch { taxonomy = { categories: [], risks: [] }; }
}

function lang() {
    return getLocale().startsWith('es') ? 'es' : 'en';
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getFilteredRisks() {
    let risks = [...taxonomy.risks];
    if (state.categoryFilter !== 'all') {
        risks = risks.filter(r => r.category === state.categoryFilter);
    }
    if (state.timeframeFilter !== 'all') {
        risks = risks.filter(r => r.timeframe === state.timeframeFilter);
    }
    switch (state.sortBy) {
        case 'risk_score_desc': risks.sort((a, b) => b.risk_score - a.risk_score); break;
        case 'risk_score_asc': risks.sort((a, b) => a.risk_score - b.risk_score); break;
        case 'impact': risks.sort((a, b) => b.impact - a.impact); break;
        case 'probability': risks.sort((a, b) => b.probability - a.probability); break;
    }
    return risks;
}

function timeframeLabel(tf) {
    const map = { present: t('observatory.present'), near_term: t('observatory.near_term'), long_term: t('observatory.long_term') };
    return map[tf] || tf;
}

function severityBars(val, max = 5) {
    return '&#9632;'.repeat(val) + '&#9633;'.repeat(max - val);
}

function getCategoryName(catId) {
    const cat = taxonomy.categories.find(c => c.id === catId);
    return cat ? cat[`name_${lang()}`] : catId;
}

function categoryBadgeColor(catId) {
    const colors = { reliability: '#0284c7', bias: '#7c3aed', privacy: '#dc2626', misuse: '#ea580c', societal: '#d97706', alignment: '#059669' };
    return colors[catId] || '#6b7280';
}

// ─── Risk Matrix 5x5 ───

function renderRiskMatrix() {
    const risks = taxonomy.risks;
    // Build matrix: matrix[impact][probability] = count of risks
    const matrix = {};
    for (let i = 1; i <= 5; i++) {
        matrix[i] = {};
        for (let p = 1; p <= 5; p++) matrix[i][p] = [];
    }
    for (const r of risks) {
        matrix[r.impact][r.probability].push(r);
    }

    let rows = '';
    const impactLabels = ['', 'Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];
    for (let i = 5; i >= 1; i--) {
        let cells = `<td style="font-weight:600;font-size:0.75rem;padding:0.5rem;text-align:right;">${i} - ${impactLabels[i]}</td>`;
        for (let p = 1; p <= 5; p++) {
            const riskList = matrix[i][p];
            const score = i * p;
            const bg = heatmapCell(score);
            const tooltip = riskList.map(r => r[`name_${lang()}`]).join(', ') || '-';
            cells += `<td style="background:${bg};color:#fff;text-align:center;padding:0.5rem;font-weight:600;font-size:0.875rem;cursor:default;" title="${esc(tooltip)}">${riskList.length > 0 ? riskList.length : ''}</td>`;
        }
        rows += `<tr>${cells}</tr>`;
    }

    const probLabels = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
    const headerCells = probLabels.map((l, i) => `<th style="text-align:center;font-size:0.7rem;padding:0.25rem;">${i + 1}<br>${l}</th>`).join('');

    return `<div style="overflow-x:auto;margin-bottom:var(--space-4);">
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
            <thead>
                <tr><th style="text-align:right;font-size:0.7rem;">${t('observatory.impact')} &darr; / ${t('observatory.probability')} &rarr;</th>${headerCells}</tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
}

// ─── Stats Summary ───

function renderStats() {
    const catCounts = {};
    for (const cat of taxonomy.categories) catCounts[cat.id] = 0;
    for (const r of taxonomy.risks) catCounts[r.category] = (catCounts[r.category] || 0) + 1;

    const data = taxonomy.categories.map(c => catCounts[c.id]);
    const labels = taxonomy.categories.map(c => c[`name_${lang()}`]);

    return barChart(data, {
        width: 450, height: 200, labels,
        horizontal: true, ariaLabel: 'Risks per category'
    });
}

// ─── Risk Cards ───

function renderRiskCard(risk) {
    const catName = getCategoryName(risk.category);
    const catColor = categoryBadgeColor(risk.category);

    return `<div class="card" style="padding:var(--space-3);margin-bottom:var(--space-3);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-2);">
            <div>
                <h3 style="margin-bottom:var(--space-1);">${risk[`name_${lang()}`]}</h3>
                <span class="badge" style="background:${catColor};color:#fff;">${catName}</span>
                <span class="badge badge-info">${timeframeLabel(risk.timeframe)}</span>
            </div>
            <div style="text-align:center;min-width:60px;">
                <div style="font-size:1.5rem;font-weight:700;color:${heatmapCell(risk.risk_score)};">${risk.risk_score}</div>
                <div style="font-size:0.7rem;color:var(--color-text-muted);">${t('observatory.risk_score')}</div>
            </div>
        </div>

        <p style="margin:var(--space-2) 0;color:var(--color-text-secondary);font-size:0.875rem;">${risk[`description_${lang()}`]}</p>

        <div style="display:flex;gap:var(--space-4);font-size:0.8125rem;margin:var(--space-2) 0;">
            <div><strong>${t('observatory.impact')}:</strong> ${severityBars(risk.impact)}</div>
            <div><strong>${t('observatory.probability')}:</strong> ${severityBars(risk.probability)}</div>
        </div>

        <details>
            <summary style="cursor:pointer;font-weight:600;font-size:0.875rem;margin-top:var(--space-2);">${t('observatory.evidence_mitigation')}</summary>
            <div style="padding:var(--space-2) 0;font-size:0.8125rem;">
                <p><strong>${t('observatory.evidence')}:</strong> ${risk[`evidence_${lang()}`]}</p>
                <p style="margin-top:var(--space-1);"><strong>${t('observatory.mitigation')}:</strong> ${risk[`mitigation_${lang()}`]}</p>
                ${risk.incidents && risk.incidents.length > 0 ? `
                    <div style="margin-top:var(--space-2);">
                        <strong>Incidents:</strong>
                        <ul style="margin:var(--space-1) 0;padding-left:var(--space-4);">
                            ${risk.incidents.map(inc => `<li><a href="${esc(inc.source)}" target="_blank" rel="noopener">${inc[`name_${lang()}`]}</a></li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        </details>
    </div>`;
}

// ─── Controls ───

function renderControls() {
    const catOpts = taxonomy.categories.map(c =>
        `<option value="${c.id}" ${state.categoryFilter === c.id ? 'selected' : ''}>${c[`name_${lang()}`]}</option>`
    ).join('');

    return `<div style="display:flex;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-4);align-items:flex-end;">
        <div>
            <label class="label" style="font-size:0.75rem;">${t('observatory.filter_category')}</label>
            <select class="select" id="obs-category" style="min-width:160px;">
                <option value="all" ${state.categoryFilter === 'all' ? 'selected' : ''}>${t('observatory.all_categories')}</option>
                ${catOpts}
            </select>
        </div>
        <div>
            <label class="label" style="font-size:0.75rem;">${t('observatory.sort_by')}</label>
            <select class="select" id="obs-sort">
                <option value="risk_score_desc" ${state.sortBy === 'risk_score_desc' ? 'selected' : ''}>${t('observatory.sort_score_desc')}</option>
                <option value="risk_score_asc" ${state.sortBy === 'risk_score_asc' ? 'selected' : ''}>${t('observatory.sort_score_asc')}</option>
                <option value="impact" ${state.sortBy === 'impact' ? 'selected' : ''}>${t('observatory.sort_impact')}</option>
                <option value="probability" ${state.sortBy === 'probability' ? 'selected' : ''}>${t('observatory.sort_probability')}</option>
            </select>
        </div>
        <div>
            <label class="label" style="font-size:0.75rem;">${t('observatory.timeframe')}</label>
            <select class="select" id="obs-timeframe">
                <option value="all" ${state.timeframeFilter === 'all' ? 'selected' : ''}>All</option>
                <option value="present" ${state.timeframeFilter === 'present' ? 'selected' : ''}>${t('observatory.present')}</option>
                <option value="near_term" ${state.timeframeFilter === 'near_term' ? 'selected' : ''}>${t('observatory.near_term')}</option>
                <option value="long_term" ${state.timeframeFilter === 'long_term' ? 'selected' : ''}>${t('observatory.long_term')}</option>
            </select>
        </div>
    </div>`;
}

function fullRender() {
    const risks = getFilteredRisks();

    container.innerHTML = `
        <section class="container" style="padding-top: var(--space-6);">
            <h1>${t('observatory.title')}</h1>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--space-4);">${t('observatory.subtitle')}</p>

            <h2 style="margin-bottom:var(--space-3);">Risk Matrix</h2>
            ${renderRiskMatrix()}

            <div style="margin-bottom:var(--space-4);">
                ${renderStats()}
            </div>

            ${renderControls()}

            <p style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:var(--space-3);">${risks.length} risks</p>

            <div>
                ${risks.map(renderRiskCard).join('')}
            </div>
        </section>
    `;

    wireEvents();
}

function wireEvents() {
    const $ = s => container.querySelector(s);
    $('#obs-category')?.addEventListener('change', e => { state.categoryFilter = e.target.value; fullRender(); });
    $('#obs-sort')?.addEventListener('change', e => { state.sortBy = e.target.value; fullRender(); });
    $('#obs-timeframe')?.addEventListener('change', e => { state.timeframeFilter = e.target.value; fullRender(); });
}

export async function render(el) {
    container = el;
    if (unsubLocale) { unsubLocale(); unsubLocale = null; }
    await loadTaxonomy();
    fullRender();
    unsubLocale = onLocaleChange(() => fullRender());
}
