import * as api from './api.js';

let currentUser = null;

export function getUser() {
  return currentUser;
}

export function setUser(user) {
  currentUser = user;
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

export function hasActiveTeams(user = currentUser) {
  return Array.isArray(user?.teams) && user.teams.length > 0;
}

export function getDefaultAuthenticatedHash(user = currentUser) {
  if (user?.appRole === 'employee' && !hasActiveTeams(user)) {
    return '#/join';
  }

  if (user?.appRole === 'employee') {
    return '#/tasks';
  }

  return '#/dashboard';
}

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('accessToken', data.session.accessToken);
  localStorage.setItem('refreshToken', data.session.refreshToken);
  currentUser = data.user;
  return currentUser;
}

export async function signup({ email, password, firstName, lastName, jobTitle, appRole }) {
  const payload = {
    email,
    password,
    firstName,
    lastName,
    appRole
  };
  const trimmedJobTitle = typeof jobTitle === 'string' ? jobTitle.trim() : '';
  if (trimmedJobTitle) {
    payload.jobTitle = trimmedJobTitle;
  }

  const { data } = await api.post('/auth/signup', payload);

  // Backend now defers session creation until after email verification.
  // The response is { email, appRole, verificationRequired, verificationEmailSent, emailRedirectTo }.
  // Do NOT persist tokens and do NOT set currentUser here -- the caller renders
  // a pending-verification state and the real session is established later via login().
  return {
    email: data?.email ?? email,
    appRole: data?.appRole ?? appRole,
    verificationRequired: data?.verificationRequired ?? true,
    verificationEmailSent: data?.verificationEmailSent ?? true,
    emailRedirectTo: data?.emailRedirectTo ?? null
  };
}

export function logout() {
  currentUser = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.location.hash = '#/';
}

export async function restoreSession() {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    return await refreshCurrentUser();
  } catch {
    currentUser = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return null;
  }
}

export async function refreshCurrentUser() {
  const { data } = await api.get('/auth/me');
  currentUser = data.user;
  return currentUser;
}
