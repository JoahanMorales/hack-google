// Sobreescritura opcional de configuración por entorno.
//
// Vacío a propósito: Coralia clasifica con Gemma 4 corriendo LOCAL, así que un
// despliegue estático no tiene modelo detrás y la app entra en modo vitrina
// sola, al no responder el endpoint.
//
// Para apuntar un despliegue al modelo real (con la Jetson encendida), pon
// aquí la URL del túnel:
//
//   window.CORALIA_CONFIG = { endpoint: "https://tu-tunel/clasificar" };
//
// En Vercel también se puede generar este archivo en el build desde la
// variable CORALIA_ENDPOINT: ver scripts/build-env.sh. Es opcional — sin él
// todo funciona igual.
window.CORALIA_CONFIG = window.CORALIA_CONFIG || {};
