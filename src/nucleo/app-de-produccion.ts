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
