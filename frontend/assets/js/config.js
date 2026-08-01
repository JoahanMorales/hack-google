/**
 * ─────────────────────────────────────────────────────────────────────────
 *  EL ÚNICO ARCHIVO QUE HAY QUE TOCAR PARA CAMBIARLE EL NOMBRE AL PROYECTO
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Cambia NOMBRE aquí abajo y se actualiza solo en TODOS lados: el <title>,
 *  el header, el hero, el footer, la pantalla de la app y los metadatos.
 *  No hay ni un solo nombre hardcodeado en el HTML.
 *
 *  Funciona así: cualquier elemento con data-cfg="ruta.a.la.llave" recibe
 *  su texto de este objeto al cargar la página (ver aplicarConfig() abajo).
 */

const CONFIG = {
  // ── Identidad ───────────────────────────────────────────────────────────
  // Cambia esto y ya. Lo demás se acomoda solo.
  nombre: 'Coralia',

  // Se muestra chiquito junto al nombre. Déjalo vacío ('') para ocultarlo.
  version: '',

  // Una línea. Es lo primero que lee un juez, que sea concreta.
  tagline: 'Siente tu espacio.',

  // Párrafo del hero. Dos o tres frases máximo.
  descripcion:
    'Coralia traduce el sonido del entorno en vibraciones distintivas, para que ' +
    'las personas sordas sepan qué está pasando a su alrededor en tiempo real. ' +
    'Gemma 4 escucha e interpreta el audio.',

  // Aparece en el <meta description> y cuando se comparte el link.
  descripcionCorta:
    'Traduce el sonido del entorno en vibraciones distintivas para personas sordas, con Gemma 4 interpretando el audio.',

  // ── Créditos ────────────────────────────────────────────────────────────
  equipo: 'Hackday Gemma 4 · GDG CDMX',
  modelo: 'Gemma 4 · e2b-it-qat · on-device',

  // ── Comportamiento de la captura ────────────────────────────────────────
  audio: {
    // Duración de cada clip que se manda a clasificar.
    duracionClipMs: 3500,
    // Pausa entre clips, para no saturar la Jetson (es un solo dispositivo).
    pausaEntreClipsMs: 600,
  },

  // ── Detección de nombre ─────────────────────────────────────────────────
  // Corre en el navegador con la Web Speech API, en paralelo a Gemma. No es
  // otro modelo que descargar: Chrome ya lo trae. Se usa SOLO para esto —
  // reconocer una palabra — porque para eso no hace falta un LLM y así el
  // aviso es instantáneo en vez de esperar el ciclo de 3.5s del clip.
  nombreUsuario: {
    // Se puede dejar vacío: la app pide el nombre en pantalla y lo guarda en
    // el navegador. Esto es solo el valor por defecto.
    valor: '',
    activo: true,
  },

  // ── Backend ─────────────────────────────────────────────────────────────
  api: {
    // Endpoint de clasificación del backend.
    //   · Ruta relativa ('/clasificar') si el backend sirve también estos
    //     archivos estáticos — es lo que queremos para la demo final, porque
    //     así funciona igual detrás del túnel sin tocar nada.
    //   · URL absoluta ('http://localhost:8100/clasificar') mientras
    //     desarrollan por separado. En ese caso el backend necesita CORS.
    endpoint: '/clasificar',
    // En true la UI corre con datos simulados, sin backend. Se apaga solo
    // en cuanto el endpoint real responde (ver api.js).
    usarMock: true,
    // Si el backend tarda más que esto, se cancela y se avisa en pantalla.
    timeoutMs: 20000,
  },

  // ── Hero en ASCII ───────────────────────────────────────────────────────
  ascii: {
    // Dejen su video aquí y el hero lo renderiza en ASCII automáticamente.
    // Si el archivo no existe, corre una animación generativa de respaldo
    // para que el hero nunca se vea vacío. Ver ascii-video.js.
    fuenteVideo: 'assets/media/hero.mp4',
    // Ancho en caracteres. Más alto = más detalle y más costo de CPU.
    columnas: 150,
    fps: 24,
  },
};

/**
 * Recorre el DOM y rellena todo lo marcado con data-cfg.
 * Soporta rutas anidadas: data-cfg="audio.duracionClipMs".
 */
function aplicarConfig(raiz = document) {
  const leer = (ruta) =>
    ruta.split('.').reduce((obj, llave) => (obj == null ? obj : obj[llave]), CONFIG);

  raiz.querySelectorAll('[data-cfg]').forEach((el) => {
    const valor = leer(el.dataset.cfg);
    if (valor != null) el.textContent = valor;
  });

  // El <title> y el meta llevan el texto correcto ya escrito en el HTML, para
  // que quien comparta el link no vea un placeholder en la vista previa. Aquí
  // se sobreescriben con la config, que sigue siendo la fuente de verdad.
  const sufijo = document.body.dataset.tituloSufijo;
  document.title = sufijo ? `${CONFIG.nombre} · ${sufijo}` : CONFIG.nombre;

  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = CONFIG.descripcionCorta;

  // La versión se esconde sola si está vacía.
  if (!CONFIG.version) {
    document.querySelectorAll('[data-cfg="version"]').forEach((el) => el.remove());
  }
}

document.addEventListener('DOMContentLoaded', () => aplicarConfig());
