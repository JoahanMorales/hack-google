/**
 * Landing: arranca el hero en ASCII y arma la lista de patrones.
 */

document.addEventListener('DOMContentLoaded', () => {
  iniciarHero();
  construirVocabulario();
  avisarSoporteVibracion();
});

async function iniciarHero() {
  const salida = document.getElementById('ascii');
  const nota = document.getElementById('nota-ascii');
  if (!salida) return;

  const hero = new HeroASCII(salida, CONFIG.ascii);
  const modo = await hero.iniciar();

  // Decirle al equipo, en la propia página, cómo poner su video. Se quita
  // solo en cuanto el archivo exista.
  if (nota) {
    nota.textContent =
      modo === 'video'
        ? ''
        : `Hero generativo · dejen su video en ${CONFIG.ascii.fuenteVideo} y se renderiza en ASCII automáticamente`;
  }

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
      // En la landing sí vibramos: es una acción que la persona pidió
      // explícitamente al tocar el botón.
      vibrar(cat.patron);
    });

    li.appendChild(boton);
    lista.appendChild(li);
  });
}

function avisarSoporteVibracion() {
  const aviso = document.getElementById('aviso-vibracion');
  if (!aviso) return;
  aviso.textContent = soportaVibracion()
    ? 'Tu dispositivo sí vibra — tócalos para sentir la diferencia.'
    : 'Este dispositivo no expone la API de vibración: vas a ver el patrón, pero no sentirlo. Ábrelo en un Android para la experiencia completa.';
}
