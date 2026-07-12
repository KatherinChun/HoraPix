const mysql = require("mysql2");

const conexion = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "sistema_login",
    port: 3306
});

conexion.connect((error) => {
    if (error) {
        console.error("Error de conexión a la base de datos:", error);
        console.log("Verifica que MySQL esté corriendo.");
        process.exit(1);
    } else {
        console.log("Base de datos conectada exitosamente.");
    }
});

conexion.on('error', (error) => {
    console.error('Error en la conexión a la base de datos:', error);
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Intentando reconectar...');
        conexion.connect((err) => {
            if (err) {
                console.error('Error al reconectar:', err);
            } else {
                console.log('Reconectado exitosamente');
            }
        });
    }
});

module.exports = conexion;