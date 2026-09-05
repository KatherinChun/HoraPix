"""
Configuración de la aplicación, cargada desde variables de entorno (.env).
Nunca se hardcodean secretos, credenciales de BD ni orígenes CORS en el código:
todo viene de aquí para poder variar entre desarrollo / producción sin tocar
una sola línea de lógica.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ---- Base de datos (HPP1 en MySQL) ----
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "horapix_app"
    db_password: str = ""
    db_name: str = "HPP1"

    # ---- JWT (token dentro de la cookie httpOnly) ----
    jwt_secret: str                     # obligatorio: sin valor por defecto a propósito
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 45

    # ---- Cookies de sesión ----
    # cookie_secure=True exige HTTPS (obligatorio en producción). En desarrollo
    # local sin certificado, se puede poner en False solo para poder probar.
    cookie_secure: bool = True
    cookie_samesite: str = "lax"

    # ---- CORS: nunca "*" porque usamos cookies (allow_credentials=True) ----
    cors_origins: List[str] = ["http://localhost:5500"]

    environment: str = "development"

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )

    class Config:
        env_file = ".env"


settings = Settings()
