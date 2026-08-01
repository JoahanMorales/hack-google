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
        resolve(await blobAWavBase64(blob));
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

/**
 * Convierte el blob de MediaRecorder (webm/opus) a WAV PCM 16 bit mono a
 * 16 kHz, en base64 y sin el prefijo data:.
 *
 * ¿Por qué no mandar el webm tal cual? Porque el backend tendría que
 * transcodificar con ffmpeg antes de poder tocar las muestras, y eso es una
 * dependencia de sistema más que puede faltar justo el día de la demo. El
 * navegador ya trae el decodificador, así que sale gratis hacerlo aquí.
 *
 * 16 kHz mono es el estándar de facto para modelos de audio y deja el clip en
 * ~110 KB por 3.5 s, que viaja bien por el túnel.
 */
async function blobAWavBase64(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const muestras = remuestrearAMono(buffer, 16000);
    return arrayBufferABase64(codificarWav(muestras, 16000));
  } finally {
    ctx.close();
  }
}

/** Mezcla a mono y remuestrea por interpolación lineal. */
function remuestrearAMono(buffer, srDestino) {
  const canales = buffer.numberOfChannels;
  const origen = buffer.getChannelData(0);
  const largoDestino = Math.round((origen.length * srDestino) / buffer.sampleRate);
  const salida = new Float32Array(largoDestino);
  const razon = origen.length / largoDestino;

  for (let i = 0; i < largoDestino; i++) {
    const pos = i * razon;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, origen.length - 1);
    const frac = pos - i0;

    let v = origen[i0] * (1 - frac) + origen[i1] * frac;
    // Promediar el resto de canales si el micrófono entregó estéreo.
    for (let c = 1; c < canales; c++) {
      const otro = buffer.getChannelData(c);
      v += otro[i0] * (1 - frac) + otro[i1] * frac;
    }
    salida[i] = v / canales;
  }
  return salida;
}

/** Empaqueta Float32 [-1,1] como WAV PCM 16 bit. */
function codificarWav(muestras, sampleRate) {
  const buffer = new ArrayBuffer(44 + muestras.length * 2);
  const vista = new DataView(buffer);
  const texto = (offset, s) => {
    for (let i = 0; i < s.length; i++) vista.setUint8(offset + i, s.charCodeAt(i));
  };

  texto(0, 'RIFF');
  vista.setUint32(4, 36 + muestras.length * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  vista.setUint32(16, 16, true); // tamaño del bloque fmt
  vista.setUint16(20, 1, true); // PCM sin comprimir
  vista.setUint16(22, 1, true); // mono
  vista.setUint32(24, sampleRate, true);
  vista.setUint32(28, sampleRate * 2, true); // bytes por segundo
  vista.setUint16(32, 2, true); // alineación de bloque
  vista.setUint16(34, 16, true); // bits por muestra
  texto(36, 'data');
  vista.setUint32(40, muestras.length * 2, true);

  let offset = 44;
  for (let i = 0; i < muestras.length; i++) {
    const s = Math.max(-1, Math.min(1, muestras[i]));
    vista.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function arrayBufferABase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = '';
  // Por trozos: pasar cientos de miles de argumentos a fromCharCode revienta
  // la pila de llamadas.
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + trozo));
  }
  return btoa(binario);
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
  // Una respuesta degradada tiene la forma del contrato pero no es una
  // clasificación real. Decirlo en pantalla en vez de fingir que el sistema
  // detectó "ambiente": si Gemma se cayó, el usuario tiene que saber que
  // dejó de oír, no creer que hay silencio.
  el['evento-urgencia'].textContent = resultado.degradado
    ? 'sin clasificar · el backend no pudo oír'
    : `urgencia ${resultado.urgencia}`;
  el['evento-urgencia'].dataset.degradado = String(Boolean(resultado.degradado));

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
