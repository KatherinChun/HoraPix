"""
Dependencias compartidas por los routers.

get_current_user  -> exige una cookie de sesión válida (JWT) y devuelve
                      el usuario autenticado, consultando siempre la BD
                      para confirmar que sigue existiendo y activo
                      (así una cuenta desactivada pierde acceso de
                      inmediato aunque su token no haya expirado).
require_roles(...) -> control de acceso (RBAC): solo deja pasar a los
                      roles indicados. Úsalo en vez de checar el rol a
                      mano dentro de cada endpoint.
verificar_csrf      -> defensa "doble cookie" contra CSRF, obligatoria
                      en toda ruta que cambia estado (POST/PATCH/DELETE).
"""
from jose import JWTError
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import get_db
from .schemas import UsuarioSesion
from .security import decode_access_token

COOKIE_NAME = "horapix_session"


def get_current_user(request: Request, db: Session = Depends(get_db)) -> UsuarioSesion:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No autenticado.")

    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión inválida o expirada.")

    fila = db.execute(
        text(
            """
            SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.activo, r.nombre_rol AS rol
            FROM usuario u
            JOIN rol r ON r.id_rol = u.id_rol
            WHERE u.id_usuario = :id_usuario
            """
        ),
        {"id_usuario": payload.get("sub")},
    ).mappings().first()

    if fila is None or not fila["activo"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario no válido o inactivo.")

    return UsuarioSesion(
        id_usuario=fila["id_usuario"],
        nombre=f"{fila['nombre']} {fila['apellido']}",
        email=fila["email"],
        rol=fila["rol"],
    )


def require_roles(*roles_permitidos: str):
    def verificador(usuario: UsuarioSesion = Depends(get_current_user)) -> UsuarioSesion:
        if usuario.rol not in roles_permitidos:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes permisos para esta acción.")
        return usuario

    return verificador


def verificar_csrf(request: Request):
    """
    Defensa CSRF de 'doble cookie': el front-end lee la cookie no-httpOnly
    `csrf_token` (creada en /auth/login) y la reenvía como encabezado
    X-CSRF-Token en cada POST/PATCH/DELETE. Un sitio malicioso puede hacer
    que el navegador envíe la cookie automáticamente, pero no puede leerla
    para copiarla al encabezado, así que una petición falsificada nunca
    tendrá ambos valores coincidiendo.
    """
    if request.method in ("POST", "PATCH", "PUT", "DELETE"):
        cookie_token = request.cookies.get("csrf_token")
        header_token = request.headers.get("X-CSRF-Token")
        if not cookie_token or not header_token or cookie_token != header_token:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Token CSRF inválido o ausente.")
