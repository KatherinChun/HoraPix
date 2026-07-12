const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const conexion = require("../Database/conexion");

const SECRET_KEY = "MiProyectoLogin2026";

// FUNCIÓN: OBTENER IP DEL CLIENTE
const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           req.ip;
};

// VERIFICAR TOKEN (DESDE COOKIE)
const verificarToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            mensaje: "Token no proporcionado",
            log: {
                timestamp: new Date().toISOString(),
                action: "TOKEN_NO_PROVIDED",
                ip: getClientIP(req)
            }
        });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            mensaje: "Token inválido o expirado",
            log: {
                timestamp: new Date().toISOString(),
                action: "TOKEN_INVALIDO",
                ip: getClientIP(req),
                error: error.message
            }
        });
    }
};

// VERIFICAR ADMIN
const verificarAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            mensaje: "Acceso denegado. Se requiere rol ADMIN",
            log: {
                timestamp: new Date().toISOString(),
                action: "ACCESO_DENEGADO",
                usuario: req.usuario?.usuario || 'Desconocido',
                rol: req.usuario?.rol || 'Desconocido',
                ip: getClientIP(req)
            }
        });
    }
    next();
};

// FUNCIÓN: VALIDAR QUE EL USUARIO EXISTE EN BD
const verificarUsuarioEnBD = (req, res, next) => {
    const sql = "SELECT * FROM usuarios WHERE id = ? AND estado = 'CONECTADO'";
    conexion.query(sql, [req.usuario.id], (error, resultados) => {
        if (error || resultados.length === 0) {
            return res.status(401).json({
                success: false,
                mensaje: "Usuario no autenticado o sesión expirada",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "USER_NOT_AUTHENTICATED",
                    usuario_id: req.usuario.id,
                    ip: getClientIP(req)
                }
            });
        }
        next();
    });
};

// ============================================
// VERIFICAR SESIÓN ACTIVA
// ============================================

const verificarSesionActiva = (req, res, next) => {
    const token = req.cookies.token;
    
    if (!token) {
        return res.status(401).json({
            success: false,
            mensaje: "Token no proporcionado",
            log: {
                timestamp: new Date().toISOString(),
                action: "TOKEN_NO_PROVIDED",
                ip: getClientIP(req)
            }
        });
    }

    const sql = `
        SELECT * FROM sesiones_activas 
        WHERE token = ? AND activo = 1 AND fecha_expiracion > NOW()
    `;
    
    conexion.query(sql, [token], (error, resultados) => {
        if (error) {
            return res.status(500).json({
                success: false,
                mensaje: "Error al verificar sesión",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "VERIFY_SESSION_ERROR",
                    error: error.message
                }
            });
        }

        if (resultados.length === 0) {
            // La sesión no está activa, actualizar estado del usuario
            const updateSql = "UPDATE usuarios SET estado = 'DESCONECTADO' WHERE id = ?";
            conexion.query(updateSql, [req.usuario.id]);
            
            return res.status(401).json({
                success: false,
                mensaje: "Sesión expirada o inválida",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "SESSION_EXPIRED",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    ip: getClientIP(req)
                }
            });
        }

        next();
    });
};

// ============================================
// RUTAS PÚBLICAS 
// ============================================

// GET - Obtener publicaciones publicadas
router.get("/publicaciones", verificarToken, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const sql = `
        SELECT p.id, p.titulo, p.contenido, p.autor_id, p.autor_nombre, 
               p.categoria, p.estado, p.fecha_creacion, p.fecha_publicacion,
               u.nombre as autor_nombre_completo
        FROM publicaciones p
        INNER JOIN usuarios u ON p.autor_id = u.id
        WHERE p.estado = 'PUBLICADO'
        ORDER BY p.fecha_publicacion DESC
    `;
    
    conexion.query(sql, (error, resultados) => {
        if (error) {
            return res.status(500).json({
                success: false,
                mensaje: "Error al obtener publicaciones",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "GET_PUBLICACIONES_ERROR",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    error: error.message
                }
            });
        }
        
        res.json({
            success: true,
            count: resultados.length,
            publicaciones: resultados,
            log: {
                timestamp: new Date().toISOString(),
                action: "GET_PUBLICACIONES",
                usuario: req.usuario?.usuario || 'Desconocido',
                rol: req.usuario?.rol || 'Desconocido',
                total: resultados.length
            }
        });
    });
});

// GET - Buscar publicaciones
router.get("/publicaciones/buscar/:termino", verificarToken, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const { termino } = req.params;
    
    if (!termino || termino.trim() === '') {
        return res.status(400).json({
            success: false,
            mensaje: "El término de búsqueda no puede estar vacío",
            log: {
                timestamp: new Date().toISOString(),
                action: "SEARCH_EMPTY_TERM",
                usuario: req.usuario?.usuario || 'Desconocido'
            }
        });
    }

    const sql = `
        SELECT p.*, u.nombre as autor_nombre_completo
        FROM publicaciones p
        INNER JOIN usuarios u ON p.autor_id = u.id
        WHERE p.estado = 'PUBLICADO'
        AND (p.titulo LIKE ? OR p.contenido LIKE ?)
        ORDER BY p.fecha_publicacion DESC
    `;
    
    conexion.query(sql, [`%${termino}%`, `%${termino}%`], (error, resultados) => {
        if (error) {
            return res.status(500).json({
                success: false,
                mensaje: "Error al buscar publicaciones",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "SEARCH_ERROR",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    error: error.message
                }
            });
        }
        
        res.json({
            success: true,
            count: resultados.length,
            publicaciones: resultados,
            log: {
                timestamp: new Date().toISOString(),
                action: "SEARCH_PUBLICACIONES",
                usuario: req.usuario?.usuario || 'Desconocido',
                termino: termino,
                total: resultados.length
            }
        });
    });
});

// POST - Crear borrador
router.post("/publicaciones/borrador", verificarToken, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const { titulo, contenido, categoria } = req.body;
    
    if (!titulo || titulo.trim() === '') {
        return res.status(400).json({
            success: false,
            mensaje: "El título no puede estar vacío",
            log: {
                timestamp: new Date().toISOString(),
                action: "BORRADOR_TITLE_EMPTY",
                usuario: req.usuario?.usuario || 'Desconocido'
            }
        });
    }

    if (!contenido || contenido.trim() === '') {
        return res.status(400).json({
            success: false,
            mensaje: "El contenido no puede estar vacío",
            log: {
                timestamp: new Date().toISOString(),
                action: "BORRADOR_CONTENT_EMPTY",
                usuario: req.usuario?.usuario || 'Desconocido'
            }
        });
    }

    const autorNombre = req.usuario.nombre || req.usuario.usuario || 'Usuario';

    const sql = `
        INSERT INTO publicaciones 
        (titulo, contenido, autor_id, autor_nombre, categoria, estado) 
        VALUES (?, ?, ?, ?, ?, 'BORRADOR')
    `;
    
    conexion.query(sql, [
        titulo.trim(),
        contenido.trim(),
        req.usuario.id,
        autorNombre,
        categoria || 'General'
    ], (error, resultado) => {
        if (error) {
            console.error("Error:", error);
            return res.status(500).json({
                success: false,
                mensaje: "Error al crear borrador",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "BORRADOR_ERROR",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    error: error.message
                }
            });
        }
        
        res.status(201).json({
            success: true,
            mensaje: "Borrador creado exitosamente. Esperando aprobación del administrador.",
            id: resultado.insertId,
            log: {
                timestamp: new Date().toISOString(),
                action: "BORRADOR_CREADO",
                usuario: req.usuario?.usuario || 'Desconocido',
                id: resultado.insertId,
                titulo: titulo.trim()
            }
        });
    });
});

// GET - Obtener mis borradores
router.get("/publicaciones/mis-borradores", verificarToken, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const sql = `
        SELECT * FROM publicaciones 
        WHERE autor_id = ? AND estado = 'BORRADOR'
        ORDER BY fecha_creacion DESC
    `;
    
    conexion.query(sql, [req.usuario.id], (error, resultados) => {
        if (error) {
            return res.status(500).json({
                success: false,
                mensaje: "Error al obtener borradores",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "GET_BORRADORES_ERROR",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    error: error.message
                }
            });
        }
        
        res.json({
            success: true,
            count: resultados.length,
            borradores: resultados,
            log: {
                timestamp: new Date().toISOString(),
                action: "GET_BORRADORES",
                usuario: req.usuario?.usuario || 'Desconocido',
                total: resultados.length
            }
        });
    });
});

// DELETE - Eliminar borrador (solo el autor)
router.delete("/publicaciones/borrador/:id", verificarToken, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const { id } = req.params;
    
    const checkSql = "SELECT * FROM publicaciones WHERE id = ? AND autor_id = ? AND estado = 'BORRADOR'";
    conexion.query(checkSql, [id, req.usuario.id], (checkError, checkResult) => {
        if (checkError) {
            return res.status(500).json({
                success: false,
                mensaje: "Error al verificar borrador",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "DELETE_BORRADOR_CHECK_ERROR",
                    error: checkError.message
                }
            });
        }

        if (checkResult.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: "Borrador no encontrado o no tienes permiso para eliminarlo",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "DELETE_BORRADOR_NOT_FOUND",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    id: id
                }
            });
        }

        const sql = "DELETE FROM publicaciones WHERE id = ? AND autor_id = ? AND estado = 'BORRADOR'";
        conexion.query(sql, [id, req.usuario.id], (error, resultado) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    mensaje: "Error al eliminar borrador",
                    log: {
                        timestamp: new Date().toISOString(),
                        action: "DELETE_BORRADOR_ERROR",
                        error: error.message
                    }
                });
            }
            
            res.json({
                success: true,
                mensaje: "Borrador eliminado correctamente",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "DELETE_BORRADOR",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    id: id
                }
            });
        });
    });
});

// ============================================
// RUTAS DE ADMIN
// ============================================

// GET - Obtener TODAS las publicaciones
router.get("/admin/publicaciones", verificarToken, verificarAdmin, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const sql = `
        SELECT p.*, u.nombre as autor_nombre_completo
        FROM publicaciones p
        INNER JOIN usuarios u ON p.autor_id = u.id
        ORDER BY p.fecha_creacion DESC
    `;
    
    conexion.query(sql, (error, resultados) => {
        if (error) {
            console.error("Error:", error);
            return res.status(500).json({
                success: false,
                mensaje: "Error al obtener publicaciones",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "ADMIN_GET_PUBLICACIONES_ERROR",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    error: error.message
                }
            });
        }
        
        res.json({
            success: true,
            count: resultados.length,
            publicaciones: resultados,
            log: {
                timestamp: new Date().toISOString(),
                action: "ADMIN_GET_PUBLICACIONES",
                usuario: req.usuario?.usuario || 'Desconocido',
                rol: req.usuario?.rol || 'Desconocido',
                total: resultados.length
            }
        });
    });
});

// GET - Obtener una publicación específica
router.get("/admin/publicaciones/:id", verificarToken, verificarAdmin, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM publicaciones WHERE id = ?";
    
    conexion.query(sql, [id], (error, resultados) => {
        if (error) {
            return res.status(500).json({
                success: false,
                mensaje: "Error al obtener publicación",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "ADMIN_GET_PUBLICACION_ERROR",
                    error: error.message
                }
            });
        }
        
        if (resultados.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: "Publicación no encontrada",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "ADMIN_PUBLICACION_NOT_FOUND",
                    id: id
                }
            });
        }
        
        res.json({
            success: true,
            publicacion: resultados[0],
            log: {
                timestamp: new Date().toISOString(),
                action: "ADMIN_GET_PUBLICACION",
                usuario: req.usuario?.usuario || 'Desconocido',
                id: id
            }
        });
    });
});

// POST - Crear publicación
router.post("/admin/publicaciones", verificarToken, verificarAdmin, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const { titulo, contenido, categoria, estado } = req.body;
    
    if (!titulo || titulo.trim() === '') {
        return res.status(400).json({
            success: false,
            mensaje: "El título no puede estar vacío",
            log: {
                timestamp: new Date().toISOString(),
                action: "CREATE_PUBLICACION_TITLE_EMPTY",
                usuario: req.usuario?.usuario || 'Desconocido'
            }
        });
    }

    if (!contenido || contenido.trim() === '') {
        return res.status(400).json({
            success: false,
            mensaje: "El contenido no puede estar vacío",
            log: {
                timestamp: new Date().toISOString(),
                action: "CREATE_PUBLICACION_CONTENT_EMPTY",
                usuario: req.usuario?.usuario || 'Desconocido'
            }
        });
    }

    const autorNombre = req.usuario.nombre || req.usuario.usuario || 'Administrador';
    
    const sql = `
        INSERT INTO publicaciones 
        (titulo, contenido, autor_id, autor_nombre, categoria, estado, fecha_publicacion) 
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    
    conexion.query(sql, [
        titulo.trim(),
        contenido.trim(),
        req.usuario.id,
        autorNombre,
        categoria || 'General',
        estado || 'PUBLICADO'
    ], (error, resultado) => {
        if (error) {
            console.error("Error:", error);
            return res.status(500).json({
                success: false,
                mensaje: "Error al crear publicación",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "CREATE_PUBLICACION_ERROR",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    error: error.message
                }
            });
        }
        
        res.status(201).json({
            success: true,
            mensaje: "Publicación creada exitosamente",
            id: resultado.insertId,
            log: {
                timestamp: new Date().toISOString(),
                action: "CREATE_PUBLICACION",
                usuario: req.usuario?.usuario || 'Desconocido',
                rol: req.usuario?.rol || 'Desconocido',
                publicacion_id: resultado.insertId,
                titulo: titulo.trim()
            }
        });
    });
});

// PUT - Actualizar publicación
router.put("/admin/publicaciones/:id", verificarToken, verificarAdmin, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const { id } = req.params;
    const { titulo, contenido, categoria, estado } = req.body;
    
    if (!titulo || titulo.trim() === '') {
        return res.status(400).json({
            success: false,
            mensaje: "El título no puede estar vacío",
            log: {
                timestamp: new Date().toISOString(),
                action: "UPDATE_PUBLICACION_TITLE_EMPTY",
                usuario: req.usuario?.usuario || 'Desconocido'
            }
        });
    }

    if (!contenido || contenido.trim() === '') {
        return res.status(400).json({
            success: false,
            mensaje: "El contenido no puede estar vacío",
            log: {
                timestamp: new Date().toISOString(),
                action: "UPDATE_PUBLICACION_CONTENT_EMPTY",
                usuario: req.usuario?.usuario || 'Desconocido'
            }
        });
    }

    const checkSql = "SELECT * FROM publicaciones WHERE id = ?";
    conexion.query(checkSql, [id], (checkError, checkResult) => {
        if (checkError) {
            return res.status(500).json({
                success: false,
                mensaje: "Error al verificar publicación",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "UPDATE_CHECK_ERROR",
                    error: checkError.message
                }
            });
        }

        if (checkResult.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: "La publicación no existe",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "UPDATE_PUBLICACION_NOT_FOUND",
                    id: id
                }
            });
        }

        let sql = `
            UPDATE publicaciones 
            SET titulo = ?, contenido = ?, categoria = ?, estado = ?
        `;
        let params = [titulo.trim(), contenido.trim(), categoria || 'General', estado || 'PUBLICADO'];
        
        if (estado === 'PUBLICADO') {
            sql += `, fecha_publicacion = NOW()`;
        }
        
        sql += ` WHERE id = ?`;
        params.push(id);
        
        conexion.query(sql, params, (error, resultado) => {
            if (error) {
                console.error("Error:", error);
                return res.status(500).json({
                    success: false,
                    mensaje: "Error al actualizar publicación",
                    log: {
                        timestamp: new Date().toISOString(),
                        action: "UPDATE_PUBLICACION_ERROR",
                        error: error.message
                    }
                });
            }
            
            res.json({
                success: true,
                mensaje: "Publicación actualizada correctamente",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "UPDATE_PUBLICACION",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    rol: req.usuario?.rol || 'Desconocido',
                    id: id
                }
            });
        });
    });
});

// DELETE - Eliminar publicación
router.delete("/admin/publicaciones/:id", verificarToken, verificarAdmin, verificarUsuarioEnBD, verificarSesionActiva, (req, res) => {
    const { id } = req.params;

    const checkSql = "SELECT * FROM publicaciones WHERE id = ?";
    conexion.query(checkSql, [id], (checkError, checkResult) => {
        if (checkError) {
            return res.status(500).json({
                success: false,
                mensaje: "Error al verificar publicación",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "DELETE_CHECK_ERROR",
                    error: checkError.message
                }
            });
        }

        if (checkResult.length === 0) {
            return res.status(404).json({
                success: false,
                mensaje: "La publicación no existe",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "DELETE_PUBLICACION_NOT_FOUND",
                    id: id
                }
            });
        }

        const sql = "DELETE FROM publicaciones WHERE id = ?";
        conexion.query(sql, [id], (error, resultado) => {
            if (error) {
                console.error("Error:", error);
                return res.status(500).json({
                    success: false,
                    mensaje: "Error al eliminar publicación",
                    log: {
                        timestamp: new Date().toISOString(),
                        action: "DELETE_PUBLICACION_ERROR",
                        error: error.message
                    }
                });
            }
            
            res.json({
                success: true,
                mensaje: "Publicación eliminada correctamente",
                log: {
                    timestamp: new Date().toISOString(),
                    action: "DELETE_PUBLICACION",
                    usuario: req.usuario?.usuario || 'Desconocido',
                    rol: req.usuario?.rol || 'Desconocido',
                    id: id
                }
            });
        });
    });
});

module.exports = router;