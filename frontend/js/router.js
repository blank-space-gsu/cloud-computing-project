import { getDefaultAuthenticatedHash, isLoggedIn } from './auth.js';

let routes = {};
let currentCleanup = null;
const publicRoutes = new Set(['/', '/login']);
const retiredRoutes = new Set(['/hours', '/productivity', '/goals']);

function buildLoginRedirectHash(hash) {
  const redirect = hash && hash !== '#/' ? hash : '#/dashboard';
  return `#/login?redirect=${encodeURIComponent(redirect)}`;
}

export function register(path, handler) {
  routes[path] = handler;
}

export function navigate(hash) {
  window.location.hash = hash;
}

export async function resolve() {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const hash = window.location.hash || '#/';
  let [path, query] = hash.slice(1).split('?');
  const params = {};

  if (query) {
    for (const part of query.split('&')) {
      const [k, v] = part.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }

  if (retiredRoutes.has(path)) {
    window.location.hash = isLoggedIn() ? getDefaultAuthenticatedHash() : '#/';
    return;
  }

  if (!publicRoutes.has(path) && !isLoggedIn()) {
    window.location.hash = buildLoginRedirectHash(hash);
    return;
  }

  if (publicRoutes.has(path) && isLoggedIn()) {
    window.location.hash = getDefaultAuthenticatedHash();
    return;
  }

  let handler = routes[path];

  if (!handler) {
    for (const [routePath, routeHandler] of Object.entries(routes)) {
      const routeParts = routePath.split('/');
      const pathParts = path.split('/');
      if (routeParts.length !== pathParts.length) continue;
      let match = true;
      const extracted = {};
      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          extracted[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        handler = routeHandler;
        Object.assign(params, extracted);
        break;
      }
    }
  }

  if (!handler) {
    window.location.hash = isLoggedIn() ? getDefaultAuthenticatedHash() : '#/';
    return;
  }

  const content = document.getElementById('content');
  const cleanup = await handler(content, params);
  if (typeof cleanup === 'function') currentCleanup = cleanup;
}

export function start() {
  window.addEventListener('hashchange', () => resolve());
}
