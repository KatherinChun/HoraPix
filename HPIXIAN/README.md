# HoraPix — HPP1

Sistema de agendamiento digital. Este paquete contiene la **capa de vista**
(frontend HTML5/CSS/JS) de los 4 mockups compartidos, más un **backend
FastAPI** ya cableado contra el esquema `HPP1.sql`, listo para conectar
cuando decidan dejar el modo de vista.

```
horapix/
├── README.md              (este archivo)
├── .gitignore
├── database/
│   └── HPP1.sql           esquema completo de la base de datos
├── frontend/
│   ├── index.html         Carta de presentación pública (antes del login)
│   ├── login.html         Inicio de sesión
│   ├── dashboard.html     Panel Profesional/Administrador — SPA con 4 vistas
│   └── admin.html         Panel de Administración (base extensible)
└── backend/
    ├── requirements.txt
    ├── .env.example
    └── app/
        ├── main.py         punto de entrada FastAPI
        ├── config.py       configuración por variables de entorno
        ├── database.py     conexión a MySQL (HPP1)
        ├── security.py     bcrypt + JWT
        ├── schemas.py      validación Pydantic de entrada/salida
        ├── dependencies.py sesión, control de acceso por rol, CSRF
        └── routers/
            ├── auth.py       login / logout / me
            ├── citas.py      agenda del profesional
            ├── clientes.py   directorio de clientes
            ├── reportes.py   agregados de rendimiento
            └── publico.py    disponibilidad + cita de invitado (sin sesión)
```

## 1. Ver el frontend ahora mismo (modo vista, sin backend)

Cada página de `frontend/` es autocontenida (HTML+CSS+JS en un solo
archivo) y funciona con **datos simulados en memoria** — no necesitas el
backend corriendo para navegar, probar el calendario, aprobar un pago
de ejemplo, buscar un cliente o ver el reporte de rendimiento.

Ábrelas directamente en el navegador, o mejor, sírvelas con un servidor
local (evita bloqueos de `file://` y es más parecido a producción):

```bash
cd horapix/frontend
python -m http.server 5500
# abre http://localhost:5500/index.html
```

Cuentas de demostración (visibles también en `login.html`):

| Rol           | Correo                     | Contraseña     |
|---------------|-----------------------------|----------------|
| Administrador | admin@horapix.com          | Admin123!      |
| Profesional   | profesional@horapix.com    | Clinica123!    |
| Cliente       | cliente@horapix.com        | Cliente123!    |

El rol **Cliente** no tiene panel propio todavía: al iniciar sesión
vuelve a la landing con un aviso de "portal en camino". Es intencional
— mostrarle el panel del profesional a un cliente sería una falla de
control de acceso, no un atajo válido.

## 2. Levantar el backend real

Primero crea el esquema en tu servidor MySQL (una sola vez):

```bash
mysql -u root -p < horapix/database/HPP1.sql
```

Luego el backend:

```bash
cd horapix/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edita .env: credenciales de MySQL, y genera un JWT_SECRET propio con:
python -c "import secrets; print(secrets.token_hex(32))"
```

Antes de apuntar el backend a la base de datos, crea un usuario de MySQL
de **mínimo privilegio** para la aplicación (nunca uses `root` aquí):

```sql
CREATE USER 'horapix_app'@'%' IDENTIFIED BY 'una_clave_fuerte';
GRANT SELECT, INSERT, UPDATE, DELETE ON HPP1.* TO 'horapix_app'@'%';
FLUSH PRIVILEGES;
```

Luego corre la API:

```bash
uvicorn app.main:app --reload --port 8000
# documentación interactiva: http://localhost:8000/docs (se apaga sola en producción)
```

## 3. Conectar el frontend al backend real

Cada método de datos en el frontend tiene esta forma, en **todas** las
páginas (`index.html`, `login.html`, `dashboard.html`, `admin.html`):

```js
async function login(email, password) {
  // ---- MOCK (etapa de vista) ----
  ... código simulado activo ...

  // ---- REAL ----
  // const res = await fetch(`${API_BASE}/api/auth/login`, {
  //   method: 'POST', credentials: 'include', ...
  // });
  // ...
}
```

Para conectar de verdad: borra el bloque `MOCK` y descomenta el bloque
`REAL` de cada función (están una debajo de la otra a propósito).
También hay que:

1. Ajustar `API_BASE` al dominio real del backend (HTTPS en producción).
2. Quitar el arreglo `DEMO_USERS`/`MOCK_*` — dejan de ser necesarios.
3. Actualizar `CORS_ORIGINS` en `.env` del backend con el dominio real
   donde quede publicado el frontend.
4. Leer la cookie `csrf_token` en el frontend y enviarla como encabezado
   `X-CSRF-Token` en cada POST/PATCH/DELETE (ver comentario en
   `dependencies.py::verificar_csrf`).

No es necesario tocar `HPP1.sql`: el backend ya usa exactamente esos
nombres de tabla y columna.

## 4. Seguridad implementada

- **Contraseñas**: hash bcrypt (`passlib`), nunca texto plano ni siquiera
  en memoria más de lo necesario.
- **Sesión**: JWT de corta duración (45 min por defecto) dentro de una
  cookie `httpOnly` + `Secure` + `SameSite` — nunca en `localStorage` ni
  en el cuerpo de la respuesta, para que un XSS no pueda robarla.
- **CSRF**: patrón de doble cookie (`csrf_token` legible + encabezado
  `X-CSRF-Token`) en toda ruta que cambia estado.
- **CORS**: origen explícito desde `.env`, nunca `"*"` (obligatorio para
  que las cookies funcionen entre dominios).
- **SQL**: 100% consultas parametrizadas (`text()` con `:parámetros`);
  ningún valor de entrada se concatena al SQL.
- **Validación de entrada**: doble capa — HTML5 + JS en el navegador
  (UX) y Pydantic en el servidor (la que realmente cuenta).
- **Archivos subidos**: solo PNG/JPG, máx. 5MB, guardados con nombre
  aleatorio (`uuid4`) — el nombre original del cliente nunca toca el
  disco, evitando path traversal y colisiones.
- **Control de acceso (RBAC)**: `require_roles(...)` en cada endpoint;
  una cuenta desactivada pierde acceso de inmediato (se revalida contra
  la BD en cada request, no solo al hacer login).
- **Máquina de estados de citas**: las transiciones válidas
  (`PENDIENTE → APROBADA/RECHAZADA/CANCELADA`, `APROBADA → COMPLETADA/CANCELADA`)
  se validan en el servidor, nunca se confían al frontend.
- **Auditoría**: login exitoso/fallido y cambios de estado de cita quedan
  registrados en la tabla `auditoria` (usuario, acción, IP, user-agent).
- **Fuerza bruta**: límite de intentos de login por IP+correo (ver nota
  sobre Redis en `routers/auth.py` para producción con varias instancias).
- **Cabeceras**: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, y `Strict-Transport-Security` en producción.
- **HTTPS**: `COOKIE_SECURE=True` exige TLS para que el navegador envíe
  la cookie; en producción, correr detrás de nginx/Caddy con certificado,
  o pasar `--ssl-keyfile`/`--ssl-certfile` a uvicorn directamente.
- **Mensajes de error**: el login nunca revela si falló el correo o la
  contraseña (evita enumerar cuentas registradas).

## 5. Qué queda pendiente (siguiente iteración)

- `admin.html` cubre Usuarios/Roles y Profesionales de forma funcional;
  Configuración del Sistema y Reportes Globales quedaron como base
  extensible ("Próximamente"), tal como se acordó.
- `/api/disponibilidad` hoy solo filtra por especialidad; falta cruzar
  contra `disponibilidad`, `bloqueo_horario` y las citas existentes para
  calcular huecos reales.
- `/api/reportes/rendimiento` calcula los 3 totales con agregación real;
  el desglose semanal/trimestral (`flujo`) queda pendiente de una
  consulta con `YEARWEEK()`/`QUARTER()`.
- Falta un mecanismo de refresh token / cierre de sesión forzado (p. ej.
  lista de tokens revocados) para invalidar sesiones antes de que
  expire el JWT.
- Falta subir/servir los comprobantes ya guardados (hoy se guardan en
  `backend/uploads/comprobantes/`, pero no hay endpoint para verlos
  desde el modal de "Revisar Pago").
