// Saforia - Hash-based SPA Router
// Routes map hash paths to lazy-loaded module render functions.
// Example: /#/analyzer -> modules/analyzer.js -> renderAnalyzer(container)

const routes = {};
let contentEl = null;
let currentRoute = null;
let notFoundHandler = null;

export function registerRoute(path, loader) {
    routes[path] = { loader, module: null };
}

export function setNotFound(handler) {
    notFoundHandler = handler;
}

function getPath() {
    const hash = window.location.hash || '';
    return hash.startsWith('#') ? hash.slice(1) : '/';
}

async function resolve() {
    const path = getPath();
    if (path === currentRoute) return;
    currentRoute = path;

    if (!contentEl) {
        contentEl = document.getElementById('main-content');
    }
    if (!contentEl) return;

    const route = routes[path];
    if (!route) {
        if (notFoundHandler) {
            notFoundHandler(contentEl);
        } else {
            // Default: redirect to first registered route
            const first = Object.keys(routes)[0];
            if (first) navigate(first);
        }
        return;
    }

    // Show loading
    contentEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        // Lazy load module if not already loaded
        if (!route.module) {
            route.module = await route.loader();
        }
        // Call the module's render function
        await route.module.render(contentEl);
        // Accessibility: move focus to main content on route change
        contentEl.focus({ preventScroll: true });
    } catch (err) {
        console.error(`Route ${path} failed:`, err);
        contentEl.innerHTML = `<div class="container"><div class="alert alert-danger">Error loading module: ${err.message}</div></div>`;
    }
}

export function navigate(path) {
    window.location.hash = path;
}

export function getCurrentRoute() {
    return currentRoute;
}

export function startRouter() {
    window.addEventListener('hashchange', resolve);
    // Initial resolve
    if (!window.location.hash) {
        window.location.hash = '#/analyzer';
    } else {
        resolve();
    }
}
