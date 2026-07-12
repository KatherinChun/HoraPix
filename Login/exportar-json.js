const conexion = require('./Database/conexion');
const fs = require('fs');
const path = require('path');

// ============ OBTENER TODOS LOS DATOS ============
function obtenerTodosLosDatos() {
    return new Promise((resolve, reject) => {
        const queries = {
            usuarios: 'SELECT id, nombre, usuario, password, rol, estado, total_accesos, ultimo_acceso, ultima_ip FROM usuarios',
            publicaciones: 'SELECT id, titulo, contenido, autor_id, autor_nombre, categoria, estado, fecha_creacion, fecha_publicacion FROM publicaciones ORDER BY id DESC',
            historial: 'SELECT id, usuario_id, usuario_nombre, ip_address, user_agent, fecha_acceso, token_generado, estado FROM historial_accesos ORDER BY fecha_acceso DESC LIMIT 100'
        };
        
        const resultados = {};
        let completadas = 0;
        const totalQueries = Object.keys(queries).length;
        
        Object.entries(queries).forEach(([nombre, sql]) => {
            conexion.query(sql, (error, resultadosQuery) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                resultados[nombre] = resultadosQuery;
                completadas++;
                
                if (completadas === totalQueries) {
                    resolve(resultados);
                }
            });
        });
    });
}

// ============ MOSTRAR RESUMEN ============
function mostrarResumen(datos) {
    console.log('\nRESUMEN DE LA EXPORTACION:');
    console.log('----------------------------------------');
    
    console.log('\nUSUARIOS (' + datos.usuarios.length + '):');
    datos.usuarios.forEach(u => {
        console.log('   ' + u.nombre + ' (@' + u.usuario + ') - ' + u.rol + ' - ' + u.estado);
    });
    
    console.log('\nPUBLICACIONES (' + datos.publicaciones.length + '):');
    datos.publicaciones.slice(0, 5).forEach(p => {
        console.log('   ' + p.estado + ' - ' + p.titulo + ' (' + p.autor_nombre + ')');
    });
    if (datos.publicaciones.length > 5) {
        console.log('   ... y ' + (datos.publicaciones.length - 5) + ' mas');
    }
    
    console.log('\nHISTORIAL (' + datos.historial.length + ' registros):');
    datos.historial.slice(0, 5).forEach(h => {
        console.log('   ' + h.usuario_nombre + ' - ' + h.estado + ' (' + new Date(h.fecha_acceso).toLocaleString() + ')');
    });
    if (datos.historial.length > 5) {
        console.log('   ... y ' + (datos.historial.length - 5) + ' mas');
    }
    
    console.log('\n----------------------------------------\n');
}

// ============ EXPORTACIÓN MANUAL (CON MENSAJES) ============
async function exportarTodoAJSON() {
    console.log('\nEXPORTANDO DATOS DEL SISTEMA A JSON...\n');
    
    try {
        const datos = await obtenerTodosLosDatos();
        
        const exportacion = {
            metadata: {
                fecha_exportacion: new Date().toISOString(),
                version: "1.0",
                sistema: "Sistema de Blog con Login",
                total_registros: {
                    usuarios: datos.usuarios.length,
                    publicaciones: datos.publicaciones.length,
                    historial: datos.historial.length
                }
            },
            ...datos
        };
        
        const archivoSalida = path.join(__dirname, 'exportacion-completa.json');
        fs.writeFileSync(
            archivoSalida, 
            JSON.stringify(exportacion, null, 2),
            'utf8'
        );
        
        console.log('Exportacion completada exitosamente!');
        console.log('Archivo guardado en:', archivoSalida);
        console.log('Tamaño:', (fs.statSync(archivoSalida).size / 1024).toFixed(2), 'KB');
        
        mostrarResumen(exportacion);
        
        conexion.end();
        
    } catch (error) {
        console.error('Error al exportar:', error);
        conexion.end();
    }
}

// ============ EXPORTACIÓN AUTOMÁTICA (SILENCIOSA) ============
async function exportarAutomatico() {
    try {
        const datos = await obtenerTodosLosDatos();
        
        const exportacion = {
            metadata: {
                fecha_exportacion: new Date().toISOString(),
                version: "1.0",
                sistema: "Sistema de Blog con Login",
                total_registros: {
                    usuarios: datos.usuarios.length,
                    publicaciones: datos.publicaciones.length,
                    historial: datos.historial.length
                }
            },
            ...datos
        };
        
        const archivoSalida = path.join(__dirname, 'exportacion-completa.json');
        fs.writeFileSync(
            archivoSalida, 
            JSON.stringify(exportacion, null, 2),
            'utf8'
        );
        
        console.log('[AUTO-EXPORT] JSON actualizado - ' + new Date().toISOString());
        
    } catch (error) {
        console.error('[AUTO-EXPORT] Error:', error.message);
    }
}

// ============ EXPORTAR FUNCIONES ============
module.exports = {
    exportarTodoAJSON,
    exportarAutomatico
};

// ============ SI SE EJECUTA DIRECTAMENTE ============
if (require.main === module) {
    exportarTodoAJSON();
}