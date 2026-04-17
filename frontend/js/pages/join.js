import * as api from '../api.js';
import { getUser, hasActiveTeams, isEmployee, refreshCurrentUser } from '../auth.js';
import { renderSidebar } from '../components/sidebar.js';
import { showError, showSuccess } from '../components/toast.js';
import { emptyState } from '../components/emptyState.js';
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
    onboardingMode
      ? 'Use a join code or invite link to join your first team.'
      : 'Add another team with a join code or invite link.'
  );

  clearElement(container);

  if (!isEmployee()) {
    const card = el('section', { className: 'join-card join-card--narrow card' },
      emptyState('Join codes are for employees', 'Managers create and share team access from the Teams page.')
    );

    card.appendChild(
      el('div', { className: 'btn-group', style: 'margin-top:18px;justify-content:center;' },
        el('button', { className: 'btn btn-primary', type: 'button', onClick: () => navigate('#/teams') }, 'Open Teams')
      )
    );

    container.appendChild(el('div', { className: 'join-shell' }, card));
    return;
  }

  const statusBox = el('div', { className: 'join-status', hidden: true });
  const codeInput = el('input', {
    className: 'form-input',
    type: 'text',
    id: 'join-code',
    name: 'joinCode',
    placeholder: 'Enter team join code',
    autocomplete: 'off'
  });
  const submitButton = el(
    'button',
    { className: 'btn btn-primary', type: 'submit' },
    inviteToken ? 'Join Team' : 'Use Join Code'
  );

  const form = el('form', { className: 'join-form' },
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label', htmlFor: 'join-code' }, 'Join code'),
      codeInput
    ),
    el('div', { className: 'join-form__actions' },
      submitButton
    )
  );

  const helperItems = [
    onboardingMode
      ? 'Enter the code your manager shared, or open the invite link while signed in.'
      : 'Joining another team will add it alongside your current memberships.',
    'You can leave a team later, but open assignments must be cleared first.'
  ];

  const card = el('section', { className: 'join-card card' },
    el('div', { className: 'join-card__header' },
      el('p', { className: 'page-hero__eyebrow' }, onboardingMode ? 'Onboarding' : 'Team access'),
      el('h2', { className: 'join-card__title' }, onboardingMode ? 'Join your first team' : 'Join another team'),
      el('p', { className: 'join-card__description' },
        inviteToken
          ? 'Invite link detected. We can finish joining this team as soon as you confirm.'
          : 'Use a team join code to become an active member.'
      )
    ),
    inviteToken
      ? el('div', { className: 'join-invite-banner' },
          el('strong', {}, 'Invite link ready'),
          el('span', {}, 'We detected a team invite in this URL.')
        )
      : null,
    statusBox,
    form,
    el('div', { className: 'join-helper-list' },
      ...helperItems.map((item) => el('div', { className: 'join-helper-item' }, item))
    )
  );

  if (!onboardingMode) {
    card.appendChild(
      el('div', { className: 'join-card__footer' },
        el('button', { className: 'btn btn-outline', type: 'button', onClick: () => navigate('#/teams') }, 'Back to Teams')
      )
    );
  }

  container.appendChild(el('div', { className: 'join-shell' }, card));

  const setPending = (nextPending, label) => {
    pending = nextPending;
    submitButton.disabled = nextPending;
    submitButton.textContent = label;
    codeInput.disabled = nextPending;
  };

  const setStatus = (type, message) => {
    statusBox.hidden = !message;
    statusBox.className = `join-status join-status--${type}`;
    statusBox.textContent = message || '';
  };

  const completeJoin = async (payload, pendingLabel) => {
    if (pending || cancelled) {
      return;
    }

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
      setPending(false, 'Use Join Code');
      return;
    }

    setPending(false, 'Use Join Code');
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
