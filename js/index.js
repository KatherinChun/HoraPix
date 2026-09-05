/**
 * HoraPix - Public Landing Page & Booking Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  loadServices();
  setupBookingModal();
});

async function loadServices() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;

  try {
    // Mock response fallback if API is not active yet
    let servicios = [];
    try {
      servicios = await API.publico.getServicios();
    } catch {
      servicios = [
        { id: 1, nombre: 'Consulta Estándar', duracion: '30 min', precio: '$25.00', descripcion: 'Evaluación inicial y diagnóstico.' },
        { id: 2, nombre: 'Sesión Especializada', duracion: '60 min', precio: '$45.00', descripcion: 'Atención personalizada y tratamiento.' },
        { id: 3, nombre: 'Control y Seguimiento', duracion: '20 min', precio: '$15.00', descripcion: 'Revisión periódica de resultados.' }
      ];
    }

    grid.innerHTML = servicios.map(s => `
      <div class="card card-hover">
        <h3 class="card-title">${s.nombre}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 12px;">${s.descripcion}</p>
        <div class="flex-between mt-4">
          <span style="font-weight: 700; color: var(--primary);">${s.precio}</span>
          <button class="btn btn-primary btn-sm" onclick="openBookingModal(${s.id}, '${s.nombre}')">Reservar Cita</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast('Error cargando los servicios', 'error');
  }
}

function setupBookingModal() {
  const modal = document.getElementById('booking-modal');
  const closeBtn = document.getElementById('close-modal');
  const form = document.getElementById('booking-form');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        servicio_id: document.getElementById('modal-service-id').value,
        nombre: document.getElementById('booking-name').value,
        email: document.getElementById('booking-email').value,
        fecha: document.getElementById('booking-date').value,
        hora: document.getElementById('booking-time').value
      };

      try {
        await API.publico.crearCitaPublica(payload);
        showToast('¡Cita programada exitosamente!', 'success');
        modal.classList.remove('active');
        form.reset();
      } catch (err) {
        showToast(err.message || 'Error al agendar la cita', 'error');
      }
    });
  }
}

function openBookingModal(serviceId, serviceName) {
  const modal = document.getElementById('booking-modal');
  document.getElementById('modal-service-id').value = serviceId;
  document.getElementById('modal-service-title').textContent = `Agendar: ${serviceName}`;
  modal.classList.add('active');
}