"""
/api/citas — agenda del profesional/administrador.

La transición de estado de una cita nunca se confía al cliente: el
servidor mantiene su propia máquina de estados (TRANSICIONES_VALIDAS) y
rechaza cualquier salto que no tenga sentido (p. ej. reabrir una cita
COMPLETADA), sin importar lo que el frontend haya mostrado.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require_roles, verificar_csrf
from ..schemas import CitaOut, EstadoCitaUpdate, UsuarioSesion

router = APIRouter()

TRANSICIONES_VALIDAS = {
    "PENDIENTE": {"APROBADA", "RECHAZADA", "CANCELADA"},
    "APROBADA": {"COMPLETADA", "CANCELADA"},
}

_SELECT_CITA = """
    SELECT c.id_cita, c.fecha, c.hora_inicio, c.hora_fin, c.estado, c.notas_cliente,
           cl.id_cliente, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido,
           u.telefono, u.email,
           cp.monto, cp.metodo_pago, cp.nombre_archivo, cp.estado AS comprobante_estado
    FROM cita c
    JOIN cliente cl ON cl.id_cliente = c.id_cliente
    JOIN usuario u ON u.id_usuario = cl.id_cliente
    LEFT JOIN comprobante_pago cp ON cp.id_cita = c.id_cita
"""


def _mapear(fila) -> CitaOut:
    return CitaOut(
        id_cita=fila["id_cita"],
        fecha=fila["fecha"],
        hora_inicio=fila["hora_inicio"],
        hora_fin=fila["hora_fin"],
        estado=fila["estado"],
        notas_cliente=fila["notas_cliente"],
        cliente={
            "id_cliente": fila["id_cliente"],
            "nombre": f"{fila['cliente_nombre']} {fila['cliente_apellido']}",
            "telefono": fila["telefono"],
            "email": fila["email"],
        },
        comprobante=(
            {
                "monto": float(fila["monto"]),
                "metodo_pago": fila["metodo_pago"],
                "nombre_archivo": fila["nombre_archivo"],
                "estado": fila["comprobante_estado"],
            }
            if fila["monto"] is not None
            else None
        ),
    )


@router.get("", response_model=list[CitaOut])
def listar_por_fecha(
    fecha: date,
    db: Session = Depends(get_db),
    usuario: UsuarioSesion = Depends(require_roles("Profesional", "Administrador")),
):
    filas = db.execute(text(f"{_SELECT_CITA} WHERE c.fecha = :fecha ORDER BY c.hora_inicio"), {"fecha": fecha}).mappings().all()
    return [_mapear(f) for f in filas]


@router.get("/calendario", response_model=list[CitaOut])
def calendario(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    usuario: UsuarioSesion = Depends(require_roles("Profesional", "Administrador")),
):
    filas = db.execute(
        text(f"{_SELECT_CITA} WHERE YEAR(c.fecha) = :year AND MONTH(c.fecha) = :month ORDER BY c.fecha, c.hora_inicio"),
        {"year": year, "month": month},
    ).mappings().all()
    return [_mapear(f) for f in filas]


@router.patch("/{id_cita}/estado", response_model=CitaOut, dependencies=[Depends(verificar_csrf)])
def actualizar_estado(
    id_cita: int,
    payload: EstadoCitaUpdate,
    db: Session = Depends(get_db),
    usuario: UsuarioSesion = Depends(require_roles("Profesional", "Administrador")),
):
    estado_actual = db.execute(text("SELECT estado FROM cita WHERE id_cita = :id"), {"id": id_cita}).scalar()
    if estado_actual is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada.")

    permitidas = TRANSICIONES_VALIDAS.get(estado_actual, set())
    if payload.estado not in permitidas:
        raise HTTPException(status.HTTP_409_CONFLICT, f"No se puede pasar de {estado_actual} a {payload.estado}.")

    try:
        db.execute(text("UPDATE cita SET estado = :estado WHERE id_cita = :id"), {"estado": payload.estado, "id": id_cita})

        if payload.estado in ("APROBADA", "RECHAZADA"):
            nuevo_estado_pago = "APROBADO" if payload.estado == "APROBADA" else "RECHAZADO"
            db.execute(
                text("UPDATE comprobante_pago SET estado = :estado, aprobado_por = :usuario WHERE id_cita = :id"),
                {"estado": nuevo_estado_pago, "usuario": usuario.id_usuario, "id": id_cita},
            )

        db.execute(
            text(
                """
                INSERT INTO auditoria (id_usuario, accion, tabla_afectada, registro_id, detalles)
                VALUES (:usuario, 'CAMBIAR_ESTADO_CITA', 'cita', :id, JSON_OBJECT('antes', :antes, 'despues', :despues))
                """
            ),
            {"usuario": usuario.id_usuario, "id": id_cita, "antes": estado_actual, "despues": payload.estado},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "No se pudo actualizar la cita. Intenta de nuevo.")

    fila = db.execute(text(f"{_SELECT_CITA} WHERE c.id_cita = :id"), {"id": id_cita}).mappings().first()
    return _mapear(fila)
