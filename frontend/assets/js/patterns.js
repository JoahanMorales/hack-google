/**
 * El vocabulario háptico.
 *
 * Cada patrón es un array de milisegundos que alterna VIBRA / SILENCIO,
 * exactamente el formato que espera navigator.vibrate():
 *
 *   [100, 50, 100]  =  vibra 100ms · calla 50ms · vibra 100ms
 *
 * Las categorías son las cuatro del contrato con el backend. Si el agente 3
 * cambia el contrato, este archivo es lo único que se toca del lado del front.
 *
 * Criterio de diseño de los patrones: tienen que distinguirse SIN VERLOS, con
 * el teléfono en el bolsillo. Por eso no varían solo en duración sino en
 * ritmo — pulsos rápidos e iguales para emergencia, dos golpes largos y
 * separados para atención, un tamborileo parejo para lo social.
 */

const CATEGORIAS = {
  alarma: {
    id: 'alarma',
    nombre: 'Alarma',
    descripcion: 'Humo, sirena, algo que exige moverse ya.',
    ejemplos: 'alarma de humo · sirena · claxon insistente',
    color: 'var(--sig-alarma)',
    glifo: '▲',
    // Urgente: pulsos cortos, iguales, repetidos, y un golpe largo que cierra.
    patron: [100, 50, 100, 50, 100, 50, 400],
  },

  // Ojo con estas dos: las descripciones siguen la semántica que definió el
  // agente 3 en gemma/_prompt.py, que es el dueño del contrato. 'atencion' es
  // algo que te reclama directamente; 'social' son voces alrededor.
  atencion: {
    id: 'atencion',
    nombre: 'Te buscan',
    descripcion: 'Algo o alguien te reclama directamente.',
    ejemplos: 'timbre · tocan la puerta · teléfono · tu nombre',
    color: 'var(--sig-atencion)',
    glifo: '◆',
    // Dos golpes medianos separados: se siente como "tap, tap" en el hombro.
    patron: [150, 100, 150],
  },

  social: {
    id: 'social',
    nombre: 'Voces',
    descripcion: 'Hay gente hablando cerca.',
    ejemplos: 'conversación · risas · alguien grita · niños',
    color: 'var(--sig-social)',
    glifo: '●',
    // Tamborileo parejo, reconocible como "hay alguien".
    patron: [80, 80, 80, 80, 80],
  },

  ambiental: {
    id: 'ambiental',
    nombre: 'Ambiente',
    descripcion: 'Ruido de fondo. No interrumpe.',
    ejemplos: 'tráfico · lluvia · conversación lejana',
    color: 'var(--sig-ambiental)',
    glifo: '─',
    // Un solo pulso muy leve. Confirma que el sistema escucha sin molestar.
    // Saturar de vibraciones al usuario es la forma más rápida de que apague
    // la app, así que lo ambiental casi no se siente.
    patron: [40],
  },
};

/** La urgencia no cambia el patrón (eso rompería el reconocimiento): solo
 *  lo intensifica repitiéndolo. El ritmo sigue siendo el mismo. */
const REPETICION_POR_URGENCIA = {
  baja: 1,
  media: 1,
  alta: 2,
};

const ORDEN_CATEGORIAS = ['alarma', 'atencion', 'social', 'ambiental'];

/** Devuelve la categoría, con fallback seguro si el backend manda basura. */
function obtenerCategoria(id) {
  return CATEGORIAS[id] || CATEGORIAS.ambiental;
}

/**
 * Arma el patrón final para un evento, aplicando la urgencia.
 * Al repetir se mete un silencio de 250ms para que se lean como dos ciclos
 * del mismo patrón y no como un patrón nuevo más largo.
 */
function construirPatron(categoriaId, urgencia = 'media') {
  const base = obtenerCategoria(categoriaId).patron;
  const veces = REPETICION_POR_URGENCIA[urgencia] ?? 1;
  if (veces === 1) return [...base];

  const salida = [];
  for (let i = 0; i < veces; i++) {
    if (i > 0) salida.push(250);
    salida.push(...base);
  }
  return salida;
}

/** Duración total del patrón en ms. La usa la partitura y el orbe. */
function duracionPatron(patron) {
  return patron.reduce((suma, ms) => suma + ms, 0);
}

/**
 * Dispara la vibración real. Devuelve false si el navegador no soporta la
 * Vibration API, para que la UI pueda avisar en vez de fallar en silencio.
 *
 * Realidad de soporte: funciona en Chrome/Firefox de Android. iOS Safari NO
 * expone la Vibration API. En la demo hay que usar un Android — en escritorio
 * y en iPhone la partitura y el orbe siguen animando, así que se ve igual
 * aunque no se sienta.
 */
function vibrar(patron) {
  if (!('vibrate' in navigator)) return false;
  try {
    return navigator.vibrate(patron);
  } catch {
    return false;
  }
}

function soportaVibracion() {
  return 'vibrate' in navigator;
}
