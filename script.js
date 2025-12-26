// script.js
console.log("Sistema de Turnos PNA Paraná - Versión Blindada 2025/2026");

// ====================================================================
// 1. CONFIGURACIÓN DE FIREBASE
// ====================================================================
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

// ====================================================================
// 2. CONFIGURACIÓN DE HORARIOS Y FERIADOS (2025-2026)
// ====================================================================
const HORA_INICIO = 7; 
const HORA_FIN = 13; 
const INTERVALO_MINUTOS = 15; 

const feriadosOficiales = [
    // --- 2025 ---
    "2025-01-01", "2025-03-03", "2025-03-04", "2025-03-24", "2025-04-02", 
    "2025-04-18", "2025-05-01", "2025-05-25", "2025-06-16", "2025-06-20", 
    "2025-06-30", // Día de la PNA
    "2025-07-09", "2025-08-15", "2025-10-13", "2025-11-24", "2025-12-08", "2025-12-25",
    // --- 2026 ---
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-23", "2026-03-24", 
    "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-25", "2026-06-20", 
    "2026-06-30", // Día de la PNA
    "2026-07-09", "2026-08-17", "2026-10-12", "2026-11-23", "2026-12-08", "2026-12-25"
];

let turnosTomados = []; 

const inputFecha = document.getElementById('fecha-turno');
const selectHorario = document.getElementById('horario-turno');
const botonSolicitar = document.getElementById('boton-solicitar');

const esAdmin = window.location.pathname.includes('admin.html');
const ADMIN_SESSION_TOKEN = 'pna_admin_token'; 

// ====================================================================
// 3. FUNCIONES DE INTERFAZ
// ====================================================================

function mostrarMensaje(id, texto, mostrar) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = texto;
        elemento.style.display = mostrar ? 'block' : 'none';
        const otroId = (id === 'mensaje-error') ? 'mensaje-exito' : 'mensaje-error';
        const otroElemento = document.getElementById(otroId);
        if(otroElemento) otroElemento.style.display = 'none';
    }
}

// ====================================================================
// 4. VALIDACIÓN DE FECHAS (Hoy + 1, Fines de semana y Feriados)
// ====================================================================

function configurarFechaMinima() {
    if (!inputFecha) return;
    // Lógica Hoy + 1: Solo permite desde mañana
    const hoy = new Date();
    const mañana = new Date(hoy);
    mañana.setDate(hoy.getDate() + 1);
    
    // Ajuste a formato YYYY-MM-DD
    const fechaMin = mañana.toISOString().split('T')[0];
    inputFecha.setAttribute('min', fechaMin);
}

function generarHorariosDisponibles(fechaSeleccionada) {
    if (!selectHorario) return; 

    selectHorario.innerHTML = '<option value="">-- Seleccione un Horario --</option>';
    selectHorario.disabled = true;

    if (!fechaSeleccionada) return; 

    // Validar Fines de Semana (0=Dom, 6=Sáb)
    const fechaObj = new Date(fechaSeleccionada + 'T00:00:00'); 
    const diaDeLaSemana = fechaObj.getDay();

    if (diaDeLaSemana === 0 || diaDeLaSemana === 6) {
        mostrarMensaje('mensaje-error', 'La oficina no atiende fines de semana.', true);
        return;
    }

    // Validar Feriados Nacionales y PNA
    if (feriadosOficiales.includes(fechaSeleccionada)) {
        mostrarMensaje('mensaje-error', 'Día no hábil: Feriado Nacional o Institucional.', true);
        return;
    }

    // Validar que no sea el mismo día (Seguridad extra)
    const hoyStr = new Date().toISOString().split('T')[0];
    if (fechaSeleccionada <= hoyStr) {
        mostrarMensaje('mensaje-error', 'Los turnos se reservan con un día de antelación.', true);
        return;
    }

    mostrarMensaje('mensaje-error', '', false);

    let horaActual = HORA_INICIO; 
    let minutosActuales = 0;
    let hayTurnosDisponibles = false;

    while (horaActual < HORA_FIN || (horaActual === HORA_FIN && minutosActuales === 0)) {
        const horario = `${String(horaActual).padStart(2, '0')}:${String(minutosActuales).padStart(2, '0')}`; 
        const turnoOcupado = turnosTomados.some(t => t.fecha === fechaSeleccionada && t.horario === horario);

        if (!turnoOcupado) {
            const option = document.createElement('option');
            option.value = horario;
            option.textContent = horario;
            selectHorario.appendChild(option);
            hayTurnosDisponibles = true;
        }
        minutosActuales += INTERVALO_MINUTOS;
        if (minutosActuales >= 60) { horaActual++; minutosActuales = 0; }
    }

    if (hayTurnosDisponibles) selectHorario.disabled = false;
}

// ====================================================================
// 5. PROCESO DE RESERVA
// ====================================================================

async function procesarSolicitudDeTurno() {
    const tramite = document.getElementById('tipo-tramite').value;
    const fecha = inputFecha.value;
    const horario = selectHorario.value;
    const nombre = document.getElementById('nombre-solicitante').value.trim();
    const dni = document.getElementById('dni-solicitante').value.trim();
    const correo = document.getElementById('correo-solicitante').value.trim(); 

    if (!tramite || !fecha || !horario || !nombre || !dni || !correo) {
        mostrarMensaje('mensaje-error', 'Por favor, complete todos los campos.', true);
        return;
    }

    botonSolicitar.disabled = true;
    botonSolicitar.textContent = "Procesando...";

    const nuevoTurnoData = {
        fecha, horario, tramite, nombre, dni, correo,
        registradoEn: new Date().toLocaleString('es-AR'),
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    };

    try {
        await coleccionTurnos.add(nuevoTurnoData);
        mostrarMensaje('mensaje-exito', `✅ Turno Confirmado para el ${fecha}. Recibirá un mail en ${correo}`, true);
        document.getElementById('formulario-turnos').reset(); 
        configurarFechaMinima();
    } catch (error) {
        console.error("Error:", error);
        mostrarMensaje('mensaje-error', 'Error al guardar. Verifique su conexión.', true);
    } finally {
        botonSolicitar.disabled = false;
        botonSolicitar.textContent = "Solicitar Turno";
    }
}

// ====================================================================
// 6. ADMINISTRACIÓN
// ====================================================================

function dibujarTablaAdmin(fechaFiltro) {
    const contenedor = document.getElementById('contenedor-tabla');
    const totalTurnos = document.getElementById('total-turnos');
    if (!contenedor) return;

    const filtrados = turnosTomados
        .filter(t => !fechaFiltro || t.fecha === fechaFiltro)
        .sort((a, b) => a.horario.localeCompare(b.horario));

    if (filtrados.length === 0) {
        contenedor.innerHTML = `<p>No hay turnos para la fecha: ${fechaFiltro}</p>`;
        totalTurnos.textContent = "";
        return;
    }

    let html = `<table class="tabla-turnos"><thead><tr><th>Hora</th><th>Trámite</th><th>Nombre</th><th>DNI</th><th>Acción</th></tr></thead><tbody>`;
    filtrados.forEach(t => {
        let tramiteLindo = t.tramite.replace(/_/g, ' ').toUpperCase();
        html += `<tr><td>${t.horario}</td><td>${tramiteLindo}</td><td>${t.nombre}</td><td>${t.dni}</td><td><button class="btn-eliminar-admin" onclick="manejarEliminacionAdmin('${t.id}')">Eliminar</button></td></tr>`;
    });
    contenedor.innerHTML = html + `</tbody></table>`;
    totalTurnos.textContent = `Turnos registrados: ${filtrados.length}`;
}

async function manejarEliminacionAdmin(id) {
    if (confirm("¿Confirmar que el turno fue atendido o debe eliminarse?")) {
        try {
            await coleccionTurnos.doc(id).delete();
        } catch (e) { alert("Error al eliminar"); }
    }
}

// ====================================================================
// 7. INICIO DE LA APLICACIÓN
// ====================================================================

function iniciarListenerTurnos(callback) {
    coleccionTurnos.onSnapshot(snap => {
        turnosTomados = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (callback) callback();
    }, () => {
        mostrarMensaje('mensaje-error', 'Error de conexión con la base de datos.', true);
    });
}

if (esAdmin) {
    const PIN_SECRET = "PNA2025parana"; 
    const btnLogin = document.getElementById('btn-login');
    const inputPin = document.getElementById('admin-pin');

    const checkSession = () => {
        if (localStorage.getItem(ADMIN_SESSION_TOKEN) === 'active') {
            document.getElementById('area-login').style.display = 'none';
            document.getElementById('dashboard-contenido').style.display = 'block';
            iniciarListenerTurnos(() => {
                const f = document.getElementById('filtro-fecha').value;
                dibujarTablaAdmin(f);
            });
        }
    };

    btnLogin?.addEventListener('click', () => {
        if (inputPin.value === PIN_SECRET) {
            localStorage.setItem(ADMIN_SESSION_TOKEN, 'active');
            location.reload();
        } else { alert("PIN Incorrecto"); }
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
        localStorage.removeItem(ADMIN_SESSION_TOKEN);
        location.reload();
    });

    checkSession();
} else {
    configurarFechaMinima();
    iniciarListenerTurnos(() => generarHorariosDisponibles(inputFecha.value));
    inputFecha?.addEventListener('change', () => generarHorariosDisponibles(inputFecha.value));
    botonSolicitar?.addEventListener('click', procesarSolicitudDeTurno);
}
