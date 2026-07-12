const express = require("express");
const router = express.Router();
const conexion = require("../Database/conexion");
const jwt = require("jsonwebtoken");
const { exportarAutomatico } = require("../exportar-json");

const SECRET_KEY = "MiProyectoLogin2026";

const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           req.ip;
};

const validarUsuario = (usuario) => {
    return /^[a-zA-Z0-9_]{3,20}$/.test(usuario);  // Solo letras, números, guion entre 3 y 20 caracteres 
};

//  VERIFICAR TOKEN


const verificarToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            code: 401,
            status: "Error",
            message: "Token no proporcionado",
            header: null,
            body: null,
            log: {
                timestamp: new Date().toISOString(),
                action: "TOKEN_NO_PROVIDED",
                ip: getClientIP(req)
            }
        });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        
        const sql = `
            SELECT sa.*, u.nombre, u.usuario, u.rol 
            FROM sesiones_activas sa
            INNER JOIN usuarios u ON sa.usuario_id = u.id
            WHERE sa.token = ? AND sa.activo = 1 AND sa.fecha_expiracion > NOW()
        `;
        
        conexion.query(sql, [token], (error, resultados) => {
            if (error || resultados.length === 0) {
                if (decoded && decoded.id) {
                    const updateSql = "UPDATE usuarios SET estado = 'DESCONECTADO' WHERE id = ?";
                    conexion.query(updateSql, [decoded.id]);
                }
                
                return res.status(401).json({
                    code: 401,
                    status: "Error",
                    message: "Sesión inválida o expirada",
                    header: null,
                    body: null,
                    log: {
                        timestamp: new Date().toISOString(),
                        action: "SESION_INVALIDA",
                        ip: getClientIP(req)
                    }
                });
            }

            req.usuario = {
                id: resultados[0].usuario_id,
                usuario: resultados[0].usuario,
                nombre: resultados[0].nombre,
                rol: resultados[0].rol,
                sesion_id: resultados[0].id,
                session_id: resultados[0].session_id
            };
            next();
        });
    } catch (error) {
        try {
            const decoded = jwt.decode(token);
            if (decoded && decoded.id) {
                const updateSql = "UPDATE usuarios SET estado = 'DESCONECTADO' WHERE id = ?";
                conexion.query(updateSql, [decoded.id]);
            }
        } catch (e) {
            // Ignorar errores de decodificación
        }
        
        res.status(401).json({
            code: 401,
            status: "Error",
            message: "Token inválido o expirado",
            header: null,
            body: null,
            log: {
                timestamp: new Date().toISOString(),
                action: "TOKEN_INVALIDO",
                ip: getClientIP(req),
                error: error.message
            }
        });
    }
};

//  VERIFICAR ADMIN (DEFINIDO ANTES DE LAS RUTAS)


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

// RUTA: LOGIN


router.post("/login", (req, res) => {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
        return res.status(400).json({
            code: 400,
            status: "Error",
            message: "Usuario y contraseña son requeridos",
            header: null,
            body: null,
            log: {
                timestamp: new Date().toISOString(),
                action: "LOGIN_EMPTY_FIELDS",
                usuario: usuario || 'Desconocido'
            }
        });
    }

    if (!validarUsuario(usuario)) {
        return res.status(400).json({
            code: 400,
            status: "Error",
            message: "Usuario debe tener entre 3 y 20 caracteres (solo letras, números y guión bajo)",
            header: null,
            body: null,
            log: {
                timestamp: new Date().toISOString(),
                action: "LOGIN_INVALID_FORMAT",
                usuario: usuario
            }
        });
    }

    if (password.length < 4) {
        return res.status(400).json({
            code: 400,
            status: "Error",
            message: "La contraseña debe tener al menos 4 caracteres",
            header: null,
            body: null,
            log: {
                timestamp: new Date().toISOString(),
                action: "LOGIN_PASSWORD_SHORT",
                usuario: usuario
            }
        });
    }

    const sql = "SELECT * FROM usuarios WHERE usuario = ? AND password = ?";
    
    conexion.query(sql, [usuario, password], (error, resultados) => {
        if (error) {
            console.error("Error en consulta:", error);
            return res.status(500).json({
                code: 500,
                status: "Error",
                message: "Error del servidor al procesar la solicitud",
                header: null,
                body: null,
                log: {
                    timestamp: new Date().toISOString(),
                    action: "LOGIN_DB_ERROR",
                    usuario: usuario,
                    error: error.message
                }
            });
        }

        const ip = getClientIP(req);
        const userAgent = req.headers['user-agent'] || 'Desconocido';

        if (resultados.length === 0) {
            const logSql = `
                INSERT INTO historial_accesos 
                (usuario_id, usuario_nombre, ip_address, user_agent, estado) 
                VALUES (?, ?, ?, ?, ?)
            `;
            conexion.query(logSql, [null, usuario, ip, userAgent, 'FALLIDO']);
            
            return res.status(401).json({
                code: 401,
                status: "Error",
                message: "Usuario o contraseña incorrectos",
                header: null,
                body: null,
                log: {
                    timestamp: new Date().toISOString(),
                    action: "LOGIN_FAIL",
                    usuario: usuario,
                    ip: ip,
                    userAgent: userAgent,
                    motivo: "Credenciales incorrectas"
                }
            });
        }

        const usuarioBD = resultados[0];

        if (usuarioBD.estado === 'BLOQUEADO') {
            return res.status(403).json({
                code: 403,
                status: "Error",
                message: "Usuario bloqueado. Contacte al administrador.",
                header: null,
                body: null,
                log: {
                    timestamp: new Date().toISOString(),
                    action: "LOGIN_BLOCKED",
                    usuario: usuarioBD.usuario,
                    id: usuarioBD.id
                }
            });
        }

        const token = jwt.sign(
            { 
                id: usuarioBD.id, 
                rol: usuarioBD.rol, 
                usuario: usuarioBD.usuario, 
                nombre: usuarioBD.nombre
            },
            SECRET_KEY,
            { expiresIn: "2h" }
        );

        const sessionId = usuarioBD.id.toString() + Date.now().toString(36).toUpperCase();

        const sessionSql = `
            INSERT INTO sesiones_activas 
            (usuario_id, session_id, token, ip_address, user_agent, fecha_expiracion, activo) 
            VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR), 1)
        `;
        
        conexion.query(sessionSql, [usuarioBD.id, sessionId, token, ip, userAgent], (sessionError, sessionResult) => {
            if (sessionError) {
                console.error("Error al guardar sesión:", sessionError);
            }

            const updateSql = `
                UPDATE usuarios 
                SET estado = 'CONECTADO',
                    ultimo_acceso = NOW(),
                    total_accesos = total_accesos + 1,
                    ultima_ip = ?
                WHERE id = ?
            `;
            
            conexion.query(updateSql, [ip, usuarioBD.id], (updateError) => {
                if (updateError) {
                    console.error("Error al actualizar usuario:", updateError);
                }

                const sesionId = sessionResult?.insertId || 0;
                const expireSql = `
                    UPDATE sesiones_activas 
                    SET activo = 0 
                    WHERE usuario_id = ? AND id != ?
                `;
                conexion.query(expireSql, [usuarioBD.id, sesionId]);

                const logSql = `
                    INSERT INTO historial_accesos 
                    (usuario_id, usuario_nombre, ip_address, user_agent, token_generado, estado) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                conexion.query(logSql, [
                    usuarioBD.id, 
                    usuarioBD.usuario, 
                    ip, 
                    userAgent, 
                    token, 
                    'EXITOSO'
                ]);

                exportarAutomatico().catch(err => {
                    console.error('Error en exportación automática:', err);
                });

                res.cookie('token', token, {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'lax',
                    maxAge: 2 * 60 * 60 * 1000
                });

                res.json({
                    code: 200,
                    status: "Ok",
                    message: "Acceso Correcto",
                    header: {
                        id: sessionId,
                        profile: usuarioBD.rol
                    },
                    body: {
                        user: {
                            id: usuarioBD.id,
                            name: usuarioBD.nombre,
                            username: usuarioBD.usuario,
                            role: usuarioBD.rol,
                            total_access: usuarioBD.total_accesos + 1,
                            last_access: new Date().toISOString()
                        },
                        log: {
                            timestamp: new Date().toISOString(),
                            action: "Acceso correcto",
                            username: usuarioBD.usuario,
                            role: usuarioBD.rol,
                            id: usuarioBD.id,
                            ip: ip,
                            userAgent: userAgent,
                            total_access: usuarioBD.total_accesos + 1,
                            session_id: sessionId,
                            token: token 
                        }
                    }
                });
            });
        });
    });
});


// RUTA: VERIFICAR TOKEN


router.post("/verificar-token", (req, res) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            code: 401,
            status: "Error",
            message: "Token no proporcionado",
            header: null,
            body: null,
            log: {
                timestamp: new Date().toISOString(),
                action: "VERIFY_TOKEN_NO_PROVIDED",
                ip: getClientIP(req)
            }
        });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        
        const sql = `
            SELECT sa.*, u.nombre, u.usuario, u.rol 
            FROM sesiones_activas sa
            INNER JOIN usuarios u ON sa.usuario_id = u.id
            WHERE sa.token = ? AND sa.activo = 1 AND sa.fecha_expiracion > NOW()
        `;
        
        conexion.query(sql, [token], (error, resultados) => {
            if (error) {
                return res.status(500).json({
                    code: 500,
                    status: "Error",
                    message: "Error al verificar el token",
                    header: null,
                    body: null,
                    log: {
                        timestamp: new Date().toISOString(),
                        action: "VERIFY_DB_ERROR",
                        error: error.message
                    }
                });
            }

            if (resultados.length === 0) {
                if (decoded && decoded.id) {
                    const updateSql = "UPDATE usuarios SET estado = 'DESCONECTADO' WHERE id = ?";
                    conexion.query(updateSql, [decoded.id]);
                }
                
                return res.status(401).json({
                    code: 401,
                    status: "Error",
                    message: "Sesión inválida o expirada",
                    header: null,
                    body: null,
                    log: {
                        timestamp: new Date().toISOString(),
                        action: "VERIFY_TOKEN_INVALID",
                        usuario: decoded.usuario || 'Desconocido'
                    }
                });
            }

            const usuario = resultados[0];
            
            res.json({
                code: 200,
                status: "Ok",
                message: "Token válido",
                header: {
                    id: usuario.id.toString() + Date.now().toString(36).toUpperCase(),
                    token_session: token,
                    profile: usuario.rol
                },
                body: {
                    user: {
                        id: usuario.id,
                        name: usuario.nombre,
                        username: usuario.usuario,
                        role: usuario.rol
                    }
                },
                log: {
                    timestamp: new Date().toISOString(),
                    action: "VERIFY_TOKEN_SUCCESS",
                    username: usuario.usuario,
                    role: usuario.rol,
                    id: usuario.id
                }
            });
        });
    } catch (error) {
        res.status(401).json({
            code: 401,
            status: "Error",
            message: "Token inválido o expirado",
            header: null,
            body: null,
            log: {
                timestamp: new Date().toISOString(),
                action: "VERIFY_TOKEN_ERROR",
                ip: getClientIP(req),
                error: error.message
            }
        });
    }
});


// RUTA: LOGOUT


router.post("/logout", (req, res) => {
    const token = req.cookies.token;
    let usuarioLog = 'Desconocido';
    let rolLog = 'Desconocido';
    let usuarioId = null;
    
    res.clearCookie('token');
    
    if (token) {
        const findSql = `
            SELECT sa.usuario_id, u.usuario, u.rol 
            FROM sesiones_activas sa
            INNER JOIN usuarios u ON sa.usuario_id = u.id
            WHERE sa.token = ? AND sa.activo = 1
        `;
        
        conexion.query(findSql, [token], (findError, resultados) => {
            if (!findError && resultados.length > 0) {
                const usuario = resultados[0];
                usuarioLog = usuario.usuario;
                rolLog = usuario.rol;
                usuarioId = usuario.usuario_id;
                
                const updateSessionSql = "UPDATE sesiones_activas SET activo = 0 WHERE token = ?";
                conexion.query(updateSessionSql, [token]);
                
                const updateUserSql = "UPDATE usuarios SET estado = 'DESCONECTADO' WHERE id = ?";
                conexion.query(updateUserSql, [usuarioId]);
                
                if (usuarioId) {
                    const logSql = `
                        INSERT INTO historial_accesos 
                        (usuario_id, usuario_nombre, estado) 
                        VALUES (?, ?, ?)
                    `;
                    conexion.query(logSql, [usuarioId, usuarioLog, 'CERRADO_SESION'], (logError) => {
                        if (logError) {
                            console.error("Error al guardar historial:", logError);
                        }
                    });
                }
            } else {
                const logSql = `
                    INSERT INTO historial_accesos 
                    (usuario_id, usuario_nombre, estado) 
                    VALUES (?, ?, ?)
                `;
                conexion.query(logSql, [null, 'Desconocido', 'CERRADO_SESION_SIN_TOKEN']);
            }
        });
    }
    
    res.json({
        code: 200,
        status: "Ok",
        message: "Sesión cerrada correctamente",
        body: {
            log: {
                timestamp: new Date().toISOString(),
                action: "LOGOUT",
                username: usuarioLog,
                role: rolLog,
                ip: getClientIP(req),
                token: token || 'No disponible'
            }
        }
    });
});

// RUTA: OBTENER MENÚ DEL USUARIO (DESDE JSON EN BD)


router.get("/menu", verificarToken, (req, res) => {
    const rol = req.usuario.rol;
    
    const sql = "SELECT menu_json FROM menu_config WHERE rol = ?";
    
    conexion.query(sql, [rol], (error, resultados) => {
        if (error) {
            console.error("Error al obtener menú:", error);
            return res.status(500).json({
                code: 500,
                status: "Error",
                message: "Error al cargar el menú",
                header: null,
                body: null,
                log: {
                    timestamp: new Date().toISOString(),
                    action: "MENU_ERROR",
                    username: req.usuario?.usuario || 'Desconocido',
                    role: rol,
                    error: error.message
                }
            });
        }

        if (resultados.length === 0) {
            return res.status(404).json({
                code: 404,
                status: "Error",
                message: "No hay menú configurado para este rol",
                header: null,
                body: null,
                log: {
                    timestamp: new Date().toISOString(),
                    action: "MENU_NOT_FOUND",
                    username: req.usuario?.usuario || 'Desconocido',
                    role: rol
                }
            });
        }

        let menu = resultados[0].menu_json;
        if (typeof menu === 'string') {
            try {
                menu = JSON.parse(menu);
            } catch (e) {
                console.error("Error al parsear JSON:", e);
                menu = [];
            }
        }

        res.json({
            code: 200,
            status: "Ok",
            message: "Menú cargado correctamente",
            header: {
                profile: rol
            },
            body: {
                menu: menu,
                log: {  
                    timestamp: new Date().toISOString(),
                    action: "MENU_LOADED",
                    username: req.usuario?.usuario || 'Desconocido',
                    role: rol,
                    total_options: Array.isArray(menu) ? menu.length : 0,
                    token: req.cookies?.token || 'No disponible'  
                }
            }
        });
    });
});

// RUTA: OBTENER CATÁLOGO DE MENÚS (SOLO ADMIN)


router.get("/catalogo-menus", verificarToken, verificarAdmin, (req, res) => {
    const sql = "SELECT * FROM catalogo_menus ORDER BY orden ASC";
    
    conexion.query(sql, (error, resultados) => {
        if (error) {
            console.error("Error al obtener catálogo:", error);
            return res.status(500).json({
                code: 500,
                status: "Error",
                message: "Error al cargar el catálogo de menús",
                header: null,
                body: null,
                log: {
                    timestamp: new Date().toISOString(),
                    action: "CATALOGO_ERROR",
                    username: req.usuario?.usuario || 'Desconocido',
                    error: error.message
                }
            });
        }

        res.json({
            code: 200,
            status: "Ok",
            message: "Catálogo de menús cargado correctamente",
            header: {
                profile: req.usuario?.rol || 'Desconocido'
            },
            body: {
                catalogo: resultados,
                total: resultados.length
            },
            log: {
                timestamp: new Date().toISOString(),
                action: "CATALOGO_LOADED",
                username: req.usuario?.usuario || 'Desconocido',
                role: req.usuario?.rol || 'Desconocido',
                total: resultados.length
            }
        });
    });
});

// RUTA: OBTENER MENÚ DE UN ROL ESPECÍFICO (SOLO ADMIN)


router.get("/menu-por-rol/:rol", verificarToken, verificarAdmin, (req, res) => {
    const { rol } = req.params;
    
    const sql = "SELECT menu_json FROM menu_config WHERE rol = ?";
    
    conexion.query(sql, [rol.toUpperCase()], (error, resultados) => {
        if (error) {
            console.error("Error al obtener menú:", error);
            return res.status(500).json({
                code: 500,
                status: "Error",
                message: "Error al cargar el menú del rol",
                header: null,
                body: null,
                log: {
                    timestamp: new Date().toISOString(),
                    action: "MENU_ROL_ERROR",
                    username: req.usuario?.usuario || 'Desconocido',
                    rol: rol,
                    error: error.message
                }
            });
        }

        if (resultados.length === 0) {
            return res.status(404).json({
                code: 404,
                status: "Error",
                message: "No hay menú configurado para este rol",
                header: null,
                body: null,
                log: {
                    timestamp: new Date().toISOString(),
                    action: "MENU_ROL_NOT_FOUND",
                    username: req.usuario?.usuario || 'Desconocido',
                    rol: rol
                }
            });
        }

        let menu = resultados[0].menu_json;
        if (typeof menu === 'string') {
            try {
                menu = JSON.parse(menu);
            } catch (e) {
                menu = [];
            }
        }

        res.json({
            code: 200,
            status: "Ok",
            message: `Menú para rol ${rol.toUpperCase()}`,
            header: {
                profile: rol.toUpperCase()
            },
            body: {
                menu: menu
            },
            log: {
                timestamp: new Date().toISOString(),
                action: "MENU_ROL_LOADED",
                username: req.usuario?.usuario || 'Desconocido',
                role: req.usuario?.rol || 'Desconocido',
                rol_solicitado: rol,
                total_options: Array.isArray(menu) ? menu.length : 0
            }
        });
    });
});

// RUTA: ACTUALIZAR MENÚ DE UN ROL (SOLO ADMIN)


router.put("/menu-por-rol/:rol", verificarToken, verificarAdmin, (req, res) => {
    const { rol } = req.params;
    const { menu_json } = req.body;

    if (!menu_json) {
        return res.status(400).json({
            code: 400,
            status: "Error",
            message: "El campo menu_json es requerido",
            header: null,
            body: null,
            log: {
                timestamp: new Date().toISOString(),
                action: "UPDATE_MENU_ERROR",
                username: req.usuario?.usuario || 'Desconocido',
                mensaje: "Falta menu_json"
            }
        });
    }

    try {
        JSON.parse(menu_json);
    } catch (e) {
        return res.status(400).json({
            code: 400,
            status: "Error",
            message: "El campo menu_json debe ser un JSON válido",
            header: null,
            body: null,
            log: {
                timestamp: new Date().toISOString(),
                action: "UPDATE_MENU_INVALID_JSON",
                username: req.usuario?.usuario || 'Desconocido'
            }
        });
    }

    const sql = `
        INSERT INTO menu_config (rol, menu_json) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE menu_json = ?, updated_at = NOW()
    `;
    
    conexion.query(sql, [rol.toUpperCase(), menu_json, menu_json], (error, resultado) => {
        if (error) {
            console.error("Error al actualizar menú:", error);
            return res.status(500).json({
                code: 500,
                status: "Error",
                message: "Error al actualizar el menú del rol",
                header: null,
                body: null,
                log: {
                    timestamp: new Date().toISOString(),
                    action: "UPDATE_MENU_ERROR",
                    username: req.usuario?.usuario || 'Desconocido',
                    rol: rol,
                    error: error.message
                }
            });
        }

        res.json({
            code: 200,
            status: "Ok",
            message: `Menú para rol ${rol.toUpperCase()} actualizado correctamente`,
            header: {
                profile: req.usuario?.rol || 'Desconocido'
            },
            body: {
                rol: rol.toUpperCase(),
                menu_json: JSON.parse(menu_json)
            },
            log: {
                timestamp: new Date().toISOString(),
                action: "MENU_UPDATED",
                username: req.usuario?.usuario || 'Desconocido',
                role: req.usuario?.rol || 'Desconocido',
                rol_actualizado: rol.toUpperCase()
            }
        });
    });
});

module.exports = router;