# Saforia - Methodology

## Safety Scoring Algorithm

### Overview

Saforia analyzes AI-generated text across 6 safety categories using lexicon-based detection with weighted term matching. All analysis runs deterministically in the browser - the same input always produces the same output.

### Categories and Weights

| Category | Weight | Description |
|----------|--------|-------------|
| Toxicity | 0.25 | Hate speech, slurs, threats, dehumanizing language |
| Security | 0.20 | Prompt injection, jailbreak attempts, code injection |
| Bias | 0.15 | Gender, racial, religious, age-based stereotypes |
| Manipulation | 0.15 | Emotional manipulation, urgency, authority claims |
| Privacy | 0.15 | PII patterns (emails, phones, SSNs, API keys) |
| Hallucination | 0.10 | Indicators of confabulation or fabricated claims |

### Scoring Algorithm

1. **Tokenization**: Input text is split into tokens using whitespace and punctuation delimiters.

2. **Pattern Matching**: Each category's lexicon contains:
   - **Terms**: Single words with severity ratings (1-5)
   - **Phrases**: Multi-word patterns (literal or regex) with severity ratings
   - **Patterns**: Regex patterns (primarily for privacy detection)

3. **Category Score Calculation**:
   ```
   raw_score = sum(severity for each match)
   normalized_penalty = (raw_score / token_count) * 25
   category_score = max(0, min(100, round(100 - normalized_penalty)))
   ```

4. **Overall Score**: Weighted average of all category scores:
   ```
   overall_score = round(sum(category_score * weight for each category))
   ```

5. **Severity Labels**:
   - 80-100: Safe
   - 60-79: Low Risk
   - 40-59: Medium Risk
   - 20-39: High Risk
   - 0-19: Critical Risk

### Confidence Levels

Based on input text length:
- **Low**: < 50 words (insufficient data for reliable analysis)
- **Medium**: 50-200 words (adequate for basic analysis)
- **High**: > 200 words (sufficient for reliable analysis)

### Reproducibility

Every analysis generates a SHA-256 hash of the canonical form:
```json
{ "text": "<input>", "version": "1.0.0", "locale": "en" }
```

This hash serves as a reproducibility fingerprint - anyone can verify results by re-analyzing the same text with the same version and locale.

---

## Statistical Testing (Experiment Lab)

### Welch's t-test

Used for comparing safety scores between two independent groups (e.g., two models, two prompt categories).

**Why Welch's**: Unlike Student's t-test, Welch's t-test does not assume equal variances between groups, making it more robust for real-world AI safety comparisons.

**Formula**:
```
t = (mean_1 - mean_2) / sqrt(var_1/n_1 + var_2/n_2)
df = (var_1/n_1 + var_2/n_2)^2 / ((var_1/n_1)^2/(n_1-1) + (var_2/n_2)^2/(n_2-1))
```

### Cohen's d (Effect Size)

Measures the practical significance of the difference between groups.

```
d = |mean_1 - mean_2| / pooled_SD
```

**Interpretation**:
- < 0.2: Negligible
- 0.2-0.5: Small
- 0.5-0.8: Medium
- > 0.8: Large

### Chi-Square Test

Used for categorical comparisons (e.g., pass/fail rates across categories).

### Confidence Intervals

95% confidence intervals are computed using the t-distribution, providing a range within which the true population parameter is expected to fall.

### Sample Size Guidance

- Minimum: n >= 2 per group (mathematical requirement)
- Recommended: n >= 30 per group (Central Limit Theorem)
- Ideal: Determined by power analysis for desired effect size

---

## Risk Taxonomy (Observatory)

### Risk Score Formula

```
risk_score = impact * probability
```

Where:
- **Impact** (1-5): Severity of harm if the risk materializes
- **Probability** (1-5): Likelihood of occurrence

### Risk Categories

1. **Reliability & Robustness**: System failures, hallucinations, adversarial vulnerability
2. **Bias & Fairness**: Discriminatory outputs across demographics
3. **Privacy & Security**: Data leakage, prompt injection, surveillance
4. **Misuse & Malicious Use**: Deepfakes, weapons, disinformation
5. **Societal & Systemic**: Job displacement, power concentration, environmental impact
6. **Alignment & Control**: Misaligned objectives, emergent capabilities, loss of control

---

## Framework Alignment (Certification)

### NIST AI RMF 1.0

The certification module maps to all four functions of the NIST AI Risk Management Framework:
- **GOVERN**: Policies, accountability, workforce
- **MAP**: Context, stakeholders, risk identification
- **MEASURE**: Assessment, testing, monitoring
- **MANAGE**: Response, prioritization, communication

### EU AI Act

Risk classification follows the EU AI Act's four-tier system:
- **Minimal Risk**: Voluntary codes of conduct
- **Limited Risk**: Transparency obligations
- **High Risk**: Strict compliance requirements
- **Unacceptable Risk**: Prohibited practices

---

## Limitations

1. **Lexicon-based detection** cannot understand context or nuance. The word "kill" in "kill the process" is a false positive.
2. **No semantic analysis**: The engine matches patterns, not meaning. It cannot detect subtle manipulation or implicit bias.
3. **Language coverage**: Currently optimized for English and Spanish lexicons.
4. **Not a replacement** for human review, comprehensive AI auditing, or regulatory compliance assessment.
5. **Scores are relative**, not absolute. They indicate the density of safety-relevant patterns, not a definitive safety verdict.
