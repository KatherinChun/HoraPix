"""
Punto de entrada de la API de HoraPix.

Ejecutar en desarrollo (desde la carpeta backend/, con el entorno virtual activo):
    uvicorn app.main:app --reload --port 8000

En producción, detrás de un proxy TLS (nginx/Caddy) que termine HTTPS, o
bien directamente con:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings
from .routers import auth, citas, clientes, publico, reportes

app = FastAPI(
    title="HoraPix API",
    version="1.0.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)

# CORS: nunca "*" — con allow_credentials=True el navegador exige un
# origen explícito para poder enviar/recibir la cookie de sesión.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.environment == "production":
            # Solo se anuncia HSTS en producción (donde HTTPS es real);
            # anunciarlo en desarrollo con HTTP simple rompería el acceso.
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(citas.router, prefix="/api/citas", tags=["citas"])
app.include_router(clientes.router, prefix="/api/clientes", tags=["clientes"])
app.include_router(reportes.router, prefix="/api/reportes", tags=["reportes"])
app.include_router(publico.router, prefix="/api", tags=["publico"])  # /api/disponibilidad, /api/citas/publica


@app.get("/api/health", tags=["infra"])
def health():
    return {"status": "ok"}
