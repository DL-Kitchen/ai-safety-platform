// Saforia - Certification Module
// Wizard to generate AI Safety Cards aligned with NIST AI RMF and EU AI Act.

import { t, onLocaleChange, getLocale } from '../i18n.js';
import { radarChart } from '../lib/charts.js';
import { sha256 } from '../lib/hash.js';
import { exportJSON, exportHTMLReport } from '../lib/export.js';
import { load, save } from '../lib/storage.js';

const CATEGORY_LABELS = {
    toxicity: () => t('analyzer.toxicity'),
    bias: () => t('analyzer.bias'),
    manipulation: () => t('analyzer.manipulation'),
    hallucination_indicators: () => t('analyzer.hallucination'),
    security: () => t('analyzer.security'),
    privacy: () => t('analyzer.privacy')
};
const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);

let container = null;
let unsubLocale = null;
let frameworks = null;

let state = {
    step: 0,
    systemName: '',
    provider: '',
    useCase: '',
    riskLevel: 'minimal',
    version: '1.0',
    scores: { toxicity: 50, bias: 50, manipulation: 50, hallucination_indicators: 50, security: 50, privacy: 50 },
    nistChecks: {},    // { checkId: status }
    safetyCard: null
};

async function loadFrameworks() {
    if (frameworks) return;
    try {
        const resp = await fetch('data/frameworks.json');
        frameworks = await resp.json();
    } catch { frameworks = {}; }
}

function lang() {
    return getLocale().startsWith('es') ? 'es' : 'en';
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const COMPLIANCE_STATUSES = ['not_assessed', 'compliant', 'partially_compliant', 'non_compliant'];
const STATUS_LABELS = {
    not_assessed: { en: 'Not Assessed', es: 'No Evaluado', badge: 'badge-info' },
    compliant: { en: 'Compliant', es: 'Cumple', badge: 'badge-safe' },
    partially_compliant: { en: 'Partially Compliant', es: 'Cumple Parcialmente', badge: 'badge-caution' },
    non_compliant: { en: 'Non-Compliant', es: 'No Cumple', badge: 'badge-danger' }
};

// ─── Step Indicator ───

function renderStepIndicator() {
    const labels = [
        t('certification.system_id'),
        t('certification.scores'),
        t('certification.safety_card')
    ];
    return `<div class="tabs" style="margin-bottom: var(--space-4);">
        ${labels.map((lbl, i) => `<button class="tab${i === state.step ? ' active' : ''}" data-step="${i}" ${i > state.step ? 'disabled' : ''}>${i + 1}. ${lbl}</button>`).join('')}
    </div>`;
}

// ─── Step 0: System Identification ───

function renderStep0() {
    const riskLevels = ['minimal', 'limited', 'high', 'unacceptable'];
    const riskOpts = riskLevels.map(rl => {
        const label = t(`certification.risk_${rl}`);
        return `<option value="${rl}" ${state.riskLevel === rl ? 'selected' : ''}>${label}</option>`;
    }).join('');

    return `<div class="card" style="padding:var(--space-4);">
        <h2>${t('certification.system_id')}</h2>

        <label class="label">${t('certification.system_name')}</label>
        <input class="input" id="cert-name" value="${esc(state.systemName)}" placeholder="e.g. ChatBot v2.0" style="width:100%;margin-bottom:var(--space-3);">

        <label class="label">${t('certification.provider')}</label>
        <input class="input" id="cert-provider" value="${esc(state.provider)}" placeholder="e.g. Acme Corp" style="width:100%;margin-bottom:var(--space-3);">

        <label class="label">${t('certification.use_case')}</label>
        <textarea class="textarea" id="cert-usecase" rows="3" placeholder="Describe the primary use case..." style="width:100%;margin-bottom:var(--space-3);">${esc(state.useCase)}</textarea>

        <label class="label">${t('certification.risk_level')}</label>
        <select class="select" id="cert-risklevel" style="width:100%;margin-bottom:var(--space-3);">${riskOpts}</select>

        <label class="label">Version</label>
        <input class="input" id="cert-version" value="${esc(state.version)}" style="width:200px;margin-bottom:var(--space-3);">

        <div style="display:flex;justify-content:flex-end;margin-top:var(--space-3);">
            <button class="btn btn-primary" id="cert-next-0" ${!state.systemName ? 'disabled' : ''}>&rarr; Next</button>
        </div>
    </div>`;
}

// ─── Step 1: Evaluation ───

function renderStep1() {
    // Import from analyzer
    const importBtn = `<button class="btn btn-secondary btn-sm" id="cert-import-analyzer" style="margin-bottom:var(--space-3);">Import from Analyzer (localStorage)</button>`;

    // Sliders for 6 categories
    const sliders = CATEGORY_KEYS.map(key => {
        const val = state.scores[key];
        return `<div style="margin-bottom:var(--space-3);">
            <label class="label" style="display:flex;justify-content:space-between;">
                <span>${CATEGORY_LABELS[key]()}</span>
                <span id="cert-val-${key}" style="font-weight:600;">${val}</span>
            </label>
            <input type="range" id="cert-score-${key}" min="0" max="100" value="${val}" style="width:100%;">
        </div>`;
    }).join('');

    // NIST AI RMF Checklist
    let nistChecklist = '';
    if (frameworks && frameworks.nist_ai_rmf) {
        const nist = frameworks.nist_ai_rmf;
        nistChecklist = `<h3 style="margin-top:var(--space-4);">${nist[`name_${lang()}`]}</h3>`;

        for (const [funcKey, func] of Object.entries(nist.functions)) {
            nistChecklist += `<details style="margin:var(--space-2) 0;">
                <summary style="cursor:pointer;font-weight:600;">${funcKey}: ${func[`name_${lang()}`]}</summary>
                <p style="font-size:0.8125rem;color:var(--color-text-secondary);margin:var(--space-1) 0;">${func[`description_${lang()}`]}</p>`;

            for (const [catKey, cat] of Object.entries(func.categories)) {
                nistChecklist += `<div style="margin:var(--space-2) 0 var(--space-2) var(--space-4);">
                    <strong style="font-size:0.875rem;">${catKey}: ${cat[`name_${lang()}`]}</strong>`;

                for (const check of cat.checks) {
                    const currentStatus = state.nistChecks[check.id] || 'not_assessed';
                    const statusInfo = STATUS_LABELS[currentStatus];
                    const opts = COMPLIANCE_STATUSES.map(s => {
                        const sl = STATUS_LABELS[s];
                        return `<option value="${s}" ${currentStatus === s ? 'selected' : ''}>${sl[lang()]}</option>`;
                    }).join('');

                    nistChecklist += `<div style="display:flex;gap:var(--space-2);align-items:flex-start;margin:var(--space-2) 0;font-size:0.8125rem;">
                        <select class="select nist-check" data-check="${check.id}" style="min-width:140px;font-size:0.75rem;">${opts}</select>
                        <span>${check[`text_${lang()}`]}</span>
                    </div>`;
                }

                nistChecklist += `</div>`;
            }

            nistChecklist += `</details>`;
        }
    }

    return `<div class="card" style="padding:var(--space-4);">
        <h2>${t('certification.scores')}</h2>
        <p style="font-size:0.8125rem;color:var(--color-text-secondary);margin-bottom:var(--space-3);">${t('certification.scores_note')}</p>

        ${importBtn}
        ${sliders}

        ${nistChecklist}

        <div style="display:flex;justify-content:space-between;margin-top:var(--space-4);">
            <button class="btn" id="cert-prev-1">&larr; Back</button>
            <button class="btn btn-primary" id="cert-next-1">${t('certification.generate')} &rarr;</button>
        </div>
    </div>`;
}

// ─── Step 2: Safety Card ───

async function generateSafetyCard() {
    const overallScore = Math.round(
        Object.values(state.scores).reduce((s, v) => s + v, 0) / CATEGORY_KEYS.length
    );

    // Count NIST compliance
    let compliant = 0, partial = 0, nonCompliant = 0, notAssessed = 0;
    for (const status of Object.values(state.nistChecks)) {
        if (status === 'compliant') compliant++;
        else if (status === 'partially_compliant') partial++;
        else if (status === 'non_compliant') nonCompliant++;
        else notAssessed++;
    }
    const totalChecks = Object.keys(state.nistChecks).length;

    // EU AI Act classification
    const euLevel = frameworks?.eu_ai_act?.risk_levels?.[state.riskLevel];

    // Hash
    const canonical = JSON.stringify({
        systemName: state.systemName,
        provider: state.provider,
        scores: state.scores,
        nistChecks: state.nistChecks,
        riskLevel: state.riskLevel,
        version: state.version
    });
    const hash = await sha256(canonical);

    state.safetyCard = {
        systemName: state.systemName,
        provider: state.provider,
        useCase: state.useCase,
        riskLevel: state.riskLevel,
        version: state.version,
        overallScore,
        scores: { ...state.scores },
        nistCompliance: { compliant, partial, nonCompliant, notAssessed, total: totalChecks },
        nistChecks: { ...state.nistChecks },
        hash,
        timestamp: new Date().toISOString()
    };

    // Save to localStorage
    save('certification', `card-${Date.now()}`, state.safetyCard);
}

function renderStep2() {
    if (!state.safetyCard) {
        return `<div class="card" style="padding:var(--space-4);">
            <div class="alert">Generating safety card...</div>
        </div>`;
    }

    const card = state.safetyCard;
    const radarData = CATEGORY_KEYS.map(k => card.scores[k]);
    const radarLabels = CATEGORY_KEYS.map(k => CATEGORY_LABELS[k]());
    const radar = radarChart(radarData, { size: 280, labels: radarLabels, ariaLabel: 'Safety scores radar' });

    const euLevel = frameworks?.eu_ai_act?.risk_levels?.[card.riskLevel];
    const euName = euLevel ? euLevel[`name_${lang()}`] : card.riskLevel;

    const nist = card.nistCompliance;
    const nistTotal = nist.compliant + nist.partial + nist.nonCompliant + nist.notAssessed;

    return `<div class="card" style="padding:var(--space-4);">
        <h2>${t('certification.safety_card')}</h2>

        <div style="text-align:center;margin:var(--space-4) 0;">
            <h3 style="font-size:1.25rem;">${esc(card.systemName)}</h3>
            <p style="color:var(--color-text-secondary);">${esc(card.provider)} | v${esc(card.version)}</p>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:flex-start;margin:var(--space-4) 0;">
            <div style="text-align:center;">
                <saforia-score-card score="${card.overallScore}" label="${t('certification.overall_safety')}" size="140"></saforia-score-card>
            </div>
            <div style="flex:1;min-width:280px;">${radar}</div>
        </div>

        <div class="grid-3" style="margin:var(--space-4) 0;">
            ${CATEGORY_KEYS.map(k => `<saforia-score-card score="${card.scores[k]}" label="${CATEGORY_LABELS[k]()}" size="80"></saforia-score-card>`).join('')}
        </div>

        <h3>${t('certification.risk_level')}</h3>
        <div class="card" style="padding:var(--space-3);margin-bottom:var(--space-3);">
            <span class="badge ${card.riskLevel === 'unacceptable' ? 'badge-danger' : card.riskLevel === 'high' ? 'badge-caution' : 'badge-info'}" style="font-size:0.875rem;">${euName}</span>
            ${euLevel ? `<p style="font-size:0.8125rem;color:var(--color-text-secondary);margin-top:var(--space-2);">${euLevel[`description_${lang()}`]}</p>` : ''}
        </div>

        <h3>${t('certification.framework_alignment')}: NIST AI RMF</h3>
        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;margin:var(--space-2) 0 var(--space-4);">
            <span class="badge badge-safe">Compliant: ${nist.compliant}</span>
            <span class="badge badge-caution">Partial: ${nist.partial}</span>
            <span class="badge badge-danger">Non-Compliant: ${nist.nonCompliant}</span>
            <span class="badge badge-info">Not Assessed: ${nist.notAssessed}</span>
        </div>
        ${nistTotal > 0 ? `<div class="progress" style="margin-bottom:var(--space-4);">
            <div class="progress-bar" style="width:${Math.round((nist.compliant / nistTotal) * 100)}%;background:var(--color-success);"></div>
            <div class="progress-bar" style="width:${Math.round((nist.partial / nistTotal) * 100)}%;background:var(--color-warning, #d97706);"></div>
        </div>` : ''}

        <div class="card" style="padding:var(--space-3);margin-bottom:var(--space-3);">
            <strong>${t('certification.verification_hash')}:</strong>
            <code style="font-size:0.75rem;word-break:break-all;display:block;margin-top:var(--space-1);background:var(--color-bg-tertiary);padding:var(--space-2);border-radius:var(--radius-sm);">${card.hash}</code>
            <p style="font-size:0.7rem;color:var(--color-text-muted);margin-top:var(--space-1);">${card.timestamp}</p>
        </div>

        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-4);">
            <button class="btn" id="cert-prev-2">&larr; Back</button>
            <div style="display:flex;gap:var(--space-2);">
                <button class="btn btn-secondary" id="cert-export-json">${t('certification.export_json')}</button>
                <button class="btn btn-primary" id="cert-export-html">${t('certification.export_pdf')}</button>
            </div>
        </div>
    </div>`;
}

// ─── HTML Report Generation ───

function generateHTMLContent() {
    const card = state.safetyCard;
    const scores = CATEGORY_KEYS.map(k => `<tr><td>${CATEGORY_LABELS[k]()}</td><td><strong>${card.scores[k]}</strong>/100</td></tr>`).join('');

    const nist = card.nistCompliance;

    return `
        <h1>AI Safety Card</h1>
        <h2>${esc(card.systemName)}</h2>
        <p><strong>Provider:</strong> ${esc(card.provider)} | <strong>Version:</strong> ${esc(card.version)}</p>
        <p><strong>Use Case:</strong> ${esc(state.useCase)}</p>

        <h2>Safety Scores</h2>
        <p class="score ${card.overallScore >= 80 ? 'safe' : card.overallScore >= 60 ? 'low' : card.overallScore >= 40 ? 'medium' : 'high'}">${card.overallScore}/100</p>
        <table>${scores}</table>

        <h2>EU AI Act Classification</h2>
        <p><strong>Risk Level:</strong> ${card.riskLevel}</p>

        <h2>NIST AI RMF Compliance</h2>
        <table>
            <tr><td>Compliant</td><td>${nist.compliant}</td></tr>
            <tr><td>Partially Compliant</td><td>${nist.partial}</td></tr>
            <tr><td>Non-Compliant</td><td>${nist.nonCompliant}</td></tr>
            <tr><td>Not Assessed</td><td>${nist.notAssessed}</td></tr>
        </table>

        <h2>Verification</h2>
        <p class="hash">${card.hash}</p>
        <p><small>Generated: ${card.timestamp}</small></p>
    `;
}

// ─── Main Render ───

function fullRender() {
    container.innerHTML = `
        <section class="container" style="padding-top: var(--space-6);">
            <h1>${t('certification.title')}</h1>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--space-4);">${t('certification.subtitle')}</p>
            ${renderStepIndicator()}
            ${state.step === 0 ? renderStep0() : state.step === 1 ? renderStep1() : renderStep2()}
        </section>
    `;
    wireEvents();
}

function wireEvents() {
    const $ = s => container.querySelector(s);

    // Step indicator
    container.querySelectorAll('[data-step]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = Number(btn.dataset.step);
            if (target <= state.step) { state.step = target; fullRender(); }
        });
    });

    if (state.step === 0) {
        $('#cert-name')?.addEventListener('input', e => {
            state.systemName = e.target.value;
            const btn = $('#cert-next-0');
            if (btn) btn.disabled = !state.systemName;
        });
        $('#cert-provider')?.addEventListener('input', e => { state.provider = e.target.value; });
        $('#cert-usecase')?.addEventListener('input', e => { state.useCase = e.target.value; });
        $('#cert-risklevel')?.addEventListener('change', e => { state.riskLevel = e.target.value; });
        $('#cert-version')?.addEventListener('input', e => { state.version = e.target.value; });
        $('#cert-next-0')?.addEventListener('click', () => { state.step = 1; fullRender(); });
    }

    if (state.step === 1) {
        // Import from analyzer
        $('#cert-import-analyzer')?.addEventListener('click', () => {
            // Try to find latest analyzer results in localStorage
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('saforia:analyzer:')) keys.push(k);
            }
            if (keys.length === 0) {
                alert(lang() === 'es' ? 'No se encontraron resultados del analizador.' : 'No analyzer results found in localStorage.');
                return;
            }
            // Use most recent
            const latest = localStorage.getItem(keys[keys.length - 1]);
            try {
                const data = JSON.parse(latest);
                if (data.categories) {
                    for (const key of CATEGORY_KEYS) {
                        if (data.categories[key]) {
                            state.scores[key] = data.categories[key].score;
                        }
                    }
                    fullRender();
                }
            } catch { /* ignore */ }
        });

        // Sliders
        for (const key of CATEGORY_KEYS) {
            const slider = $(`#cert-score-${key}`);
            if (slider) {
                slider.addEventListener('input', e => {
                    state.scores[key] = parseInt(e.target.value, 10);
                    const valEl = $(`#cert-val-${key}`);
                    if (valEl) valEl.textContent = state.scores[key];
                });
            }
        }

        // NIST checks
        container.querySelectorAll('.nist-check').forEach(sel => {
            sel.addEventListener('change', e => {
                state.nistChecks[e.target.dataset.check] = e.target.value;
            });
        });

        // Initialize NIST checks that haven't been set
        if (frameworks && frameworks.nist_ai_rmf) {
            for (const func of Object.values(frameworks.nist_ai_rmf.functions)) {
                for (const cat of Object.values(func.categories)) {
                    for (const check of cat.checks) {
                        if (!state.nistChecks[check.id]) {
                            state.nistChecks[check.id] = 'not_assessed';
                        }
                    }
                }
            }
        }

        $('#cert-prev-1')?.addEventListener('click', () => { state.step = 0; fullRender(); });
        $('#cert-next-1')?.addEventListener('click', async () => {
            state.step = 2;
            await generateSafetyCard();
            fullRender();
        });
    }

    if (state.step === 2) {
        $('#cert-prev-2')?.addEventListener('click', () => { state.step = 1; fullRender(); });
        $('#cert-export-json')?.addEventListener('click', () => {
            if (state.safetyCard) {
                exportJSON(state.safetyCard, `saforia-safety-card-${Date.now()}.json`);
            }
        });
        $('#cert-export-html')?.addEventListener('click', () => {
            if (state.safetyCard) {
                exportHTMLReport(generateHTMLContent(), `saforia-safety-card-${Date.now()}.html`);
            }
        });
    }
}

export async function render(el) {
    container = el;
    if (unsubLocale) { unsubLocale(); unsubLocale = null; }
    await loadFrameworks();
    fullRender();
    unsubLocale = onLocaleChange(() => fullRender());
}
