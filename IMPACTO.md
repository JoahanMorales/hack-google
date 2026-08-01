# Impacto

## A quién le sirve

La Organización Mundial de la Salud estima que más de **1,500 millones de
personas** viven con algún grado de pérdida auditiva, y que alrededor de **430
millones** tienen una pérdida discapacitante que requiere atención. En México,
el INEGI reporta cientos de miles de personas con discapacidad auditiva.

Pero el número no es lo que importa. Lo que importa es qué se pierde
exactamente.

## Qué se pierde sin sonido

El oído no es solo un canal de comunicación: es el **sistema de conciencia
ambiental** del cuerpo. Es el único sentido que funciona en 360 grados, en la
oscuridad, mientras duermes y mientras miras hacia otro lado.

Sin él, o sin un sustituto, se pierden tres cosas distintas:

**Seguridad.** Una alarma de humo es un dispositivo diseñado bajo el supuesto de
que quien está en la casa puede oírlo. Para una persona sorda que vive sola, ese
supuesto no se cumple, y es literalmente el escenario para el que se inventó la
alarma.

**Autonomía.** Tocan la puerta y no te enteras. El teléfono suena en otro cuarto.
Se te queda la llave del gas abierta. Cada uno es pequeño; juntos son una
dependencia constante de que alguien más esté presente para avisar.

**Presencia.** Alguien te habla desde atrás y no volteas, y la otra persona
interpreta que la ignoraste. El bebé llora en el cuarto de al lado. Esto no
aparece en las estadísticas de accesibilidad, pero es lo que más pesa en el día
a día.

## Por qué lo que existe hoy no alcanza

Las soluciones actuales —luces estroboscópicas, timbres vibradores,
smartwatches genéricos— comparten un límite: **avisan que hubo un sonido, pero
no cuál**.

Eso tiene tres consecuencias:

1. **Obliga a verificar visualmente cada vez.** La persona interrumpe lo que
   hace y busca la fuente. La alerta no resuelve el problema, lo pospone.
2. **Iguala lo trivial con lo urgente.** El mismo aviso para un portazo que para
   una fuga de gas. Con el tiempo, la persona deja de reaccionar.
3. **Cansa hasta que se apaga.** Es el patrón conocido de fatiga de alertas. Una
   herramienta de seguridad que la gente termina apagando no es una herramienta
   de seguridad.

Además, los sistemas dedicados son **caros y de un solo propósito**: un timbre
vibrador sirve para el timbre y nada más. Cada necesidad nueva es un aparato
nuevo.

## Qué cambia Coralia

**Distingue.** Cuatro patrones que se reconocen por ritmo, sin mirar la
pantalla. La persona no se entera de que "pasó algo": se entera de **qué** pasó
y si tiene que moverse ya.

**Corre en lo que la gente ya trae.** Un navegador en un teléfono. Sin hardware
dedicado, sin comprar nada, sin suscripción. Ese es el factor que decide si algo
llega a quien lo necesita o se queda en el catálogo de dispositivos caros de
asistencia.

**Es un modelo general, no un detector de una cosa.** Al usar Gemma 4 para
interpretar en vez de un clasificador entrenado para sonidos fijos, el mismo
sistema cubre casos que no estaban previstos: el bebé llorando, tu nombre entre
el ruido, una conversación subiendo de tono. No hay que construir un producto
nuevo para cada situación.

**No pide confianza.** El audio del cuarto de alguien nunca sale del
dispositivo, porque el modelo corre local. Un sistema de escucha ambiental
permanente que manda audio a la nube no se adopta en una casa, y con razón. La
privacidad aquí no es una casilla: es la condición para que alguien lo deje
encendido.

## Más allá de la sordera

El mismo mecanismo sirve en situaciones donde cualquiera pierde el canal
auditivo:

- Un padre o madre oyente que duerme y necesita saber si el bebé llora.
- Trabajo en entornos con protección auditiva obligatoria: obra, fábrica, pista.
- Usar audífonos con cancelación de ruido en la calle.
- Ambientes ruidosos donde una alarma se pierde entre el fondo.

El diseño para una discapacidad específica termina siendo útil mucho más allá de
ella. Es el argumento de siempre del diseño accesible, y aquí se cumple sin
forzarlo.

## Lo que falta para que esto sirva de verdad

Honestamente, un prototipo de un día no cambia la vida de nadie. Lo que haría
falta:

- **Validación con personas sordas**, no con desarrolladores oyentes imaginando
  qué necesitan. Es el paso que más cambiaría el diseño y el que no se hizo.
- **Correr en el teléfono**, no contra un servidor local. Gemma 4 en el
  dispositivo cerraría el argumento de privacidad y quitaría la dependencia de
  red.
- **Ejecución en segundo plano.** Hoy requiere la pestaña abierta y visible; una
  herramienta de seguridad real tiene que correr todo el día.
- **Medir falsos positivos en condiciones reales**, con varias fuentes de sonido
  a la vez, que es como suena una casa de verdad.
