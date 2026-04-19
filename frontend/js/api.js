const LOCAL_API_BASE_URL = 'http://localhost:4000/api/v1';
const PRODUCTION_API_BASE_URL = 'https://api.tasktrail.site/api/v1';

function resolveBaseUrl() {
  const host = window.location.hostname;

  if (host === 'localhost' || host === '127.0.0.1') {
    return LOCAL_API_BASE_URL;
  }

  return PRODUCTION_API_BASE_URL;
}

const BASE_URL = resolveBaseUrl();

function getToken() {
  return localStorage.getItem('accessToken');
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    throw { network: true, message: 'Cannot reach the server. Is the backend running?' };
  }

  const body = await res.json();

  if (!body.success) {
    const error = body.error || {};
    if (res.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    }
    throw { status: res.status, code: error.code, message: error.message, details: error.details };
  }

  return { data: body.data, meta: body.meta, message: body.message };
}

export function get(path) {
  return request(path, { method: 'GET' });
}

export function post(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body) });
}

export function patch(path, body) {
  return request(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function del(path) {
  return request(path, { method: 'DELETE' });
}
