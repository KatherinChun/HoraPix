"""
Motor de base de datos y sesión por-request.

Se usa SQLAlchemy Core (text() con parámetros nombrados) en lugar de un ORM
completo porque el esquema HPP1 ya existe y está fijado en HPP1.sql; esto
evita mantener un segundo mapeo de modelos duplicado. Cada consulta usa
parámetros ligados (:nombre) — NUNCA f-strings ni concatenación directa de
valores de entrada — que es lo que realmente previene la inyección SQL,
con o sin ORM de por medio.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,   # evita usar conexiones muertas tras inactividad
    pool_recycle=1800,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """Dependencia de FastAPI: entrega una sesión y la cierra siempre al final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
