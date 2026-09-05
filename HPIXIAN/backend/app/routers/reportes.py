"""
/api/reportes — agregados de rendimiento.

Cubre las tres tarjetas de estadística (citas completadas, nuevos
clientes, cancelaciones) con consultas de agregación reales sobre HPP1.

Pendiente para la siguiente iteración: el desglose `flujo` (el
gráfico de barras semanal/trimestral) requiere agrupar por semana ISO o
trimestre con YEARWEEK()/QUARTER(); se deja fuera de esta primera
versión para no improvisar una agregación a medias. El frontend ya
espera exactamente esta forma cuando se implemente:
    "flujo": [{ "label": "Sem 1", "valor": 32 }, ...]
"""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require_roles
from ..schemas import RendimientoOut, UsuarioSesion

router = APIRouter()

_CONDICIONES_FECHA = {
    "mes": "c.fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND c.fecha < DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01')",
    "mes_pasado": "c.fecha >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01') AND c.fecha < DATE_FORMAT(CURDATE(), '%Y-%m-01')",
    "anio": "YEAR(c.fecha) = YEAR(CURDATE())",
}


@router.get("/rendimiento", response_model=RendimientoOut)
def rendimiento(
    periodo: str = "mes",
    db: Session = Depends(get_db),
    usuario: UsuarioSesion = Depends(require_roles("Profesional", "Administrador")),
):
    condicion = _CONDICIONES_FECHA.get(periodo, _CONDICIONES_FECHA["mes"])
    condicion_registro = condicion.replace("c.fecha", "u.fecha_registro")

    completadas = db.execute(text(f"SELECT COUNT(*) FROM cita c WHERE c.estado = 'COMPLETADA' AND {condicion}")).scalar()
    canceladas = db.execute(text(f"SELECT COUNT(*) FROM cita c WHERE c.estado = 'CANCELADA' AND {condicion}")).scalar()
    nuevos_clientes = db.execute(
        text(f"SELECT COUNT(*) FROM usuario u JOIN cliente cl ON cl.id_cliente = u.id_usuario WHERE {condicion_registro}")
    ).scalar()

    return RendimientoOut(
        periodo=periodo,
        citas_completadas=completadas or 0,
        cancelaciones=canceladas or 0,
        nuevos_clientes=nuevos_clientes or 0,
    )
