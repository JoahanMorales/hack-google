/**
 * Lógica de la app: captura clips, los manda a clasificar, y traduce la
 * respuesta a vibración + orbe + partitura, todo con los mismos tiempos.
 */

const estado = {
  escuchando: false,
  grabador: null,
  pista: null,
  cancelar: false,
  historial: [],
};

let cliente;
let partituraEvento;
let temporizadoresOrbe = [];

// ── Elementos ────────────────────────────────────────────────────────────────
const el = {};

document.addEventListener('DOMContentLoaded', () => {
  [
    'orbe', 'orbe-glifo', 'evento', 'evento-categoria', 'evento-etiqueta',
    'evento-urgencia', 'evento-partitura', 'boton-escuchar',
    'boton-escuchar-texto', 'control-nota', 'historial-lista', 'limpiar',
    'estado-fuente', 'estado-texto', 'anuncio', 'leyenda',
  ].forEach((id) => {
    el[id] = document.getElementById(id);
  });

  construirLeyenda();

  partituraEvento = new PartituraHaptica(el['evento-partitura'], {
    conEtiquetas: false,
    alto: 30,
  });

  cliente = new ClienteClasificacion(CONFIG.api);
  cliente.alCambiarModo = pintarModo;
  pintarModo(cliente.modo);
  cliente.sondear();

  el['boton-escuchar'].addEventListener('click', alternarEscucha);
  el['limpiar'].addEventListener('click', limpiarHistorial);

  if (!soportaVibracion()) {
    nota(
      'Este dispositivo no vibra (iOS no expone la API). Vas a ver el patrón en pantalla.'
    );
  }

  // app.html?demo=1 arranca solo, con eventos simulados y sin pedir micrófono.
  // Sirve para dos cosas: probar el flujo completo de forma automatizada, y
  // tener una demo que no depende del permiso de micrófono ni del ruido de la
  // sala si algo falla enfrente del jurado.
  if (new URLSearchParams(location.search).has('demo')) {
    estado.modoDemo = true;
    iniciarEscucha();
  }
});

function construirLeyenda() {
  ORDEN_CATEGORIAS.forEach((id) => {
    const cat = CATEGORIAS[id];
    const li = document.createElement('li');
    li.className = 'leyenda__item';
    li.dataset.categoria = id;
    li.dataset.activo = 'false';
    li.style.setProperty('--item-color', cat.color);
    li.innerHTML = `<span class="leyenda__glifo" aria-hidden="true">${cat.glifo}</span>`;
    const nombre = document.createElement('span');
    nombre.textContent = cat.nombre;
    li.appendChild(nombre);
    el.leyenda.appendChild(li);
  });
}

function resaltarLeyenda(categoriaId) {
  el.leyenda.querySelectorAll('.leyenda__item').forEach((item) => {
    item.dataset.activo = String(item.dataset.categoria === categoriaId);
  });
}

// ── Encender / apagar ────────────────────────────────────────────────────────

async function alternarEscucha() {
  if (estado.escuchando) detenerEscucha();
  else await iniciarEscucha();
}

async function iniciarEscucha() {
  nota('');
  // En modo demo no se pide micrófono: los eventos vienen del guion simulado.
  const micOk = estado.modoDemo ? false : await pedirMicrofono();

  // Si no hay micrófono pero el mock está activo, la demo sigue: es preferible
  // a una pantalla muerta enfrente de un juez.
  if (!micOk && !CONFIG.api.usarMock) return;

  estado.escuchando = true;
  estado.cancelar = false;
  el['boton-escuchar'].dataset.activo = 'true';
  el['boton-escuchar-texto'].textContent = 'Dejar de escuchar';
  el.orbe.dataset.estado = 'escuchando';

  if (!micOk) {
    nota(
      estado.modoDemo
        ? 'Modo demo: eventos simulados, sin micrófono.'
        : 'Sin micrófono: corriendo con eventos simulados.'
    );
  }

  bucleDeEscucha();
}

function detenerEscucha() {
  estado.escuchando = false;
  estado.cancelar = true;

  if (estado.grabador && estado.grabador.state !== 'inactive') {
    estado.grabador.stop();
  }
  if (estado.pista) {
    estado.pista.getTracks().forEach((t) => t.stop());
    estado.pista = null;
  }

  el['boton-escuchar'].dataset.activo = 'false';
  el['boton-escuchar-texto'].textContent = 'Empezar a escuchar';
  el.orbe.dataset.estado = 'dormido';
  vibrar(0); // cortar cualquier vibración en curso
}

async function pedirMicrofono() {
  // getUserMedia exige contexto seguro. Con file:// no existe siquiera.
  if (!navigator.mediaDevices?.getUserMedia) {
    nota(
      'El micrófono necesita HTTPS o localhost. Abre la página desde un servidor, no como archivo.',
      'error'
    );
    return false;
  }

  try {
    estado.pista = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false, // queremos el ruido del cuarto, no limpiarlo
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
    return true;
  } catch (error) {
    const mensaje =
      error.name === 'NotAllowedError'
        ? 'Permiso de micrófono denegado. Actívalo en el candado de la barra de direcciones.'
        : 'No se encontró micrófono en este dispositivo.';
    nota(mensaje, 'error');
    return false;
  }
}

/** Graba un clip, lo manda, espera, y repite mientras siga encendido. */
async function bucleDeEscucha() {
  while (estado.escuchando && !estado.cancelar) {
    try {
      const audio = estado.pista ? await grabarClip() : '';
      if (!estado.escuchando) break;

      const resultado = await cliente.clasificar(audio);
      if (!estado.escuchando) break;

      mostrarEvento(resultado);
    } catch (error) {
      nota(`Se perdió un clip: ${error.message}`, 'error');
    }

    await esperar(CONFIG.audio.pausaEntreClipsMs);
  }
}

function grabarClip() {
  return new Promise((resolve, reject) => {
    const trozos = [];
    let grabador;
    try {
      grabador = new MediaRecorder(estado.pista);
    } catch {
      reject(new Error('MediaRecorder no soportado'));
      return;
    }
    estado.grabador = grabador;

    grabador.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.push(e.data);
    };

    grabador.onstop = async () => {
      try {
        const blob = new Blob(trozos, { type: grabador.mimeType });
        resolve(await blobABase64(blob));
      } catch (error) {
        reject(error);
      }
    };

    grabador.onerror = () => reject(new Error('falló la grabación'));

    grabador.start();
    setTimeout(() => {
      if (grabador.state !== 'inactive') grabador.stop();
    }, CONFIG.audio.duracionClipMs);
  });
}

function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    // Se manda solo la carga útil, sin el prefijo data:audio/webm;base64,
    lector.onloadend = () => resolve(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => reject(new Error('no se pudo leer el audio'));
    lector.readAsDataURL(blob);
  });
}

// ── Pintar el evento ─────────────────────────────────────────────────────────

function mostrarEvento(resultado) {
  const cat = obtenerCategoria(resultado.categoria);
  const patron = construirPatron(resultado.categoria, resultado.urgencia);

  // Todo el color de la pantalla sale de esta variable.
  document.body.style.setProperty('--activo', cat.color);

  el.evento.dataset.vacio = 'false';
  el['evento-categoria'].textContent = cat.nombre;
  el['evento-etiqueta'].textContent = resultado.etiqueta;
  el['evento-urgencia'].textContent = `urgencia ${resultado.urgencia}`;

  el['orbe-glifo'].textContent = cat.glifo;
  el['orbe-glifo'].classList.add('visible');
  resaltarLeyenda(cat.id);

  // Reiniciar la animación de entrada.
  el.evento.classList.remove('entrando');
  void el.evento.offsetWidth;
  el.evento.classList.add('entrando');

  partituraEvento.dibujar(patron, cat.color);
  partituraEvento.reproducir();

  vibrar(patron);
  pulsarOrbe(patron);

  agregarAlHistorial(resultado, cat);

  // Para quien no ve la pantalla, esto es la única salida del evento.
  el.anuncio.textContent = `${cat.nombre}. ${resultado.etiqueta}. Urgencia ${resultado.urgencia}.`;
}

/**
 * Enciende y apaga el orbe con los mismos milisegundos del patrón de
 * vibración. Es literalmente el mismo array que recibe navigator.vibrate(),
 * por eso van en sync exacto y no "parecido".
 */
function pulsarOrbe(patron) {
  temporizadoresOrbe.forEach(clearTimeout);
  temporizadoresOrbe = [];
  el.orbe.classList.remove('pulsando');

  let t = 0;
  patron.forEach((ms, i) => {
    if (i % 2 === 0) {
      const inicio = t;
      temporizadoresOrbe.push(
        setTimeout(() => el.orbe.classList.add('pulsando'), inicio),
        setTimeout(() => el.orbe.classList.remove('pulsando'), inicio + ms)
      );
    }
    t += ms;
  });
}

function agregarAlHistorial(resultado, cat) {
  estado.historial.unshift({ ...resultado, hora: new Date() });
  estado.historial = estado.historial.slice(0, 40);
  pintarHistorial();
}

function pintarHistorial() {
  const lista = el['historial-lista'];
  if (estado.historial.length === 0) {
    lista.innerHTML =
      '<li class="historial__vacio">Los eventos aparecen aquí conforme se detectan.</li>';
    return;
  }

  lista.innerHTML = '';
  estado.historial.forEach((ev) => {
    const cat = obtenerCategoria(ev.categoria);
    const li = document.createElement('li');
    li.className = 'fila';
    li.dataset.urgencia = ev.urgencia;
    li.style.setProperty('--fila-color', cat.color);
    li.innerHTML = `
      <span class="fila__glifo" aria-hidden="true">${cat.glifo}</span>
      <span class="fila__texto">
        <span class="fila__etiqueta"></span>
        <span class="fila__categoria">${cat.nombre} · ${ev.urgencia}</span>
      </span>
      <span class="fila__hora">${ev.hora.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}</span>
    `;
    // textContent y no innerHTML: la etiqueta viene de Gemma, no se inyecta
    // como HTML aunque el modelo devuelva algo raro.
    li.querySelector('.fila__etiqueta').textContent = ev.etiqueta;
    lista.appendChild(li);
  });
}

function limpiarHistorial() {
  estado.historial = [];
  pintarHistorial();
}

// ── Utilidades de UI ─────────────────────────────────────────────────────────

function pintarModo(modo) {
  el['estado-fuente'].dataset.modo = modo;
  el['estado-texto'].textContent = modo;
}

function nota(texto, tipo = '') {
  el['control-nota'].textContent = texto;
  el['control-nota'].dataset.tipo = tipo;
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
