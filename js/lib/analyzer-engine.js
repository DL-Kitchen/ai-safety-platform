// Saforia - Core Safety Analysis Engine
// Analyzes text against safety lexicons across 6 categories.
// Returns deterministic, reproducible results with SHA-256 hashing.

import { loadLexicon } from './safety-lexicon.js';
import { sha256 } from './hash.js';
import { getLocale } from '../i18n.js';

const VERSION = '1.0.0';

const CATEGORY_WEIGHTS = {
    toxicity: 0.25,
    bias: 0.15,
    manipulation: 0.15,
    hallucination_indicators: 0.10,
    security: 0.20,
    privacy: 0.15
};

const CATEGORY_KEYS = Object.keys(CATEGORY_WEIGHTS);

// Pre-compiled regex cache per locale
const regexCache = new Map();

function compileRegex(pattern) {
    const key = pattern;
    if (regexCache.has(key)) return regexCache.get(key);
    try {
        const re = new RegExp(pattern, 'gi');
        regexCache.set(key, re);
        return re;
    } catch {
        return null;
    }
}

function tokenize(text) {
    return text.toLowerCase().split(/[\s,.;:!?()[\]{}"'`\-/\\|]+/).filter(t => t.length > 0);
}

function findTermMatches(text, tokens, terms) {
    const matches = [];
    if (!terms) return matches;

    for (const [term, info] of Object.entries(terms)) {
        const termLower = term.toLowerCase();
        // Multi-word terms need phrase matching
        if (termLower.includes(' ')) {
            const textLower = text.toLowerCase();
            let idx = textLower.indexOf(termLower);
            while (idx !== -1) {
                matches.push({
                    term,
                    category: info.category,
                    severity: info.severity,
                    position: idx,
                    type: 'term'
                });
                idx = textLower.indexOf(termLower, idx + 1);
            }
        } else {
            // Single-word: match against tokens
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i] === termLower) {
                    // Find position in original text (approximate)
                    const pos = text.toLowerCase().indexOf(termLower);
                    matches.push({
                        term,
                        category: info.category,
                        severity: info.severity,
                        position: pos >= 0 ? pos : 0,
                        type: 'term'
                    });
                    break; // Count each unique term once
                }
            }
        }
    }
    return matches;
}

function findPhraseMatches(text, phrases) {
    const matches = [];
    if (!phrases || !Array.isArray(phrases)) return matches;
    const textLower = text.toLowerCase();

    for (const phrase of phrases) {
        if (phrase.isRegex) {
            const re = compileRegex(phrase.pattern);
            if (!re) continue;
            re.lastIndex = 0;
            let match;
            while ((match = re.exec(textLower)) !== null) {
                matches.push({
                    term: match[0],
                    pattern: phrase.pattern,
                    category: phrase.category,
                    severity: phrase.severity,
                    position: match.index,
                    type: 'phrase'
                });
                // Prevent infinite loop on zero-length matches
                if (match[0].length === 0) re.lastIndex++;
            }
        } else {
            const patternLower = phrase.pattern.toLowerCase();
            let idx = textLower.indexOf(patternLower);
            while (idx !== -1) {
                matches.push({
                    term: phrase.pattern,
                    category: phrase.category,
                    severity: phrase.severity,
                    position: idx,
                    type: 'phrase'
                });
                idx = textLower.indexOf(patternLower, idx + 1);
            }
        }
    }
    return matches;
}

function findPatternMatches(text, patterns) {
    // Privacy category uses "patterns" key instead of "phrases"
    return findPhraseMatches(text, patterns);
}

function analyzeCategory(text, tokens, categoryData) {
    if (!categoryData) return { score: 100, matches: [], count: 0 };

    const termMatches = findTermMatches(text, tokens, categoryData.terms);
    const phraseMatches = findPhraseMatches(text, categoryData.phrases);
    const patternMatches = findPatternMatches(text, categoryData.patterns);

    const allMatches = [...termMatches, ...phraseMatches, ...patternMatches];

    // Calculate raw score from severity-weighted matches
    const rawScore = allMatches.reduce((sum, m) => sum + m.severity, 0);

    // Normalize by token count (longer texts naturally have more matches)
    const tokenCount = Math.max(tokens.length, 1);
    const scalingFactor = 25; // Calibrated so a moderately toxic text scores ~50
    const normalizedPenalty = (rawScore / tokenCount) * scalingFactor;

    // Category score: 100 = perfectly safe, 0 = extremely unsafe
    const score = Math.max(0, Math.min(100, Math.round(100 - normalizedPenalty)));

    return {
        score,
        matches: allMatches,
        count: allMatches.length
    };
}

function getConfidenceLevel(wordCount) {
    if (wordCount < 50) return 'low';
    if (wordCount <= 200) return 'medium';
    return 'high';
}

function getSeverityLabel(score) {
    if (score >= 80) return 'safe';
    if (score >= 60) return 'low';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'high';
    return 'critical';
}

export async function analyzeText(text, locale) {
    locale = locale || getLocale();
    const lexicon = await loadLexicon(locale);

    const tokens = tokenize(text);
    const wordCount = tokens.length;

    // Analyze each category
    const categories = {};
    const allMatches = [];

    for (const catKey of CATEGORY_KEYS) {
        const result = analyzeCategory(text, tokens, lexicon[catKey]);
        categories[catKey] = {
            score: result.score,
            matches: result.matches,
            count: result.count
        };
        allMatches.push(...result.matches.map(m => ({ ...m, mainCategory: catKey })));
    }

    // Weighted overall score
    let overallScore = 0;
    for (const catKey of CATEGORY_KEYS) {
        overallScore += categories[catKey].score * CATEGORY_WEIGHTS[catKey];
    }
    overallScore = Math.round(overallScore);

    // Confidence level
    const confidence = getConfidenceLevel(wordCount);

    // Reproducibility hash
    const canonical = JSON.stringify({ text, version: VERSION, locale });
    const hash = await sha256(canonical);

    const timestamp = new Date().toISOString();

    return {
        overallScore,
        severity: getSeverityLabel(overallScore),
        categories,
        metadata: {
            textLength: wordCount,
            charCount: text.length,
            confidence,
            locale,
            version: VERSION,
            timestamp,
            hash
        },
        matches: allMatches
    };
}

export { VERSION, CATEGORY_WEIGHTS, CATEGORY_KEYS, getSeverityLabel, getConfidenceLevel };
