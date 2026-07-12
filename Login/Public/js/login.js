document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const mensaje = document.getElementById('mensaje');
    const btnLogin = document.getElementById('btnLogin');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');

    // Verificar si ya está logueado
    const token = localStorage.getItem('token');
    if (token) {
        verificarToken(token);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        mensaje.classList.add('d-none');
        
        const usuario = document.getElementById('usuario').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!usuario || !password) {
            mostrarMensaje('Por favor, completa todos los campos', 'warning');
            return;
        }

        btnLogin.disabled = true;
        btnText.classList.add('d-none');
        btnSpinner.classList.remove('d-none');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ usuario, password })
            });

            const data = await response.json();
            console.log('Respuesta del login:', data);

            if (data.code === 200 && data.status === "Ok") {
                // Guardar datos del usuario 
                const user = data.body.user;
                const pages = data.body.pages || [];
                
                localStorage.setItem('usuario', JSON.stringify({
                    id: user.id,
                    nombre: user.name,
                    usuario: user.username,
                    rol: user.role,
                    pages: pages
                }));
                
                mostrarMensaje('Login exitoso! Redirigiendo...', 'success');
                
                setTimeout(() => {
                    if (user.role === 'ADMIN') {
                        window.location.href = '/admin.html';
                    } else {
                        window.location.href = '/usuario.html';
                    }
                }, 1000);
            } else {
                mostrarMensaje(data.message || 'Error al iniciar sesión', 'danger');
                btnLogin.disabled = false;
                btnText.classList.remove('d-none');
                btnSpinner.classList.add('d-none');
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarMensaje('Error al conectar con el servidor', 'danger');
            btnLogin.disabled = false;
            btnText.classList.remove('d-none');
            btnSpinner.classList.add('d-none');
        }
    });

    function mostrarMensaje(texto, tipo = 'danger') {
        mensaje.textContent = texto;
        mensaje.className = `alert alert-${tipo}`;
        mensaje.classList.remove('d-none');
    }

    async function verificarToken(token) {
        try {
            const response = await fetch('/api/verificar-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            const data = await response.json();

            if (data.code === 200 && data.status === "Ok") {
                const user = data.body.user;
                if (user.role === 'ADMIN') {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/usuario.html';
                }
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('usuario');
            }
        } catch (error) {
            console.error('Error al verificar token:', error);
        }
    }
});