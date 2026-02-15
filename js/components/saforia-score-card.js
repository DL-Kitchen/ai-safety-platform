// Saforia - Score Card Web Component
// Displays a circular score (0-100) with color coding.
// Usage: <saforia-score-card score="85" label="Overall Score" severity="safe"></saforia-score-card>

class SaforiaScoreCard extends HTMLElement {
    static get observedAttributes() {
        return ['score', 'label', 'severity', 'size'];
    }

    attributeChangedCallback() {
        this.render();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const score = parseInt(this.getAttribute('score') || '0', 10);
        const label = this.getAttribute('label') || '';
        const size = parseInt(this.getAttribute('size') || '120', 10);
        const severity = this.getAttribute('severity') || this.getSeverity(score);

        const colors = {
            safe: 'var(--color-success)',
            low: 'var(--color-info)',
            medium: 'var(--color-warning)',
            high: 'var(--color-danger)',
            critical: 'var(--color-danger)'
        };

        const color = colors[severity] || colors.medium;
        const radius = (size - 12) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (score / 100) * circumference;

        this.innerHTML = `
            <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 0.5rem;" role="meter" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100" aria-label="${label ? label + ': ' + score + '/100' : score + '/100'}">
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);" aria-hidden="true">
                    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                        fill="none" stroke="var(--color-bg-tertiary)" stroke-width="8"/>
                    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                        fill="none" stroke="${color}" stroke-width="8"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                        stroke-linecap="round"
                        style="transition: stroke-dashoffset 0.8s ease;"/>
                </svg>
                <div style="position: relative; margin-top: -${size / 2 + 16}px; margin-bottom: ${size / 2 - 24}px; text-align: center;" aria-hidden="true">
                    <div style="font-size: ${size / 4}px; font-weight: 700; color: ${color}; line-height: 1;">${score}</div>
                    <div style="font-size: ${Math.max(10, size / 10)}px; color: var(--color-text-muted); margin-top: 2px;">/100</div>
                </div>
                ${label ? `<div style="font-size: 0.8125rem; font-weight: 500; color: var(--color-text-secondary); text-align: center;">${label}</div>` : ''}
            </div>
        `;
    }

    getSeverity(score) {
        if (score >= 80) return 'safe';
        if (score >= 60) return 'low';
        if (score >= 40) return 'medium';
        if (score >= 20) return 'high';
        return 'critical';
    }
}

customElements.define('saforia-score-card', SaforiaScoreCard);
