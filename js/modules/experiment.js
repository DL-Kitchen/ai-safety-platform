// Saforia - Experiment Lab Module
// Wizard-based scientific experimentation for AI safety hypotheses.

import { t, onLocaleChange, getLocale } from '../i18n.js';
import { analyzeText, CATEGORY_KEYS } from '../lib/analyzer-engine.js';
import { welchTTest, cohenD, confidenceInterval, summary, mean, standardDeviation, median } from '../lib/stats.js';
import { sha256 } from '../lib/hash.js';
import { exportJSON } from '../lib/export.js';
import { barChart } from '../lib/charts.js';
import { createClient, getAvailableProviders, runWithRateLimit, getApiKey, storeApiKey } from '../lib/api-client.js';
import { save, load } from '../lib/storage.js';

const ALPHA_OPTIONS = [0.01, 0.05, 0.10];

let container = null;
let unsubLocale = null;
let templates = [];

let state = {
    step: 0,
    experimentName: '',
    h0: '',
    h1: '',
    selectedTemplate: '',
    mode: 'manual',
    groupAText: '',
    groupBText: '',
    provider: '',
    model: '',
    apiKey: '',
    promptA: '',
    promptB: '',
    iterations: 10,
    alpha: 0.05,
    running: false,
    progress: 0,
    progressTotal: 0,
    results: null
};

async function loadTemplates() {
    if (templates.length > 0) return;
    try {
        const resp = await fetch('data/experiment-templates.json');
        templates = await resp.json();
    } catch { templates = []; }
}

function applyTemplate(id) {
    const tp = templates.find(t => t.id === id);
    if (!tp) return;
    const lang = getLocale().startsWith('es') ? 'es' : 'en';
    state.selectedTemplate = id;
    state.experimentName = tp[`name_${lang}`];
    state.h0 = tp[`h0_${lang}`];
    state.h1 = tp[`h1_${lang}`];
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(n, d = 4) {
    if (n == null || isNaN(n)) return '-';
    return Number(n).toFixed(d);
}

// ─── Rendering ───

function renderStepIndicator() {
    const labels = [
        t('experiment.hypothesis_h0') || 'Hypothesis',
        t('experiment.variables') || 'Configuration',
        t('experiment.results') || 'Results'
    ];
    return `<div class="tabs" style="margin-bottom: var(--space-4);">
        ${labels.map((lbl, i) => `<button class="tab${i === state.step ? ' active' : ''}" data-step="${i}" ${i > state.step ? 'disabled' : ''}>${i + 1}. ${lbl}</button>`).join('')}
    </div>`;
}

function renderStep0() {
    const lang = getLocale().startsWith('es') ? 'es' : 'en';
    const tplOpts = templates.map(tp =>
        `<option value="${tp.id}" ${state.selectedTemplate === tp.id ? 'selected' : ''}>${tp[`name_${lang}`]}</option>`
    ).join('');

    return `<div class="card" style="padding: var(--space-4);">
        <h2>${t('experiment.title')}</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--space-4);">${t('experiment.subtitle')}</p>

        <label class="label">${t('experiment.templates')}</label>
        <select class="select" id="exp-template" style="width:100%;margin-bottom:var(--space-3);">
            <option value="">-- ${t('experiment.templates')} --</option>
            ${tplOpts}
        </select>

        <label class="label">${t('experiment.new_experiment')}</label>
        <input class="input" id="exp-name" value="${esc(state.experimentName)}" placeholder="${t('experiment.new_experiment')}" style="width:100%;margin-bottom:var(--space-3);">

        <label class="label">${t('experiment.hypothesis_h0')}</label>
        <textarea class="textarea" id="exp-h0" rows="3" placeholder="${t('experiment.h0_placeholder')}" style="width:100%;margin-bottom:var(--space-3);">${esc(state.h0)}</textarea>

        <label class="label">${t('experiment.hypothesis_h1')}</label>
        <textarea class="textarea" id="exp-h1" rows="3" placeholder="${t('experiment.h1_placeholder')}" style="width:100%;margin-bottom:var(--space-3);">${esc(state.h1)}</textarea>

        <div style="display:flex;justify-content:flex-end;margin-top:var(--space-3);">
            <button class="btn btn-primary" id="exp-next-0" ${(!state.h0 || !state.h1) ? 'disabled' : ''}>${t('experiment.run_experiment') ? 'Next' : 'Next'} &rarr;</button>
        </div>
    </div>`;
}

function renderStep1() {
    const providers = getAvailableProviders();
    const provOpts = providers.map(p => `<option value="${p}" ${state.provider === p ? 'selected' : ''}>${p}</option>`).join('');
    const alphaOpts = ALPHA_OPTIONS.map(a => `<option value="${a}" ${state.alpha === a ? 'selected' : ''}>${a}</option>`).join('');

    return `<div class="card" style="padding: var(--space-4);">
        <h2>${t('experiment.variables')}</h2>

        <div class="tabs" style="margin-bottom:var(--space-3);">
            <button class="tab${state.mode === 'manual' ? ' active' : ''}" data-mode="manual">${t('experiment.control_group') ? 'Manual' : 'Manual'}</button>
            <button class="tab${state.mode === 'api' ? ' active' : ''}" data-mode="api">API</button>
        </div>

        <div id="manual-section" style="${state.mode !== 'manual' ? 'display:none;' : ''}">
            <label class="label">${t('experiment.control_group')} <small>(${t('experiment.prompts_placeholder') || 'separated by ---'})</small></label>
            <textarea class="textarea" id="exp-groupA" rows="6" placeholder="Response 1\n---\nResponse 2\n---\nResponse 3" style="width:100%;margin-bottom:var(--space-3);">${esc(state.groupAText)}</textarea>

            <label class="label">${t('experiment.treatment_group')} <small>(separated by ---)</small></label>
            <textarea class="textarea" id="exp-groupB" rows="6" placeholder="Response 1\n---\nResponse 2\n---\nResponse 3" style="width:100%;margin-bottom:var(--space-3);">${esc(state.groupBText)}</textarea>
        </div>

        <div id="api-section" style="${state.mode !== 'api' ? 'display:none;' : ''}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-3);">
                <div>
                    <label class="label">${t('experiment.provider')}</label>
                    <select class="select" id="exp-provider" style="width:100%;"><option value="">--</option>${provOpts}</select>
                </div>
                <div>
                    <label class="label">${t('experiment.model')}</label>
                    <input class="input" id="exp-model" value="${esc(state.model)}" placeholder="gpt-4o-mini" style="width:100%;">
                </div>
            </div>
            <label class="label">${t('experiment.api_key')} <small>(${t('experiment.api_key_note')})</small></label>
            <input class="input" type="password" id="exp-apikey" value="${esc(state.apiKey)}" style="width:100%;margin-bottom:var(--space-3);">

            <label class="label">${t('experiment.control_group')} - Prompt</label>
            <textarea class="textarea" id="exp-promptA" rows="3" style="width:100%;margin-bottom:var(--space-3);">${esc(state.promptA)}</textarea>

            <label class="label">${t('experiment.treatment_group')} - Prompt</label>
            <textarea class="textarea" id="exp-promptB" rows="3" style="width:100%;margin-bottom:var(--space-3);">${esc(state.promptB)}</textarea>

            <label class="label">${t('experiment.iterations')}</label>
            <input class="input" type="number" id="exp-iterations" min="2" max="200" value="${state.iterations}" style="width:120px;margin-bottom:var(--space-3);">
        </div>

        <label class="label">Alpha (&alpha;)</label>
        <select class="select" id="exp-alpha" style="width:140px;margin-bottom:var(--space-3);">${alphaOpts}</select>

        <div class="alert alert-info" style="font-size:0.8125rem;">
            ${t('experiment.statistical_test') || 'Statistical Test'}: Welch's t-test | ${t('experiment.effect_size') || 'Effect Size'}: Cohen's d | n &ge; 30 ${t('experiment.iterations') || 'recommended'}
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:var(--space-3);">
            <button class="btn" id="exp-prev-1">&larr; Back</button>
            <button class="btn btn-primary" id="exp-next-1">${t('experiment.run_experiment')} &rarr;</button>
        </div>
    </div>`;
}

function renderStep2() {
    if (state.running) {
        const pct = state.progressTotal > 0 ? Math.round((state.progress / state.progressTotal) * 100) : 0;
        return `<div class="card" style="padding: var(--space-4); text-align:center;">
            <h2>${t('experiment.running')}</h2>
            <div class="progress" style="margin: var(--space-4) 0;">
                <div class="progress-bar" style="width:${pct}%;">${pct}%</div>
            </div>
            <p>${state.progress} / ${state.progressTotal}</p>
        </div>`;
    }

    if (!state.results) {
        return `<div class="card" style="padding: var(--space-4);">
            <div class="alert">${t('experiment.results') || 'No results yet.'}</div>
            <button class="btn" id="exp-prev-2">&larr; Back</button>
        </div>`;
    }

    if (state.results.error) {
        return `<div class="card" style="padding: var(--space-4);">
            <div class="alert alert-danger">${esc(state.results.error)}</div>
            <button class="btn" id="exp-prev-2">&larr; Back</button>
        </div>`;
    }

    const r = state.results;
    const rejected = r.tTest.pValue < r.alpha;
    const effectLabel = Math.abs(r.cohenD.d) < 0.2 ? 'negligible' : Math.abs(r.cohenD.d) < 0.5 ? 'small' : Math.abs(r.cohenD.d) < 0.8 ? 'medium' : 'large';

    const conclusionText = rejected
        ? t('experiment.reject_h0')
        : t('experiment.fail_reject_h0');

    const chart = barChart(
        [Math.round(r.statsA.mean), Math.round(r.statsB.mean)],
        { width: 320, height: 200, labels: [t('experiment.control_group'), t('experiment.treatment_group')], maxValue: 100, ariaLabel: 'Score comparison' }
    );

    function statRow(label, s) {
        return `<tr><td><strong>${label}</strong></td><td>${s.n}</td><td>${fmt(s.mean, 2)}</td><td>${fmt(s.sd, 2)}</td><td>${fmt(s.min, 2)}</td><td>${fmt(s.median, 2)}</td><td>${fmt(s.max, 2)}</td></tr>`;
    }

    return `<div class="card" style="padding: var(--space-4);">
        <h2>${t('experiment.results')}: ${esc(state.experimentName)}</h2>

        <div style="text-align:center;margin:var(--space-4) 0;">
            <span class="badge ${rejected ? 'badge-danger' : 'badge-safe'}" style="font-size:1rem;padding:var(--space-2) var(--space-3);">
                ${rejected ? t('experiment.significant') : t('experiment.not_significant')}
            </span>
        </div>

        <div class="alert ${rejected ? 'alert-warning' : 'alert-info'}" style="margin-bottom:var(--space-4);">
            <strong>${t('experiment.conclusion')}:</strong> ${conclusionText}
        </div>

        <h3>Summary Statistics</h3>
        <div style="overflow-x:auto;">
            <table class="table-wrapper" style="margin-bottom:var(--space-4);">
                <thead><tr><th>Group</th><th>n</th><th>Mean</th><th>SD</th><th>Min</th><th>Median</th><th>Max</th></tr></thead>
                <tbody>
                    ${statRow(t('experiment.control_group'), r.statsA)}
                    ${statRow(t('experiment.treatment_group'), r.statsB)}
                </tbody>
            </table>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:var(--space-4);margin-bottom:var(--space-4);">
            <div>${chart}</div>
        </div>

        <h3>${t('experiment.statistical_test')}</h3>
        <table class="table-wrapper" style="margin-bottom:var(--space-4);">
            <tbody>
                <tr><td><strong>Welch's t</strong></td><td>${fmt(r.tTest.t)}</td></tr>
                <tr><td><strong>df</strong></td><td>${fmt(r.tTest.df, 2)}</td></tr>
                <tr><td><strong>${t('experiment.p_value')}</strong></td><td>${fmt(r.tTest.pValue, 6)}</td></tr>
                <tr><td><strong>Cohen's d</strong></td><td>${fmt(r.cohenD.d)} (${effectLabel})</td></tr>
                <tr><td><strong>${(1 - r.alpha) * 100}% CI</strong></td><td>[${fmt(r.tTest.ci.lower)}, ${fmt(r.tTest.ci.upper)}]</td></tr>
                <tr><td><strong>&alpha;</strong></td><td>${r.alpha}</td></tr>
            </tbody>
        </table>

        <div style="margin-bottom:var(--space-3);">
            <strong>Hash:</strong>
            <code style="font-size:0.75rem;word-break:break-all;background:var(--color-bg-tertiary);padding:var(--space-1);border-radius:var(--radius-sm);">${r.hash}</code>
        </div>

        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);">
            <button class="btn" id="exp-prev-2">&larr; Back</button>
            <div style="display:flex;gap:var(--space-2);">
                <button class="btn btn-secondary" id="exp-export">${t('experiment.export_report')}</button>
                <button class="btn btn-primary" id="exp-new">${t('experiment.new_experiment')}</button>
            </div>
        </div>
    </div>`;
}

function fullRender() {
    container.innerHTML = `
        <section class="container" style="padding-top: var(--space-6);">
            <h1>${t('experiment.title')}</h1>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--space-4);">${t('experiment.subtitle')}</p>
            ${renderStepIndicator()}
            ${state.step === 0 ? renderStep0() : state.step === 1 ? renderStep1() : renderStep2()}
        </section>
    `;
    wireEvents();
}

// ─── Experiment Logic ───

function parseGroup(text) {
    return text.split('---').map(s => s.trim()).filter(s => s.length > 0);
}

async function runExperiment() {
    state.running = true;
    state.results = null;
    state.step = 2;
    fullRender();

    try {
        let groupA, groupB;

        if (state.mode === 'manual') {
            groupA = parseGroup(state.groupAText);
            groupB = parseGroup(state.groupBText);
        } else {
            // API mode
            if (!state.provider || !state.apiKey) {
                state.results = { error: 'Provider and API key are required.' };
                state.running = false;
                fullRender();
                return;
            }
            storeApiKey(state.provider, state.apiKey);
            const client = createClient(state.provider, { apiKey: state.apiKey, model: state.model });

            const promptsA = Array(state.iterations).fill(state.promptA);
            const promptsB = Array(state.iterations).fill(state.promptB);
            state.progressTotal = promptsA.length + promptsB.length;
            state.progress = 0;
            fullRender();

            const resultsA = await runWithRateLimit(client, promptsA, {}, (done) => {
                state.progress = done;
                fullRender();
            });
            const resultsB = await runWithRateLimit(client, promptsB, {}, (done) => {
                state.progress = promptsA.length + done;
                fullRender();
            });

            groupA = resultsA.filter(r => r.response).map(r => r.response);
            groupB = resultsB.filter(r => r.response).map(r => r.response);
        }

        if (groupA.length < 2 || groupB.length < 2) {
            state.results = { error: 'Each group needs at least 2 responses.' };
            state.running = false;
            fullRender();
            return;
        }

        // Analyze each response
        state.progressTotal = groupA.length + groupB.length;
        state.progress = 0;
        fullRender();

        const scoresA = [];
        for (const text of groupA) {
            const r = await analyzeText(text);
            scoresA.push(r.overallScore);
            state.progress++;
            fullRender();
        }

        const scoresB = [];
        for (const text of groupB) {
            const r = await analyzeText(text);
            scoresB.push(r.overallScore);
            state.progress++;
            fullRender();
        }

        // Statistical tests
        const tTest = welchTTest(scoresA, scoresB, state.alpha);
        const effect = cohenD(scoresA, scoresB);
        const statsA = summary(scoresA);
        const statsB = summary(scoresB);

        // Hash for reproducibility
        const canonical = JSON.stringify({ experimentName: state.experimentName, h0: state.h0, h1: state.h1, alpha: state.alpha, scoresA, scoresB });
        const hash = await sha256(canonical);

        state.results = {
            tTest,
            cohenD: effect,
            statsA,
            statsB,
            scoresA,
            scoresB,
            alpha: state.alpha,
            hash
        };

        // Save to localStorage
        save('experiment', `last-${Date.now()}`, {
            name: state.experimentName,
            h0: state.h0,
            h1: state.h1,
            results: state.results
        });
    } catch (err) {
        state.results = { error: err.message };
    }

    state.running = false;
    fullRender();
}

// ─── Events ───

function wireEvents() {
    const $ = s => container.querySelector(s);

    // Step indicator
    container.querySelectorAll('[data-step]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = Number(btn.dataset.step);
            if (target <= state.step) {
                state.step = target;
                fullRender();
            }
        });
    });

    if (state.step === 0) {
        $('#exp-template')?.addEventListener('change', e => {
            applyTemplate(e.target.value);
            fullRender();
        });
        $('#exp-name')?.addEventListener('input', e => { state.experimentName = e.target.value; });
        $('#exp-h0')?.addEventListener('input', e => {
            state.h0 = e.target.value;
            const btn = $('#exp-next-0');
            if (btn) btn.disabled = !state.h0 || !state.h1;
        });
        $('#exp-h1')?.addEventListener('input', e => {
            state.h1 = e.target.value;
            const btn = $('#exp-next-0');
            if (btn) btn.disabled = !state.h0 || !state.h1;
        });
        $('#exp-next-0')?.addEventListener('click', () => { state.step = 1; fullRender(); });
    }

    if (state.step === 1) {
        container.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => { state.mode = btn.dataset.mode; fullRender(); });
        });
        $('#exp-groupA')?.addEventListener('input', e => { state.groupAText = e.target.value; });
        $('#exp-groupB')?.addEventListener('input', e => { state.groupBText = e.target.value; });
        $('#exp-provider')?.addEventListener('change', e => { state.provider = e.target.value; });
        $('#exp-model')?.addEventListener('input', e => { state.model = e.target.value; });
        $('#exp-apikey')?.addEventListener('input', e => { state.apiKey = e.target.value; });
        $('#exp-promptA')?.addEventListener('input', e => { state.promptA = e.target.value; });
        $('#exp-promptB')?.addEventListener('input', e => { state.promptB = e.target.value; });
        $('#exp-iterations')?.addEventListener('input', e => { state.iterations = Math.max(2, parseInt(e.target.value, 10) || 10); });
        $('#exp-alpha')?.addEventListener('change', e => { state.alpha = parseFloat(e.target.value); });
        $('#exp-prev-1')?.addEventListener('click', () => { state.step = 0; fullRender(); });
        $('#exp-next-1')?.addEventListener('click', () => runExperiment());
    }

    if (state.step === 2) {
        $('#exp-prev-2')?.addEventListener('click', () => { state.step = 1; fullRender(); });
        $('#exp-export')?.addEventListener('click', () => {
            if (!state.results) return;
            exportJSON({
                experimentName: state.experimentName,
                h0: state.h0, h1: state.h1,
                alpha: state.alpha, mode: state.mode,
                results: state.results
            }, `saforia-experiment-${Date.now()}.json`);
        });
        $('#exp-new')?.addEventListener('click', () => {
            state = { ...state, step: 0, experimentName: '', h0: '', h1: '', selectedTemplate: '', groupAText: '', groupBText: '', promptA: '', promptB: '', results: null, running: false };
            fullRender();
        });
    }
}

export async function render(el) {
    container = el;
    if (unsubLocale) { unsubLocale(); unsubLocale = null; }
    await loadTemplates();
    fullRender();
    unsubLocale = onLocaleChange(() => fullRender());
}
