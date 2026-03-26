import { el, clearElement } from '../utils/dom.js';
import { login } from '../auth.js';
import { navigate } from '../router.js';
import { renderSidebar } from '../components/sidebar.js';

export default async function loginPage(container) {
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('main-wrapper').classList.add('full-width');
  document.getElementById('header').style.display = 'none';

  clearElement(container);
  container.innerHTML = '';

  const errorBox = el('div', { className: 'login-error', id: 'login-error' });

  const form = el('form', { id: 'login-form' },
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label', htmlFor: 'email' }, 'Email'),
      el('input', { className: 'form-input', type: 'email', id: 'email', name: 'email', placeholder: 'you@example.com', required: true, autocomplete: 'email' })
    ),
    el('div', { className: 'form-group' },
      el('label', { className: 'form-label', htmlFor: 'password' }, 'Password'),
      el('input', { className: 'form-input', type: 'password', id: 'password', name: 'password', placeholder: 'Enter your password', required: true, autocomplete: 'current-password' })
    ),
    el('button', { className: 'btn btn-primary btn-lg', type: 'submit', style: 'width:100%;margin-top:8px' }, 'Sign In')
  );

  const demoHint = el('div', { style: 'margin-top:20px;padding:14px;background:var(--color-primary-bg);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--color-text-secondary)' },
    el('strong', { style: 'display:block;margin-bottom:4px;color:var(--color-primary-dark)' }, 'Demo Accounts'),
    el('div', {}, 'Manager: manager.demo@cloudcomputing.local'),
    el('div', {}, 'Employee: employee.one@cloudcomputing.local'),
    el('div', { style: 'margin-top:4px;font-style:italic' }, 'Use the demo password from your .env file')
  );

  const card = el('div', { className: 'login-card' },
    el('div', { className: 'login-brand' },
      el('h1', {}, '⚡ TaskFlow'),
      el('p', {}, 'Workforce Task Management System')
    ),
    errorBox,
    form,
    demoHint
  );

  const wrapper = el('div', { className: 'login-wrapper' }, card);
  container.appendChild(wrapper);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    errorBox.classList.remove('show');
    const emailInput = form.querySelector('#email');
    const passwordInput = form.querySelector('#password');
    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const user = await login(emailInput.value.trim(), passwordInput.value);
      document.getElementById('sidebar').classList.remove('hidden');
      document.getElementById('main-wrapper').classList.remove('full-width');
      document.getElementById('header').style.display = '';
      renderSidebar();
      navigate('#/dashboard');
    } catch (err) {
      errorBox.textContent = err.message || 'Login failed. Please check your credentials.';
      errorBox.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  return () => {
    document.getElementById('header').style.display = '';
    document.getElementById('main-wrapper').classList.remove('full-width');
  };
}
