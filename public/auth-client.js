function showAuthMessage(element, text, success) {
  element.textContent = text;
  element.classList.remove('error', 'success');
  element.classList.add(success ? 'success' : 'error');
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
  const loginMessage = document.getElementById('login-message');
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberEl = document.getElementById('login-remember');
    const remember = rememberEl ? rememberEl.checked : false;
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Login failed.');
      }
      showAuthMessage(loginMessage, 'Logged in — redirecting…', true);
      window.location.href = '/index.html';
    } catch (error) {
      showAuthMessage(loginMessage, error.message, false);
    }
  });
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
  const registerMessage = document.getElementById('register-message');
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    if (password !== confirmPassword) {
      showAuthMessage(registerMessage, 'Passwords do not match.', false);
      return;
    }
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }
      showAuthMessage(registerMessage, 'Account created successfully! Redirecting to login…', true);
      registerForm.reset();
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1500);
    } catch (error) {
      showAuthMessage(registerMessage, error.message, false);
    }
  });
}
