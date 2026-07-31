/**
 * Captura de audio en clips cortos + envio a /clasificar.
 * Sin DOM ni estilos - el Agente 1 conecta esto a su UI/vibraciones.
 *
 * Uso:
 *   const captura = crearCapturaAudio({
 *     endpoint: "http://localhost:5000/clasificar",
 *     onEvento: (json) => { ... },   // json = forma del contrato
 *     onError: (err) => { ... },
 *   });
 *   await captura.iniciar();
 *   // ...
 *   captura.detener();
 */
function crearCapturaAudio({
  endpoint,
  duracionMs = 3500,
  timeoutMs = 15000,
  onEvento,
  onError,
}) {
  let stream = null;
  let grabador = null;
  let corriendo = false;
  let requestEnVuelo = false;

  async function blobABase64(blob) {
    const buffer = await blob.arrayBuffer();
    let binario = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      binario += String.fromCharCode(bytes[i]);
    }
    return btoa(binario);
  }

  async function enviarClip(blob) {
    // Backpressure: si ya hay una request en vuelo (el dispositivo de Gemma
    // es unico y encola), se descarta este clip en vez de encimar requests.
    if (requestEnVuelo) return;
    requestEnVuelo = true;

    const controlador = new AbortController();
    const timeoutId = setTimeout(() => controlador.abort(), timeoutMs);

    try {
      const audio_base64 = await blobABase64(blob);
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_base64, mime_type: blob.type }),
        signal: controlador.signal,
      });
      const json = await resp.json();
      onEvento?.(json, resp.headers.get("X-Vibra-Estado"));
    } catch (err) {
      onError?.(err);
    } finally {
      clearTimeout(timeoutId);
      requestEnVuelo = false;
    }
  }

  function grabarUnClip() {
    if (!corriendo || !stream) return;
    const trozos = [];
    grabador = new MediaRecorder(stream);
    grabador.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.push(e.data);
    };
    grabador.onstop = () => {
      const blob = new Blob(trozos, { type: grabador.mimeType });
      enviarClip(blob);
      if (corriendo) grabarUnClip();
    };
    grabador.start();
    setTimeout(() => {
      if (grabador && grabador.state !== "inactive") grabador.stop();
    }, duracionMs);
  }

  async function iniciar() {
    if (corriendo) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      onError?.(err);
      return;
    }
    corriendo = true;
    grabarUnClip();
  }

  function detener() {
    corriendo = false;
    if (grabador && grabador.state !== "inactive") grabador.stop();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function activo() {
    return corriendo;
  }

  return { iniciar, detener, activo };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { crearCapturaAudio };
}