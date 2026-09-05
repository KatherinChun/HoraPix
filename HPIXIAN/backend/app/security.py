"""
Seguridad: hashing de contraseñas y JWT.

- Las contraseñas NUNCA se guardan ni se comparan en texto plano: se
  almacenan como hash bcrypt (usuario.password_hash) y se verifican con
  passlib, que hace la comparación en tiempo constante.
- El JWT es de corta duración (JWT_EXPIRE_MINUTES) y viaja únicamente
  dentro de una cookie httpOnly — nunca en localStorage ni en el body de
  la respuesta — para que un XSS no pueda robarlo con JavaScript.
"""
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    to_encode.update({"iat": now, "exp": now + timedelta(minutes=settings.jwt_expire_minutes)})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    # jose.JWTError (firma inválida, token expirado, etc.) se propaga al
    # llamador; dependencies.py la traduce a un 401 para el cliente.
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)
