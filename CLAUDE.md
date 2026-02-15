# Saforia - Project Context

## What is this

AI Safety & Security platform. Browser-only, zero dependencies, zero cost. Apache 2.0.
Repo: https://github.com/DL-Kitchen/ai-safety-platform
Live: https://dl-kitchen.github.io/ai-safety-platform/

## Stack

- Vanilla JS, Web Components, no framework, no build step
- Hash-based SPA router with lazy-loaded modules
- CSS custom properties for theming (light/dark)
- i18n: English + Spanish, auto-detection, `t('key')` with dot-notation
- Storage: localStorage with `saforia:` namespace
- PWA: Service Worker (`sw.js`) with cache-first strategy
- Deploy: GitHub Pages via GitHub Actions

## Architecture

### Module contract

Every module in `js/modules/` exports a `render(container)` function. The router calls it with the `#main-content` element. Modules are lazy-loaded via `import()`.

```js
// js/modules/example.js
export async function render(container) {
    container.innerHTML = `...`;
    // Setup event listeners, fetch data, etc.
}
```

### Routes (registered in js/app.js)

| Hash | Module |
|------|--------|
| `#/analyzer` | `js/modules/analyzer.js` |
| `#/experiment` | `js/modules/experiment.js` |
| `#/observatory` | `js/modules/observatory.js` |
| `#/redteam` | `js/modules/redteam.js` |
| `#/certification` | `js/modules/certification.js` |

### Key libraries (js/lib/)

| File | Purpose |
|------|---------|
| `analyzer-engine.js` | Lexicon-based safety analysis, 6 categories, weighted scoring |
| `stats.js` | Welch's t-test, Cohen's d, chi-square, CI, descriptive stats |
| `charts.js` | Pure SVG: radar, bar, heatmap, sparkline |
| `export.js` | JSON, CSV, HTML report download |
| `api-client.js` | OpenAI, Anthropic, Ollama abstraction. Keys in sessionStorage only |
| `storage.js` | localStorage wrapper with namespace and quota awareness |
| `hash.js` | SHA-256 via Web Crypto API |
| `safety-lexicon.js` | Loads lexicons from `data/lexicons/{locale}.json` |

### Web Components

- `<saforia-navbar>` - Navigation, theme toggle, locale switcher
- `<saforia-score-card score="85" label="Score" severity="safe">` - Circular score display

### i18n

- Translations in `locales/en.json` and `locales/es.json`
- Use `t('section.key')` for translations, `t('key', { var: value })` for interpolation
- `onLocaleChange(fn)` to react to language changes
- Fetch paths use `import.meta.url` for correct resolution from any page

### Safety scoring

- 6 categories: toxicity (0.25), security (0.20), bias (0.15), manipulation (0.15), privacy (0.15), hallucination (0.10)
- Score 0-100 (100 = safe): `100 - (severity_sum / token_count * 25)`
- Overall = weighted average of categories
- Deterministic: same input + version + locale = same SHA-256 hash

### Data files (data/)

- `lexicons/en.json`, `lexicons/es.json` - Safety term lexicons
- `experiment-templates.json` - 4 experiment templates
- `attack-patterns.json` - 16 attack patterns in 6 categories
- `risk-taxonomy.json` - 25 real-world AI risks
- `frameworks.json` - NIST AI RMF + EU AI Act

## Testing

```bash
# Browser
open tests/runner.html

# Headless (needs playwright)
npm install playwright && npx playwright install chromium
node tests/run-headless.js
```

Tests are in `tests/runner.html` as inline assertions. Headless runner in `tests/run-headless.js` starts a local server and runs via Playwright.

## Conventions

- Zero external dependencies - everything from scratch
- All UI text must go through `t()` for i18n
- API keys never in localStorage, only sessionStorage
- No commits with author attribution (anonymous community contribution)
- Fetch paths: use `new URL('...', import.meta.url)` not relative to page
- Navbar reads `window.location.hash` directly (not `getCurrentRoute()`) to avoid race conditions
