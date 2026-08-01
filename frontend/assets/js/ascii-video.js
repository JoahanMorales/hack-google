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

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
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

    let salida = '';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // Luminancia perceptual (Rec. 601): el ojo pesa mucho más el verde.
        const lum =
          (0.299 * datos[i] + 0.587 * datos[i + 1] + 0.114 * datos[i + 2]) / 255;
        salida += RAMPA[Math.min(RAMPA.length - 1, (lum * RAMPA.length) | 0)];
      }
      salida += '\n';
    }
    this.salida.textContent = salida;
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

    let salida = '';
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
        const n = Math.max(0, Math.min(1, (v + 1) / 2));
        salida += RAMPA[Math.min(RAMPA.length - 1, (n * RAMPA.length) | 0)];
      }
      salida += '\n';
    }
    this.salida.textContent = salida;
  }
}
