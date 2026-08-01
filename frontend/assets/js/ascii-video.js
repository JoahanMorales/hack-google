/**
 * HERO EN ASCII
 *
 * Convierte un video a ASCII en tiempo real: dibuja cada frame en un canvas
 * chiquito, lee la luminancia de cada pixel y la mapea a un carácter.
 *
 * ── CÓMO PONER SU VIDEO ─────────────────────────────────────────────────────
 *   1. Guárdenlo en  frontend/assets/media/hero.mp4
 *   2. Listo. No hay que tocar código.
 *
 *   Para cambiar la ruta o el detalle, todo está en CONFIG.ascii (config.js).
 *   Recomendado: video corto (5-15s), MUCHO contraste, sujeto claro sobre
 *   fondo oscuro. El ASCII destruye los medios tonos, así que un video plano
 *   se ve a puré. Silencien el audio, el <video> va muted de todos modos.
 *
 * Si el archivo no existe o el navegador no lo puede decodificar, arranca
 * sola una animación generativa de ondas interfiriendo — que es literalmente
 * el tema del proyecto, así que el respaldo no se siente como un respaldo.
 */

// De más oscuro a más claro. El espacio al inicio es intencional: es el negro.
const RAMPA = ' .·:-=+*#%@';

/**
 * Color por nivel de intensidad: índigo profundo en lo tenue, subiendo por
 * azul aciano y lavanda hasta un lila casi blanco en los picos.
 *
 * Deliberadamente NO usa las señales de categoría (rojo alarma, ámbar, verde).
 * Esas comunican urgencia dentro de la app y no deben aparecer como decorado
 * en un fondo, o pierden fuerza justo donde importa. Los tokens viven en
 * tokens.css, así que la paleta se retoca ahí sin abrir este archivo.
 *
 * Un color por posición de la rampa, precalculado: buscarlo en cada pixel de
 * cada frame sería trabajo tirado.
 */
const COLORES_RAMPA = [
  '',                 // el espacio no se pinta
  '#2f4bb0',          // azul profundo
  '#2f4bb0',
  '#4a86e8',          // azul brillante
  '#4a86e8',
  '#7b7ef0',          // azul-violeta
  '#9d6ef2',          // violeta
  '#c06cf0',          // orquídea
  '#e08ae8',          // rosa lila
  '#f3bdf5',          // lila pálido
  '#fbe8ff',          // casi blanco
];

class HeroASCII {
  /**
   * @param {HTMLElement} salida  el <pre> donde se escribe
   * @param {object} opciones     { fuenteVideo, columnas, fps }
   */
  constructor(salida, opciones = {}) {
    this.salida = salida;
    this.columnas = opciones.columnas ?? 150;
    this.fps = opciones.fps ?? 24;
    this.fuenteVideo = opciones.fuenteVideo ?? null;
    this.corriendo = false;
    this.modo = null; // 'video' | 'generativo'
    this.t = 0;

    // Los caracteres son más altos que anchos (~2:1), así que hay que
    // comprimir las filas o la imagen sale estirada verticalmente.
    this.relacionCaracter = 0.5;

    // Canvas interno, chiquito: solo para leer los pixeles del video.
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Canvas visible donde se dibuja el ASCII.
    this.lienzo = salida;
    this.ctx2d = salida.getContext ? salida.getContext('2d') : null;
    this.familiaFuente =
      'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';
    this._ajustarLienzo();
    window.addEventListener('resize', () => this._ajustarLienzo());
  }

  /** Ajusta el canvas a su tamaño en pantalla, respetando la densidad. */
  _ajustarLienzo() {
    if (!this.lienzo || !this.lienzo.getBoundingClientRect) return;
    const r = this.lienzo.getBoundingClientRect();
    // Se limita a 2x: en pantallas 3x el costo de pintado se dispara sin que
    // se note la diferencia en un fondo de texto tenue.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.lienzo.width = Math.max(1, Math.round(r.width * dpr));
    this.lienzo.height = Math.max(1, Math.round(r.height * dpr));
    this._tamFuente = null; // forzar recalibrado del tamaño de fuente
  }

  async iniciar() {
    if (this.fuenteVideo && (await this._intentarVideo())) {
      this.modo = 'video';
    } else {
      this.modo = 'generativo';
    }
    this.corriendo = true;
    this._bucle();
    return this.modo;
  }

  detener() {
    this.corriendo = false;
    if (this.temporizador) clearTimeout(this.temporizador);
    if (this.video) this.video.pause();
  }

  /** Intenta cargar el video. Resuelve false si no existe o no se puede leer. */
  _intentarVideo() {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = this.fuenteVideo;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      // Sin esto, un video servido desde otro origen ensucia el canvas y
      // getImageData revienta con SecurityError.
      video.crossOrigin = 'anonymous';

      let resuelto = false;
      const terminar = (ok) => {
        if (resuelto) return;
        resuelto = true;
        resolve(ok);
      };

      video.addEventListener('loadeddata', () => {
        this.video = video;
        const alto = Math.round(
          this.columnas *
            (video.videoHeight / video.videoWidth) *
            this.relacionCaracter
        );
        this.canvas.width = this.columnas;
        this.canvas.height = Math.max(alto, 1);
        video.play().then(() => terminar(true)).catch(() => terminar(false));
      });

      video.addEventListener('error', () => terminar(false));
      // Si el archivo no está, algunos navegadores tardan en emitir 'error'.
      setTimeout(() => terminar(false), 4000);
    });
  }

  _bucle() {
    if (!this.corriendo) return;

    // Con reduced-motion se pinta un frame y se congela: el hero conserva su
    // textura pero deja de moverse. Un fondo animado permanente es justo lo
    // que esa preferencia pide evitar.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        if (this.modo === 'video') this._frameVideo();
        else this._frameGenerativo();
      } catch {
        /* si falla, el hero se queda vacío pero la página funciona igual */
      }
      this.corriendo = false;
      return;
    }

    try {
      if (this.modo === 'video') this._frameVideo();
      else this._frameGenerativo();
    } catch {
      // Si el video falla a media reproducción (códec raro, pestaña oculta),
      // caemos al generativo en vez de dejar el hero congelado.
      this.modo = 'generativo';
    }
    this.temporizador = setTimeout(() => this._bucle(), 1000 / this.fps);
  }

  _frameVideo() {
    const { width: w, height: h } = this.canvas;
    this.ctx.drawImage(this.video, 0, 0, w, h);
    const datos = this.ctx.getImageData(0, 0, w, h).data;

    const niveles = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      // Luminancia perceptual (Rec. 601): el ojo pesa mucho más el verde.
      const lum =
        (0.299 * datos[i] + 0.587 * datos[i + 1] + 0.114 * datos[i + 2]) / 255;
      niveles[p] = Math.min(RAMPA.length - 1, (lum * RAMPA.length) | 0);
    }
    this._pintar(niveles, w, h);
  }

  /**
   * Respaldo generativo: dos ondas circulares interfiriendo, como dos fuentes
   * de sonido en un cuarto. Es el mismo fenómeno que el proyecto traduce a
   * vibración, así que el hero dice algo aunque no haya video.
   */
  _frameGenerativo() {
    const w = this.columnas;
    const h = Math.round(w * 0.28);
    this.t += 0.08;

    const fuentes = [
      { x: w * 0.3, y: h * 0.5, f: 0.55 },
      { x: w * 0.72, y: h * 0.42, f: 0.4 },
    ];

    const niveles = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (const s of fuentes) {
          // Corregir la relación de aspecto del carácter en la distancia, si
          // no las ondas salen ovaladas.
          const dx = x - s.x;
          const dy = (y - s.y) / this.relacionCaracter;
          const d = Math.sqrt(dx * dx + dy * dy);
          v += Math.sin(d * s.f - this.t * 2) / (1 + d * 0.06);
        }
        // El 1.7 es contraste: sin él la suma de las dos ondas se agolpa
        // cerca de 0.5 y solo se usa el centro de la rampa, dejando fuera los
        // tonos claros. Con esto la escala completa entra en juego.
        const n = Math.max(0, Math.min(1, (v * 1.7 + 1) / 2));
        niveles[y * w + x] = Math.min(RAMPA.length - 1, (n * RAMPA.length) | 0);
      }
    }
    this._pintar(niveles, w, h);
  }

  /**
   * Dibuja el frame en el canvas.
   *
   * Truco de rendimiento: en vez de un fillText por carácter (~6000 por frame,
   * inviable), se hace UNO por fila y color. Para cada color se arma la fila
   * completa con espacios donde van los demás colores; como la fuente es
   * monoespaciada, cada carácter cae exactamente en su columna. Eso baja de
   * miles de llamadas a unas pocas centenas.
   */
  _pintar(niveles, w, h) {
    const ctx = this.ctx2d;
    if (!ctx) return;

    const { width: W, height: H } = this.lienzo;
    ctx.clearRect(0, 0, W, H);

    const anchoCelda = W / w;
    const altoCelda = H / h;

    // El tamaño de fuente se calibra midiendo el avance real de la fuente
    // monoespaciada, en vez de asumir el clásico 0.6em que varía entre
    // sistemas y descuadraría las columnas.
    if (!this._tamFuente || this._anchoCeldaPrevio !== anchoCelda) {
      ctx.font = `100px ${this.familiaFuente}`;
      const avance = ctx.measureText('M').width / 100;
      this._tamFuente = anchoCelda / avance;
      this._anchoCeldaPrevio = anchoCelda;
    }

    ctx.font = `${this._tamFuente}px ${this.familiaFuente}`;
    ctx.textBaseline = 'top';

    const filaPorColor = new Map();
    for (let y = 0; y < h; y++) {
      filaPorColor.clear();

      for (let x = 0; x < w; x++) {
        const nivel = niveles[y * w + x];
        const color = COLORES_RAMPA[nivel];
        if (!color) continue;
        let fila = filaPorColor.get(color);
        if (!fila) {
          fila = new Array(w).fill(' ');
          filaPorColor.set(color, fila);
        }
        fila[x] = RAMPA[nivel];
      }

      const py = y * altoCelda;
      for (const [color, fila] of filaPorColor) {
        ctx.fillStyle = color;
        ctx.fillText(fila.join(''), 0, py);
      }
    }
  }
}
