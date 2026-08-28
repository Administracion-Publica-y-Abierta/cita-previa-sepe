import { crearApp, type App } from './app'
import { relojDelSistema } from './reloj'

let app: App | undefined

/**
 * La aplicación tal como la usan los Route Handlers. Se memoriza a nivel de
 * módulo porque en serverless eso es lo único que sobrevive entre peticiones
 * dentro de una misma instancia; nada que dependa de ello puede darlo por
 * garantizado (el freno y la caché irán a un almacén compartido, no aquí).
 */
export function appDeProduccion(): App {
  app ??= crearApp({ fetch: globalThis.fetch, reloj: relojDelSistema })
  return app
}

/**
 * Solo para los tests: hace que los Route Handlers usen la aplicación montada
 * con el `fetch` y el reloj falsos. Lo llama `montarApp()`, así que ningún test
 * necesita saber que existe.
 *
 * No es una tercera costura. No entra en el código que se prueba: solo decide
 * cuál de las dos aplicaciones ven las rutas. Sin esto, un test que entrase por
 * la ruta de verdad —que es como se prueba aquí— saldría a la red de verdad.
 */
export function instalarApp(otra: App): void {
  app = otra
}
