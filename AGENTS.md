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
grabados: un error, un HTML de saturación— e `instanteInicial`, por si un test
necesita otra fecha. El reloj arranca por defecto en el instante de la segunda
captura, para que las fechas de los fixtures sigan siendo futuro.

El ritmo de 2,5 s no es un parámetro que un test pueda bajar, y no lo será: un
test que necesite tiempo mueve el reloj, no el freno.

### Las dos únicas costuras

1. **El `fetch`.** El cliente SEPE y el geocodificador lo reciben por
   parámetro. Todo lo que hay por encima —parseo del HTML de los `<option>`,
   caché, freno, filtros, rutas— se ejercita de verdad.
2. **El reloj.** Porque el freno y la caducidad de la caché son tiempo, y sin
   esto o los tests esperan 2,5 segundos por petición o esas dos cosas se
   quedan sin probar.

No se añaden más costuras, y no se intercepta a nivel de red (MSW): añade una
capa que hay que depurar aparte y no cubre el reloj.

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
