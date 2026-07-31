/**
 * Cliente del contrato con el backend (agente 2).
 *
 *   POST /clasificar
 *   →  { "audio_base64": "..." }
 *   ←  { "categoria": "alarma"|"atencion"|"social"|"ambiental",
 *        "urgencia":  "baja"|"media"|"alta",
 *        "etiqueta":  "alarma de humo",
 *        "reasoning": "..." }         ← opcional
 *
 * Mientras el backend no exista, esto responde con datos simulados para que
 * toda la UI se pueda construir y demostrar sin depender de nadie. En cuanto
 * el endpoint real conteste, se cambia solo — no hay que tocar código ni
 * recargar: el primer 200 real apaga el mock.
 */

class ClienteClasificacion {
  constructor(config) {
    this.endpoint = config.endpoint;
    this.timeoutMs = config.timeoutMs;
    this.usarMock = config.usarMock;
    this.backendVivo = false;
    // Se llama cuando cambia entre mock y real, para actualizar el indicador.
    this.alCambiarModo = () => {};
  }

  get modo() {
    return this.backendVivo ? 'real' : 'simulado';
  }

  /**
   * Prueba si el backend está arriba. Se llama al cargar y cada vez que
   * falla una petición, para reconectarse solo cuando el agente 2 despliegue.
   */
  async sondear() {
    const antes = this.backendVivo;
    try {
      const r = await fetch(this.endpoint, {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(3000),
      });
      this.backendVivo = r.ok || r.status === 405 || r.status === 204;
    } catch {
      this.backendVivo = false;
    }
    if (antes !== this.backendVivo) this.alCambiarModo(this.modo);
    return this.backendVivo;
  }

  /**
   * Manda un clip a clasificar.
   * @param {string} audioBase64
   * @returns {Promise<object>} respuesta con la forma del contrato
   */
  async clasificar(audioBase64) {
    if (this.usarMock && !this.backendVivo) {
      return this._simular();
    }

    try {
      const respuesta = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_base64: audioBase64 }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const datos = await respuesta.json();

      if (!this.backendVivo) {
        this.backendVivo = true;
        this.alCambiarModo(this.modo);
      }
      return this._normalizar(datos);
    } catch (error) {
      // Nunca dejar la UI colgada: si el backend truena, se degrada a
      // simulado y se avisa en pantalla, pero la demo sigue viva.
      if (this.backendVivo) {
        this.backendVivo = false;
        this.alCambiarModo(this.modo);
      }
      if (this.usarMock) return this._simular();
      throw error;
    }
  }

  /**
   * Blinda la respuesta del backend. Si Gemma alucina una categoría que no
   * existe o se salta un campo, la UI no se rompe: cae a 'ambiental', que es
   * la opción que menos molesta al usuario.
   */
  _normalizar(datos) {
    const categoriasValidas = ORDEN_CATEGORIAS;
    const urgenciasValidas = ['baja', 'media', 'alta'];

    return {
      categoria: categoriasValidas.includes(datos?.categoria)
        ? datos.categoria
        : 'ambiental',
      urgencia: urgenciasValidas.includes(datos?.urgencia)
        ? datos.urgencia
        : 'media',
      etiqueta:
        typeof datos?.etiqueta === 'string' && datos.etiqueta.trim()
          ? datos.etiqueta.trim().slice(0, 60)
          : 'sonido sin identificar',
      reasoning: typeof datos?.reasoning === 'string' ? datos.reasoning : '',
      simulado: false,
    };
  }

  // ── Simulación ────────────────────────────────────────────────────────────

  _simular() {
    const guion = [
      { categoria: 'ambiental', urgencia: 'baja', etiqueta: 'tráfico lejano' },
      { categoria: 'social', urgencia: 'media', etiqueta: 'tocan la puerta' },
      { categoria: 'ambiental', urgencia: 'baja', etiqueta: 'conversación de fondo' },
      { categoria: 'atencion', urgencia: 'media', etiqueta: 'alguien dice tu nombre' },
      { categoria: 'ambiental', urgencia: 'baja', etiqueta: 'ventilador' },
      { categoria: 'alarma', urgencia: 'alta', etiqueta: 'alarma de humo' },
      { categoria: 'social', urgencia: 'baja', etiqueta: 'teléfono sonando' },
      { categoria: 'atencion', urgencia: 'alta', etiqueta: 'te gritan desde atrás' },
    ];

    this._i = (this._i ?? -1) + 1;
    const evento = guion[this._i % guion.length];

    // Latencia parecida a la real: la Jetson tarda ~1-2s en un clip corto.
    const espera = 900 + Math.random() * 800;
    return new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            ...evento,
            reasoning:
              'Simulado — sin backend conectado. El guion recorre las cuatro categorías en orden para poder probar todos los patrones.',
            simulado: true,
          }),
        espera
      )
    );
  }
}
