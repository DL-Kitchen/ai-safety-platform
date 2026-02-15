#!/usr/bin/env node
// Saforia - Headless Test Runner
// Runs tests/runner.html in a headless browser using Playwright.
// Usage: npx playwright install chromium && node tests/run-headless.js

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.svg': 'image/svg+xml'
};

// Simple static file server
function startServer(port = 0) {
    return new Promise((resolve) => {
        const server = createServer((req, res) => {
            let filePath = join(ROOT, req.url === '/' ? 'index.html' : req.url);
            if (!existsSync(filePath)) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            const ext = extname(filePath);
            const mime = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mime });
            res.end(readFileSync(filePath));
        });

        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            resolve({ server, port: addr.port });
        });
    });
}

async function run() {
    const { server, port } = await startServer();
    const url = `http://127.0.0.1:${port}/tests/runner.html`;

    console.log(`Server running at http://127.0.0.1:${port}`);
    console.log(`Running tests at ${url}\n`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Capture console output
    page.on('console', msg => {
        const type = msg.type();
        if (type === 'error') console.error('  [ERROR]', msg.text());
    });

    await page.goto(url);

    // Wait for test results (max 30 seconds)
    const results = await page.waitForFunction(() => window.__TEST_RESULTS__, { timeout: 30000 });
    const { passed, failed, total, elapsed } = await results.jsonValue();

    // Print failures if any
    if (failed > 0) {
        const failures = await page.$$eval('.fail', els => els.map(el => el.textContent));
        failures.forEach(f => console.log(`  FAIL: ${f}`));
        console.log('');
    }

    console.log(`Results: ${passed}/${total} passed, ${failed} failed (${elapsed}ms)`);

    await browser.close();
    server.close();

    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
