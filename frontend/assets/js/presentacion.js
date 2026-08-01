/**
 * PLAN B PARA EL ESCENARIO.
 *
 * La vibración puede no ocurrir por muchas razones fuera de nuestro control:
 * iOS no tiene la API, en escritorio existe pero no hace nada, y en Android
 * el modo silencio o la opción "vibración al tocar" apagada la suprimen.
 *
 * Así que el patrón se emite por TRES canales a la vez, todos alimentados por
 * el mismo array de milisegundos que recibe navigator.vibrate():
 *
 *   1. vibración   — lo real, cuando el dispositivo puede
 *   2. destello    — la pantalla pulsa con el patrón; se ve desde el fondo
 *                    del salón y funciona hasta proyectada
 *   3. zumbido     — un tono grave con el mismo ritmo, para que un jurado
 *                    oyente perciba la diferencia entre los cuatro patrones
 *
 * El punto de la demo es "estos patrones se distinguen entre sí". Eso se
 * puede demostrar viéndolos y oyéndolos, aunque nada vibre.
 */

class ModoPresentacion {
  constructor(destello) {
    this.destello = destello;
    this.conDestello = true;
    this.conSonido = false; // se enciende a mano: en una sala ruidosa estorba
    this.temporizadores = [];
    this.ctx = null;
  }

  /**
   * Emite el patrón por los canales activos.
   * @param {number[]} patron  alterna [vibra, calla, vibra, ...]
   * @param {string} color     el color de la categoría, para el destello
   */
  emitir(patron, color) {
    this.detener();
    if (this.conDestello) this._destellar(patron, color);
    if (this.conSonido) this._zumbar(patron);
  }

  detener() {
    this.temporizadores.forEach(clearTimeout);
    this.temporizadores = [];
    if (this.destello) this.destello.classList.remove('activo');
  }

  _destellar(patron, color) {
    if (!this.destello) return;
    this.destello.style.setProperty('--destello-color', color);

    let t = 0;
    patron.forEach((ms, i) => {
      if (i % 2 === 0) {
        const inicio = t;
        this.temporizadores.push(
          setTimeout(() => this.destello.classList.add('activo'), inicio),
          setTimeout(() => this.destello.classList.remove('activo'), inicio + ms)
        );
      }
      t += ms;
    });
  }

  /**
   * Tono grave con el ritmo del patrón. 90 Hz suena a zumbido de motor de
   * vibración, no a alarma de microondas: la idea es que se perciba como el
   * mismo fenómeno, no como un pitido nuevo.
   */
  _zumbar(patron) {
    try {
      // El AudioContext se crea al primer uso: si se crea antes de que la
      // persona toque algo, el navegador lo deja suspendido.
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      return;
    }

    const ahora = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const ganancia = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 90;
    ganancia.gain.setValueAtTime(0, ahora);

    let t = 0;
    patron.forEach((ms, i) => {
      const inicio = ahora + t / 1000;
      const fin = inicio + ms / 1000;
      if (i % 2 === 0) {
        // Rampas cortas en vez de cortes secos: un corte instantáneo produce
        // un chasquido audible que ensucia el patrón.
        ganancia.gain.setTargetAtTime(0.28, inicio, 0.008);
        ganancia.gain.setTargetAtTime(0, fin - 0.01, 0.008);
      }
      t += ms;
    });

    const total = patron.reduce((s, ms) => s + ms, 0) / 1000;
    osc.connect(ganancia).connect(this.ctx.destination);
    osc.start(ahora);
    osc.stop(ahora + total + 0.1);
  }
}

/**
 * Intenta vibrar y reporta si el navegador siquiera lo aceptó.
 *
 * OJO: que devuelva true NO garantiza que el teléfono se haya movido. La API
 * no tiene forma de confirmarlo — en escritorio devuelve true y no pasa nada.
 * Por eso la única prueba válida es que una persona lo sienta.
 */
function intentarVibrar(patron) {
  if (!('vibrate' in navigator)) return { intentado: false, motivo: 'sin-api' };
  try {
    const aceptado = navigator.vibrate(patron);
    return { intentado: true, aceptado };
  } catch (error) {
    return { intentado: false, motivo: String(error) };
  }
}

/**
 * Lo que se puede saber del entorno ANTES de subir al escenario.
 * Se muestra en la app para que nadie descubra el problema en vivo.
 */
function diagnosticoVibracion() {
  const ua = navigator.userAgent;
  const esIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const esAndroid = /Android/.test(ua);
  const tieneApi = 'vibrate' in navigator;

  if (esIOS) {
    return {
      nivel: 'no',
      texto: 'iOS no permite vibrar desde el navegador. Usa un Android para sentir los patrones.',
    };
  }
  if (!tieneApi) {
    return {
      nivel: 'no',
      texto: 'Este navegador no expone la API de vibración. El patrón se ve y se oye igual.',
    };
  }
  if (!esAndroid) {
    return {
      nivel: 'quizas',
      texto: 'En escritorio la API existe pero no hay hardware que vibre. El patrón se ve en pantalla.',
    };
  }
  return {
    nivel: 'si',
    texto: 'Pruébalo con el botón: si no lo sientes, revisa que el teléfono no esté en silencio.',
  };
}
