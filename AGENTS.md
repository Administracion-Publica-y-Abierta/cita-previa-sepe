<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cómo se trabaja en este repositorio

El código y los comentarios van **en castellano**, y los comentarios explican
**por qué**, no qué. Antes de tocar nada, lee `CONTRIBUTING.md`: la regla de no
acelerar el ritmo de peticiones al SEPE no es de estilo y no se negocia.

## Órdenes

| Orden | Para qué |
|---|---|
| `npm run dev` | Levanta la aplicación en desarrollo. |
| `npm test` | Toda la batería de tests. Levanta la aplicación y un Chromium: ver abajo. |
| `npm run tipos` | Comprobación de tipos. |
| `npm run lint` | Reglas de estilo. |
| `npm run fixtures -- <ruta>` | Rehace los fixtures desde las capturas `.har`. |

## El mapa

Es de **MapLibre GL JS** sobre las teselas de **OpenFreeMap**, sin clave de
API. Lo que hay que saber antes de tocarlo:

- **Casi nada de lo que decide el mapa está en el componente.** `src/interfaz/
  mapa/puntos.ts` decide qué se dibuja y dónde se encuadra, y `estilo.ts` con
  qué aspecto: los dos son datos y se prueban en Node. `mapa.tsx` es solo el
  pegamento con MapLibre, y ahí no se mete lógica que se pueda sacar.
- **Sin WebGL no hay mapa, y no pasa nada.** Se pregunta antes de traerse la
  librería, así que quien no puede pintarlo tampoco se descarga casi un mega
  de JavaScript. Es también lo que pasa en los tests: jsdom no pinta, y lo que
  se prueba ahí es que la lista sigue siendo el resultado completo.
- **El worker se copia a `public/mapa/` en cada `dev` y cada `build`**
  (`scripts/copiar-el-mapa.mjs`), y `setWorkerUrl` apunta ahí. MapLibre lo
  busca con `import.meta.url`, que dentro de un bundle no lleva a
  `node_modules`: sin esto el worker se muere sin decir nada y el mapa pinta el
  fondo y ni una calle. Parece que funciona, y es lo que lo hace caro de
  encontrar.

## La búsqueda no es una respuesta: es algo que va llegando

Una pasada de nueve trámites son unos 44 segundos —el freno de 2,5 s no se
negocia— y eso no lo mira nadie ni lo aguanta una función serverless. Por eso
`POST /api/busqueda` contesta en **streaming**, un objeto JSON por línea
(NDJSON), y no un resultado. Lo que hay que saber antes de tocarlo:

- **No es *Server-Sent Events*, y no por gusto.** `EventSource` solo sabe hacer
  GET, y aquí el código postal no puede ir en una URL: el alojamiento registra
  la URL entera de cada petición solo por existir. Un objeto por línea sobre un
  POST no necesita librería en ninguna de las dos puntas (`src/nucleo/ndjson.ts`).
- **Una invocación no sostiene la pasada entera.** `src/sepe/pasada.ts` lleva un
  presupuesto: cuando se acaba, cierra con un evento `pendientes` y la siguiente
  petición continúa por ahí. Eso no es sondeo —cada petición trae trámites
  resueltos—, y el primer trámite se consulta **siempre**, aunque el
  presupuesto ya esté gastado: sin esa regla, una zona cuyo catálogo se lo come
  entero no avanzaría nunca.
- **La continuación manda identificadores y nada más.** Los nombres de los
  trámites los dice el SEPE, y para eso la cola de la zona se guarda en el
  almacén compartido (`src/sepe/cola.ts`). La alternativa —que el navegador
  devuelva los nombres— sería meter en la respuesta texto llegado en una
  petición, que es justo lo que `src/app/api/errores.ts` no permite.
- **En la pantalla, lo que llega se suma.** `src/interfaz/lo-que-va-llegando.ts`
  guarda los trámites resueltos y funde sus oficinas por identificador,
  quedándose con el hueco más temprano **y con el trámite del que es**: la misma
  oficina sale en varios trámites con una hora distinta en cada uno, y una hora
  sin decir para qué es no sirve para ir a ninguna parte.
- **El mapa se encuadra una vez por búsqueda, no por trámite.** Los que entran
  detrás son oficinas de la misma zona, y mover la vista con cada uno le
  quitaría el mapa de las manos a quien lo está mirando mientras el resto llega.

## Marcar trámites no relanza la búsqueda

Mucha gente no sabe cómo se llama su trámite, así que aquí no se le hace
elegir uno: se marcan **varios a la vez** y salen agrupados como los agrupa el
SEPE. Lo que hay que saber antes de tocarlo:

- **El grupo viaja pegado a cada trámite de la cola** (`src/sepe/cola.ts`) y no
  aparte, porque la cola es una fila y no un árbol: quien la recorre no
  necesita la agrupación y quien la enseña la rehace. El grupo es el trámite de
  **nivel 2** —el combo «Trámite» de la sede, del que cuelga el de
  «Subtrámite»—. El nivel 1 no entra: el SEPE lo llama «Tipo de oficina» y no
  agrupa trámites.
- **Sin marcar nada se enseñan todos.** Marcar estrecha, y no es un paso previo
  a ver nada: por eso el hero sigue siendo un campo y un botón.
- **El filtro mira y no tira.** `soloLoElegido`
  (`src/interfaz/tramites-elegidos.ts`) filtra la vista, no el estado: lo
  desmarcado sigue entero, y eso es lo que hace que volver a marcarlo no cueste
  otra consulta al SEPE.
- **Marcar algo que no se ha consultado lo mete en la cola.** Por eso la
  búsqueda vive en el hero como un bucle y no como una llamada: mientras quede
  algo marcado por saber se vuelve a salir al SEPE y lo que llega se suma a lo
  que ya hay. Con una pasada abierta se apunta y se espera —dos pasadas a la
  vez son dos colas peleándose por las fichas del freno—.
- **Lo marcado va en el fragmento** (`#cp=08401&t=23,17`), por lo mismo que el
  código postal: el alojamiento registra la URL entera y el fragmento no viaja.
  Y un enlace que trae trámites elegidos consulta **solo esos**: quien lo
  comparte ya ha elegido, y la zona entera son unos 44 segundos que nadie ha
  pedido.

Este filtro y el de la lista —distancia, franja y fecha— son de esta misma
fase y no se parecen en nada: **este puede costar una consulta al SEPE**,
porque puede marcarse algo que todavía no se sabe; el otro no cuesta ninguna
nunca. Por eso viven en sitios distintos y se prueban de formas distintas.

## Los filtros no le preguntan nada al SEPE

Sobre la lista que ya ha llegado se filtra por distancia, por franja y por
fecha, y se ordena. Todo ello son **funciones puras** en `src/interfaz/
filtros.ts`, y por eso responden al instante y no cuestan ni una petición: lo
caro —salir al SEPE— ya se pagó. `filtros-de-la-lista.tsx` es solo los controles.

- **La franja es la del primer hueco de cada oficina, no su agenda.** El
  desglose de días y horas del SEPE (`calendarioServicio`) exige el parámetro
  `documento`, y esta fase no pide DNI. La pantalla lo dice donde está el
  control, y no como letra pequeña: dejar creer que se ven todos los huecos de
  una oficina es la misma clase de mentira que contar un SEPE caído como «no
  hay citas».
- **El tope del control de distancia no es un radio de cien kilómetros: es no
  filtrar.** Si fuera un radio, una zona rural cuya oficina más cercana está a
  ciento veinte se quedaría sin lista y sin saber por qué.
- **«Esta semana» son siete días y lo dice la propia opción.** Una semana
  natural que acabe mañana convierte el filtro en algo que casi nunca deja
  nada, y quien lo lee no tendría cómo saber por qué.
- **Cuando no queda nada se dice qué filtro lo tapa, y solo si quitarlo basta.**
  `quienLasTapa` devuelve los que, **quitados ellos solos**, devuelven algún
  resultado. Cuando harían falta dos no se señala a ninguno: ofrecer quitar uno
  sería mandar a alguien a pulsar un botón que lo deja donde estaba.
- **El «hoy» es el del trámite, y no el de la cola.** La referencia es el
  `consultadoEn` del evento `tramite`, que es el instante con el que el SEPE
  contestó **esas horas**. El de la cola vale para lo suyo y no para esto: la
  cola se guarda un día entero (`VIDA_DE_LA_COLA_MS`), así que usarlo haría que
  «hoy» fuera ayer y dejara fuera todos los huecos de hoy sin decir por qué.
  Con el del trámite, además, una pestaña abierta desde ayer no cambia de
  opinión sola y los tests no dependen de la hora a la que se ejecuten.
- **Los filtros van en el fragmento, con el código postal y por lo mismo.** Una
  búsqueda ya filtrada se comparte tal cual sin que el alojamiento registre de
  dónde es quien la abre. Solo se escribe lo que se ha tocado, y con
  `replaceState`: mover el deslizador dejaría noventa y nueve paradas en el
  historial.

Dos consecuencias en los tests. La pantalla tiene ahora **dos regiones vivas**
—el resumen de la búsqueda y el contador de lo que dejan los filtros—, así que
cada una se pide por su nombre con `elResumen()` y `elContador()`, y no con
`getByRole('status')` a secas.

Y hay una segunda excepción al patrón de `userEvent`, escrita aquí por lo mismo
que la del techo del freno: **el deslizador de distancia se mueve con
`fireEvent.change`**. `userEvent` no sabe arrastrar un `range`, y llegar con las
flechas serían noventa y cinco pulsaciones por test. Que se pueda mover con el
teclado se prueba aparte, y ahí sí con la persona.

## El patrón de test: `montarApp()`

**Todo test empieza montando la aplicación con un `fetch` y un reloj falsos, en
una línea:**

```ts
import { montarApp } from './ayudantes/montar-app'

const { app, fetch, reloj } = montarApp()
```

Lo que devuelve:

- `app` — la aplicación armada, con sus dependencias ya inyectadas.
- `fetch` — el `fetch` grabado. `fetch.llamadas` es la lista de peticiones que
  se le han hecho al SEPE: contarlas es como se prueban el single-flight, la
  caché y el freno.
- `reloj` — `reloj.avanzar(2500)` mueve el tiempo sin gastarlo.

Admite `respuestas` —respuestas puestas a mano para los caminos que no hay
grabados: un error, un HTML de saturación—, `instanteInicial`, por si un test
necesita otra fecha, y `configuracion`, para el TTL de la caché, cuánto se
conserva una respuesta buena y el ancho de la clave. El reloj arranca por defecto en el instante de la segunda captura,
para que las fechas de los fixtures sigan siendo futuro.

Devuelve además el `almacen`, que es donde viven el freno y la caché. Sirve
para lo único que no se puede montar de otra forma:

```ts
const primera = montarApp()
const segunda = otraInvocacion(primera)   // otro proceso, mismo almacén
```

`otraInvocacion` monta **otra aplicación** con su memoria y su `fetch`
propios, compartiendo el reloj y el almacén. Es lo más parecido a dos
funciones serverless atendiendo a la vez, y es la única forma de comprobar lo
que de verdad se le pide al freno y a la caché: que valgan **entre**
invocaciones y no solo dentro de una. Un single-flight guardado en una
variable del proceso pasaría el test de dos búsquedas simultáneas y fallaría
en producción.

El ritmo de 2,5 s no es un parámetro que un test pueda bajar, y no lo será: un
test que necesite tiempo mueve el reloj, no el freno.

Lo que sí es un parámetro es el TTL de la caché y el ancho de su clave, y por
eso los tests de la caché se escriben **sobre el parámetro** y no sobre el
valor que tenga hoy: el día que la clave se ensanche a provincia, se cambia un
valor y los tests siguen diciendo lo mismo.

### Dos proyectos: `servidor` e `interfaz`

`npm test` los corre los dos. El de `servidor` es todo lo de arriba, en Node.
El de `interfaz` monta los `.tsx` con jsdom y `@testing-library/react`, y ahí
el patrón es otro: se pinta la pantalla y se usa como la usaría una persona.

```ts
const persona = userEvent.setup()
render(<Portada />)
await persona.type(screen.getByLabelText('Código postal'), '08401')
await persona.click(screen.getByRole('button', { name: /comprobar horas/i }))
```

Se busca por **rol y por nombre accesible** —`getByRole`, `getByLabelText`— y
no por clase ni por `data-testid`. No es preferencia: la mitad de lo que este
proyecto promete es que la lista se pueda recorrer con teclado y con lector de
pantalla, y buscar así es lo que hace que un test falle cuando eso se rompe.

Ahí la costura vuelve a ser el `fetch`, ahora el del navegador: la interfaz
habla con un Route Handler, y lo que hay detrás ya se ejercita entrando por la
ruta en el proyecto de `servidor`. Los dobles están en
`pruebas/interfaz/sepe-en-el-navegador.ts` y toman sus tipos del servidor, para
que una respuesta que cambie de forma no compile.

Como la búsqueda llega a trozos, ahí hay tres formas de contestar:
`apiQueContesta(pasadaDeUnTramite())` suelta la pasada de golpe y es la de casi
todos los tests; `apiQueVaContando()` suelta un evento cuando el test lo dice, y
es la única forma de mirar la pantalla **a mitad** de la pasada, que es donde
vive la mitad de lo que promete esta versión; y `apiQueContestaPorTurnos()`
contesta una cosa distinta a cada petición, que es como se prueba que una pasada
que no cabe en una invocación se continúa en la siguiente.

### Las dos únicas costuras

1. **El `fetch`.** El cliente SEPE y el geocodificador lo reciben por
   parámetro. Todo lo que hay por encima —parseo del HTML de los `<option>`,
   caché, freno, filtros, rutas— se ejercita de verdad.
2. **El reloj.** Porque el freno y la caducidad de la caché son tiempo, y sin
   esto o los tests esperan 2,5 segundos por petición o esas dos cosas se
   quedan sin probar.

No se añaden más costuras, y no se intercepta a nivel de red (MSW): añade una
capa que hay que depurar aparte y no cubre el reloj.

**El almacén compartido no es una tercera costura.** El de memoria es código
de producción —es el que corre en `npm run dev`— y el de Redis se construye
por encima del `fetch`, o sea de la costura que ya había: los tests lo
ejercitan de verdad, con un Redis de mentira que habla su protocolo REST.
`pruebas/almacen.test.ts` pasa la misma batería a los dos, que es lo que hace
que probar contra el de memoria diga algo sobre el que va desplegado.

### La única excepción: el techo del freno

Dos tests de `pruebas/cache-y-freno.test.ts` no montan la aplicación y hablan
con `crearFrenoCompartido` directamente. Está escrito aquí porque saltarse la
regla en silencio es peor que la excepción:

- **El techo de dos minutos no se ve desde arriba.** Quien pide ficha se rinde
  a los quince segundos, así que en cuanto el ritmo se endurece de verdad deja
  de haber peticiones —y de haber vacíos que lo endurezcan más—. Por encima de
  la costura, cualquier techo entre quince segundos y dos minutos se comporta
  igual. Medirlo exige preguntarle al freno.
- **Endurecerlo con búsquedas de verdad lo decide el jitter.** Con el ritmo ya
  doblado, la pausa que sale cae a un lado o a otro del plazo según el azar, y
  el test pasaría unas veces sí y otras no. Se le anotan los vacíos al freno y
  se acabó la moneda al aire.

Todo lo demás —caché, single-flight, ritmo, servir viejo, no saltarse el
freno— entra por `montarApp()` y se mide contando peticiones en el `fetch`
falso. Si mañana aparece una forma de ver el techo desde arriba, estos dos
tests sobran.

### Qué es un buen test aquí

Uno que solo mira **comportamiento externo**: entra un código postal, salen
unas oficinas. Nada de comprobar que se llamó a tal función interna, ni cuántas
veces, ni con qué argumentos. En cuanto existan Route Handlers, casi todos los
tests entran por ellos.

### La prueba de navegador

Hay **una**, en `pruebas/navegador/`, y el tope es **dos**. Recorre el camino
feliz en un Chromium de verdad: se escribe un código postal, salen las
oficinas, se ven los pines en el mapa y al filtrar quedan menos.

Existe por una sola razón: **en jsdom no hay WebGL, así que el mapa nunca se
monta**. Todo lo que hay entre `new Map()` y un pin pintado —la descarga de
MapLibre, el worker que copia `scripts/copiar-el-mapa.mjs`, el lienzo— no se
puede mirar de ninguna otra forma, y este proyecto ya sabe lo que es un mapa
que falla en silencio. Lo demás no entra aquí: entra por los Route Handlers
con el `fetch` grabado, que es donde sale barato.

Se ejecuta con `npm test` como los demás; `pretest` se encarga de que el
Chromium esté instalado —la primera vez en una máquina son unos 100 MB de
descarga; después es una comprobación de un cuarto de segundo—. Lo que hace por
debajo:

- Levanta `next dev` en un puerto libre y espera a que conteste. Es
  `pruebas/navegador/el-servidor.ts`, el `globalSetup` del proyecto
  `navegador` de `vitest.config.mts`.
- Corta la red del navegador: **solo pasan la propia aplicación y el estilo
  del mapa de fondo**, que se contesta desde el test. Todo lo demás se aborta
  y se apunta, y la prueba comprueba al final que no se ha apuntado nada.
- `POST /api/busqueda` la contesta el Route Handler de verdad montado con
  `montarApp()`, desde el proceso del test. Es el mismo patrón de siempre, y
  es lo que hace que la pasada no cueste los cuarenta segundos de freno que
  costaría con el reloj de pared.
- El mapa se mira como lo mira quien tiene la pantalla delante: se captura la
  región y se cuentan los píxeles del verde de «con hueco». Un lienzo de WebGL
  no tiene nodos que buscar. Se cuenta cuando el dibujo ha dejado de cambiar,
  porque la geometría de los grupos la calcula el worker de MapLibre y una
  captura suelta puede pillar la mitad de los puntos pintados.

La línea `.next/dev/dev/types/**/*.ts` de `tsconfig.json` la escribe `next` él
solo la primera vez que arranca, y va commiteada por eso: sin ella, cada `npm
test` —que ahora levanta la aplicación— dejaría `tsconfig.json` modificado en
el `git status` de quien los ejecute. No se le puede poner un comentario al
lado: `next` reescribe ese fichero como JSON y se los comería.

## Los fixtures

`pruebas/fixtures/sepe/` es tráfico real del SEPE, extraído de dos capturas de
red y **anonimizado al extraer**. Están generados: no se editan a mano.

Las capturas `.har` crudas **viven fuera del repositorio y no entran nunca**:
llevan el DNI en las URLs de la parte de reserva y el `JSESSIONID` en las
cabeceras. Para rehacer los fixtures con capturas nuevas:

```sh
npm run fixtures -- ~/ruta/a/las/capturas
```

**El extractor reconstruye el directorio entero en cada pasada**: lo que no
salga de las capturas que se le pasen, desaparece. Así los fixtures son siempre
exactamente lo que hay en las capturas y nada más, pero obliga a pasarle
**todas**, no solo la nueva. Lo cómodo es dejarlas juntas en `capturas/` —está
en `.gitignore`— y llamarlo sin argumentos.

Qué cuenta como dato personal está en `scripts/datos-personales.mjs`, en un
solo sitio: lo usan el extractor para limpiar y los tests para comprobar que lo
limpiado sigue limpio. El extractor aborta sin escribir nada si algo ha
sobrevivido a la anonimización, y al avisar dice cuántos y de qué tipo, nunca
cuáles: un aviso que imprime el DNI que acaba de encontrar lo deja escrito en
la consola y en el registro de CI, que es la fuga que se quería evitar.

Si un test pide al `fetch` falso algo que no está grabado, **falla con un error
que dice qué hay grabado**. No devuelve vacío: una respuesta vacía del SEPE es
un caso real con significado propio (medido: vacío y 46 oficinas en 30
segundos), y un test no debe poder confundirlo con «esto no estaba grabado».
