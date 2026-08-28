#!/usr/bin/env node
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Deja el worker de MapLibre donde el navegador pueda pedirlo.
 *
 * MapLibre descomprime y trocea las teselas en un worker, y averigua dónde
 * está su fichero con `import.meta.url`. Dentro de un bundle eso apunta al
 * bundle, no a `node_modules`: el worker arranca, no encuentra su módulo y se
 * muere sin decir nada. El mapa entonces pinta el fondo y ni una calle, que es
 * la peor forma de fallar que hay —parece que funciona—.
 *
 * Se copia en cada `dev` y en cada `build` en vez de guardarlo en el
 * repositorio para que no pueda quedarse atrás de la versión instalada: un
 * worker de una versión y una librería de otra es exactamente el fallo raro
 * que nadie encuentra.
 */

const AQUI = dirname(fileURLToPath(import.meta.url))
const DESDE = join(AQUI, '..', 'node_modules', 'maplibre-gl', 'dist')
const HASTA = join(AQUI, '..', 'public', 'mapa')

// El worker importa a su vez el módulo compartido, así que los dos tienen que
// acabar en el mismo sitio.
const FICHEROS = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

await rm(HASTA, { recursive: true, force: true })
await mkdir(HASTA, { recursive: true })
for (const fichero of FICHEROS) {
  await cp(join(DESDE, fichero), join(HASTA, fichero))
}
