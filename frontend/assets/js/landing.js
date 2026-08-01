/**
 * Landing: arranca el hero en ASCII y arma la lista de patrones.
 */

let presentacion;

document.addEventListener('DOMContentLoaded', () => {
  presentacion = new ModoPresentacion(document.getElementById('destello'));
  iniciarHero();
  construirVocabulario();
  avisarSoporteVibracion();
});

async function iniciarHero() {
  const salida = document.getElementById('ascii');
  if (!salida) return;

  const hero = new HeroASCII(salida, CONFIG.ascii);
  await hero.iniciar();


  // No gastar CPU renderizando algo que nadie está viendo: en una Jetson
  // sirviendo el modelo, cada ciclo cuenta.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hero.detener();
    else hero.iniciar();
  });
}

function construirVocabulario() {
  const lista = document.getElementById('lista-vocabulario');
  if (!lista) return;

  ORDEN_CATEGORIAS.forEach((id) => {
    const cat = CATEGORIAS[id];

    const li = document.createElement('li');
    const boton = document.createElement('button');
    boton.className = 'tarjeta-patron';
    boton.type = 'button';
    boton.style.setProperty('--categoria-color', cat.color);
    boton.setAttribute(
      'aria-label',
      `Reproducir el patrón de ${cat.nombre}. ${cat.descripcion}`
    );

    boton.innerHTML = `
      <span class="tarjeta-patron__id">
        <span class="tarjeta-patron__glifo" aria-hidden="true">${cat.glifo}</span>
        <span>
          <span class="tarjeta-patron__nombre">${cat.nombre}</span>
          <span class="tarjeta-patron__ejemplos">${cat.ejemplos}</span>
        </span>
      </span>
      <span class="tarjeta-patron__partitura"></span>
      <span class="tarjeta-patron__accion">Reproducir</span>
    `;

    const contenedor = boton.querySelector('.tarjeta-patron__partitura');
    const partitura = new PartituraHaptica(contenedor, {
      conEtiquetas: true,
      alto: 34,
    });
    partitura.dibujar(cat.patron, cat.color);

    boton.addEventListener('click', () => {
      partitura.reproducir();
      // En la landing sí emitimos: es una acción que la persona pidió
      // explícitamente al tocar. Van los tres canales, para que el patrón se
      // perciba aunque el dispositivo no vibre.
      intentarVibrar(cat.patron);
      presentacion.emitir(cat.patron, cat.color);
    });

    li.appendChild(boton);
    lista.appendChild(li);
  });
}

function avisarSoporteVibracion() {
  const aviso = document.getElementById('aviso-vibracion');
  if (!aviso) return;
  // No se puede saber si el aparato realmente vibra: la API devuelve true en
  // escritorio y no pasa nada. Así que no se promete, se describe.
  aviso.textContent = `${diagnosticoVibracion().texto} La pantalla destella con el mismo ritmo en cualquier dispositivo.`;
}
