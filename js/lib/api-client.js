// Saforia - API Client Abstraction
// Factory for AI provider clients. API keys stored in sessionStorage only.

const DEFAULT_RATE_LIMIT_MS = 1000;

class ManualClient {
    async complete() {
        return null; // UI handles manual paste workflow
    }
}

class OpenAIClient {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'gpt-4o-mini';
        this.rateLimit = config.rateLimit || DEFAULT_RATE_LIMIT_MS;
    }

    async complete(prompt, options = {}) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
                    { role: 'user', content: prompt }
                ],
                max_tokens: options.maxTokens || 1024,
                temperature: options.temperature ?? 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${err}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    }
}

class AnthropicClient {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.model = config.model || 'claude-sonnet-4-5-20250929';
        this.rateLimit = config.rateLimit || DEFAULT_RATE_LIMIT_MS;
    }

    async complete(prompt, options = {}) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: options.maxTokens || 1024,
                ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${err}`);
        }

        const data = await response.json();
        return data.content?.[0]?.text || '';
    }
}

class OllamaClient {
    constructor(config) {
        this.baseUrl = config.baseUrl || 'http://localhost:11434';
        this.model = config.model || 'llama3';
        this.rateLimit = config.rateLimit || 0;
    }

    async complete(prompt, options = {}) {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                prompt: options.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
                stream: false
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Ollama error (${response.status}): ${err}`);
        }

        const data = await response.json();
        return data.response || '';
    }
}

const PROVIDERS = {
    manual: ManualClient,
    openai: OpenAIClient,
    anthropic: AnthropicClient,
    ollama: OllamaClient
};

export function createClient(provider, config = {}) {
    const ClientClass = PROVIDERS[provider];
    if (!ClientClass) throw new Error(`Unknown provider: ${provider}`);
    return new ClientClass(config);
}

export function getAvailableProviders() {
    return Object.keys(PROVIDERS);
}

// Rate-limited sequential execution
export async function runWithRateLimit(client, prompts, options = {}, onProgress) {
    const results = [];
    const delay = client.rateLimit || DEFAULT_RATE_LIMIT_MS;

    for (let i = 0; i < prompts.length; i++) {
        try {
            const result = await client.complete(prompts[i], options);
            results.push({ prompt: prompts[i], response: result, error: null });
        } catch (err) {
            results.push({ prompt: prompts[i], response: null, error: err.message });
        }

        if (onProgress) onProgress(i + 1, prompts.length);

        // Rate limit (skip delay on last item)
        if (delay > 0 && i < prompts.length - 1) {
            await new Promise(r => setTimeout(r, delay));
        }
    }

    return results;
}

// Store/retrieve API key in sessionStorage
export function storeApiKey(provider, key) {
    sessionStorage.setItem(`saforia:apikey:${provider}`, key);
}

export function getApiKey(provider) {
    return sessionStorage.getItem(`saforia:apikey:${provider}`) || '';
}

export function clearApiKey(provider) {
    sessionStorage.removeItem(`saforia:apikey:${provider}`);
}
