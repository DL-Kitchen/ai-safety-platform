// Saforia - Simple Event Bus for module communication

const handlers = {};

export function on(event, fn) {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(fn);
    return () => off(event, fn);
}

export function off(event, fn) {
    if (!handlers[event]) return;
    handlers[event] = handlers[event].filter(h => h !== fn);
}

export function emit(event, data) {
    if (!handlers[event]) return;
    handlers[event].forEach(fn => {
        try { fn(data); } catch (err) { console.error(`Event handler error [${event}]:`, err); }
    });
}
