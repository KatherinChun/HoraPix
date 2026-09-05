/**
 * HoraPix - Login & Registration Form Handling
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const toggleAuth = document.getElementById('toggle-auth');

  if (toggleAuth) {
    toggleAuth.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.toggle('hidden');
      registerForm.classList.toggle('hidden');
      toggleAuth.textContent = loginForm.classList.contains('hidden') 
        ? '¿Ya tienes cuenta? Inicia sesión' 
        : '¿No tienes cuenta? Regístrate aquí';
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      try {
        const response = await API.auth.login({ username: email, password });
        Auth.saveSession(response.access_token, response.user);
        showToast('¡Bienvenido de nuevo!', 'success');
        setTimeout(() => {
          window.location.href = response.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
        }, 1000);
      } catch (err) {
        showToast(err.message || 'Credenciales incorrectas', 'error');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userData = {
        nombre: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        telefono: document.getElementById('reg-phone').value,
        password: document.getElementById('reg-password').value
      };

      try {
        await API.auth.register(userData);
        showToast('Registro exitoso. Puedes iniciar sesión.', 'success');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } catch (err) {
        showToast(err.message || 'Error en el registro', 'error');
      }
    });
  }
});