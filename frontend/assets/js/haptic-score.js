/**
 * PARTITURA HÁPTICA — el elemento firma del proyecto.
 *
 * Dibuja un patrón de vibración como notación: bloques llenos donde el
 * teléfono vibra, huecos donde calla, todo a escala real de milisegundos.
 * Un cabezal recorre la partitura exactamente al mismo tiempo que corre la
 * vibración real, así que la vibración se VE además de sentirse.
 *
 * Esto es lo que hace la demo defendible frente a un jurado que no trae un
 * Android en la mano: aunque no puedan sentirlo, pueden leer el patrón y ver
 * que "alarma" y "te hablan" son dos cosas visiblemente distintas.
 */

class PartituraHaptica {
  /**
   * @param {HTMLElement} contenedor
   * @param {object} opciones
   *   - conEtiquetas: muestra los valores en ms debajo de cada bloque
   *   - alto: altura de los bloques en px
   */
  constructor(contenedor, opciones = {}) {
    this.contenedor = contenedor;
    this.conEtiquetas = opciones.conEtiquetas ?? false;
    this.alto = opciones.alto ?? 44;
    this.patron = [];
    this.temporizadores = [];
    this.contenedor.classList.add('partitura');
    this.contenedor.style.setProperty('--partitura-alto', `${this.alto}px`);
  }

  /**
   * Pinta un patrón. No lo reproduce — solo lo dibuja en reposo.
   * @param {number[]} patron  alterna [vibra, calla, vibra, ...]
   * @param {string} color     var(--sig-*) de la categoría
   */
  dibujar(patron, color) {
    this.limpiar();
    this.patron = [...patron];
    const total = this.patron.reduce((s, ms) => s + ms, 0) || 1;

    this.contenedor.innerHTML = '';
    this.contenedor.style.setProperty('--partitura-color', color);

    this.pista = document.createElement('div');
    this.pista.className = 'partitura__pista';

    this.bloques = [];
    this.patron.forEach((ms, i) => {
      const esVibracion = i % 2 === 0;
      const seg = document.createElement('div');
      seg.className = esVibracion
        ? 'partitura__bloque'
        : 'partitura__silencio';
      // flex-grow proporcional = escala real de tiempo, sin cálculos de px.
      seg.style.flexGrow = String(ms / total);

      if (esVibracion) {
        if (this.conEtiquetas) {
          const et = document.createElement('span');
          et.className = 'partitura__ms mono';
          et.textContent = ms;
          seg.appendChild(et);
        }
        this.bloques.push(seg);
      }
      this.pista.appendChild(seg);
    });

    this.cabezal = document.createElement('div');
    this.cabezal.className = 'partitura__cabezal';

    this.contenedor.appendChild(this.pista);
    this.contenedor.appendChild(this.cabezal);

    // Texto equivalente para lectores de pantalla: la notación visual no
    // significa nada para alguien que navega con voz.
    this.contenedor.setAttribute('role', 'img');
    this.contenedor.setAttribute(
      'aria-label',
      `Patrón de vibración: ${this.patron
        .map((ms, i) => (i % 2 === 0 ? `vibra ${ms}` : `pausa ${ms}`))
        .join(', ')} milisegundos.`
    );

    return this;
  }

  /**
   * Reproduce la animación de la partitura. Devuelve la duración total en ms
   * para que quien llame pueda encadenar (el orbe usa esto).
   *
   * Ojo: esto NO dispara navigator.vibrate() — de eso se encarga app.js, para
   * que la partitura sirva igual en la landing, donde no queremos que el
   * teléfono de un visitante vibre sin que lo haya pedido.
   */
  reproducir() {
    if (!this.pista) return 0;
    this.detener();

    const total = this.patron.reduce((s, ms) => s + ms, 0);
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.contenedor.classList.add('esta-sonando');

    // Cabezal: una sola transición lineal de punta a punta.
    this.cabezal.style.transition = 'none';
    this.cabezal.style.left = '0%';
    // Forzar reflow para que la transición arranque desde 0 de verdad.
    void this.cabezal.offsetWidth;
    if (!reducido) {
      this.cabezal.style.transition = `left ${total}ms linear`;
      this.cabezal.style.left = '100%';
    }

    // Cada bloque se enciende en su milisegundo exacto.
    let t = 0;
    let iBloque = 0;
    this.patron.forEach((ms, i) => {
      if (i % 2 === 0) {
        const bloque = this.bloques[iBloque++];
        const inicio = t;
        this.temporizadores.push(
          setTimeout(() => bloque.classList.add('activo'), inicio),
          setTimeout(() => bloque.classList.remove('activo'), inicio + ms)
        );
      }
      t += ms;
    });

    this.temporizadores.push(
      setTimeout(() => {
        this.contenedor.classList.remove('esta-sonando');
        if (this.cabezal) this.cabezal.style.transition = 'none';
      }, total)
    );

    return total;
  }

  detener() {
    this.temporizadores.forEach(clearTimeout);
    this.temporizadores = [];
    if (this.bloques) this.bloques.forEach((b) => b.classList.remove('activo'));
    this.contenedor.classList.remove('esta-sonando');
  }

  limpiar() {
    this.detener();
  }
}
