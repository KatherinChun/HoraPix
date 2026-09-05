"""
/api/auth — login, logout, sesión actual.

Decisiones de seguridad relevantes:
- La respuesta de error de login es siempre el mismo mensaje genérico,
  exista o no el correo, para no permitir enumerar usuarios registrados.
- El JWT se entrega en una cookie httpOnly + Secure + SameSite (nunca en
  el cuerpo JSON) para que JavaScript no pueda leerlo ni un XSS robarlo.
- Se limita el número de intentos fallidos por IP+correo en una ventana
  de tiempo (mitiga fuerza bruta). El diccionario en memoria de abajo
  sirve para un solo proceso; en producción con varias instancias hay
  que moverlo a un backend compartido (Redis) — por ejemplo con la
  librería slowapi.
- Cada intento (éxito o fallo) se registra en la tabla `auditoria`.
"""
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..dependencies import COOKIE_NAME, get_current_user
from ..schemas import LoginRequest, UsuarioSesion
from ..security import create_access_token, generate_csrf_token, verify_password

router = APIRouter()

_intentos_fallidos: dict[str, list[datetime]] = defaultdict(list)
MAX_INTENTOS = 5
VENTANA = timedelta(minutes=15)


def _demasiados_intentos(clave: str) -> bool:
    ahora = datetime.utcnow()
    _intentos_fallidos[clave] = [t for t in _intentos_fallidos[clave] if ahora - t < VENTANA]
    return len(_intentos_fallidos[clave]) >= MAX_INTENTOS


def _registrar_intento_fallido(clave: str) -> None:
    _intentos_fallidos[clave].append(datetime.utcnow())


def _registrar_auditoria(db: Session, id_usuario: int, accion: str, request: Request) -> None:
    db.execute(
        text(
            """
            INSERT INTO auditoria (id_usuario, accion, tabla_afectada, registro_id, ip_origen, user_agent)
            VALUES (:id_usuario, :accion, 'usuario', :registro_id, :ip, :ua)
            """
        ),
        {
            "id_usuario": id_usuario,
            "accion": accion,
            "registro_id": id_usuario,
            "ip": request.client.host if request.client else None,
            "ua": request.headers.get("user-agent"),
        },
    )
    db.commit()


@router.post("/login", response_model=UsuarioSesion)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    clave_limite = f"{request.client.host if request.client else 'desconocido'}:{payload.email.lower()}"
    if _demasiados_intentos(clave_limite):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos. Intenta de nuevo en unos minutos.")

    fila = db.execute(
        text(
            """
            SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.password_hash, u.activo, r.nombre_rol AS rol
            FROM usuario u
            JOIN rol r ON r.id_rol = u.id_rol
            WHERE u.email = :email
            """
        ),
        {"email": payload.email.lower()},
    ).mappings().first()

    credenciales_invalidas = (
        fila is None
        or not fila["activo"]
        or not fila["password_hash"]
        or not verify_password(payload.password, fila["password_hash"])
    )
    if credenciales_invalidas:
        _registrar_intento_fallido(clave_limite)
        if fila is not None:
            _registrar_auditoria(db, fila["id_usuario"], "LOGIN_FALLIDO", request)
        # Mensaje genérico a propósito: nunca reveles si el correo existe o si falló la contraseña.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos.")

    token = create_access_token({"sub": str(fila["id_usuario"]), "rol": fila["rol"]})
    csrf_token = generate_csrf_token()

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,  # el frontend necesita leerla para copiarla al header X-CSRF-Token
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )

    db.execute(text("UPDATE usuario SET ultimo_acceso = NOW() WHERE id_usuario = :id"), {"id": fila["id_usuario"]})
    _registrar_auditoria(db, fila["id_usuario"], "LOGIN_EXITOSO", request)

    return UsuarioSesion(
        id_usuario=fila["id_usuario"],
        nombre=f"{fila['nombre']} {fila['apellido']}",
        email=fila["email"],
        rol=fila["rol"],
    )


@router.post("/logout")
def logout(response: Response, usuario: UsuarioSesion = Depends(get_current_user)):
    response.delete_cookie(COOKIE_NAME, path="/")
    response.delete_cookie("csrf_token", path="/")
    return {"ok": True}


@router.get("/me", response_model=UsuarioSesion)
def me(usuario: UsuarioSesion = Depends(get_current_user)):
    return usuario
