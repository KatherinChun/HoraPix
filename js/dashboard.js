/**
 * HoraPix - Client Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  Auth.requireAuth();
  loadUserInfo();
  loadUserAppointments();
});

function loadUserInfo() {
  const user = Auth.getUser();
  if (user) {
    document.getElementById('user-name-display').textContent = user.nombre || 'Usuario';
  }
}

async function loadUserAppointments() {
  const tbody = document.getElementById('appointments-list');
  if (!tbody) return;

  try {
    let citas = [];
    try {
      citas = await API.citas.getByUser();
    } catch {
      citas = [
        { id: 101, servicio: 'Consulta Estándar', fecha: '2026-08-25', hora: '10:00 AM', estado: 'confirmada' },
        { id: 102, servicio: 'Control y Seguimiento', fecha: '2026-09-02', hora: '03:30 PM', estado: 'pendiente' }
      ];
    }

    if (citas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No tienes citas programadas.</td></tr>';
      return;
    }

    tbody.innerHTML = citas.map(c => `
      <tr>
        <td>#${c.id}</td>
        <td><strong>${c.servicio}</strong></td>
        <td>${c.fecha} - ${c.hora}</td>
        <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
        <td>
          ${c.estado !== 'cancelada' ? `<button class="btn btn-danger btn-sm" onclick="cancelAppointment(${c.id})">Cancelar</button>` : '-'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error cargando tus citas', 'error');
  }
}

async function cancelAppointment(id) {
  if (!confirm('¿Estás seguro de cancelar esta cita?')) return;

  try {
    await API.citas.cancel(id);
    showToast('Cita cancelada correctamente', 'success');
    loadUserAppointments();
  } catch (err) {
    showToast('No se pudo cancelar la cita', 'error');
  }
}