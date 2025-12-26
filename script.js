// script.js - Versión Corregida (Botón + Filtros Admin)
console.log("Sistema PNA Paraná - v2.1");

const firebaseConfig = {
    apiKey: "AIzaSyBTLZI20dEdAbcnxlZ1YnvMz3twmhyvH_A",
    authDomain: "turnos-pna-parana-nuevo.firebaseapp.com",
    projectId: "turnos-pna-parana-nuevo",
    storageBucket: "turnos-pna-parana-nuevo.firebasestorage.app",
    messagingSenderId: "1026768851982",
    appId: "1:1026768851982:web:6f6bfdd3bb3dc3d2b4585f"
};

if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const coleccionTurnos = db.collection('turnosPNA');

const HORA_INICIO = 7, HORA_FIN = 13, INTERVALO_MINUTOS = 15;
const feriadosOficiales = [
    "2025-01-01", "2025-03-03", "2025-03-04", "2025-03-24", "2025-04-02", 
    "2025-04-18", "2025-05-01", "2025-05-25", "2025-06-16", "2025-06-20", 
    "2025-06-30", "2025-07-09", "2025-08-15", "2025-10-13", "2025-11-24", 
    "2025-12-08", "2025-12-25", "2026-01-01", "2026-06-30"
];

let turnosTomados = [];
const inputFecha = document.getElementById('fecha-turno');
const selectHorario = document.getElementById('horario-turno');
const botonSolicitar = document.getElementById('boton-solicitar');
const esAdmin = window.location.pathname.includes('admin.html');
const ADMIN_SESSION_TOKEN = 'pna_admin_token';

// --- FUNCIONES CORE ---

function mostrarMensaje(id, texto, mostrar) {
    const el = document.getElementById(id);
    if (el) { el.textContent = texto; el.style.display = mostrar ? 'block' : 'none'; }
}

function configurarFechaMinima() {
    if (!inputFecha) return;
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    inputFecha.setAttribute('min', mañana.toISOString().split('T')[0]);
}

// VALIDACIÓN MEJORADA DEL BOTÓN
function validarFormulario() {
    if (esAdmin || !botonSolicitar) return;
    
    const tramite = document.getElementById('tipo-tramite')?.value;
    const fecha = inputFecha?.value;
    const horario = selectHorario?.value;
    const nombre = document.getElementById('nombre-solicitante')?.value.trim();
    const dni = document.getElementById('dni-solicitante')?.value.trim();
    const correo = document.getElementById('correo-solicitante')?.value.trim();

    // Si todo tiene algo escrito, habilitamos
    const estaCompleto = tramite && fecha && horario && nombre && dni && correo;
    botonSolicitar.disabled = !estaCompleto;
}

function generarHorariosDisponibles(fechaSeleccionada) {
    if (!selectHorario) return;
    selectHorario.innerHTML = '<option value="">-- Seleccione un Horario --</option>';
    selectHorario.disabled = true;

    if (!fechaSeleccionada) return;

    const fechaObj = new Date(fechaSeleccionada + 'T00:00:00');
    if (fechaObj.getDay() === 0 || fechaObj.getDay() === 6 || feriadosOficiales.includes(fechaSeleccionada)) {
        mostrarMensaje('mensaje-error', 'Día no hábil o feriado.', true);
        return;
    }

    mostrarMensaje('mensaje-error', '', false);
    let h = HORA_INICIO, m = 0;
    while (h < HORA_FIN || (h === HORA_FIN && m === 0)) {
        const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        if (!turnosTomados.some(t => t.fecha === fechaSeleccionada && t.horario === hhmm)) {
            const opt = document.createElement('option');
            opt.value = hhmm; opt.textContent = hhmm;
            selectHorario.appendChild(opt);
        }
        m += INTERVALO_MINUTOS;
        if (m >= 60) { h++; m = 0; }
    }
    selectHorario.disabled = false;
    validarFormulario();
}

async function procesarSolicitudDeTurno() {
    const data = {
        tramite: document.getElementById('tipo-tramite').value,
        fecha: inputFecha.value,
        horario: selectHorario.value,
        nombre: document.getElementById('nombre-solicitante').value.trim(),
        dni: document.getElementById('dni-solicitante').value.trim(),
        correo: document.getElementById('correo-solicitante').value.trim(),
        registradoEn: new Date().toLocaleString('es-AR')
    };

    botonSolicitar.disabled = true;
    try {
        await coleccionTurnos.add(data);
        alert("✅ Turno Confirmado");
        location.reload(); 
    } catch (e) { alert("Error al guardar"); botonSolicitar.disabled = false; }
}

// --- LÓGICA ADMINISTRADOR ---

function dibujarTablaAdmin(fechaFiltro) {
    const contenedor = document.getElementById('contenedor-tabla');
    if (!contenedor) return;

    // Si no hay filtro, mostramos los de HOY por defecto
    const hoy = new Date().toISOString().split('T')[0];
    const filtroEfectivo = fechaFiltro || hoy;

    const filtrados = turnosTomados
        .filter(t => t.fecha === filtroEfectivo)
        .sort((a, b) => a.horario.localeCompare(b.horario));

    let html = `<table class="tabla-turnos"><thead><tr><th>Hora</th><th>Trámite</th><th>Nombre</th><th>Acción</th></tr></thead><tbody>`;
    filtrados.forEach(t => {
        html += `<tr><td>${t.horario}</td><td>${t.tramite}</td><td>${t.nombre}</td>
                 <td><button onclick="manejarEliminacionAdmin('${t.id}')">Eliminar</button></td></tr>`;
    });
    contenedor.innerHTML = html + "</tbody></table>";
    document.getElementById('total-turnos').textContent = `Turnos (${filtroEfectivo}): ${filtrados.length}`;
}

async function manejarEliminacionAdmin(id) {
    if (confirm("¿Eliminar turno?")) await coleccionTurnos.doc(id).delete();
}

// --- INICIO ---

if (esAdmin) {
    const PIN_SECRET = "PNA2025parana";
    const areaLogin = document.getElementById('area-login');
    const contenido = document.getElementById('dashboard-contenido');
    
    if (localStorage.getItem(ADMIN_SESSION_TOKEN) === 'active') {
        areaLogin.style.display = 'none';
        contenido.style.display = 'block';
        const inputFiltro = document.getElementById('filtro-fecha');
        // Escuchar cambios en el filtro
        inputFiltro?.addEventListener('change', () => dibujarTablaAdmin(inputFiltro.value));
        coleccionTurnos.onSnapshot(snap => {
            turnosTomados = snap.docs.map(d => ({id: d.id, ...d.data()}));
            dibujarTablaAdmin(inputFiltro?.value);
        });
    } else {
        document.getElementById('btn-login')?.addEventListener('click', () => {
            if (document.getElementById('admin-pin').value === PIN_SECRET) {
                localStorage.setItem(ADMIN_SESSION_TOKEN, 'active');
                location.reload();
            } else alert("PIN Incorrecto");
        });
    }
} else {
    configurarFechaMinima();
    coleccionTurnos.onSnapshot(snap => {
        turnosTomados = snap.docs.map(d => ({id: d.id, ...d.data()}));
        generarHorariosDisponibles(inputFecha?.value);
    });
    inputFecha?.addEventListener('change', () => generarHorariosDisponibles(inputFecha.value));
    
    // Escuchar cada vez que escriben para habilitar el botón
    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', validarFormulario);
    });
    botonSolicitar?.addEventListener('click', procesarSolicitudDeTurno);
}
