// script.js - VERSIÓN FINAL REPARADA
const firebaseConfig = {
    apiKey: "AIzaSyBTLZI20dEdAbcnxlZ1YnvMz3twmhyvH_A",
    authDomain: "turnos-pna-parana-nuevo.firebaseapp.com",
    projectId: "turnos-pna-parana-nuevo",
    storageBucket: "turnos-pna-parana-nuevo.firebasestorage.app",
    messagingSenderId: "1026768851982",
    appId: "1:1026768851982:web:6f6bfdd3bb3dc3d2b4585f"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();
const coleccionTurnos = db.collection('turnosPNA');

const HORA_INICIO = 7, HORA_FIN = 13, INTERVALO = 15;
const feriados = [
    "2025-01-01", "2025-03-03", "2025-03-04", "2025-03-24", "2025-04-02", "2025-04-18", 
    "2025-05-01", "2025-05-25", "2025-06-16", "2025-06-20", "2025-06-30", "2025-07-09", 
    "2025-08-15", "2025-10-13", "2025-11-24", "2025-12-08", "2025-12-25",
    "2026-01-01", "2026-06-30"
];

let turnosTomados = [];
const esAdmin = window.location.pathname.includes('admin.html');

// --- LÓGICA DE TURNOS (CLIENTE) ---

function mostrarError(texto, mostrar) {
    const el = document.getElementById('mensaje-error');
    if (el) { el.textContent = texto; el.style.display = mostrar ? 'block' : 'none'; }
}

function configurarFechaMinima() {
    const inputF = document.getElementById('fecha-turno');
    if (!inputF) return;
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    inputF.setAttribute('min', mañana.toISOString().split('T')[0]);
}

function generarHorariosDisponibles(fechaSeleccionada) {
    const selectH = document.getElementById('horario-turno');
    if (!selectH) return;

    selectH.innerHTML = '<option value="">-- Seleccione un Horario --</option>';
    selectH.disabled = true;
    mostrarError("", false);

    if (!fechaSeleccionada) return;

    // Validar Fin de Semana y Feriados
    const fechaObj = new Date(fechaSeleccionada + 'T00:00:00');
    const dia = fechaObj.getDay(); // 0: Dom, 6: Sab

    if (dia === 0 || dia === 6 || feriados.includes(fechaSeleccionada)) {
        mostrarError("La fecha seleccionada es feriado o fin de semana.", true);
        return;
    }

    let h = HORA_INICIO, m = 0;
    let hayDisponibilidad = false;

    while (h < HORA_FIN || (h === HORA_FIN && m === 0)) {
        const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const ocupado = turnosTomados.some(t => t.fecha === fechaSeleccionada && t.horario === hhmm);

        if (!ocupado) {
            const opt = document.createElement('option');
            opt.value = hhmm; opt.textContent = hhmm;
            selectH.appendChild(opt);
            hayDisponibilidad = true;
        }
        m += INTERVALO;
        if (m >= 60) { h++; m = 0; }
    }

    if (hayDisponibilidad) {
        selectH.disabled = false;
    } else {
        mostrarError("No hay turnos disponibles para esta fecha.", true);
    }
}

function validarBotonSolicitar() {
    const btn = document.getElementById('boton-solicitar');
    if (!btn) return;
    const campos = ['tipo-tramite', 'fecha-turno', 'horario-turno', 'nombre-solicitante', 'dni-solicitante', 'correo-solicitante'];
    const incompleto = campos.some(id => !document.getElementById(id)?.value.trim());
    btn.disabled = incompleto;
}

async function procesarSolicitudDeTurno() {
    const btn = document.getElementById('boton-solicitar');
    const data = {
        tramite: document.getElementById('tipo-tramite').value,
        fecha: document.getElementById('fecha-turno').value,
        horario: document.getElementById('horario-turno').value,
        nombre: document.getElementById('nombre-solicitante').value.trim(),
        dni: document.getElementById('dni-solicitante').value.trim(),
        correo: document.getElementById('correo-solicitante').value.trim(),
        registradoEn: new Date().toLocaleString('es-AR')
    };

    btn.disabled = true;
    try {
        await coleccionTurnos.add(data);
        alert("✅ Turno Confirmado exitosamente.");
        location.reload(); 
    } catch (e) { alert("Error al guardar."); btn.disabled = false; }
}

// --- LÓGICA ADMINISTRADOR ---

function dibujarTablaAdmin(fechaFiltro) {
    const contenedor = document.getElementById('contenedor-tabla');
    if (!contenedor) return;

    const hoy = new Date().toISOString().split('T')[0];
    const fechaParaMostrar = fechaFiltro || hoy;

    const filtrados = turnosTomados
        .filter(t => t.fecha === fechaParaMostrar)
        .sort((a, b) => a.horario.localeCompare(b.horario));

    if (filtrados.length === 0) {
        contenedor.innerHTML = `<p>No hay turnos para el día ${fechaParaMostrar}</p>`;
        document.getElementById('total-turnos').textContent = "Sin turnos";
        return;
    }

    let html = `<table class="tabla-turnos"><thead><tr><th>Hora</th><th>Nombre</th><th>Acción</th></tr></thead><tbody>`;
    filtrados.forEach(t => {
        html += `<tr>
            <td>${t.horario}</td>
            <td>${t.nombre}</td>
            <td><button class="btn-eliminar-admin" onclick="eliminarTurno('${t.id}')">Atendido/Eliminar</button></td>
        </tr>`;
    });
    contenedor.innerHTML = html + "</tbody></table>";
    document.getElementById('total-turnos').textContent = `Total (${fechaParaMostrar}): ${filtrados.length}`;
}

async function eliminarTurno(id) {
    if (confirm("¿Marcar como atendido o eliminar?")) {
        await coleccionTurnos.doc(id).delete();
    }
}

// --- INICIALIZACIÓN ---

if (esAdmin) {
    const PIN_CORRECTO = "PNA2025parana";
    const areaLogin = document.getElementById('area-login');
    const areaDashboard = document.getElementById('dashboard-contenido');

    const cargarAdmin = () => {
        areaLogin.style.display = 'none';
        areaDashboard.style.display = 'block';
        const filtro = document.getElementById('filtro-fecha');
        filtro.addEventListener('change', () => dibujarTablaAdmin(filtro.value));
        coleccionTurnos.onSnapshot(snap => {
            turnosTomados = snap.docs.map(d => ({id: d.id, ...d.data()}));
            dibujarTablaAdmin(filtro.value);
        });
    };

    if (localStorage.getItem('admin_pna') === 'true') {
        cargarAdmin();
    }

    document.getElementById('btn-login')?.addEventListener('click', () => {
        if (document.getElementById('admin-pin').value === PIN_CORRECTO) {
            localStorage.setItem('admin_pna', 'true');
            cargarAdmin();
        } else { alert("PIN Incorrecto"); }
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        localStorage.removeItem('admin_pna');
        location.reload();
    });
} else {
    configurarFechaMinima();
    const inputFecha = document.getElementById('fecha-turno');
    
    // Escuchar cambios en la fecha para generar horarios
    inputFecha?.addEventListener('change', () => {
        generarHorariosDisponibles(inputFecha.value);
        validarBotonSolicitar();
    });

    // Validar el resto de los campos
    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', validarBotonSolicitar);
    });

    // Sincronizar con Firebase
    coleccionTurnos.onSnapshot(snap => {
        turnosTomados = snap.docs.map(d => ({id: d.id, ...d.data()}));
        if (inputFecha?.value) generarHorariosDisponibles(inputFecha.value);
    });

    document.getElementById('boton-solicitar')?.addEventListener('click', procesarSolicitudDeTurno);
}
