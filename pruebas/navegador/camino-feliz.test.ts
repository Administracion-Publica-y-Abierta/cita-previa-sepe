import { afterAll, beforeAll, expect, inject, it } from 'vitest'
import { abrirLaPortada, pinesAsentados, pixelesConHueco, type ElNavegador } from './el-navegador'
import { CODIGO_POSTAL, elSepeGrabado, TRAMITE } from './el-sepe-grabado'

/**
 * El camino feliz, en un navegador de verdad: se escribe un código postal,
 * salen las oficinas, se ven los pines en el mapa y al filtrar cambia lo que
 * hay delante.
 *
 * **Es una sola prueba a propósito.** Una de estas cuesta levantar la
 * aplicación y un Chromium, y se rompe por cosas que no son fallos —un píxel,
 * una animación—. Lo que justifica esta es lo que no se puede probar de
 * ninguna otra forma: que el mapa se pinte. En jsdom no hay WebGL, así que en
 * los tests de interfaz el mapa **nunca se monta**; aquí sí, con su librería
 * descargada de verdad y su worker pedido al servidor. Ese worker es el fallo
 * mudo que describe `scripts/copiar-el-mapa.mjs` —el mapa pinta el fondo y ni
 * una calle— y es exactamente lo que aquí sale a cero pines.
 *
 * Todo lo demás —qué se le pregunta al SEPE, en qué orden, cuántas veces, qué
 * pasa cuando va mal, qué dice cada filtro— entra por los Route Handlers y por
 * los componentes, que es donde sale barato y no se rompe solo.
 */

/** Lo que la captura de 08402 tiene dentro. Si esto cambia, es que no son los fixtures. */
const OFICINAS = 46
const CON_HUECO = 37

/**
 * Las dos que quedan a dos kilómetros de Granollers, las dos con hueco y en el
 * orden en que las deja el filtro, que ordena por distancia.
 */
const LAS_DE_AL_LADO = ['GRANOLLERS-FRANQUESES - SEPE', 'GRANOLLERS-PERIFERIA - SEPE']

let navegador: ElNavegador

beforeAll(async () => {
  navegador = await abrirLaPortada(inject('servidor'), elSepeGrabado())
})

afterAll(async () => {
  await navegador?.cerrar()
})

it('se escribe un código postal, salen las oficinas con sus pines, y al filtrar quedan menos', async () => {
  const { pagina } = navegador

  await pagina.getByLabel('Código postal').fill(CODIGO_POSTAL)
  await pagina.getByRole('button', { name: /comprobar horas/i }).click()

  // Lo primero que se lee, y lo que dice si esto son los fixtures o no.
  await expect
    .poll(() => pagina.getByRole('status', { name: /resumen de la búsqueda/i }).textContent(), {
      timeout: 60_000,
    })
    .toBe(`${OFICINAS} oficinas cerca de Granollers, ${CON_HUECO} con hueco.`)

  // El título dice de qué trámite son estas oficinas, que es el que el SEPE
  // grabado tiene en el catálogo de la zona.
  expect(
    await pagina.getByRole('heading', { level: 2, name: `Resultados para «${TRAMITE.nombre}»` }).count(),
  ).toBe(1)

  const oficinas = pagina.getByRole('list', { name: /oficinas/i }).getByRole('listitem')
  expect(await oficinas.count()).toBe(OFICINAS)

  // El mapa: aquí no hay nodo que buscar ni texto que leer, hay una imagen.
  // Que tenga verde dentro es que los pines de las oficinas con hueco están
  // pintados, que es lo único que jsdom no puede decir.
  const mapa = pagina.getByRole('region', { name: 'Mapa de las oficinas' })
  await expect.poll(() => pixelesConHueco(pagina, mapa), { timeout: 60_000 }).toBeGreaterThan(0)

  // Y una vez hay algo pintado, el dibujo terminado: es el número contra el
  // que se compara después, y una captura a medias lo dejaría por debajo de lo
  // que deja el filtro sin que nada estuviera mal.
  const pinesDeLasCuarentaYseis = await pinesAsentados(pagina, mapa)

  // Filtrar es teclado y no un valor puesto por dentro: `Inicio` deja el
  // control en un kilómetro y una flecha lo sube a dos, que es lo que hay
  // hasta las dos oficinas de Granollers.
  const distancia = pagina.getByLabel(/Distancia máxima/)
  await distancia.focus()
  await pagina.keyboard.press('Home')
  await pagina.keyboard.press('ArrowRight')

  expect(await distancia.inputValue()).toBe('2')

  // El contador cuenta sobre el total y no sobre lo que queda: es lo que deja
  // ver que la lista está corta porque uno la ha acortado.
  await expect
    .poll(() => pagina.getByRole('status', { name: /oficinas que dejan los filtros/i }).textContent())
    .toContain(`${LAS_DE_AL_LADO.length} de ${OFICINAS} oficinas`)

  expect(await oficinas.count()).toBe(LAS_DE_AL_LADO.length)
  expect(await oficinas.allTextContents()).toEqual(
    LAS_DE_AL_LADO.map((nombre) => expect.stringContaining(nombre)),
  )

  // Y el mapa enseña lo mismo que la lista: con dos oficinas queda mucho menos
  // verde que con cuarenta y seis. Se le da plazo porque el mapa se rehace en
  // el fotograma siguiente, y en una máquina cargada ese fotograma tarda más
  // de lo que espera un sondeo normal.
  await expect
    .poll(() => pixelesConHueco(pagina, mapa), { timeout: 30_000 })
    .toBeLessThan(pinesDeLasCuarentaYseis)

  // Ni una petición ha salido de esta máquina: el SEPE de esta prueba es el de
  // las capturas, y el mapa de fondo se contesta desde aquí.
  expect(navegador.fueraDeAqui).toEqual([])
})
