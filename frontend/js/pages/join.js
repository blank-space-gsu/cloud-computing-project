import * as api from '../api.js';
import { getUser, hasActiveTeams, isEmployee, refreshCurrentUser } from '../auth.js';
import { renderSidebar } from '../components/sidebar.js';
import { showError, showSuccess } from '../components/toast.js';
import { renderHeader } from '../components/header.js';
import { el, clearElement } from '../utils/dom.js';
import { navigate } from '../router.js';

export default async function joinPage(container, params = {}) {
  const currentUser = getUser();
  const onboardingMode = !hasActiveTeams(currentUser);
  const inviteToken = params.inviteToken?.trim() || '';
  let pending = false;
  let cancelled = false;

  renderHeader(
    'Join Team',
    onboardingMode ? 'Join your first team' : 'Add another team'
  );

  clearElement(container);

  // ---- Non-employee view (managers land here, e.g. via invite URL) --------
  if (!isEmployee()) {
    const notice = el('section', { className: 'ejoin' },
      el('div', { className: 'ejoin-card' },
        el('div', { className: 'ejoin-card__head' },
          el('span', { className: 'ejoin-eyebrow' }, 'Manager account'),
          el('h2', { className: 'ejoin-card__title' }, 'Join codes are for employees'),
          el('p', { className: 'ejoin-card__desc' },
            'Managers create and share team access from the Teams page.'
          )
        ),
        el('div', { className: 'ejoin-actions' },
          el('button', {
            className: 'ejoin-btn ejoin-btn--primary',
            type: 'button',
            onClick: () => navigate('#/teams')
          }, 'Open Teams')
        )
      )
    );
    container.appendChild(notice);
    return;
  }

  // ---- Employee view ------------------------------------------------------
  const statusBox = el('div', { className: 'ejoin-status', hidden: true });

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
    inviteToken ? 'Join team' : 'Use join code'
  );

  const form = el('form', { className: 'ejoin-form' },
    el('label', { className: 'ejoin-label', htmlFor: 'join-code' }, 'Join code'),
    codeInput,
    el('div', { className: 'ejoin-form__actions' }, submitButton)
  );

  const helperItems = [
    onboardingMode
      ? 'Enter the code your manager shared, or open the invite link while signed in.'
      : 'Joining another team will add it alongside your current memberships.',
    'You can leave a team later, but open assignments must be cleared first.'
  ];

  const shell = el('section', { className: 'ejoin' });

  const card = el('div', { className: 'ejoin-card' },
    el('div', { className: 'ejoin-card__head' },
      el('span', { className: 'ejoin-eyebrow' }, onboardingMode ? 'Onboarding' : 'Team access'),
      el('h2', { className: 'ejoin-card__title' },
        onboardingMode ? 'Join your first team' : 'Join another team'
      ),
      el('p', { className: 'ejoin-card__desc' },
        inviteToken
          ? 'Invite link detected. Confirm to finish joining this team.'
          : 'Use a team join code to become an active member.'
      )
    ),
    inviteToken
      ? el('div', { className: 'ejoin-invite' },
          el('strong', {}, 'Invite link ready'),
          el('span', {}, 'We detected a team invite in this URL.')
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
    setStatus('info', inviteToken ? 'Connecting you to the team…' : 'Checking your join access…');

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
      setPending(false, 'Use join code');
      return;
    }

    setPending(false, 'Use join code');
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

  if (inviteToken) {
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
