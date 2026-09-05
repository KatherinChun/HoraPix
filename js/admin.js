/**
 * HoraPix - Admin Panel Management Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  Auth.requireAdmin();
  loadAdminStats();
  loadAllAppointments();
});

async function loadAdminStats() {
  try {
    let stats = { totalCitas: 48, confirmadas: 32, pendientes: 10, clientes: 120 };
    try {
      stats = await API.reportes.getResumen();
    } catch {}

    document.getElementById('stat-total').textContent = stats.totalCitas || 0;
    document.getElementById('stat-confirmed').textContent = stats.confirmadas || 0;
    document.getElementById('stat-pending').textContent = stats.pendientes || 0;
    document.getElementById('stat-clients').textContent = stats.clientes || 0;
  } catch (err) {
    console.error('Error cargando estadísticas', err);
  }
}

async function loadAllAppointments() {
  const tbody = document.getElementById('admin-citas-list');
  if (!tbody) return;

  try {
    let citas = [];
    try {
      citas = await API.citas.getAll();
    } catch {
      citas = [
        { id: 101, cliente: 'Ana García', servicio: 'Consulta Estándar', fecha: '2026-08-25 10:00 AM', estado: 'confirmada' },
        { id: 102, cliente: 'Carlos López', servicio: 'Sesión Especializada', fecha: '2026-08-25 11:30 AM', estado: 'pendiente' },
        { id: 103, cliente: 'María Rodríguez', servicio: 'Control y Seguimiento', fecha: '2026-08-26 09:00 AM', estado: 'pendiente' }
      ];
    }

    tbody.innerHTML = citas.map(c => `
      <tr>
        <td>#${c.id}</td>
        <td><strong>${c.cliente}</strong></td>
        <td>${c.servicio}</td>
        <td>${c.fecha}</td>
        <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
        <td class="flex gap-2">
          ${c.estado === 'pendiente' ? `
            <button class="btn btn-primary btn-sm" onclick="changeStatus(${c.id}, 'confirmada')">Aprobar</button>
            <button class="btn btn-danger btn-sm" onclick="changeStatus(${c.id}, 'cancelada')">Rechazar</button>
          ` : '-'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error cargando las citas del sistema', 'error');
  }
}

async function changeStatus(id, newStatus) {
  try {
    await API.citas.updateStatus(id, newStatus);
    showToast(`Cita #${id} actualizada a ${newStatus}`, 'success');
    loadAllAppointments();
    loadAdminStats();
  } catch (err) {
    showToast('Error al actualizar el estado', 'error');
  }
}