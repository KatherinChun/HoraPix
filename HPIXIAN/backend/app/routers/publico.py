"""
/api/disponibilidad y /api/citas/publica — únicas rutas SIN sesión, usadas
por la landing page (agendamiento de invitado, sin cuenta previa).

Reglas de seguridad para el comprobante de pago (ya definidas para el
proyecto): solo PNG/JPG, máximo 5MB, y se guarda con un nombre aleatorio
(uuid4) en disco — el nombre original que sube el cliente nunca se usa
como nombre de archivo, para evitar path traversal y colisiones.
"""
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import CitaPublicaOut, SlotDisponible

router = APIRouter()

TIPOS_PERMITIDOS = {"image/png": ".png", "image/jpeg": ".jpg"}
TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024
DIRECTORIO_COMPROBANTES = "uploads/comprobantes"


@router.get("/disponibilidad", response_model=list[SlotDisponible])
def disponibilidad(especialidad: str, fecha: str, hora: str, db: Session = Depends(get_db)):
    """
    Primera versión: devuelve profesionales activos de la especialidad
    pedida. Pendiente para la siguiente iteración: cruzar contra
    `disponibilidad` (horario recurrente), `bloqueo_horario` (excepciones)
    y las citas ya existentes ese día, para excluir horarios ocupados de
    verdad en vez de solo listar profesionales.
    """
    filas = db.execute(
        text(
            """
            SELECT p.id_profesional, u.nombre, u.apellido
            FROM profesional p
            JOIN usuario u ON u.id_usuario = p.id_profesional
            WHERE p.especialidad = :especialidad AND p.activo = TRUE
            LIMIT 5
            """
        ),
        {"especialidad": especialidad},
    ).mappings().all()

    return [
        SlotDisponible(
            id_profesional=f["id_profesional"],
            profesional=f"{f['nombre']} {f['apellido']}",
            especialidad=especialidad,
            fecha=fecha,
            hora=hora,
        )
        for f in filas
    ]


@router.post("/citas/publica", response_model=CitaPublicaOut, status_code=status.HTTP_201_CREATED)
async def crear_cita_publica(
    id_profesional: int = Form(...),
    fecha: str = Form(...),
    hora: str = Form(...),
    nombre: str = Form(..., min_length=3, max_length=150),
    email: str = Form(...),
    telefono: str = Form(""),
    comprobante: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if comprobante.content_type not in TIPOS_PERMITIDOS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El comprobante debe ser una imagen PNG o JPG.")

    contenido = await comprobante.read()
    if len(contenido) > TAMANO_MAXIMO_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El comprobante no puede superar 5MB.")

    try:
        fila_usuario = db.execute(text("SELECT id_usuario FROM usuario WHERE email = :email"), {"email": email.lower()}).first()

        if fila_usuario:
            id_cliente = fila_usuario[0]
        else:
            id_rol_cliente = db.execute(text("SELECT id_rol FROM rol WHERE nombre_rol = 'Cliente'")).scalar()
            partes = nombre.strip().split(" ", 1)
            resultado = db.execute(
                text(
                    """
                    INSERT INTO usuario (nombre, apellido, email, telefono, id_rol, activo)
                    VALUES (:nombre, :apellido, :email, :telefono, :id_rol, TRUE)
                    """
                ),
                {
                    "nombre": partes[0],
                    "apellido": partes[1] if len(partes) > 1 else "",
                    "email": email.lower(),
                    "telefono": telefono,
                    "id_rol": id_rol_cliente,
                },
            )
            id_cliente = resultado.lastrowid
            db.execute(text("INSERT INTO cliente (id_cliente) VALUES (:id)"), {"id": id_cliente})

        tarifa = db.execute(text("SELECT tarifa_consulta FROM profesional WHERE id_profesional = :id"), {"id": id_profesional}).scalar()

        h, m = (int(p) for p in hora.split(":"))
        hora_fin = f"{(h + 1) % 24:02d}:{m:02d}"  # duración por defecto de 1h; ajustar según profesional.tiempo_consulta

        resultado = db.execute(
            text(
                """
                INSERT INTO cita (id_cliente, id_profesional, fecha, hora_inicio, hora_fin, estado, creado_por)
                VALUES (:id_cliente, :id_profesional, :fecha, :hora_inicio, :hora_fin, 'PENDIENTE', :id_cliente)
                """
            ),
            {"id_cliente": id_cliente, "id_profesional": id_profesional, "fecha": fecha, "hora_inicio": hora, "hora_fin": hora_fin},
        )
        id_cita = resultado.lastrowid

        os.makedirs(DIRECTORIO_COMPROBANTES, exist_ok=True)
        nombre_archivo = f"{uuid.uuid4().hex}{TIPOS_PERMITIDOS[comprobante.content_type]}"
        with open(os.path.join(DIRECTORIO_COMPROBANTES, nombre_archivo), "wb") as destino:
            destino.write(contenido)

        db.execute(
            text(
                """
                INSERT INTO comprobante_pago (id_cita, monto, estado, nombre_archivo, tipo_archivo, tamano_bytes)
                VALUES (:id_cita, :monto, 'PENDIENTE', :nombre_archivo, :tipo, :tamano)
                """
            ),
            {
                "id_cita": id_cita,
                "monto": tarifa or 0,
                "nombre_archivo": nombre_archivo,
                "tipo": comprobante.content_type,
                "tamano": len(contenido),
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "No se pudo registrar la cita. Intenta de nuevo.")

    return CitaPublicaOut(id_cita=id_cita, estado="PENDIENTE")
