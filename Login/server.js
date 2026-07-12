const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const conexion = require("./Database/conexion");

const app = express();
const PORT = 3000;

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ARCHIVOS ESTÁTICOS

app.use(express.static(path.join(__dirname, "Public")));


// RUTAS

const loginRoutes = require("./Routes/login");
const publicacionesRoutes = require("./Routes/publicaciones");

app.use("/api", loginRoutes);
app.use("/api", publicacionesRoutes);


// RUTA PRINCIPAL

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Public", "login.html"));
});


// MANEJO DE ERRORES 404

app.use((req, res) => {
    res.status(404).json({
        code: 404,
        status: "Error",
        message: "Ruta no encontrada",
        header: null,
        body: null,
        log: {
            timestamp: new Date().toISOString(),
            action: "ROUTE_NOT_FOUND",
            url: req.originalUrl,
            method: req.method,
            ip: req.ip || req.connection.remoteAddress
        }
    });
});


// ERRORES GLOBAL

app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        code: 500,
        status: "Error",
        message: "Error interno del servidor",
        header: null,
        body: null,
        log: {
            timestamp: new Date().toISOString(),
            action: "UNHANDLED_ERROR",
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
    });
});


// CAPTURAR ERRORES

process.on('uncaughtException', (error) => {
    console.error('Excepción no capturada:', error);
});



function limpiarSesiones() {
    const sql = `
        UPDATE usuarios 
        SET estado = 'DESCONECTADO' 
        WHERE estado = 'CONECTADO' 
        AND id NOT IN (
            SELECT usuario_id FROM sesiones_activas WHERE activo = 1 AND fecha_expiracion > NOW()
        )
    `;
    
    conexion.query(sql, (error, result) => {
        if (error) {
            console.error("Error al limpiar sesiones:", error);
        } else {
            console.log(`Sesiones limpiadas: ${result.affectedRows} usuarios actualizados a DESCONECTADO`);
        }
    });
}

// Ejecutar al iniciar
conexion.connect((error) => {
    if (error) {
        console.error("Error de conexión:", error);
        process.exit(1);
    } else {
        console.log("Base de datos conectada exitosamente.");
        limpiarSesiones(); 
    }
});


// INICIAR SERVIDOR

app.listen(PORT, () => {
    console.log("\n===================================");
    console.log("Servidor corriendo en:");
    console.log(`http://localhost:${PORT}`);
    console.log("===================================");
    console.log("Usuarios de prueba:");
    console.log("Admin: admin / 12345");
    console.log("Usuario: juan / 12345");
    console.log("===================================\n");
});

module.exports = app;
