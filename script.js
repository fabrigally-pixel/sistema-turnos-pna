// script.js - VERSIÓN FINAL INTEGRADA
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
function configurarFechaMinima() {
    const inputF = document.getElementById('fecha-turno');
    if (!inputF) return;
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    inputF.setAttribute('min', mañana.toISOString().split('T')[0]);
}

function validarBotonSolicitar() {
    const btn = document.getElementById('boton-solicitar');
    if (!btn) return;
    const campos = ['tipo-tramite', 'fecha-turno', 'horario-turno', 'nombre-solicitante', 'dni-solicitante', 'correo-solicitante'];
    const incompleto = campos.some(id => !document.getElementById(id)?.value.trim());
    btn.disabled = incompleto;
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
    document.querySelectorAll('input, select').forEach(el => el.addEventListener('input', validarBotonSolicitar));
    coleccionTurnos.onSnapshot(snap => {
        turnosTomados = snap.docs.map(d => ({id: d.id, ...d.data()}));
    });
}
