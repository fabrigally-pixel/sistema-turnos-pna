// script.js

console.log("Sistema de Turnos PNA Paraná JS cargado. (Firebase ON)");

// 1. CONFIGURACIÓN DE FIREBASE Y BASE DE DATOS (Firestore)
const firebaseConfig = {
    // 🔑 TUS CLAVES PROPORCIONADAS 🔑
    apiKey: "AIzaSyAHMs2qHywQJaFurCiwnCQIVH8QJawwVkE", 
    authDomain: "turnospnaparana.firebaseapp.com",
    projectId: "turnospnaparana",
    storageBucket: "turnospnaparana.firebasestorage.app",
    messagingSenderId: "108098927642",
    appId: "1:108098927642:web:0b40d23a4aebafc40a25a3"
};

// Inicializa Firebase (usando el formato de SDK CDN)
if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

// Referencia global a la Base de Datos y la Colección
const db = firebase.firestore();
const coleccionTurnos = db.collection('turnosPNA');


// 2. DEFINICIÓN DE HORARIOS y LÍMITES
const HORA_INICIO = 7; 
const HORA_FIN = 13; 
const INTERVALO_MINUTOS = 15; 

// 3. Caché local para la disponibilidad (se llena desde Firebase)
let turnosTomados = []; 

// 4. Obtener referencias del DOM (válido para index.html)
const inputFecha = document.getElementById('fecha-turno');
const selectHorario = document.getElementById('horario-turno');
const botonSolicitar = document.getElementById('boton-solicitar');

// 5. Determinar la ruta
const esAdmin = window.location.pathname.includes('admin.html');


// --- FUNCIONES DE UTILIDAD Y PERSISTENCIA ---

function mostrarMensaje(id, texto, mostrar) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = texto;
        elemento.style.display = mostrar ? 'block' : 'none';
        
        const otroId = (id === 'mensaje-error') ? 'mensaje-exito' : 'mensaje-error';
        const otroElemento = document.getElementById(otroId);
        if(otroElemento) {
            otroElemento.style.display = 'none';
        }
    }
}


// --- FUNCIONES DE ADMINISTRACIÓN (admin.html) ---

function dibujarTablaAdmin(fechaFiltro) {
    const contenedorTabla = document.getElementById('contenedor-tabla');
    const totalTurnosElemento = document.getElementById('total-turnos');
    
    if (!contenedorTabla || !totalTurnosElemento) return;

    // Filtra y ordena los turnos desde el caché (cargado de Firestore)
    const turnosFiltrados = turnosTomados
        .filter(turno => !fechaFiltro || turno.fecha === fechaFiltro)
        .sort((a, b) => {
            return a.horario.localeCompare(b.horario);
        });

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
        // Intenta obtener el nombre completo del trámite (si está disponible en el DOM)
        let nombreTramite = turno.tramite; 
        try {
            const selectElement = document.getElementById('tipo-tramite');
            if (selectElement) {
                nombreTramite = selectElement.querySelector(`option[value="${turno.tramite}"]`).textContent;
            } else {
                // Si no está el select (estamos en admin), formatea el valor guardado
                nombreTramite = turno.tramite.replace(/_/g, ' ').toUpperCase(); 
            }
        } catch (e) {
            nombreTramite = turno.tramite; // Si falla, usa el valor crudo
        }

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
    
    document.querySelectorAll('.btn-eliminar-admin').forEach(button => {
        button.addEventListener('click', manejarEliminacionAdmin);
    });
}


// 💡 FUNCIÓN ASÍNCRONA DE ELIMINACIÓN: Usa Firestore
async function manejarEliminacionAdmin(event) {
    const idAEliminar = event.target.dataset.id; 
    
    if (confirm("¿Confirma que este turno ha sido ATENDIDO o debe ser ELIMINADO de la Base de Datos?")) {
        try {
            await coleccionTurnos.doc(idAEliminar).delete();
            
            await cargarTurnos(); 
            
            const filtroFecha = document.getElementById('filtro-fecha').value;
            dibujarTablaAdmin(filtroFecha);
            
            if (inputFecha) { 
                generarHorariosDisponibles(inputFecha.value);
            }
            
        } catch (error) {
            console.error("Error al eliminar el turno:", error);
        }
    }
}


// 💡 FUNCIÓN ASÍNCRONA DE CARGA: Usa Firestore
async function cargarTurnos() {
    try {
        const snapshot = await coleccionTurnos.get();
        
        turnosTomados = snapshot.docs.map(doc => ({
            id: doc.id, 
            ...doc.data() 
        }));
        
        console.log(`Turnos cargados desde Firestore: ${turnosTomados.length}`);
        
    } catch (error) {
        console.error("Error al cargar turnos desde Firestore:", error);
    }
}


// --- FUNCIÓN CLAVE: GENERACIÓN DE HORARIOS (index.html) ---

function generarHorariosDisponibles(fechaSeleccionada) {
    if (!selectHorario) return; 
    
    selectHorario.innerHTML = '<option value="">-- Seleccione un Horario --</option>';
    selectHorario.disabled = true;
    
    if (!fechaSeleccionada) return; 
    
    const fechaSeleccionadaUTC = fechaSeleccionada + 'T00:00:00'; 
    const diaDeLaSemana = new Date(fechaSeleccionadaUTC).getDay();
    
    if (diaDeLaSemana === 0 || diaDeLaSemana === 6) {
        selectHorario.innerHTML = '<option value="">Día no hábil (Sábados y Domingos)</option>';
        mostrarMensaje('mensaje-error', 'La oficina atiende únicamente de Lunes a Viernes.', true);
        return;
    }
    
    const hoy = new Date();
    const fechaTurnoObj = new Date(fechaSeleccionadaUTC); 
    const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    
    if (fechaTurnoObj < hoyMedianoche) {
        selectHorario.innerHTML = '<option value="">Fecha pasada</option>';
        mostrarMensaje('mensaje-error', 'No puede solicitar turnos para fechas pasadas.', true);
        return;
    }

    mostrarMensaje('mensaje-error', '', false);
    
    let horaActual = HORA_INICIO; 
    let minutosActuales = 0;
    let hayTurnosDisponibles = false;
    
    while (horaActual < HORA_FIN || (horaActual === HORA_FIN && minutosActuales === 0)) {
        
        const horaFormateada = String(horaActual).padStart(2, '0');
        const minutosFormateados = String(minutosActuales).padStart(2, '0');
        const horario = `${horaFormateada}:${minutosFormateados}`; 
        
        const turnoYaTomado = turnosTomados.some(turno => 
            turno.fecha === fechaSeleccionada && turno.horario === horario
        );
        
        if (!turnoYaTomado) {
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

        if (horaActual > HORA_FIN) {
            break; 
        }
    }
    
    if (hayTurnosDisponibles) {
        selectHorario.disabled = false;
        mostrarMensaje('mensaje-error', '', false);
    } else { 
        selectHorario.innerHTML = '<option value="">No hay turnos disponibles para este día</option>';
        mostrarMensaje('mensaje-error', 'Todos los turnos entre 07:00 y 13:00 han sido tomados.', true);
    }
    
    if (botonSolicitar) botonSolicitar.disabled = true;
}


// --- LÓGICA DE SOLICITUD DE TURNO (index.html) ---

async function procesarSolicitudDeTurno() {
    const tramite = document.getElementById('tipo-tramite').value;
    const fecha = inputFecha.value;
    const horario = selectHorario.value;
    const nombre = document.getElementById('nombre-solicitante').value.trim();
    const dni = document.getElementById('dni-solicitante').value.trim();
    const correo = document.getElementById('correo-solicitante').value.trim(); // 🔑 CAPTURAMOS EL NUEVO CAMPO CORREO 🔑
    
    if (!tramite || !fecha || !horario || !nombre || !dni || !correo) { // 🔑 VERIFICAMOS QUE CORREO NO ESTÉ VACÍO 🔑
        mostrarMensaje('mensaje-error', 'Por favor, complete todos los campos del formulario.', true);
        return;
    }
    
    const nombreTramite = document.querySelector(`#tipo-tramite option[value="${tramite}"]`).textContent;

    if (!confirm(`Confirma el turno para el trámite: ${nombreTramite} el día ${fecha} a las ${horario}? Se enviará una confirmación a: ${correo}`)) {
        return;
    }

    const nuevoTurnoData = {
        fecha: fecha,
        horario: horario,
        tramite: tramite,
        nombre: nombre,
        dni: dni,
        correo: correo, // 🔑 ENVIAMOS EL CORREO A FIRESTORE 🔑
        registradoEn: new Date().toLocaleString('es-AR')
    };
    
    try {
        await coleccionTurnos.add(nuevoTurnoData);
        
        await cargarTurnos(); 
        
        mostrarMensaje('mensaje-exito', `✅ Turno CONFIRMADO para ${nombre} el ${fecha} a las ${horario}. Se ha enviado la confirmación a ${correo}.`, true);
        
        document.getElementById('formulario-turnos').reset(); 
        generarHorariosDisponibles(''); 
        botonSolicitar.disabled = true;

    } catch (error) {
        mostrarMensaje('mensaje-error', 'Error al guardar el turno en la Base de Datos. Verifique su conexión.', true);
        console.error("Error al guardar en Firestore: ", error);
    }
}


// --- LÓGICA DE INICIO Y RUTAS (Controla index.html vs admin.html) ---

if (esAdmin) {
    // 💡 Lógica de LOGIN SIMPLE (PIN)
    const PIN_CORRECTO = "1234"; // 🔑 PIN DE ACCESO A LA ADMINISTRACIÓN (CÁMBIALO)
    
    const areaLogin = document.getElementById('area-login');
    const dashboardContenido = document.getElementById('dashboard-contenido');
    const btnLogin = document.getElementById('btn-login');
    const inputPin = document.getElementById('admin-pin');
    const errorLogin = document.getElementById('login-error');
    
    // Función de inicialización del Dashboard
    const iniciarDashboard = async () => { 
        const inputFiltroFecha = document.getElementById('filtro-fecha');
        
        const fechaHoy = new Date();
        const fechaHoyString = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, '0')}-${String(fechaHoy.getDate()).padStart(2, '0')}`;
        
        inputFiltroFecha.value = fechaHoyString;
        document.getElementById('fecha-hoy').textContent = `Turnos del: ${fechaHoyString}`;

        inputFiltroFecha.addEventListener('change', () => {
            dibujarTablaAdmin(inputFiltroFecha.value);
            document.getElementById('fecha-hoy').textContent = `Turnos del: ${inputFiltroFecha.value}`;
        });
        
        // Cargar datos ANTES de dibujar la tabla
        await cargarTurnos(); 
        dibujarTablaAdmin(fechaHoyString);
    };


    // Función de Login
    const intentarLogin = () => {
        // CORRECCIÓN CLAVE: Usar .trim() para evitar errores por espacios en blanco.
        if (inputPin.value.trim() === PIN_CORRECTO) { 
            areaLogin.style.display = 'none';
            dashboardContenido.style.display = 'block';
            iniciarDashboard(); // Inicia la carga de datos y el dashboard
        } else {
            errorLogin.textContent = 'PIN incorrecto. Intente de nuevo.';
            errorLogin.style.display = 'block';
            inputPin.value = '';
        }
    };
    
    // Asignación de Eventos
    if (btnLogin && inputPin) {
        btnLogin.addEventListener('click', intentarLogin);
        inputPin.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') intentarLogin();
        });
    }
    
} else {
    // 💡 Lógica para la Vista del Ciudadano (index.html)
    
    if (inputFecha && selectHorario && botonSolicitar) { 
        
        // Cargar los turnos al iniciar la vista del ciudadano
        cargarTurnos(); 
        
        inputFecha.addEventListener('change', () => {
            generarHorariosDisponibles(inputFecha.value);
        });

        selectHorario.addEventListener('change', () => {
            botonSolicitar.disabled = !selectHorario.value; 
            mostrarMensaje('mensaje-error', '', false);
        });

        botonSolicitar.addEventListener('click', procesarSolicitudDeTurno);
    }
}