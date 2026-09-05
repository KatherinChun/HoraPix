-- =====================================================================
-- HPP1 (HoraPix)
-- Sistema de agendamiento de citas — Base de datos relacional (MySQL 8+)
-- Basado en el diagrama ER del proyecto (drawSQL)
-- =====================================================================

DROP DATABASE IF EXISTS HPP1;
CREATE DATABASE HPP1
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;
USE HPP1;

-- =====================================================================
-- 1. ROL — catálogo de roles del sistema (Administrador, Profesional, Cliente)
-- =====================================================================
CREATE TABLE rol (
    id_rol          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre_rol      VARCHAR(50)  NOT NULL UNIQUE,
    descripcion     TEXT         NULL,
    fecha_creacion  DATETIME     NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- 2. USUARIO — tabla base de identidad (todos los actores del sistema)
-- =====================================================================
CREATE TABLE usuario (
    id_usuario      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(100)  NOT NULL,
    apellido        VARCHAR(100)  NOT NULL,
    email           VARCHAR(255)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255)  NULL,
    telefono        VARCHAR(20)   NULL,
    google_id       VARCHAR(255)  NULL,
    fecha_registro  DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
    id_rol          INT UNSIGNED  NOT NULL,
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    ultimo_acceso   DATETIME      NULL,
    foto_perfil_url TEXT          NULL,
    CONSTRAINT fk_usuario_rol
        FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_usuario_rol ON usuario(id_rol);

-- =====================================================================
-- 3. MENU — ítems del menú dinámico (auto-referenciado para submenús)
-- =====================================================================
CREATE TABLE menu (
    id_menu         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(100)  NOT NULL,
    icono           VARCHAR(50)   NULL,
    ruta            VARCHAR(255)  NOT NULL,
    padre_id        INT UNSIGNED  NULL,
    orden           INT           NULL,
    activo          BOOLEAN       NULL DEFAULT TRUE,
    fecha_creacion  DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_menu_padre
        FOREIGN KEY (padre_id) REFERENCES menu(id_menu)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_menu_padre ON menu(padre_id);

-- =====================================================================
-- 4. MENU_ROL — menús visibles por rol
-- =====================================================================
CREATE TABLE menu_rol (
    id_menu_rol     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_rol          INT UNSIGNED NOT NULL,
    id_menu         INT UNSIGNED NOT NULL,
    fecha_creacion  DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_menurol_rol
        FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_menurol_menu
        FOREIGN KEY (id_menu) REFERENCES menu(id_menu)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_menurol UNIQUE (id_rol, id_menu)
) ENGINE=InnoDB;

-- =====================================================================
-- 5. MENU_USUARIO — permisos de menú a nivel individual (excepciones)
-- =====================================================================
CREATE TABLE menu_usuario (
    id_menu_usuario INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario      INT UNSIGNED NOT NULL,
    id_menu         INT UNSIGNED NOT NULL,
    fecha_creacion  DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_menuusuario_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_menuusuario_menu
        FOREIGN KEY (id_menu) REFERENCES menu(id_menu)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT uq_menuusuario UNIQUE (id_usuario, id_menu)
) ENGINE=InnoDB;

-- =====================================================================
-- 6. PROFESIONAL — extensión 1:1 de usuario (rol profesional/clínico)
-- =====================================================================
CREATE TABLE profesional (
    id_profesional        INT UNSIGNED PRIMARY KEY,
    colegiado_numero      VARCHAR(50)     NULL,
    especialidad          VARCHAR(255)    NULL,
    biografia             TEXT            NULL,
    google_calendar_token TEXT            NULL,
    google_calendar_id    VARCHAR(255)    NULL,
    tiempo_consulta       INT UNSIGNED    NULL DEFAULT 60,
    activo                BOOLEAN         NULL DEFAULT TRUE,
    verificado            BOOLEAN         NULL DEFAULT FALSE,
    configuracion         JSON            NULL,
    tarifa_consulta       DECIMAL(10,2)   NULL,
    fecha_creacion        DATETIME        NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_profesional_usuario
        FOREIGN KEY (id_profesional) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 7. CLIENTE — extensión 1:1 de usuario (paciente), datos clínicos básicos
-- =====================================================================
CREATE TABLE cliente (
    id_cliente             INT UNSIGNED PRIMARY KEY,
    fecha_nacimiento       DATE     NULL,
    direccion              TEXT     NULL,
    alergias               TEXT     NULL,
    medicamentos_actuales  TEXT     NULL,
    notas_medicas          TEXT     NULL,
    fecha_creacion         DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cliente_usuario
        FOREIGN KEY (id_cliente) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 8. DISPONIBILIDAD — horario recurrente semanal por profesional
-- =====================================================================
CREATE TABLE disponibilidad (
    id_disponibilidad     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_profesional        INT UNSIGNED NOT NULL,
    dia_semana            TINYINT UNSIGNED NOT NULL COMMENT '0=domingo ... 6=sábado',
    hora_inicio           TIME     NOT NULL,
    hora_fin              TIME     NOT NULL,
    activo                BOOLEAN  NULL DEFAULT TRUE,
    fecha_inicio_vigencia DATE     NULL,
    fecha_fin_vigencia    DATE     NULL,
    fecha_creacion        DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_disponibilidad_profesional
        FOREIGN KEY (id_profesional) REFERENCES profesional(id_profesional)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_disponibilidad_dia CHECK (dia_semana BETWEEN 0 AND 6),
    CONSTRAINT chk_disponibilidad_horas CHECK (hora_fin > hora_inicio)
) ENGINE=InnoDB;

CREATE INDEX idx_disponibilidad_profesional ON disponibilidad(id_profesional, dia_semana);

-- =====================================================================
-- 9. BLOQUEO_HORARIO — excepciones puntuales (vacaciones, permisos, etc.)
-- =====================================================================
CREATE TABLE bloqueo_horario (
    id_bloqueo      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_profesional  INT UNSIGNED NOT NULL,
    fecha_inicio    DATETIME     NOT NULL,
    fecha_fin       DATETIME     NOT NULL,
    motivo          VARCHAR(255) NULL,
    tipo_bloqueo    VARCHAR(50)  NULL,
    activo          BOOLEAN      NULL DEFAULT TRUE,
    fecha_creacion  DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
    creado_por      INT UNSIGNED NULL,
    CONSTRAINT fk_bloqueo_profesional
        FOREIGN KEY (id_profesional) REFERENCES profesional(id_profesional)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_bloqueo_creador
        FOREIGN KEY (creado_por) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_bloqueo_fechas CHECK (fecha_fin > fecha_inicio)
) ENGINE=InnoDB;

CREATE INDEX idx_bloqueo_profesional_fechas ON bloqueo_horario(id_profesional, fecha_inicio, fecha_fin);

-- =====================================================================
-- 10. CITA — tabla central del sistema de agendamiento
-- =====================================================================
CREATE TABLE cita (
    id_cita               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cliente            INT UNSIGNED  NOT NULL,
    id_profesional        INT UNSIGNED  NOT NULL,
    fecha                 DATE          NOT NULL,
    hora_inicio           TIME          NOT NULL,
    hora_fin              TIME          NOT NULL,
    estado                VARCHAR(50)   NOT NULL DEFAULT 'PENDIENTE',
    google_event_id       VARCHAR(255)  NULL,
    creado_por            INT UNSIGNED  NULL,
    fecha_creacion        DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
    notas_internas        TEXT          NULL,
    notas_cliente         TEXT          NULL,
    recordatorio_enviado  BOOLEAN       NULL DEFAULT FALSE,
    fecha_recordatorio    DATETIME      NULL,
    calificacion          TINYINT UNSIGNED NULL,
    comentario_cliente    TEXT          NULL,
    CONSTRAINT fk_cita_cliente
        FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_cita_profesional
        FOREIGN KEY (id_profesional) REFERENCES profesional(id_profesional)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_cita_creador
        FOREIGN KEY (creado_por) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_cita_estado
        CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA','CANCELADA','COMPLETADA')),
    CONSTRAINT chk_cita_horas CHECK (hora_fin > hora_inicio),
    CONSTRAINT chk_cita_calificacion CHECK (calificacion BETWEEN 1 AND 5),
    CONSTRAINT uq_cita_slot UNIQUE (id_profesional, fecha, hora_inicio)
) ENGINE=InnoDB;

CREATE INDEX idx_cita_cliente ON cita(id_cliente);
CREATE INDEX idx_cita_estado_fecha ON cita(estado, fecha);

-- =====================================================================
-- 11. COMPROBANTE_PAGO — comprobante de pago asociado a una cita
-- =====================================================================
CREATE TABLE comprobante_pago (
    id_comprobante   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_cita          INT UNSIGNED  NOT NULL,
    monto            DECIMAL(10,2) NOT NULL,
    estado           VARCHAR(50)   NOT NULL DEFAULT 'PENDIENTE',
    metodo_pago      VARCHAR(50)   NULL,
    fecha_pago       DATETIME      NULL,
    aprobado_por     INT UNSIGNED  NULL,
    fecha_creacion   DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
    referencia_pago  VARCHAR(255)  NULL,
    nombre_archivo   VARCHAR(255)  NULL,
    url_archivo      TEXT          NULL,
    tipo_archivo     VARCHAR(50)   NULL,
    tamano_bytes     INT UNSIGNED  NULL,
    fecha_subida     DATETIME      NULL,
    subido_por       INT UNSIGNED  NULL,
    CONSTRAINT fk_comprobante_cita
        FOREIGN KEY (id_cita) REFERENCES cita(id_cita)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_comprobante_aprobador
        FOREIGN KEY (aprobado_por) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_comprobante_subido_por
        FOREIGN KEY (subido_por) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_comprobante_estado
        CHECK (estado IN ('PENDIENTE','APROBADO','RECHAZADO'))
) ENGINE=InnoDB;

CREATE INDEX idx_comprobante_cita ON comprobante_pago(id_cita);

-- =====================================================================
-- 12. NOTIFICACION — cola de notificaciones (correo, recordatorios, etc.)
-- =====================================================================
CREATE TABLE notificacion (
    id_notificacion  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario       INT UNSIGNED NOT NULL,
    tipo             VARCHAR(50)  NOT NULL,
    contenido        TEXT         NULL,
    estado_envio     VARCHAR(50)  NOT NULL DEFAULT 'PENDIENTE',
    fecha_envio      DATETIME     NULL,
    intentos         INT UNSIGNED NULL DEFAULT 0,
    proximo_intento  DATETIME     NULL,
    error_mensaje    TEXT         NULL,
    fecha_creacion   DATETIME     NULL DEFAULT CURRENT_TIMESTAMP,
    prioridad        TINYINT UNSIGNED NULL DEFAULT 3,
    CONSTRAINT fk_notificacion_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT chk_notificacion_estado
        CHECK (estado_envio IN ('PENDIENTE','ENVIADA','FALLIDA'))
) ENGINE=InnoDB;

CREATE INDEX idx_notificacion_usuario_estado ON notificacion(id_usuario, estado_envio);

-- =====================================================================
-- 13. AUDITORIA — bitácora de acciones sobre el sistema
-- =====================================================================
CREATE TABLE auditoria (
    id_auditoria    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario      INT UNSIGNED  NOT NULL,
    accion          VARCHAR(50)   NOT NULL,
    tabla_afectada  VARCHAR(100)  NOT NULL,
    registro_id     INT UNSIGNED  NOT NULL,
    detalles        JSON          NULL,
    ip_origen       VARCHAR(45)   NULL,
    user_agent      TEXT          NULL,
    fecha_hora      DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_auditoria_usuario ON auditoria(id_usuario);
CREATE INDEX idx_auditoria_tabla_registro ON auditoria(tabla_afectada, registro_id);

-- =====================================================================
-- 14. REPORTE — reportes generados (PDF/Excel) por administración
-- =====================================================================
CREATE TABLE reporte (
    id_reporte           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario_generador INT UNSIGNED  NOT NULL,
    tipo_reporte         VARCHAR(100)  NOT NULL,
    fecha_generacion     DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
    parametros           JSON          NULL,
    archivo_url          TEXT          NULL,
    nombre_archivo       VARCHAR(255)  NULL,
    formato              VARCHAR(20)   NULL,
    CONSTRAINT fk_reporte_usuario
        FOREIGN KEY (id_usuario_generador) REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_reporte_usuario ON reporte(id_usuario_generador);

-- =====================================================================
-- 15. CONFIGURACION_SISTEMA — parámetros globales clave/valor
-- =====================================================================
CREATE TABLE configuracion_sistema (
    id_configuracion      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    clave                 VARCHAR(100) NOT NULL UNIQUE,
    valor                 TEXT         NOT NULL,
    descripcion           TEXT         NULL,
    categoria             VARCHAR(50)  NULL,
    fecha_actualizacion   DATETIME     NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- DATOS INICIALES (seed) — roles base del sistema
-- =====================================================================
INSERT INTO rol (nombre_rol, descripcion) VALUES
    ('Administrador', 'Gestión total del sistema: usuarios, reportes, configuración'),
    ('Profesional',   'Presta el servicio de consulta y administra su propia agenda'),
    ('Cliente',       'Agenda y da seguimiento a sus propias citas');

-- Fin del script HPP1
