document.addEventListener('DOMContentLoaded', async () => {
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');

    // 1. VERIFICAR AUTENTICACION (ya no necesitas token en localStorage)
    // La cookie se envía automáticamente con credentials: 'include'
    
    // 2. MOSTRAR NOMBRE DEL USUARIO
    document.getElementById('nombreUsuario').textContent = usuarioData.nombre || 'Usuario';

    // 3. CARGAR MENU DINAMICO
    await cargarMenu();

    // 4. CARGAR CONTENIDO POR DEFECTO (Dashboard)
    cargarContenido('dashboard');

    // 5. EVENT LISTENER PARA CERRAR SESION
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
});

// FUNCION: CARGAR MENU DESDE LA BASE DE DATOS

async function cargarMenu() {
    try {
        const response = await fetch('/api/menu', {
            credentials: 'include'
        });

        if (response.status === 401) {
            localStorage.removeItem('usuario');
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();

        // NUEVA ESTRUCTURA: data.code, data.body.menu
        if (data.code === 200 && data.status === "Ok") {
            const menuList = document.getElementById('menuDinamico');
            const menuItems = data.body.menu || [];
            
            if (menuItems.length === 0) {
                menuList.innerHTML = `
                    <li class="nav-item">
                        <span class="text-white-50 px-3">No hay menus disponibles</span>
                    </li>
                `;
                return;
            }

            menuList.innerHTML = menuItems.map(item => {
                const ruta = item.url.replace('/', '') || 'dashboard';
                return `
                    <li class="nav-item">
                        <a class="nav-link text-white" href="#" 
                           onclick="cargarContenido('${ruta}')">
                            <i class="${item.icono}"></i> ${item.nombre}
                        </a>
                    </li>
                `;
            }).join('');

            console.log('Menu de usuario cargado desde la BD:', menuItems);
        } else {
            console.error('Error al cargar menu:', data.message);
            document.getElementById('menuDinamico').innerHTML = `
                <li class="nav-item">
                    <span class="text-danger px-3">Error al cargar menu</span>
                </li>
            `;
        }
    } catch (error) {
        console.error('Error en cargarMenu:', error);
        document.getElementById('menuDinamico').innerHTML = `
            <li class="nav-item">
                <span class="text-danger px-3">Error al cargar menu</span>
            </li>
        `;
    }
}


// FUNCION: CARGAR CONTENIDO SEGUN MENU

function cargarContenido(seccion) {
    const contenedor = document.getElementById('contenidoPrincipal');
    
    switch(seccion) {
        case 'dashboard':
            contenedor.innerHTML = `
                <h2> Dashboard</h2>
                <p>Bienvenido al panel de usuario</p>
                <div class="alert alert-info">
                    Puedes ver las publicaciones y crear borradores.
                    Los borradores deben ser aprobados por el administrador.
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="card bg-primary text-white">
                            <div class="card-body">
                                <h5 class="card-title">Publicaciones</h5>
                                <h2 id="totalPublicaciones">0</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card bg-warning text-dark">
                            <div class="card-body">
                                <h5 class="card-title">Mis Borradores</h5>
                                <h2 id="totalBorradores">0</h2>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            cargarEstadisticasUsuario();
            break;

        case 'publicaciones':
            contenedor.innerHTML = `
                <h2> Publicaciones</h2>
                <div id="alertContainer"></div>
                <div id="listaPublicaciones">
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p>Cargando publicaciones...</p>
                    </div>
                </div>
            `;
            cargarPublicacionesUsuario();
            break;

        case 'mis-borradores':
            contenedor.innerHTML = `
                <h2> Mis Borradores</h2>
                <button class="btn btn-success mb-3" onclick="mostrarFormularioBorrador()">
                    Crear Borrador
                </button>
                <div id="formularioBorrador" style="display:none;" class="mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5>Nuevo Borrador</h5>
                            <form id="borradorForm">
                                <div class="mb-3">
                                    <label class="form-label">Titulo *</label>
                                    <input type="text" class="form-control" id="tituloBorrador" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Contenido *</label>
                                    <textarea class="form-control" id="contenidoBorrador" rows="4" required></textarea>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Categoria</label>
                                    <input type="text" class="form-control" id="categoriaBorrador" placeholder="General">
                                </div>
                                <div class="alert alert-info">
                                    Los borradores deben ser aprobados por el administrador para ser publicados.
                                </div>
                                <button type="button" class="btn btn-primary" onclick="guardarBorrador()">
                                    Guardar
                                </button>
                                <button type="button" class="btn btn-secondary" onclick="ocultarFormularioBorrador()">
                                    Cancelar
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                <div id="listaBorradores">
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p>Cargando borradores...</p>
                    </div>
                </div>
            `;
            cargarMisBorradoresUsuario();
            break;

        default:
            contenedor.innerHTML = `
                <h2> Dashboard</h2>
                <p>Seccion no encontrada</p>
            `;
    }
}


// FUNCIONES PARA MOSTRAR/OCULTAR FORMULARIO


function mostrarFormularioBorrador() {
    document.getElementById('formularioBorrador').style.display = 'block';
    document.getElementById('formularioBorrador').scrollIntoView({ behavior: 'smooth' });
}

function ocultarFormularioBorrador() {
    document.getElementById('formularioBorrador').style.display = 'none';
    document.getElementById('borradorForm').reset();
}


// FUNCIONES DEL USUARIO

async function cargarPublicacionesUsuario() {
    try {
        const response = await fetch('/api/publicaciones', {
            credentials: 'include' 
        });

        if (response.status === 401) {
            localStorage.removeItem('usuario');
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();
        const contenedor = document.getElementById('listaPublicaciones');

        if (data.success && data.publicaciones.length > 0) {
            contenedor.innerHTML = data.publicaciones.map(p => `
                <div class="card mb-3 shadow-sm">
                    <div class="card-body">
                        <h4>${p.titulo}</h4>
                        <div class="mb-2">
                            <span class="badge bg-info">${p.categoria || 'General'}</span>
                            <span class="text-muted ms-2">
                                ${p.autor_nombre}
                            </span>
                            <span class="text-muted ms-2">
                                ${new Date(p.fecha_creacion).toLocaleDateString()}
                            </span>
                        </div>
                        <p class="card-text">${p.contenido}</p>
                    </div>
                </div>
            `).join('');
        } else {
            contenedor.innerHTML = `
                <div class="alert alert-info">
                    No hay publicaciones disponibles
                </div>
            `;
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('listaPublicaciones').innerHTML = `
            <div class="alert alert-danger">
                Error al cargar publicaciones
            </div>
        `;
    }
}

async function cargarMisBorradoresUsuario() {
    try {
        const response = await fetch('/api/publicaciones/mis-borradores', {
            credentials: 'include' 
        });

        const data = await response.json();
        const contenedor = document.getElementById('listaBorradores');

        if (data.success && data.borradores.length > 0) {
            contenedor.innerHTML = data.borradores.map(b => `
                <div class="card mb-2">
                    <div class="card-body">
                        <h5>${b.titulo}</h5>
                        <p class="text-muted">${b.contenido.substring(0, 150)}${b.contenido.length > 150 ? '...' : ''}</p>
                        <span class="badge bg-warning text-dark">Borrador</span>
                        <small class="text-muted ms-2">
                            ${new Date(b.fecha_creacion).toLocaleDateString()}
                        </small>
                        <button class="btn btn-sm btn-danger float-end" onclick="eliminarBorrador(${b.id})">
                            Eliminar
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            contenedor.innerHTML = `
                <div class="alert alert-info">
                    No tienes borradores
                </div>
            `;
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('listaBorradores').innerHTML = `
            <div class="alert alert-danger">
                Error al cargar borradores
            </div>
        `;
    }
}

async function guardarBorrador() {
    const titulo = document.getElementById('tituloBorrador').value.trim();
    const contenido = document.getElementById('contenidoBorrador').value.trim();
    const categoria = document.getElementById('categoriaBorrador').value.trim();

    if (!titulo || !contenido) {
        alert('Titulo y contenido son requeridos');
        return;
    }

    try {
        const response = await fetch('/api/publicaciones/borrador', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // envía la cookie automáticamente
            body: JSON.stringify({ titulo, contenido, categoria })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.mensaje);
            ocultarFormularioBorrador();
            cargarContenido('mis-borradores');
        } else {
            alert(data.mensaje);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar borrador');
    }
}

async function eliminarBorrador(id) {
    if (!confirm('Eliminar este borrador?')) return;

    try {
        const response = await fetch(`/api/publicaciones/borrador/${id}`, {
            method: 'DELETE',
            credentials: 'include', // envía la cookie automáticamente
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (data.success) {
            alert(data.mensaje);
            cargarContenido('mis-borradores');
        } else {
            alert(data.mensaje);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar borrador');
    }
}

async function cargarEstadisticasUsuario() {
    try {
        const resPublicaciones = await fetch('/api/publicaciones', {
            credentials: 'include' 
        });
        const dataPublicaciones = await resPublicaciones.json();

        const resBorradores = await fetch('/api/publicaciones/mis-borradores', {
            credentials: 'include' 
        });
        const dataBorradores = await resBorradores.json();

        if (dataPublicaciones.success) {
            document.getElementById('totalPublicaciones').textContent = dataPublicaciones.publicaciones.length;
        }

        if (dataBorradores.success) {
            document.getElementById('totalBorradores').textContent = dataBorradores.borradores.length;
        }
    } catch (error) {
        console.error('Error:', error);
    }
}


// FUNCION: CERRAR SESION

async function cerrarSesion() {
    try {
        await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include' // 👈 Envía la cookie automáticamente
        });
    } catch (error) {
        console.error('Error:', error);
    }

    localStorage.removeItem('usuario');
    window.location.href = '/login.html';
}