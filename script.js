// script.js
console.log("Sistema de Turnos PNA Paraná JS cargado. (Proyecto: turnos-pna-parana-nuevo)");

// ====================================================================
// 1. CONFIGURACIÓN DE FIREBASE Y BASE DE DATOS (Firestore)
// ====================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBTLZI20dEdAbcnxlZ1YnvMz3twmhyvH_A",
    authDomain: "turnos-pna-parana-nuevo.firebaseapp.com",
    projectId: "turnos-pna-parana-nuevo",
    storageBucket: "turnos-pna-parana-nuevo.firebasestorage.app",
    messagingSenderId: "1026768851982",
    appId: "1:1026768851982:web:6f6bfdd3bb3dc3d2b4585f"
};

// Inicializa Firebase verificando si ya existe una instancia
if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

// Referencia global a la Base de Datos y la Colección
const db = firebase.firestore();
const coleccionTurnos = db.collection('turnosPNA'); // Debe coincidir con las reglas de Firestore

// ====================================================================
// 2. DEFINICIÓN DE HORARIOS, LÍMITES Y VARIABLES GLOBALES
// ====================================================================
const HORA_INICIO = 7; 
const HORA_FIN = 13; 
const INTERVALO_MINUTOS = 15; 

// Caché local para la disponibilidad (se sincroniza con Firebase)
let turnosTomados = []; 

// Referencias del DOM para index.html
const inputFecha = document.getElementById('fecha-turno');
const selectHorario = document.getElementById('horario-turno');
const botonSolicitar = document.getElementById('boton-solicitar');

// Determinar si estamos en la vista de administración
const esAdmin = window.location.pathname.includes('admin.html');
const ADMIN_SESSION_TOKEN = 'pna_admin_token'; 

// ====================================================================
// 3. FUNCIONES DE UTILIDAD (Mensajes y UI)
// ====================================================================

function mostrarMensaje(id, texto, mostrar) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = texto;
        elemento.style.display = mostrar ? 'block' : 'none';
        
        // Ocultar el mensaje opuesto
        const otroId = (id === 'mensaje-error') ? 'mensaje-exito' : 'mensaje-error';
        const otroElemento = document.getElementById(otroId);
        if(otroElemento) {
            otroElemento.style.display = 'none';
        }
    }
}

// ====================================================================
// 4. FUNCIONES DE ADMINISTRACIÓN (admin.html)
// ====================================================================

function dibujarTablaAdmin(fechaFiltro) {
    const contenedorTabla = document.getElementById('contenedor-tabla');
    const totalTurnosElemento = document.getElementById('total-turnos');
    
    if (!contenedorTabla || !totalTurnosElemento) return;

    // Filtra y ordena los turnos desde el caché
    const turnosFiltrados = turnosTomados
        .filter(turno => !fechaFiltro || turno.fecha === fechaFiltro)
        .sort((a, b) => a.horario.localeCompare(b.horario));

    if (turnosFiltrados.length === 0) {
        contenedorTabla.innerHTML = `<p>No hay turnos registrados para el ${fechaFiltro ? fechaFiltro : 'día seleccionado'}.</p>`;
        totalTurnosElemento.textContent = '';
        return;
    }

    let tablaHTML = `
        <table class="tabla-turnos">
            <thead>
                <tr>
                    <th>Hora</th>
                    <th>Trámite</th>
                    <th>Nombre</th>
                    <th>DNI</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>
    `;

    turnosFiltrados.forEach(turno => {
        // Formatear el nombre del trámite para que sea legible
        let nombreTramite = turno.tramite ? turno.tramite.replace(/_/g, ' ').toUpperCase() : "OTROS";

        tablaHTML += `
            <tr>
                <td>${turno.horario}</td>
                <td>${nombreTramite}</td>
                <td>${turno.nombre}</td>
                <td>${turno.dni}</td>
                <td><button class="btn-eliminar-admin" data-id="${turno.id}">Atendido/Eliminar</button></td>
            </tr>
        `;
    });

    tablaHTML += `</tbody></table>`;
    contenedorTabla.innerHTML = tablaHTML;
    totalTurnosElemento.textContent = `Total de turnos para el día: ${turnosFiltrados.length}`;
    
    // Agregar eventos a los nuevos botones de eliminación
    document.querySelectorAll('.btn-eliminar-admin').forEach(button => {
        button.addEventListener('click', manejarEliminacionAdmin);
    });
}

async function manejarEliminacionAdmin(event) {
    const idAEliminar = event.target.dataset.id; 
    
    if (confirm("¿Confirma que este turno ha sido ATENDIDO o debe ser ELIMINADO de la Base de Datos?")) {
        try {
            await coleccionTurnos.doc(idAEliminar).delete();
            console.log("Turno eliminado con éxito.");
        } catch (error) {
            console.error("Error al eliminar el turno:", error);
            alert("No se pudo eliminar el turno. Verifique los permisos.");
        }
    }
}

// ====================================================================
// 5. LÓGICA DE SINCRONIZACIÓN (Firestore Listener)
// ====================================================================

function iniciarListenerTurnos(callback) {
    // Escucha cambios en la base de datos en tiempo real
    coleccionTurnos.onSnapshot(snapshot => {
        turnosTomados = snapshot.docs.map(doc => ({
            id: doc.id, 
            ...doc.data() 
        }));
        
        console.log(`Sincronización: ${turnosTomados.length} turnos cargados.`);
        
        if (callback) {
            callback();
        }
    }, error => {
        console.error("Error en la conexión con Firestore:", error);
        mostrarMensaje('mensaje-error', 'Error de conexión con la base de datos.', true);
    });
}

// ====================================================================
// 6. GENERACIÓN DE HORARIOS Y VALIDACIONES (index.html)
// ====================================================================

function generarHorariosDisponibles(fechaSeleccionada) {
    if (!selectHorario) return; 
    
    selectHorario.innerHTML = '<option value="">-- Seleccione un Horario --</option>';
    selectHorario.disabled = true;
    
    if (!fechaSeleccionada) return; 
    
    // Validar Fines de Semana
    const fechaSeleccionadaUTC = fechaSeleccionada + 'T00:00:00'; 
    const diaDeLaSemana = new Date(fechaSeleccionadaUTC).getDay();
    
    if (diaDeLaSemana === 0 || diaDeLaSemana === 6) {
        selectHorario.innerHTML = '<option value="">Día no hábil</option>';
        mostrarMensaje('mensaje-error', 'La oficina atiende únicamente de Lunes a Viernes.', true);
        return;
    }
    
    // Validar que no sea una fecha pasada
    const hoy = new Date();
    const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fechaTurnoObj = new Date(fechaSeleccionadaUTC); 
    
    if (fechaTurnoObj < hoyMedianoche) {
        selectHorario.innerHTML = '<option value="">Fecha pasada</option>';
        mostrarMensaje('mensaje-error', 'No se pueden solicitar turnos para fechas anteriores a hoy.', true);
        return;
    }

    mostrarMensaje('mensaje-error', '', false);
    
    let horaActual = HORA_INICIO; 
    let minutosActuales = 0;
    let hayTurnosDisponibles = false;
    
    // Ciclo para generar intervalos de 15 minutos
    while (horaActual < HORA_FIN || (horaActual === HORA_FIN && minutosActuales === 0)) {
        
        const horario = `${String(horaActual).padStart(2, '0')}:${String(minutosActuales).padStart(2, '0')}`; 
        
        // Verificar si el horario ya está ocupado en la fecha seleccionada
        const turnoOcupado = turnosTomados.some(turno => 
            turno.fecha === fechaSeleccionada && turno.horario === horario
        );
        
        if (!turnoOcupado) {
            const option = document.createElement('option');
            option.value = horario;
            option.textContent = horario;
            selectHorario.appendChild(option);
            hayTurnosDisponibles = true;
        }

        minutosActuales += INTERVALO_MINUTOS;
        if (minutosActuales >= 60) {
            horaActual++;
            minutosActuales = 0;
        }
    }
    
    if (hayTurnosDisponibles) {
        selectHorario.disabled = false;
    } else { 
        selectHorario.innerHTML = '<option value="">No hay disponibilidad</option>';
        mostrarMensaje('mensaje-error', 'No quedan turnos disponibles para la fecha seleccionada.', true);
    }
}

// ====================================================================
// 7. PROCESO DE RESERVA (Guardar en Firebase)
// ====================================================================

async function procesarSolicitudDeTurno() {
    const tramite = document.getElementById('tipo-tramite').value;
    const fecha = inputFecha.value;
    const horario = selectHorario.value;
    const nombre = document.getElementById('nombre-solicitante').value.trim();
    const dni = document.getElementById('dni-solicitante').value.trim();
    const correo = document.getElementById('correo-solicitante').value.trim(); 
    
    // Validación de campos vacíos
    if (!tramite || !fecha || !horario || !nombre || !dni || !correo) {
        mostrarMensaje('mensaje-error', 'Por favor, complete todos los campos, incluido el correo electrónico.', true);
        return;
    }
    
    if (!confirm(`¿Confirma el turno para el día ${fecha} a las ${horario}? Se enviará el comprobante a ${correo}`)) {
        return;
    }

    // Deshabilitar botón para evitar múltiples clics
    botonSolicitar.disabled = true;
    botonSolicitar.textContent = "Procesando...";

    const nuevoTurnoData = {
        fecha: fecha,
        horario: horario,
        tramite: tramite,
        nombre: nombre,
        dni: dni,
        correo: correo, 
        registradoEn: new Date().toLocaleString('es-AR'),
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    };
    
    try {
        // GUARDADO EN FIRESTORE
        await coleccionTurnos.add(nuevoTurnoData);
        
        mostrarMensaje('mensaje-exito', `✅ Turno Confirmado. Verifique su correo electrónico: ${correo}`, true);
        
        // Resetear formulario
        document.getElementById('formulario-turnos').reset(); 
        generarHorariosDisponibles(''); 
        
    } catch (error) {
        mostrarMensaje('mensaje-error', 'Error al guardar el turno. Verifique su conexión o las reglas de la base de datos.', true);
        console.error("Error Firestore:", error);
    } finally {
        botonSolicitar.disabled = false;
        botonSolicitar.textContent = "Solicitar Turno";
    }
}

// ====================================================================
// 8. CONTROL DE RUTAS E INICIO (Admin vs Index)
// ====================================================================

if (esAdmin) {
    // LÓGICA DEL PANEL ADMINISTRADOR
    const PIN_CORRECTO = "1234"; 
    const areaLogin = document.getElementById('area-login');
    const dashboardContenido = document.getElementById('dashboard-contenido');
    const btnLogin = document.getElementById('btn-login');
    const inputPin = document.getElementById('admin-pin');

    const iniciarDashboard = () => { 
        const inputFiltroFecha = document.getElementById('filtro-fecha');
        const hoy = new Date().toISOString().split('T')[0];
        
        inputFiltroFecha.value = hoy;
        document.getElementById('fecha-hoy').textContent = `Turnos del: ${hoy}`;

        inputFiltroFecha.addEventListener('change', () => {
            dibujarTablaAdmin(inputFiltroFecha.value);
            document.getElementById('fecha-hoy').textContent = `Turnos del: ${inputFiltroFecha.value}`;
        });
        
        iniciarListenerTurnos(() => dibujarTablaAdmin(inputFiltroFecha.value));
    };

    const checkSession = () => {
        if (localStorage.getItem(ADMIN_SESSION_TOKEN) === 'active') {
            areaLogin.style.display = 'none';
            dashboardContenido.style.display = 'block';
            iniciarDashboard(); 
        } else {
            areaLogin.style.display = 'block';
            dashboardContenido.style.display = 'none';
        }
    };

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            if (inputPin.value.trim() === PIN_CORRECTO) { 
                localStorage.setItem(ADMIN_SESSION_TOKEN, 'active');
                checkSession(); 
            } else {
                alert("PIN Incorrecto");
            }
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            localStorage.removeItem(ADMIN_SESSION_TOKEN);
            location.reload();
        });
    }

    checkSession();
    
} else {
    // LÓGICA DEL FORMULARIO CIUDADANO
    if (inputFecha) { 
        iniciarListenerTurnos(() => {
            generarHorariosDisponibles(inputFecha.value);
        });
        
        inputFecha.addEventListener('change', () => {
            generarHorariosDisponibles(inputFecha.value);
        });

        botonSolicitar.addEventListener('click', procesarSolicitudDeTurno);

        // Validación dinámica de campos para habilitar botón
        document.querySelectorAll('#formulario-turnos input, #formulario-turnos select').forEach(element => {
            element.addEventListener('input', () => {
                const formLleno = [...document.querySelectorAll('#formulario-turnos input, #formulario-turnos select')].every(i => i.value.trim() !== "");
                botonSolicitar.disabled = !formLleno;
            });
        });
    }
}