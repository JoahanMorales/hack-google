/**
 * Detección del nombre propio, en el navegador.
 *
 * Usa la Web Speech API, que Chrome ya trae integrada: cero modelo que
 * descargar, cero dependencias, y avisa en cuanto se dice la palabra en vez
 * de esperar el ciclo de 3.5 s del clip que va a Gemma.
 *
 * Por qué no un LLM para esto: reconocer una palabra no necesita uno, y la
 * latencia importa. Si alguien te llama por tu nombre, enterarte cuatro
 * segundos después ya no sirve de nada.
 *
 * Aviso honesto para el pitch: el reconocimiento de Chrome procesa el audio
 * en servidores de Google, así que ESTA parte no es on-device. Gemma sí corre
 * local. Si un juez pregunta por privacidad, la respuesta es que la
 * clasificación del entorno —lo que pasa todo el tiempo— nunca sale del
 * dispositivo, y que esta función es opcional y se puede apagar.
 *
 * Soporte real: Chrome de escritorio y Android. Firefox y iOS Safari no la
 * exponen; ahí la app sigue funcionando, solo sin esta función.
 */

class DetectorDeNombre {
  /**
   * @param {function(string):void} alEscuchar  recibe la frase donde apareció
   */
  constructor(alEscuchar) {
    this.alEscuchar = alEscuchar;
    this.nombre = '';
    this.corriendo = false;
    this.ultimaDeteccion = 0;
    this.reconocedor = null;
  }

  static soportado() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  definirNombre(nombre) {
    this.nombre = normalizar(nombre);
  }

  iniciar() {
    if (!DetectorDeNombre.soportado() || this.corriendo) return false;

    const Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Reconocedor();
    r.lang = 'es-MX';
    r.continuous = true;
    // Con resultados parciales el aviso llega apenas se dice la palabra, sin
    // esperar a que la frase termine.
    r.interimResults = true;
    r.maxAlternatives = 3;

    r.onresult = (evento) => this._revisar(evento);

    r.onerror = (evento) => {
      // 'no-speech' y 'aborted' son ruido normal, no vale la pena reportarlos.
      if (evento.error !== 'no-speech' && evento.error !== 'aborted') {
        console.warn('detección de nombre:', evento.error);
      }
    };

    // El reconocedor se detiene solo cada tanto (silencio, límite interno).
    // Se relanza mientras siga encendido, si no la función muere en silencio
    // a los pocos minutos.
    r.onend = () => {
      if (this.corriendo) {
        try {
          r.start();
        } catch {
          /* ya estaba arrancando, no pasa nada */
        }
      }
    };

    this.reconocedor = r;
    this.corriendo = true;
    try {
      r.start();
      return true;
    } catch {
      this.corriendo = false;
      return false;
    }
  }

  detener() {
    this.corriendo = false;
    if (this.reconocedor) {
      try {
        this.reconocedor.stop();
      } catch {
        /* ya estaba detenido */
      }
    }
  }

  _revisar(evento) {
    if (!this.nombre) return;

    for (let i = evento.resultIndex; i < evento.results.length; i++) {
      const resultado = evento.results[i];
      for (let j = 0; j < resultado.length; j++) {
        const texto = normalizar(resultado[j].transcript);
        if (!contienePalabra(texto, this.nombre)) continue;

        // Anti-rebote: los resultados parciales repiten la misma frase varias
        // veces mientras se habla, y sin esto vibraría en ráfaga.
        const ahora = Date.now();
        if (ahora - this.ultimaDeteccion < 3000) return;
        this.ultimaDeteccion = ahora;

        this.alEscuchar(resultado[j].transcript.trim());
        return;
      }
    }
  }
}

/** Minúsculas y sin acentos: "Joahan" y "joahán" tienen que coincidir. */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    // Rango de diacríticos combinantes, escrito con escapes para que no
    // dependa de cómo se guarde este archivo.
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Busca el nombre como palabra completa, no como subcadena: si el nombre es
 * "Ana", no debe dispararse con "mañana" ni con "ananá".
 */
function contienePalabra(texto, palabra) {
  if (!palabra) return false;
  return texto
    .split(/[^a-z0-9]+/)
    .some((token) => token === palabra);
}
