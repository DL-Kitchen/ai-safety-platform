// Saforia - SVG Chart Utilities
// Pure SVG chart generation, no external dependencies.
// Uses CSS custom properties for theming.

const CHART_COLORS = [
    'var(--color-chart-1, #1a56db)',
    'var(--color-chart-2, #059669)',
    'var(--color-chart-3, #d97706)',
    'var(--color-chart-4, #dc2626)',
    'var(--color-chart-5, #7c3aed)',
    'var(--color-chart-6, #0891b2)'
];

export function radarChart(data, options = {}) {
    const {
        size = 300,
        labels = [],
        maxValue = 100,
        fillColor = 'rgba(26, 86, 219, 0.2)',
        strokeColor = 'var(--color-accent, #1a56db)',
        gridColor = 'var(--color-border, #e5e7eb)',
        labelColor = 'var(--color-text-secondary, #6b7280)',
        ariaLabel = 'Radar chart'
    } = options;

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.35;
    const n = data.length;
    const angleStep = (2 * Math.PI) / n;

    // Grid rings
    const rings = [0.2, 0.4, 0.6, 0.8, 1.0];
    let gridLines = '';
    for (const scale of rings) {
        const points = [];
        for (let i = 0; i < n; i++) {
            const angle = i * angleStep - Math.PI / 2;
            points.push(`${cx + r * scale * Math.cos(angle)},${cy + r * scale * Math.sin(angle)}`);
        }
        gridLines += `<polygon points="${points.join(' ')}" fill="none" stroke="${gridColor}" stroke-width="0.5" opacity="0.5"/>`;
    }

    // Axis lines
    let axes = '';
    for (let i = 0; i < n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        axes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${gridColor}" stroke-width="0.5" opacity="0.5"/>`;
    }

    // Data polygon
    const dataPoints = [];
    for (let i = 0; i < n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const value = Math.min(data[i] / maxValue, 1);
        dataPoints.push(`${cx + r * value * Math.cos(angle)},${cy + r * value * Math.sin(angle)}`);
    }

    // Data dots
    let dots = '';
    for (let i = 0; i < n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const value = Math.min(data[i] / maxValue, 1);
        const x = cx + r * value * Math.cos(angle);
        const y = cy + r * value * Math.sin(angle);
        dots += `<circle cx="${x}" cy="${y}" r="3" fill="${strokeColor}"/>`;
    }

    // Labels
    let labelEls = '';
    const labelR = r + 20;
    for (let i = 0; i < n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + labelR * Math.cos(angle);
        const y = cy + labelR * Math.sin(angle);
        const anchor = Math.abs(x - cx) < 1 ? 'middle' : (x > cx ? 'start' : 'end');
        const label = labels[i] || `Category ${i + 1}`;
        labelEls += `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-size="11" fill="${labelColor}">${label}</text>`;
    }

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${ariaLabel}" xmlns="http://www.w3.org/2000/svg">
        ${gridLines}
        ${axes}
        <polygon points="${dataPoints.join(' ')}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
        ${dots}
        ${labelEls}
    </svg>`;
}

export function barChart(data, options = {}) {
    const {
        width = 400,
        height = 250,
        labels = [],
        maxValue = null,
        horizontal = false,
        barColor = null,
        showValues = true,
        ariaLabel = 'Bar chart'
    } = options;

    const max = maxValue || Math.max(...data, 1);
    const n = data.length;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    let bars = '';
    if (horizontal) {
        const barH = chartH / n - 4;
        for (let i = 0; i < n; i++) {
            const w = (data[i] / max) * chartW;
            const y = padding.top + i * (chartH / n) + 2;
            const color = barColor || CHART_COLORS[i % CHART_COLORS.length];
            bars += `<rect x="${padding.left}" y="${y}" width="${w}" height="${barH}" fill="${color}" rx="2"/>`;
            if (showValues) {
                bars += `<text x="${padding.left + w + 5}" y="${y + barH / 2}" dominant-baseline="central" font-size="11" fill="var(--color-text-secondary, #6b7280)">${data[i]}</text>`;
            }
            const label = labels[i] || '';
            bars += `<text x="${padding.left - 5}" y="${y + barH / 2}" text-anchor="end" dominant-baseline="central" font-size="10" fill="var(--color-text-secondary, #6b7280)">${label}</text>`;
        }
    } else {
        const barW = chartW / n - 4;
        for (let i = 0; i < n; i++) {
            const h = (data[i] / max) * chartH;
            const x = padding.left + i * (chartW / n) + 2;
            const y = padding.top + chartH - h;
            const color = barColor || CHART_COLORS[i % CHART_COLORS.length];
            bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${color}" rx="2"/>`;
            if (showValues) {
                bars += `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-size="11" fill="var(--color-text-secondary, #6b7280)">${data[i]}</text>`;
            }
            const label = labels[i] || '';
            bars += `<text x="${x + barW / 2}" y="${padding.top + chartH + 15}" text-anchor="middle" font-size="9" fill="var(--color-text-secondary, #6b7280)">${label}</text>`;
        }
    }

    // Y-axis line
    const axisLine = `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartH}" stroke="var(--color-border, #e5e7eb)" stroke-width="1"/>`;
    // X-axis line
    const xAxisLine = `<line x1="${padding.left}" y1="${padding.top + chartH}" x2="${padding.left + chartW}" y2="${padding.top + chartH}" stroke="var(--color-border, #e5e7eb)" stroke-width="1"/>`;

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}" xmlns="http://www.w3.org/2000/svg">
        ${axisLine}
        ${xAxisLine}
        ${bars}
    </svg>`;
}

export function heatmapCell(value, max = 25) {
    const ratio = Math.min(value / max, 1);
    if (ratio < 0.2) return 'var(--color-success, #059669)';
    if (ratio < 0.4) return 'var(--color-info, #0284c7)';
    if (ratio < 0.6) return '#d97706';
    if (ratio < 0.8) return '#ea580c';
    return 'var(--color-danger, #dc2626)';
}

export function sparkline(data, options = {}) {
    const { width = 100, height = 30, color = 'var(--color-accent, #1a56db)', ariaLabel = 'Trend' } = options;
    if (!data || data.length < 2) return '';

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1);

    const points = data.map((v, i) =>
        `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`
    ).join(' ');

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}" xmlns="http://www.w3.org/2000/svg">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}
