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
  nombre: 'VibraContexto',

  // Se muestra chiquito junto al nombre. Déjalo vacío ('') para ocultarlo.
  version: 'v0.1',

  // Una línea. Es lo primero que lee un juez, que sea concreta.
  tagline: 'El sonido del cuarto, traducido a piel.',

  // Párrafo del hero. Dos o tres frases máximo.
  descripcion:
    'Las alertas para personas sordas vibran igual para un portazo que para una alarma de incendio. ' +
    'Aquí cada tipo de sonido tiene su propio patrón de vibración, así que se distingue qué pasó sin ver la pantalla.',

  // Aparece en el <meta description> y cuando se comparte el link.
  descripcionCorta:
    'Traduce el sonido del entorno en patrones de vibración distinguibles, con Gemma 4 corriendo local.',

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

  // ── Backend ─────────────────────────────────────────────────────────────
  api: {
    // Endpoint del agente 2.
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

  // El nombre también vive fuera del <body>.
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = CONFIG.descripcionCorta;
  if (document.title.includes('{{nombre}}')) {
    document.title = document.title.replace('{{nombre}}', CONFIG.nombre);
  }

  // La versión se esconde sola si está vacía.
  if (!CONFIG.version) {
    document.querySelectorAll('[data-cfg="version"]').forEach((el) => el.remove());
  }
}

document.addEventListener('DOMContentLoaded', () => aplicarConfig());
