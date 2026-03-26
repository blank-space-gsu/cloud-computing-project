import * as api from './api.js';

let currentUser = null;

export function getUser() {
  return currentUser;
}

export function isLoggedIn() {
  return currentUser !== null;
}

export function isManager() {
  return currentUser?.appRole === 'manager' || currentUser?.appRole === 'admin';
}

export function isEmployee() {
  return currentUser?.appRole === 'employee';
}

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('accessToken', data.session.accessToken);
  localStorage.setItem('refreshToken', data.session.refreshToken);
  currentUser = data.user;
  return currentUser;
}

export function logout() {
  currentUser = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.hash = '#/login';
}

export async function restoreSession() {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const { data } = await api.get('/auth/me');
    currentUser = data.user;
    return currentUser;
  } catch {
    currentUser = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return null;
  }
}
