document.addEventListener('DOMContentLoaded', async () => {
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
   
    if (usuarioData.rol !== 'ADMIN') {
        window.location.href = '/usuario.html';
        return;
    }

    // MOSTRAR NOMBRE DEL USUARIO
    document.getElementById('nombreUsuario').textContent = usuarioData.nombre || 'Administrador';

    // CARGAR MENÚ DINÁMICO
    await cargarMenu();

    // CARGAR DASHBOARD POR DEFECTO
    cargarContenido('dashboard');

    // EVENT LISTENER PARA CERRAR SESIÓN
    document.getElementById('btnLogout').addEventListener('click', cerrarSesion);
});


// FUNCIÓN: CARGAR MENÚ DESDE LA BASE DE DATOS

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
                        <span class="text-white-50 px-3">No hay menús disponibles</span>
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

            console.log('Menú cargado desde la BD:', menuItems);
        } else {
            console.error('Error al cargar menú:', data.message);
            document.getElementById('menuDinamico').innerHTML = `
                <li class="nav-item">
                    <span class="text-danger px-3">Error al cargar menú</span>
                </li>
            `;
        }
    } catch (error) {
        console.error('Error en cargarMenu:', error);
        document.getElementById('menuDinamico').innerHTML = `
            <li class="nav-item">
                <span class="text-danger px-3">Error al cargar menú</span>
            </li>
        `;
    }
}


// FUNCIÓN: CARGAR CONTENIDO SEGÚN MENÚ

function cargarContenido(seccion) {
    const contenedor = document.getElementById('contenidoPrincipal');
    
    switch(seccion) {
        case 'dashboard':
            contenedor.innerHTML = `
                <h2><i class="bi bi-speedometer2"></i> Dashboard</h2>
                <p>Bienvenido al panel de administración</p>
                <div class="row">
                    <div class="col-md-3">
                        <div class="card bg-primary text-white">
                            <div class="card-body">
                                <h5 class="card-title">Publicaciones</h5>
                                <h2 id="totalPublicaciones">0</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-success text-white">
                            <div class="card-body">
                                <h5 class="card-title">Publicados</h5>
                                <h2 id="totalPublicados">0</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-warning text-dark">
                            <div class="card-body">
                                <h5 class="card-title">Borradores</h5>
                                <h2 id="totalBorradores">0</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card bg-info text-white">
                            <div class="card-body">
                                <h5 class="card-title">Usuarios</h5>
                                <h2 id="totalUsuarios">0</h2>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            cargarEstadisticas();
            break;

        case 'publicaciones':
            contenedor.innerHTML = `
                <h2><i class="bi bi-newspaper"></i> Gestión de Publicaciones</h2>
                <button class="btn btn-success mb-3" onclick="cargarContenido('crear-publicacion')">
                    <i class="bi bi-plus-circle"></i> Nueva Publicación
                </button>
                <div id="alertContainer"></div>
                <div id="tablaPublicaciones">
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p>Cargando publicaciones...</p>
                    </div>
                </div>
            `;
            cargarPublicaciones();
            break;

        case 'crear-publicacion':
            contenedor.innerHTML = `
                <h2><i class="bi bi-plus-circle"></i> Crear Publicación</h2>
                <div class="card">
                    <div class="card-body">
                        <form id="formPublicacion">
                            <div class="mb-3">
                                <label class="form-label">Título *</label>
                                <input type="text" class="form-control" id="tituloPublicacion" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Contenido *</label>
                                <textarea class="form-control" id="contenidoPublicacion" rows="5" required></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Categoría</label>
                                <input type="text" class="form-control" id="categoriaPublicacion" placeholder="General">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Estado</label>
                                <select class="form-control" id="estadoPublicacion">
                                    <option value="PUBLICADO">Publicado</option>
                                    <option value="BORRADOR">Borrador</option>
                                    <option value="ARCHIVADO">Archivado</option>
                                </select>
                            </div>
                            <button type="button" class="btn btn-primary" onclick="guardarPublicacion()">
                                <i class="bi bi-save"></i> Guardar
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="cargarContenido('publicaciones')">
                                <i class="bi bi-arrow-left"></i> Volver
                            </button>
                        </form>
                    </div>
                </div>
            `;
            break;

        case 'mis-borradores':
            contenedor.innerHTML = `
                <h2><i class="bi bi-pencil"></i> Mis Borradores</h2>
                <div id="listaBorradores">
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p>Cargando borradores...</p>
                    </div>
                </div>
            `;
            cargarMisBorradores();
            break;

        case 'usuarios':
            contenedor.innerHTML = `
                <h2><i class="bi bi-people"></i> Gestión de Usuarios</h2>
                <p>Lista de usuarios registrados</p>
                <div id="tablaUsuarios">
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <p>Cargando usuarios...</p>
                    </div>
                </div>
            `;
            cargarUsuarios();
            break;

        default:
            contenedor.innerHTML = `
                <h2><i class="bi bi-speedometer2"></i> Dashboard</h2>
                <p>Sección no encontrada, volviendo al dashboard</p>
            `;
    }
}

// FUNCIONES AUXILIARES


async function cargarPublicaciones() {
    try {
        const response = await fetch('/api/admin/publicaciones', {
            credentials: 'include'
        });

        if (response.status === 401) {
            localStorage.removeItem('usuario');
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();

        if (data.success) {
            const tabla = document.getElementById('tablaPublicaciones');
            
            if (data.publicaciones.length === 0) {
                tabla.innerHTML = `
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i> No hay publicaciones
                    </div>
                `;
                return;
            }

            tabla.innerHTML = `
                <table class="table table-striped">
                    <thead class="table-dark">
                        <tr>
                            <th>ID</th>
                            <th>Título</th>
                            <th>Autor</th>
                            <th>Categoría</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.publicaciones.map(p => `
                            <tr>
                                <td>#${p.id}</td>
                                <td><strong>${p.titulo}</strong></td>
                                <td>${p.autor_nombre}</td>
                                <td>${p.categoria || 'General'}</td>
                                <td>${getEstadoBadge(p.estado)}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary" onclick="editarPublicacion(${p.id})">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-sm btn-danger" onclick="eliminarPublicacion(${p.id})">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            console.error('Error al cargar publicaciones:', data.message);
            document.getElementById('tablaPublicaciones').innerHTML = `
                <div class="alert alert-danger">
                    Error al cargar publicaciones: ${data.message || 'Error desconocido'}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('tablaPublicaciones').innerHTML = `
            <div class="alert alert-danger">
                Error al cargar publicaciones
            </div>
        `;
    }
}

function getEstadoBadge(estado) {
    const badges = {
        'PUBLICADO': '<span class="badge bg-success">Publicado</span>',
        'BORRADOR': '<span class="badge bg-warning text-dark">Borrador</span>',
        'ARCHIVADO': '<span class="badge bg-secondary">Archivado</span>'
    };
    return badges[estado] || `<span class="badge bg-secondary">${estado}</span>`;
}

async function guardarPublicacion() {
    const titulo = document.getElementById('tituloPublicacion').value.trim();
    const contenido = document.getElementById('contenidoPublicacion').value.trim();
    const categoria = document.getElementById('categoriaPublicacion').value.trim();
    const estado = document.getElementById('estadoPublicacion').value;

    if (!titulo || !contenido) {
        alert('Título y contenido son requeridos');
        return;
    }

    try {
        const response = await fetch('/api/admin/publicaciones', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ titulo, contenido, categoria, estado })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.mensaje);
            cargarContenido('publicaciones');
        } else {
            alert(data.mensaje);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar publicación');
    }
}

async function eliminarPublicacion(id) {
    if (!confirm('¿Estás seguro de eliminar esta publicación?')) return;

    try {
        const response = await fetch(`/api/admin/publicaciones/${id}`, {
            method: 'DELETE',
            credentials: 'include', 
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.mensaje);
            cargarContenido('publicaciones');
        } else {
            alert(data.mensaje);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar publicación');
    }
}

async function editarPublicacion(id) {
    try {
        // 1. Obtener los datos de la publicación
        const response = await fetch(`/api/admin/publicaciones/${id}`, {
            credentials: 'include'
        });

        if (response.status === 401) {
            localStorage.removeItem('usuario');
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();

        if (data.success) {
            const pub = data.publicacion;
            
            // 2. Crear un modal dinámico para editar
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'editarModal';
            modal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-pencil"></i> Editar Publicación #${pub.id}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editarForm">
                                <input type="hidden" id="editId" value="${pub.id}">
                                <div class="mb-3">
                                    <label class="form-label">Título *</label>
                                    <input type="text" class="form-control" id="editTitulo" value="${pub.titulo}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Contenido *</label>
                                    <textarea class="form-control" id="editContenido" rows="5" required>${pub.contenido}</textarea>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Categoría</label>
                                    <input type="text" class="form-control" id="editCategoria" value="${pub.categoria || ''}" placeholder="General">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Estado</label>
                                    <select class="form-control" id="editEstado">
                                        <option value="PUBLICADO" ${pub.estado === 'PUBLICADO' ? 'selected' : ''}>Publicado</option>
                                        <option value="BORRADOR" ${pub.estado === 'BORRADOR' ? 'selected' : ''}>Borrador</option>
                                        <option value="ARCHIVADO" ${pub.estado === 'ARCHIVADO' ? 'selected' : ''}>Archivado</option>
                                    </select>
                                </div>
                                <div class="alert alert-info">
                                    <i class="bi bi-info-circle"></i>
                                    <strong>Autor:</strong> ${pub.autor_nombre} | 
                                    <strong>Creado:</strong> ${new Date(pub.fecha_creacion).toLocaleDateString()}
                                    ${pub.estado === 'BORRADOR' ? ' | <span class="badge bg-warning text-dark">✏️ Pendiente de aprobación</span>' : ''}
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="guardarEdicion()">
                                <i class="bi bi-save"></i> Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // 3. Mostrar el modal
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();
            
            // 4. Eliminar el modal del DOM cuando se cierre
            modal.addEventListener('hidden.bs.modal', function() {
                this.remove();
            });
            
        } else {
            alert('Error al cargar la publicación: ' + data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar la publicación');
    }
}

// FUNCIÓN: GUARDAR EDICIÓN

async function guardarEdicion() {
    const id = document.getElementById('editId').value;
    const titulo = document.getElementById('editTitulo').value.trim();
    const contenido = document.getElementById('editContenido').value.trim();
    const categoria = document.getElementById('editCategoria').value.trim();
    const estado = document.getElementById('editEstado').value;

    if (!titulo || !contenido) {
        alert('Título y contenido son requeridos');
        return;
    }

    try {
        const response = await fetch(`/api/admin/publicaciones/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ titulo, contenido, categoria, estado })
        });

        const data = await response.json();

        if (data.success) {
            alert(data.mensaje);
            // Cerrar modal
            const modal = document.getElementById('editarModal');
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
            // Recargar la lista de publicaciones
            cargarContenido('publicaciones');
        } else {
            alert(data.mensaje);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar los cambios');
    }
}

async function cargarMisBorradores() {
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
                        <p>${b.contenido.substring(0, 100)}${b.contenido.length > 100 ? '...' : ''}</p>
                        <span class="badge bg-warning text-dark">Borrador</span>
                        <small class="text-muted ms-2">${new Date(b.fecha_creacion).toLocaleDateString()}</small>
                        <button class="btn btn-sm btn-danger float-end" onclick="eliminarBorradorAdmin(${b.id})">
                            <i class="bi bi-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            contenedor.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No tienes borradores
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

async function cargarUsuarios() {
    // Función para cargar usuarios 
    const contenedor = document.getElementById('tablaUsuarios');
    contenedor.innerHTML = `
        <div class="alert alert-info">
            <i class="bi bi-info-circle"></i> Gestión de usuarios en desarrollo
        </div>
    `;
}

async function cargarEstadisticas() {
    try {
        const response = await fetch('/api/admin/publicaciones', {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            const publicados = data.publicaciones.filter(p => p.estado === 'PUBLICADO').length;
            const borradores = data.publicaciones.filter(p => p.estado === 'BORRADOR').length;
            
            document.getElementById('totalPublicaciones').textContent = data.publicaciones.length;
            document.getElementById('totalPublicados').textContent = publicados;
            document.getElementById('totalBorradores').textContent = borradores;
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function eliminarBorradorAdmin(id) {
    if (!confirm('¿Estás seguro de eliminar este borrador?')) return;

    try {
        const response = await fetch(`/api/publicaciones/borrador/${id}`, {
            method: 'DELETE',
            credentials: 'include', 
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.mensaje);
            cargarMisBorradores();
        } else {
            alert(data.mensaje);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar borrador');
    }
}






// FUNCIÓN: CERRAR SESIÓN

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