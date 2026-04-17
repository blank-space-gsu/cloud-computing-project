import * as api from '../api.js';
import { getUser, hasActiveTeams, isEmployee, refreshCurrentUser } from '../auth.js';
import { renderSidebar } from '../components/sidebar.js';
import { showError, showSuccess } from '../components/toast.js';
import { renderHeader } from '../components/header.js';
import { el, clearElement } from '../utils/dom.js';
import { navigate } from '../router.js';

export default async function joinPage(container, params = {}) {
  const currentUser = getUser();
  const employeeMode = isEmployee();
  const onboardingMode = employeeMode && !hasActiveTeams(currentUser);
  const inviteToken = params.inviteToken?.trim() || '';
  let pending = false;
  let cancelled = false;

  renderHeader(
    'Join Team',
    onboardingMode
      ? 'Join your first team'
      : employeeMode
        ? 'Add another team'
        : 'Join a team as manager'
  );

  clearElement(container);

  // ---- Employee view ------------------------------------------------------
  const statusBox = el('div', { className: 'ejoin-status', hidden: true });
  const inviteMode = Boolean(inviteToken);
  const codeLabel = employeeMode ? 'Join code' : 'Access code';
  const submitLabel = inviteMode ? 'Join team' : employeeMode ? 'Use join code' : 'Use access code';

  const codeInput = el('input', {
    className: 'ejoin-input',
    type: 'text',
    id: 'join-code',
    name: 'joinCode',
    placeholder: 'Enter team join code',
    autocomplete: 'off'
  });

  const submitButton = el(
    'button',
    { className: 'ejoin-btn ejoin-btn--primary', type: 'submit' },
    submitLabel
  );

  const form = el('form', { className: 'ejoin-form' },
    el('label', { className: 'ejoin-label', htmlFor: 'join-code' }, codeLabel),
    codeInput,
    el('div', { className: 'ejoin-form__actions' }, submitButton)
  );

  const helperItems = employeeMode
    ? [
        onboardingMode
          ? 'Enter the code your manager shared, or open the invite link while signed in.'
          : 'Joining another team will add it alongside your current memberships.',
        'You can leave a team later, but open assignments must be cleared first.'
      ]
    : [
        inviteMode
          ? 'We detected a manager invite in this URL. Confirm to join this team as a co-manager.'
          : 'Use the manager code or invite link shared by the team owner to join as a manager.',
        'Employee-only access is blocked for manager accounts.'
      ];

  const shell = el('section', { className: 'ejoin' });

  const card = el('div', { className: 'ejoin-card' },
    el('div', { className: 'ejoin-card__head' },
      el('span', { className: 'ejoin-eyebrow' },
        onboardingMode
          ? 'Onboarding'
          : employeeMode
            ? 'Team access'
            : 'Manager access'
      ),
      el('h2', { className: 'ejoin-card__title' },
        onboardingMode
          ? 'Join your first team'
          : employeeMode
            ? 'Join another team'
            : 'Join a team you manage'
      ),
      el('p', { className: 'ejoin-card__desc' },
        inviteMode
          ? employeeMode
            ? 'Invite link detected. Confirm to finish joining this team.'
            : 'Manager invite detected. Confirm to join this team as a manager.'
          : employeeMode
            ? 'Use a team join code to become an active member.'
            : 'Use a manager access code to join a team as a co-manager.'
      )
    ),
    inviteMode
      ? el('div', { className: 'ejoin-invite' },
          el('strong', {}, employeeMode ? 'Invite link ready' : 'Manager invite ready'),
          el('span', {}, employeeMode ? 'We detected a team invite in this URL.' : 'We detected a manager invite in this URL.')
        )
      : null,
    statusBox,
    form
  );

  if (!onboardingMode) {
    card.appendChild(
      el('div', { className: 'ejoin-card__footer' },
        el('button', {
          className: 'ejoin-btn ejoin-btn--ghost',
          type: 'button',
          onClick: () => navigate('#/teams')
        }, 'Back to Teams')
      )
    );
  }

  shell.appendChild(card);

  shell.appendChild(
    el('div', { className: 'ejoin-helpers' },
      el('h3', { className: 'ejoin-helpers__title' }, 'Good to know'),
      el('ul', { className: 'ejoin-helpers__list' },
        ...helperItems.map((item) => el('li', { className: 'ejoin-helpers__item' }, item))
      )
    )
  );

  container.appendChild(shell);

  // ---- State helpers ------------------------------------------------------
  const setPending = (nextPending, label) => {
    pending = nextPending;
    submitButton.disabled = nextPending;
    submitButton.textContent = label;
    codeInput.disabled = nextPending;
  };

  const setStatus = (type, message) => {
    statusBox.hidden = !message;
    statusBox.className = `ejoin-status ejoin-status--${type}`;
    statusBox.textContent = message || '';
  };

  const completeJoin = async (payload, pendingLabel) => {
    if (pending || cancelled) return;

    setPending(true, pendingLabel);
    setStatus(
      'info',
      inviteMode
        ? 'Connecting you to the team…'
        : employeeMode
          ? 'Checking your join access…'
          : 'Checking your manager access…'
    );

    try {
      const { data, message } = await api.post('/team-join', payload);
      await refreshCurrentUser();
      renderSidebar();
      setStatus('success', message || 'Team joined successfully.');
      showSuccess(message || 'Team joined successfully.');
      navigate(`#/teams/${data.team.id}`);
    } catch (error) {
      const message = error?.message || 'We could not join that team right now.';
      setStatus('error', message);
      showError(error);
      setPending(false, submitLabel);
      return;
    }

    setPending(false, submitLabel);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const joinCode = codeInput.value.trim();

    if (!joinCode) {
      setStatus('error', 'Enter a join code to continue.');
      return;
    }

    await completeJoin({ joinCode }, 'Joining…');
  });

  if (inviteMode) {
    setTimeout(() => {
      if (!cancelled) {
        completeJoin({ inviteToken }, 'Joining…');
      }
    }, 0);
  }

  return () => {
    cancelled = true;
  };
}
