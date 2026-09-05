"""
/api/clientes — directorio y ficha individual.

La búsqueda usa LIKE con un parámetro ligado (:q), nunca se concatena el
texto de búsqueda directamente en el SQL. Datos clínicos (alergias,
medicamentos, notas médicas) solo se exponen a Profesional/Administrador,
igual que el resto del panel — nunca a un rol Cliente.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require_roles
from ..schemas import ClienteFicha, ClienteResumen, UsuarioSesion

router = APIRouter()


@router.get("", response_model=list[ClienteResumen])
def listar_clientes(
    q: str = "",
    db: Session = Depends(get_db),
    usuario: UsuarioSesion = Depends(require_roles("Profesional", "Administrador")),
):
    filas = db.execute(
        text(
            """
            SELECT cl.id_cliente, u.nombre, u.apellido, u.email, u.telefono,
                   (SELECT MAX(c.fecha) FROM cita c WHERE c.id_cliente = cl.id_cliente AND c.fecha <= CURDATE()) AS ultima_cita
            FROM cliente cl
            JOIN usuario u ON u.id_usuario = cl.id_cliente
            WHERE (:q = '' OR u.nombre LIKE CONCAT('%', :q, '%') OR u.apellido LIKE CONCAT('%', :q, '%')
                   OR u.email LIKE CONCAT('%', :q, '%') OR u.telefono LIKE CONCAT('%', :q, '%'))
            ORDER BY u.nombre
            """
        ),
        {"q": q},
    ).mappings().all()
    return [
        ClienteResumen(
            id_cliente=f["id_cliente"],
            nombre=f"{f['nombre']} {f['apellido']}",
            email=f["email"],
            telefono=f["telefono"],
            ultima_cita=f["ultima_cita"],
        )
        for f in filas
    ]


@router.get("/{id_cliente}", response_model=ClienteFicha)
def obtener_cliente(
    id_cliente: int,
    db: Session = Depends(get_db),
    usuario: UsuarioSesion = Depends(require_roles("Profesional", "Administrador")),
):
    fila = db.execute(
        text(
            """
            SELECT cl.id_cliente, u.nombre, u.apellido, u.email, u.telefono,
                   cl.fecha_nacimiento, cl.direccion, cl.alergias, cl.medicamentos_actuales, cl.notas_medicas
            FROM cliente cl
            JOIN usuario u ON u.id_usuario = cl.id_cliente
            WHERE cl.id_cliente = :id
            """
        ),
        {"id": id_cliente},
    ).mappings().first()

    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente no encontrado.")

    return ClienteFicha(
        id_cliente=fila["id_cliente"],
        nombre=f"{fila['nombre']} {fila['apellido']}",
        email=fila["email"],
        telefono=fila["telefono"],
        fecha_nacimiento=fila["fecha_nacimiento"],
        direccion=fila["direccion"],
        alergias=fila["alergias"],
        medicamentos_actuales=fila["medicamentos_actuales"],
        notas_medicas=fila["notas_medicas"],
    )
