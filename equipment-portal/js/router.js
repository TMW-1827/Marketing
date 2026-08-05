/* Простий хеш-роутер: #/route/param */

const listeners = new Set();

export function parseHash(h = location.hash) {
  const clean = String(h || '').replace(/^#\/?/, '');
  const [path, ...rest] = clean.split('/');
  return { route: path || 'dashboard', param: rest[0] || null, rest };
}

export function navigate(hash) {
  const target = hash.startsWith('#') ? hash : '#/' + hash.replace(/^\//, '');
  if (location.hash === target) onHash();
  else location.hash = target;
}

export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function onHash() {
  const r = parseHash();
  listeners.forEach((fn) => fn(r));
}

export function startRouter() {
  window.addEventListener('hashchange', onHash);
  if (!location.hash) location.hash = '#/dashboard';
  else onHash();
}
