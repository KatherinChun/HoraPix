"""
Esquemas Pydantic.

Toda entrada del cliente pasa por uno de estos modelos antes de tocar la
base de datos: tipos, longitudes y formatos se validan aquí (además de
las validaciones de negocio en cada router). Esto es la segunda capa de
validación — la primera es la del formulario en el navegador, pero esa
NUNCA es suficiente por sí sola porque el cliente puede saltársela.
"""
from datetime import date, time
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UsuarioSesion(BaseModel):
    id_usuario: int
    nombre: str
    email: EmailStr
    rol: str


class ClienteContacto(BaseModel):
    id_cliente: int
    nombre: str
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None


class ComprobanteOut(BaseModel):
    monto: float
    metodo_pago: Optional[str] = None
    nombre_archivo: Optional[str] = None
    estado: str


class CitaOut(BaseModel):
    id_cita: int
    fecha: date
    hora_inicio: time
    hora_fin: time
    estado: str
    notas_cliente: Optional[str] = None
    cliente: Optional[ClienteContacto] = None
    comprobante: Optional[ComprobanteOut] = None


class EstadoCitaUpdate(BaseModel):
    estado: Literal["PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA", "COMPLETADA"]


class ClienteResumen(BaseModel):
    id_cliente: int
    nombre: str
    email: EmailStr
    telefono: Optional[str] = None
    ultima_cita: Optional[date] = None


class ClienteFicha(BaseModel):
    id_cliente: int
    nombre: str
    email: EmailStr
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    direccion: Optional[str] = None
    alergias: Optional[str] = None
    medicamentos_actuales: Optional[str] = None
    notas_medicas: Optional[str] = None


class RendimientoOut(BaseModel):
    periodo: str
    citas_completadas: int
    cancelaciones: int
    nuevos_clientes: int


class SlotDisponible(BaseModel):
    id_profesional: int
    profesional: str
    especialidad: str
    fecha: date
    hora: str


class CitaPublicaOut(BaseModel):
    id_cita: int
    estado: str
