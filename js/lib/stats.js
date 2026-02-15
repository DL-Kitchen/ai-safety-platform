// Saforia - Statistical Functions Library
// All functions implemented from mathematical first principles.
// Zero external dependencies. Accurate to 6+ significant digits.
//
// References:
// - Abramowitz & Stegun, "Handbook of Mathematical Functions" (1964)
// - Press et al., "Numerical Recipes" (3rd ed.)
// - Lanczos, C., "A Precision Approximation of the Gamma Function" (1964)

// ============================================================
// DESCRIPTIVE STATISTICS
// ============================================================

export function mean(arr) {
    if (arr.length === 0) return NaN;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
}

export function variance(arr) {
    if (arr.length < 2) return NaN;
    const m = mean(arr);
    let sumSq = 0;
    for (let i = 0; i < arr.length; i++) {
        const d = arr[i] - m;
        sumSq += d * d;
    }
    return sumSq / (arr.length - 1); // Bessel's correction
}

export function standardDeviation(arr) {
    const v = variance(arr);
    return isNaN(v) ? NaN : Math.sqrt(v);
}

export function median(arr) {
    if (arr.length === 0) return NaN;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ============================================================
// SPECIAL FUNCTIONS (needed for statistical distributions)
// ============================================================

/**
 * Log-Gamma function using Lanczos approximation.
 * Accurate for x > 0.
 */
function logGamma(x) {
    // Lanczos coefficients for g=7
    const c = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7
    ];

    if (x < 0.5) {
        // Reflection formula: Gamma(1-x)*Gamma(x) = pi/sin(pi*x)
        return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    }

    x -= 1;
    let a = c[0];
    const t = x + 7.5; // g + 0.5
    for (let i = 1; i < 9; i++) {
        a += c[i] / (x + i);
    }

    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Regularized incomplete beta function I_x(a, b).
 * Used for t-distribution and F-distribution CDF.
 * Uses continued fraction expansion (Lentz's method).
 */
function regularizedBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // For numerical stability, use the identity I_x(a,b) = 1 - I_{1-x}(b,a)
    if (x > (a + 1) / (a + b + 2)) {
        return 1 - regularizedBeta(1 - x, b, a);
    }

    const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

    // Continued fraction using Lentz's modified method
    const maxIter = 200;
    const eps = 1e-14;
    let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < eps) d = eps;
    d = 1 / d;
    f = d;

    for (let m = 1; m <= maxIter; m++) {
        // Even step
        let numerator = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
        d = 1 + numerator * d;
        if (Math.abs(d) < eps) d = eps;
        c = 1 + numerator / c;
        if (Math.abs(c) < eps) c = eps;
        d = 1 / d;
        f *= c * d;

        // Odd step
        numerator = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
        d = 1 + numerator * d;
        if (Math.abs(d) < eps) d = eps;
        c = 1 + numerator / c;
        if (Math.abs(c) < eps) c = eps;
        d = 1 / d;
        const delta = c * d;
        f *= delta;

        if (Math.abs(delta - 1) < eps) break;
    }

    return front * f;
}

/**
 * Regularized lower incomplete gamma function P(a, x) = gamma(a,x) / Gamma(a).
 * Used for chi-square distribution CDF.
 */
function regularizedGammaP(a, x) {
    if (x < 0) return 0;
    if (x === 0) return 0;

    if (x < a + 1) {
        // Series expansion
        let sum = 1 / a;
        let term = 1 / a;
        for (let n = 1; n < 200; n++) {
            term *= x / (a + n);
            sum += term;
            if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
        }
        return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    } else {
        // Continued fraction (complementary)
        return 1 - regularizedGammaQ(a, x);
    }
}

function regularizedGammaQ(a, x) {
    // Continued fraction for Q(a,x) = 1 - P(a,x)
    const maxIter = 200;
    const eps = 1e-14;

    let b0 = x + 1 - a, c = 1 / eps, d = 1 / b0;
    let f = d;

    for (let i = 1; i <= maxIter; i++) {
        const an = -i * (i - a);
        const bn = x + 2 * i + 1 - a;
        d = an * d + bn;
        if (Math.abs(d) < eps) d = eps;
        c = bn + an / c;
        if (Math.abs(c) < eps) c = eps;
        d = 1 / d;
        const delta = d * c;
        f *= delta;
        if (Math.abs(delta - 1) < eps) break;
    }

    return Math.exp(-x + a * Math.log(x) - logGamma(a)) * f;
}

// ============================================================
// DISTRIBUTION FUNCTIONS
// ============================================================

/**
 * CDF of the t-distribution with df degrees of freedom.
 */
function tDistCDF(tVal, df) {
    const x = df / (df + tVal * tVal);
    const prob = 0.5 * regularizedBeta(x, df / 2, 0.5);
    return tVal >= 0 ? 1 - prob : prob;
}

/**
 * CDF of the chi-square distribution with df degrees of freedom.
 */
function chiSquareCDF(x, df) {
    if (x <= 0) return 0;
    return regularizedGammaP(df / 2, x / 2);
}

/**
 * Inverse normal (probit) function.
 * Abramowitz & Stegun approximation 26.2.23.
 * Accurate to ~4.5e-4 (sufficient for CI calculations).
 */
function normalInverse(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    // Rational approximation for central region
    if (p < 0.5) return -normalInverse(1 - p);

    const t = Math.sqrt(-2 * Math.log(1 - p));
    const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
    const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;

    return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

/**
 * Inverse t-distribution using Newton-Raphson refinement.
 */
function tDistInverse(p, df) {
    if (df <= 0) return NaN;
    if (df === 1) return Math.tan(Math.PI * (p - 0.5)); // Cauchy
    if (df === 2) return (2 * p - 1) / Math.sqrt(2 * p * (1 - p)); // Exact for df=2

    // Initial estimate from normal approximation
    let x = normalInverse(p);

    // Cornish-Fisher expansion for better initial estimate
    const g1 = (x * x * x + x) / (4 * df);
    const g2 = (5 * x * x * x * x * x + 16 * x * x * x + 3 * x) / (96 * df * df);
    x = x + g1 + g2;

    // Newton-Raphson refinement
    for (let i = 0; i < 10; i++) {
        const cdf = tDistCDF(x, df);
        const err = cdf - p;
        if (Math.abs(err) < 1e-12) break;

        // PDF of t-distribution for derivative
        const lnPdf = logGamma((df + 1) / 2) - logGamma(df / 2)
            - 0.5 * Math.log(df * Math.PI)
            - ((df + 1) / 2) * Math.log(1 + x * x / df);
        const pdf = Math.exp(lnPdf);

        if (pdf > 1e-15) {
            x -= err / pdf;
        } else {
            break;
        }
    }

    return x;
}

// ============================================================
// HYPOTHESIS TESTS
// ============================================================

/**
 * Welch's t-test for two independent samples with unequal variances.
 * Returns: { t, df, pValue, significant, meanDiff, ci }
 */
export function welchTTest(sample1, sample2, alpha = 0.05) {
    const n1 = sample1.length, n2 = sample2.length;
    if (n1 < 2 || n2 < 2) {
        return { t: NaN, df: NaN, pValue: NaN, significant: false, error: 'Samples must have at least 2 values each.' };
    }

    const m1 = mean(sample1), m2 = mean(sample2);
    const v1 = variance(sample1), v2 = variance(sample2);
    const se1 = v1 / n1, se2 = v2 / n2;
    const se = Math.sqrt(se1 + se2);

    if (se === 0) {
        return { t: 0, df: n1 + n2 - 2, pValue: 1, significant: false, meanDiff: m1 - m2 };
    }

    const tStat = (m1 - m2) / se;

    // Welch-Satterthwaite degrees of freedom
    const df = Math.pow(se1 + se2, 2) /
        (Math.pow(se1, 2) / (n1 - 1) + Math.pow(se2, 2) / (n2 - 1));

    // Two-tailed p-value
    const pValue = 2 * (1 - tDistCDF(Math.abs(tStat), df));

    // Confidence interval for the difference
    const tCrit = tDistInverse(1 - alpha / 2, df);
    const marginOfError = tCrit * se;

    return {
        t: tStat,
        df: Math.round(df * 100) / 100,
        pValue,
        significant: pValue < alpha,
        alpha,
        meanDiff: m1 - m2,
        ci: {
            lower: (m1 - m2) - marginOfError,
            upper: (m1 - m2) + marginOfError,
            confidence: 1 - alpha
        },
        samples: { n1, n2, mean1: m1, mean2: m2, sd1: Math.sqrt(v1), sd2: Math.sqrt(v2) }
    };
}

/**
 * Cohen's d effect size for two independent samples.
 * Uses pooled standard deviation.
 */
export function cohenD(sample1, sample2) {
    const m1 = mean(sample1), m2 = mean(sample2);
    const v1 = variance(sample1), v2 = variance(sample2);
    const n1 = sample1.length, n2 = sample2.length;

    // Pooled standard deviation
    const pooledVar = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
    const pooledSD = Math.sqrt(pooledVar);

    if (pooledSD === 0) return { d: 0, interpretation: 'none' };

    const d = Math.abs(m1 - m2) / pooledSD;

    let interpretation;
    if (d < 0.2) interpretation = 'negligible';
    else if (d < 0.5) interpretation = 'small';
    else if (d < 0.8) interpretation = 'medium';
    else interpretation = 'large';

    return { d: Math.round(d * 1000) / 1000, interpretation };
}

/**
 * Chi-square test of independence for a contingency table.
 * Input: 2D array of observed frequencies.
 */
export function chiSquareTest(observed, alpha = 0.05) {
    const rows = observed.length;
    const cols = observed[0].length;
    const df = (rows - 1) * (cols - 1);

    if (df < 1) return { chiSquare: NaN, df: 0, pValue: NaN, significant: false, error: 'Table too small.' };

    // Row totals, column totals, grand total
    const rowTotals = observed.map(row => row.reduce((s, v) => s + v, 0));
    const colTotals = [];
    for (let j = 0; j < cols; j++) {
        let sum = 0;
        for (let i = 0; i < rows; i++) sum += observed[i][j];
        colTotals.push(sum);
    }
    const grandTotal = rowTotals.reduce((s, v) => s + v, 0);

    if (grandTotal === 0) return { chiSquare: 0, df, pValue: 1, significant: false };

    // Expected frequencies and chi-square statistic
    let chiSq = 0;
    const expected = [];
    for (let i = 0; i < rows; i++) {
        expected[i] = [];
        for (let j = 0; j < cols; j++) {
            const exp = (rowTotals[i] * colTotals[j]) / grandTotal;
            expected[i][j] = exp;
            if (exp > 0) {
                chiSq += Math.pow(observed[i][j] - exp, 2) / exp;
            }
        }
    }

    const pValue = 1 - chiSquareCDF(chiSq, df);

    return {
        chiSquare: Math.round(chiSq * 1000) / 1000,
        df,
        pValue,
        significant: pValue < alpha,
        alpha,
        expected,
        cramersV: Math.sqrt(chiSq / (grandTotal * (Math.min(rows, cols) - 1)))
    };
}

/**
 * Confidence interval for a sample mean using t-distribution.
 */
export function confidenceInterval(data, confidence = 0.95) {
    const n = data.length;
    if (n < 2) return { mean: mean(data), lower: NaN, upper: NaN, marginOfError: NaN };

    const m = mean(data);
    const se = standardDeviation(data) / Math.sqrt(n);
    const alpha = 1 - confidence;
    const tCrit = tDistInverse(1 - alpha / 2, n - 1);
    const moe = tCrit * se;

    return {
        mean: m,
        lower: m - moe,
        upper: m + moe,
        marginOfError: moe,
        standardError: se,
        confidence,
        n
    };
}

/**
 * Summary statistics for a dataset.
 */
export function summary(data) {
    const sorted = [...data].sort((a, b) => a - b);
    const n = data.length;
    return {
        n,
        mean: mean(data),
        median: median(data),
        sd: standardDeviation(data),
        variance: variance(data),
        min: sorted[0],
        max: sorted[n - 1],
        q1: sorted[Math.floor(n * 0.25)],
        q3: sorted[Math.floor(n * 0.75)],
        iqr: sorted[Math.floor(n * 0.75)] - sorted[Math.floor(n * 0.25)]
    };
}
