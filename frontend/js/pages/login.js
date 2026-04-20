import { el, clearElement } from '../utils/dom.js';
import { getDefaultAuthenticatedHash, login, signup } from '../auth.js';
import { navigate } from '../router.js';
import { renderSidebar } from '../components/sidebar.js';

const DEMO_PASSWORD = 'cloudcomputing1!2';
const DEMO_ACCOUNTS = {
  manager: { email: 'olivia.hart@tasktrail.local', password: DEMO_PASSWORD },
  employee: { email: 'ethan.reyes@tasktrail.local', password: DEMO_PASSWORD }
};

export default async function loginPage(container, params = {}) {
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('main-wrapper').classList.add('full-width');
  document.getElementById('header').style.display = 'none';

  clearElement(container);
  container.innerHTML = '';

  let mode = params.mode === 'signup' ? 'signup' : 'signin';

  // Persistent cross-mode scaffolding
  const errorBox = el('div', { className: 'login-error', id: 'login-error' });
  const noticeBox = el('div', { className: 'auth-notice', id: 'auth-notice' });
  const formSlot = el('div', { className: 'auth-form-slot' });
  const demoSlot = el('div', { className: 'auth-demo-slot' });
  const toggleLine = el('p', { className: 'auth-toggle-line' });

  const brand = el('div', { className: 'login-brand' },
    el('h1', {}, '\u26A1 TaskTrail'),
    el('p', {}, 'Get work to the right people.')
  );

  const tabs = el('div', { className: 'auth-tabs', role: 'tablist' },
    tabButton('signin', 'Sign in'),
    tabButton('signup', 'Sign up')
  );

  function tabButton(key, label) {
    const btn = el('button', {
      type: 'button',
      className: `auth-tab${mode === key ? ' is-active' : ''}`,
      role: 'tab',
      'aria-selected': String(mode === key),
      onClick: () => setMode(key)
    }, label);
    btn.dataset.mode = key;
    return btn;
  }

  function setMode(next, { keepNotice = false } = {}) {
    if (next === mode) return;
    mode = next;
    for (const btn of tabs.querySelectorAll('.auth-tab')) {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    }
    clearError();
    if (!keepNotice) clearNotice();
    renderActiveForm();
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.remove('show');
  }

  function showError(message) {
    errorBox.textContent = message || 'Something went wrong. Please try again.';
    errorBox.classList.add('show');
  }

  function clearNotice() {
    clearElement(noticeBox);
    noticeBox.classList.remove('show', 'auth-notice--success', 'auth-notice--info');
  }

  function showNotice(message, { tone = 'success' } = {}) {
    clearElement(noticeBox);
    const icon = tone === 'success' ? '\u2713' : 'i';
    noticeBox.appendChild(el('span', { className: 'auth-notice__icon', 'aria-hidden': 'true' }, icon));
    noticeBox.appendChild(el('span', { className: 'auth-notice__text' }, message));
    noticeBox.classList.add('show', `auth-notice--${tone}`);
  }

  function renderActiveForm() {
    clearElement(formSlot);
    clearElement(demoSlot);
    clearElement(toggleLine);

    if (mode === 'signin') {
      formSlot.appendChild(buildSignInForm());
      demoSlot.appendChild(buildDemoPanel());
      toggleLine.appendChild(document.createTextNode("New to TaskTrail? "));
      toggleLine.appendChild(el('button', {
        className: 'auth-toggle-link', type: 'button',
        onClick: () => setMode('signup')
      }, 'Create an account'));
    } else {
      formSlot.appendChild(buildSignUpForm());
      toggleLine.appendChild(document.createTextNode('Already have an account? '));
      toggleLine.appendChild(el('button', {
        className: 'auth-toggle-link', type: 'button',
        onClick: () => setMode('signin')
      }, 'Sign in'));
    }
  }

  // ---- Sign in form ------------------------------------------------------
  function buildSignInForm() {
    const emailInput = el('input', {
      className: 'form-input', type: 'email', id: 'signin-email',
      name: 'email', placeholder: 'you@example.com',
      required: true, autocomplete: 'email'
    });
    const passwordInput = el('input', {
      className: 'form-input', type: 'password', id: 'signin-password',
      name: 'password', placeholder: 'Your password',
      required: true, autocomplete: 'current-password'
    });
    const submit = el('button', {
      className: 'btn btn-primary btn-lg',
      type: 'submit',
      style: 'width:100%;margin-top:4px'
    }, 'Sign in');

    const form = el('form', { id: 'login-form', noValidate: true },
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label', htmlFor: 'signin-email' }, 'Email'),
        emailInput
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label', htmlFor: 'signin-password' }, 'Password'),
        passwordInput
      ),
      submit
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      clearNotice();

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      if (!email || !password) {
        showError('Enter your email and password.');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Signing in...';
      try {
        const user = await login(email, password);
        await handleAuthSuccess(user);
      } catch (err) {
        if (err?.code === 'EMAIL_NOT_VERIFIED' || err?.status === 403) {
          showError(
            'Your email isn\u2019t verified yet. Check your inbox for the verification link before signing in.'
          );
        } else {
          showError(err?.message || 'Login failed. Please check your credentials.');
        }
        submit.disabled = false;
        submit.textContent = 'Sign in';
      }
    });

    return form;
  }

  // ---- Sign up form ------------------------------------------------------
  function buildSignUpForm() {
    const firstInput = el('input', {
      className: 'form-input', type: 'text', id: 'signup-first',
      name: 'firstName', placeholder: 'First name',
      required: true, autocomplete: 'given-name'
    });
    const lastInput = el('input', {
      className: 'form-input', type: 'text', id: 'signup-last',
      name: 'lastName', placeholder: 'Last name',
      required: true, autocomplete: 'family-name'
    });
    const emailInput = el('input', {
      className: 'form-input', type: 'email', id: 'signup-email',
      name: 'email', placeholder: 'you@example.com',
      required: true, autocomplete: 'email'
    });
    const jobInput = el('input', {
      className: 'form-input', type: 'text', id: 'signup-job',
      name: 'jobTitle', placeholder: 'e.g. Ops Lead (optional)',
      autocomplete: 'organization-title'
    });
    const passInput = el('input', {
      className: 'form-input', type: 'password', id: 'signup-pass',
      name: 'password', placeholder: 'At least 6 characters',
      required: true, autocomplete: 'new-password'
    });
    const confirmInput = el('input', {
      className: 'form-input', type: 'password', id: 'signup-confirm',
      name: 'confirmPassword', placeholder: 'Repeat password',
      required: true, autocomplete: 'new-password'
    });

    const roleField = el('div', { className: 'role-picker', role: 'radiogroup', 'aria-label': 'Account type' },
      roleOption('manager', 'Manager', 'Create teams, assign work, and oversee delivery.'),
      roleOption('employee', 'Employee', 'Join a team with a code and work through your tasks.')
    );

    const submit = el('button', {
      className: 'btn btn-primary btn-lg',
      type: 'submit',
      style: 'width:100%;margin-top:4px'
    }, 'Create account');

    const form = el('form', { id: 'signup-form', noValidate: true },
      el('div', { className: 'form-row form-row--two' },
        el('div', { className: 'form-group' },
          el('label', { className: 'form-label', htmlFor: 'signup-first' }, 'First name'),
          firstInput
        ),
        el('div', { className: 'form-group' },
          el('label', { className: 'form-label', htmlFor: 'signup-last' }, 'Last name'),
          lastInput
        )
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label', htmlFor: 'signup-email' }, 'Email'),
        emailInput
      ),
      el('div', { className: 'form-group' },
        el('label', { className: 'form-label', htmlFor: 'signup-job' }, 'Job title'),
        jobInput
      ),
      el('div', { className: 'form-row form-row--two' },
        el('div', { className: 'form-group' },
          el('label', { className: 'form-label', htmlFor: 'signup-pass' }, 'Password'),
          passInput
        ),
        el('div', { className: 'form-group' },
          el('label', { className: 'form-label', htmlFor: 'signup-confirm' }, 'Confirm password'),
          confirmInput
        )
      ),
      el('div', { className: 'form-group' },
        el('span', { className: 'form-label' }, 'I am signing up as'),
        roleField
      ),
      submit
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();

      const firstName = firstInput.value.trim();
      const lastName = lastInput.value.trim();
      const email = emailInput.value.trim();
      const password = passInput.value;
      const confirm = confirmInput.value;
      const jobTitle = jobInput.value.trim();
      const selectedRole = form.querySelector('input[name="appRole"]:checked')?.value;

      if (!firstName || !lastName) {
        showError('Enter your first and last name.');
        return;
      }
      if (!email) { showError('Enter your email.'); return; }
      if (!password || password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirm) {
        showError('Passwords do not match.');
        return;
      }
      if (selectedRole !== 'manager' && selectedRole !== 'employee') {
        showError('Choose whether you are signing up as a manager or employee.');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Creating account...';
      try {
        const result = await signup({
          email,
          password,
          firstName,
          lastName,
          jobTitle,
          appRole: selectedRole
        });
        renderSignupPending({
          email: result?.email || email,
          emailSent: result?.verificationEmailSent !== false
        });
      } catch (err) {
        showError(err?.message || 'Sign up failed. Please try again.');
        submit.disabled = false;
        submit.textContent = 'Create account';
      }
    });

    return form;
  }

  // ---- Pending verification card ----------------------------------------
  function renderSignupPending({ email, emailSent }) {
    clearError();
    clearNotice();
    clearElement(formSlot);
    clearElement(demoSlot);
    clearElement(toggleLine);

    // Hide the tabs while the user is in the pending-verification state --
    // they can't switch to "Sign in" and have it work until they click the link.
    tabs.classList.add('is-hidden');

    const heading = emailSent
      ? 'Check your inbox'
      : 'Almost there';
    const subcopy = emailSent
      ? 'We sent a verification link to your email. Click it to activate your account, then sign in.'
      : 'We couldn\u2019t confirm that the verification email was sent. You can retry signing up, or contact support if it keeps happening.';

    const pending = el('div', { className: 'auth-pending', role: 'status', 'aria-live': 'polite' },
      el('div', { className: 'auth-pending__icon', 'aria-hidden': 'true' }, '\u2709'),
      el('h2', { className: 'auth-pending__title' }, heading),
      el('p', { className: 'auth-pending__copy' }, subcopy),
      el('p', { className: 'auth-pending__email' },
        el('span', { className: 'auth-pending__email-label' }, 'Sent to '),
        el('strong', {}, email)
      ),
      el('p', { className: 'auth-pending__hint' },
        'Verify your email before signing in. The link may land in spam \u2014 it\u2019s safe to open.'
      ),
      el('button', {
        className: 'btn btn-primary btn-lg auth-pending__cta',
        type: 'button',
        style: 'width:100%;margin-top:4px',
        onClick: () => {
          tabs.classList.remove('is-hidden');
          setMode('signin');
        }
      }, 'I\u2019ve verified \u2014 sign in')
    );

    formSlot.appendChild(pending);
  }

  function roleOption(value, title, description) {
    const input = el('input', {
      type: 'radio', name: 'appRole', value, id: `role-${value}`,
      className: 'role-option__input'
    });
    const label = el('label', {
      className: 'role-option', htmlFor: `role-${value}`
    },
      input,
      el('span', { className: 'role-option__indicator', 'aria-hidden': 'true' }),
      el('div', { className: 'role-option__copy' },
        el('strong', { className: 'role-option__title' }, title),
        el('span', { className: 'role-option__desc' }, description)
      )
    );
    return label;
  }

  // ---- Demo autofill panel ----------------------------------------------
  function buildDemoPanel() {
    return el('div', { className: 'auth-demo' },
      el('div', { className: 'auth-demo__head' },
        el('strong', { className: 'auth-demo__title' }, 'Try a demo account'),
        el('span', { className: 'auth-demo__sub' },
          'Password: ',
          el('code', { className: 'auth-demo__code' }, DEMO_PASSWORD)
        )
      ),
      el('div', { className: 'auth-demo__actions' },
        el('button', {
          className: 'btn btn-outline btn-sm auth-demo__btn',
          type: 'button',
          onClick: () => autofillDemo('manager')
        },
          el('span', { className: 'auth-demo__btn-label' }, 'Manager demo'),
          el('span', {
            className: 'auth-demo__btn-email',
            title: DEMO_ACCOUNTS.manager.email
          }, DEMO_ACCOUNTS.manager.email)
        ),
        el('button', {
          className: 'btn btn-outline btn-sm auth-demo__btn',
          type: 'button',
          onClick: () => autofillDemo('employee')
        },
          el('span', { className: 'auth-demo__btn-label' }, 'Employee demo'),
          el('span', {
            className: 'auth-demo__btn-email',
            title: DEMO_ACCOUNTS.employee.email
          }, DEMO_ACCOUNTS.employee.email)
        )
      )
    );
  }

  function autofillDemo(role) {
    const creds = DEMO_ACCOUNTS[role];
    if (!creds) return;
    if (mode !== 'signin') {
      setMode('signin');
    }
    const emailField = formSlot.querySelector('#signin-email');
    const passField = formSlot.querySelector('#signin-password');
    if (emailField) emailField.value = creds.email;
    if (passField) passField.value = creds.password;
    clearError();
  }

  // ---- Shared success handler -------------------------------------------
  async function handleAuthSuccess(user) {
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('main-wrapper').classList.remove('full-width');
    document.getElementById('header').style.display = '';
    renderSidebar();
    const redirectTarget = params.redirect?.startsWith('#/')
      ? params.redirect
      : getDefaultAuthenticatedHash(user);
    navigate(redirectTarget);
  }

  // ---- Card skeleton -----------------------------------------------------
  const card = el('div', { className: 'login-card login-card--auth' },
    el('button', {
      className: 'login-back-link', type: 'button',
      onClick: () => navigate('#/')
    }, '\u2190 Back to home'),
    brand,
    tabs,
    noticeBox,
    errorBox,
    formSlot,
    toggleLine,
    demoSlot
  );

  container.appendChild(el('div', { className: 'login-wrapper' }, card));

  renderActiveForm();

  // Verification-return UX: if the login page is opened after the verification
  // callback (e.g. #/login?verified=1), show a success banner inviting sign-in.
  if (params.verified === '1' || params.verified === 'true') {
    if (mode !== 'signin') setMode('signin', { keepNotice: true });
    showNotice('Email verified. You can sign in now.', { tone: 'success' });
  } else if (params.verified === '0' || params.verified === 'false') {
    showNotice(
      'That verification link is expired or invalid. Try signing in or request a new link.',
      { tone: 'info' }
    );
  }

  return () => {
    document.getElementById('header').style.display = '';
    document.getElementById('main-wrapper').classList.remove('full-width');
  };
}
