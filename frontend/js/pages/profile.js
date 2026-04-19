import { el, clearElement } from '../utils/dom.js';
import { getUser, isManager, setUser } from '../auth.js';
import * as api from '../api.js';
import { renderHeader } from '../components/header.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { showError, showSuccess } from '../components/toast.js';
import { capitalize } from '../utils/format.js';
import { getVisibleTeams, selectPreferredTeam, sortTeamsForDemo } from '../utils/teams.js';

export default async function profilePage(container) {
  const user = getUser();
  renderHeader('Profile', 'Your account');
  clearElement(container);
  showLoading(container);

  try {
    const teamsResponse = await api.get('/teams');
    if (!isProfileViewActive() || !getUser()) return;

    const teams = sortTeamsForDemo(getVisibleTeams(teamsResponse.data.teams || []));
    const preferredTeam = selectPreferredTeam(teams);

    let supervisors = [];
    if (!isManager() && preferredTeam) {
      try {
        const { data } = await api.get(`/teams/${preferredTeam.id}/members`);
        supervisors = (data.members || []).filter(
          (m) => m.membershipRole === 'manager' && m.id !== user.id
        );
      } catch {
        /* ignore supervisor fetch failures */
      }
    }
    if (!isProfileViewActive() || !getUser()) return;

    clearElement(container);

    const shell = el('div', { className: 'prof' });
    shell.appendChild(buildIdentityHeader(user));
    shell.appendChild(buildAccountSection(user, async () => profilePage(container)));
    shell.appendChild(buildContextSection({ teams, preferredTeam, supervisors }));

    container.appendChild(shell);
  } catch (err) {
    showError(err);
    hideLoading(container);
  }
}

function isProfileViewActive() {
  return (window.location.hash || '#/profile').startsWith('#/profile');
}

/* ------------------------------------------------------------------ */
/* Identity header                                                     */
/* ------------------------------------------------------------------ */

function buildIdentityHeader(user) {
  const roleLabel = isManager() ? 'Manager' : 'Employee';
  const subtitle = user.jobTitle || capitalize(user.appRole);

  return el('section', { className: 'prof-identity' },
    el('div', { className: 'prof-identity__avatar', 'aria-hidden': 'true' }, initials(user.fullName)),
    el('div', { className: 'prof-identity__body' },
      el('div', { className: 'prof-identity__name-row' },
        el('h2', { className: 'prof-identity__name' }, user.fullName || 'Your name'),
        el('span', { className: 'prof-identity__tag' }, roleLabel)
      ),
      subtitle ? el('p', { className: 'prof-identity__subtitle' }, subtitle) : null,
      el('p', { className: 'prof-identity__email' }, user.email || '')
    )
  );
}

/* ------------------------------------------------------------------ */
/* Account information (editable)                                      */
/* ------------------------------------------------------------------ */

function buildAccountSection(user, onSaved) {
  let saveBtn;

  const form = el('form', {
    className: 'prof-section prof-form',
    onSubmit: async (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      const payload = {
        firstName: f.querySelector('[name="firstName"]').value.trim(),
        lastName: f.querySelector('[name="lastName"]').value.trim(),
        jobTitle: f.querySelector('[name="jobTitle"]').value.trim() || null,
        dateOfBirth: f.querySelector('[name="dateOfBirth"]').value || null,
        address: f.querySelector('[name="address"]').value.trim() || null
      };

      saveBtn.disabled = true;
      try {
        const { data } = await api.patch('/users/me', payload);
        setUser(data.user);
        showSuccess('Profile updated.');
        await onSaved?.();
      } catch (err) {
        showError(err);
        saveBtn.disabled = false;
      }
    }
  });

  form.appendChild(el('header', { className: 'prof-section__header' },
    el('h3', { className: 'prof-section__title' }, 'Account information'),
    el('p', { className: 'prof-section__sub' }, 'Update your basic profile details.')
  ));

  form.appendChild(el('div', { className: 'prof-form__grid' },
    fieldInput('First name', 'firstName', 'text', user.firstName || ''),
    fieldInput('Last name', 'lastName', 'text', user.lastName || ''),
    fieldInput('Date of birth', 'dateOfBirth', 'date', user.dateOfBirth || ''),
    fieldInput('Role in company', 'jobTitle', 'text', user.jobTitle || '')
  ));
  form.appendChild(fieldTextarea('Address', 'address', user.address || ''));

  form.appendChild(el('div', { className: 'prof-form__readonly' },
    readonlyRow('Email', user.email || '—'),
    readonlyRow('App role', capitalize(user.appRole))
  ));

  form.appendChild(el('div', { className: 'prof-form__actions' },
    (saveBtn = el('button', { className: 'prof-btn prof-btn--primary', type: 'submit' }, 'Save changes'))
  ));

  return form;
}

function fieldInput(label, name, type, value) {
  return el('label', { className: 'prof-field' },
    el('span', { className: 'prof-field__label' }, label),
    el('input', { className: 'prof-field__input', name, type, value })
  );
}

function fieldTextarea(label, name, value) {
  return el('label', { className: 'prof-field prof-field--wide' },
    el('span', { className: 'prof-field__label' }, label),
    el('textarea', {
      className: 'prof-field__input prof-field__input--textarea',
      name,
      rows: 2
    }, value || '')
  );
}

function readonlyRow(label, value) {
  return el('div', { className: 'prof-readonly' },
    el('span', { className: 'prof-readonly__label' }, label),
    el('span', { className: 'prof-readonly__value' }, value)
  );
}

/* ------------------------------------------------------------------ */
/* Team context (role-specific contents, same container)               */
/* ------------------------------------------------------------------ */

function buildContextSection({ teams, preferredTeam, supervisors }) {
  const section = el('section', { className: 'prof-section' });

  if (isManager()) {
    const managedTeams = teams.filter((t) => t.canManageTeam);
    const list = managedTeams.length ? managedTeams : teams;

    section.appendChild(el('header', { className: 'prof-section__header' },
      el('h3', { className: 'prof-section__title' }, 'Team scope'),
      el('p', { className: 'prof-section__sub' }, 'Teams tied to your manager access.')
    ));

    const body = el('div', { className: 'prof-context' });
    body.appendChild(contextRow('Teams', String(list.length)));

    if (list.length) {
      const chips = el('div', { className: 'prof-context__chips' });
      for (const team of list) {
        chips.appendChild(el('span', { className: 'prof-context__chip' }, team.name));
      }
      body.appendChild(contextRow('Names', chips));
    }

    section.appendChild(body);
    return section;
  }

  // Employee
  section.appendChild(el('header', { className: 'prof-section__header' },
    el('h3', { className: 'prof-section__title' }, 'Team context'),
    el('p', { className: 'prof-section__sub' }, 'Your active team and supervisors.')
  ));

  const body = el('div', { className: 'prof-context' });
  body.appendChild(contextRow('Active team', preferredTeam?.name || 'No team'));

  if (supervisors.length) {
    const chips = el('div', { className: 'prof-context__chips' });
    for (const s of supervisors) {
      chips.appendChild(el('span', { className: 'prof-context__chip' }, s.fullName));
    }
    body.appendChild(contextRow('Managed by', chips));
  } else {
    body.appendChild(contextRow(
      'Managed by',
      el('span', { className: 'prof-context__value prof-context__value--muted' }, 'No supervisors listed')
    ));
  }

  section.appendChild(body);
  return section;
}

function contextRow(label, valueOrNode) {
  const valueEl = typeof valueOrNode === 'string'
    ? el('span', { className: 'prof-context__value' }, valueOrNode)
    : valueOrNode;
  return el('div', { className: 'prof-context__row' },
    el('span', { className: 'prof-context__label' }, label),
    valueEl
  );
}

/* ------------------------------------------------------------------ */
/* Utils                                                               */
/* ------------------------------------------------------------------ */

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';
}
