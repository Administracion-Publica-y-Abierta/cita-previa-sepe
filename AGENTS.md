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
| `npm test` | Toda la batería de tests. |
| `npm run tipos` | Comprobación de tipos. |
| `npm run lint` | Reglas de estilo. |
| `npm run fixtures -- <ruta>` | Rehace los fixtures desde las capturas `.har`. |

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
