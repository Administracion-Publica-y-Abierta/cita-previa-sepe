import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Portada from '@/app/page'
import { buscar, campoDelCodigoPostal, listaDeOficinas, montarPortada } from './la-portada'
import {
  apiQueContesta,
  apiQueContestaPorTurnos,
  apiQueVaContando,
  cola,
  consultando,
  oficina,
  resuelto,
  tramite,
} from './sepe-en-el-navegador'

/**
 * El filtro de trámites, mirado desde la pantalla.
 *
 * Lo que se prueba aquí es lo que hace que marcar sirva de algo con una
 * búsqueda que va llegando: que marcar lo que no se ha consultado lo meta en
 * la cola en vez de relanzar la búsqueda, y que desmarcar no tire lo que ya
 * costó una consulta al SEPE.
 */

/** Dos grupos del SEPE de verdad: son los nombres de sus combos «Trámite». */
const COBRANDO = { id: 155, nombre: 'Estoy cobrando prestación/subsidio y ha cambiado mi situación' }
const FINALIZADO = { id: 158, nombre: 'He finalizado un trabajo' }

const EXTRANJERO = tramite({ id: 23, nombre: 'Voy a salir al extranjero', grupo: COBRANDO })
const JUBILAR = tramite({ id: 17, nombre: 'Me voy a jubilar', grupo: COBRANDO })
const REANUDAR = tramite({ id: 14, nombre: 'Quiero reanudar mi prestación', grupo: FINALIZADO })

const LA_DEL_EXTRANJERO = oficina({ id: 1, nombre: 'LA DEL EXTRANJERO' })
const LA_DE_JUBILARSE = oficina({ id: 2, nombre: 'LA DE JUBILARSE' })

/** Los tres trámites de la zona, los dos primeros ya consultados. */
const DOS_CONSULTADOS = [
  cola([EXTRANJERO, JUBILAR, REANUDAR]),
  resuelto({ tramite: EXTRANJERO, oficinas: [LA_DEL_EXTRANJERO] }),
  resuelto({ tramite: JUBILAR, oficinas: [LA_DE_JUBILARSE] }),
]

function casilla(tramite: { nombre: string }): HTMLInputElement {
  return screen.getByRole('checkbox', { name: tramite.nombre }) as HTMLInputElement
}

function nombresDeLasOficinas(lista: HTMLElement): string[] {
  return within(lista)
    .getAllByRole('listitem')
    .map((fila) => within(fila).getByRole('heading').textContent ?? '')
}

describe('los trámites que se pueden marcar', () => {
  it('salen agrupados como los agrupa el SEPE y con sus mismos nombres', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_CONSULTADOS)

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Es la agrupación del SEPE, no una nuestra: el grupo es el trámite que en
    // su sede se elige antes del subtrámite, y quien pregunta reconoce el suyo
    // por ese par de nombres.
    const grupo = screen.getByRole('group', { name: COBRANDO.nombre })
    expect(within(grupo).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(grupo).getByRole('checkbox', { name: EXTRANJERO.nombre })).toBeTruthy()
    expect(within(grupo).getByRole('checkbox', { name: JUBILAR.nombre })).toBeTruthy()

    const otro = screen.getByRole('group', { name: FINALIZADO.nombre })
    expect(within(otro).getAllByRole('checkbox')).toHaveLength(1)
  })

  it('no salen antes de que se sepa qué hay en la zona', () => {
    montarPortada()

    // Un filtro con la lista vacía no filtra nada y es una pantalla más que
    // entender antes de haber visto un solo resultado.
    expect(screen.queryByRole('checkbox')).toBe(null)
  })

  it('se marcan con el teclado, dentro del grupo que les pone nombre', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_CONSULTADOS)

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Del campo al botón, y del botón a la primera casilla: se llega sin ratón
    // y se marca con la barra espaciadora, que es lo que hace el navegador con
    // una casilla de verdad y lo que un lector de pantalla sabe anunciar.
    campoDelCodigoPostal().focus()
    await persona.tab()
    await persona.tab()

    expect(document.activeElement).toBe(casilla(EXTRANJERO))
    await persona.keyboard(' ')
    expect(casilla(EXTRANJERO).checked).toBe(true)
  })
})

describe('marcar varios trámites a la vez', () => {
  it('sin marcar nada se enseñan todos', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_CONSULTADOS)

    await buscar(persona, '08402')

    expect(nombresDeLasOficinas(await listaDeOficinas())).toEqual(['LA DEL EXTRANJERO', 'LA DE JUBILARSE'])
    expect(casilla(EXTRANJERO).checked).toBe(false)
  })

  it('marcar uno estrecha la lista, y marcar el segundo la vuelve a abrir', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_CONSULTADOS)

    await buscar(persona, '08402')
    await listaDeOficinas()

    await persona.click(casilla(JUBILAR))
    expect(nombresDeLasOficinas(await listaDeOficinas())).toEqual(['LA DE JUBILARSE'])

    // Quien no sabe cómo se llama su trámite marca los que le suenan, y ve las
    // oficinas de todos a la vez sin tener que acertar a la primera.
    await persona.click(casilla(EXTRANJERO))
    expect(nombresDeLasOficinas(await listaDeOficinas())).toEqual(['LA DEL EXTRANJERO', 'LA DE JUBILARSE'])
  })

  it('desmarcar lo saca de la vista sin perderlo, y volver a marcarlo no gasta otra consulta', async () => {
    const persona = montarPortada()
    const api = apiQueContesta(DOS_CONSULTADOS)

    await buscar(persona, '08402')
    await listaDeOficinas()

    await persona.click(casilla(EXTRANJERO))
    await persona.click(casilla(JUBILAR))
    await persona.click(casilla(JUBILAR))

    expect(nombresDeLasOficinas(await listaDeOficinas())).toEqual(['LA DEL EXTRANJERO'])

    // Lo desmarcado no se tira: sigue en la pantalla y vuelve tal cual. Al
    // SEPE no se le ha vuelto a preguntar nada.
    await persona.click(casilla(JUBILAR))
    expect(nombresDeLasOficinas(await listaDeOficinas())).toEqual(['LA DEL EXTRANJERO', 'LA DE JUBILARSE'])
    expect(api.peticiones).toHaveLength(1)
  })

  it('el botón de quitar el filtro devuelve el resultado entero', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_CONSULTADOS)

    await buscar(persona, '08402')
    await listaDeOficinas()
    await persona.click(casilla(JUBILAR))

    await persona.click(screen.getByRole('button', { name: /ver todos los trámites/i }))

    expect(nombresDeLasOficinas(await listaDeOficinas())).toEqual(['LA DEL EXTRANJERO', 'LA DE JUBILARSE'])
    expect(casilla(JUBILAR).checked).toBe(false)
  })
})

describe('marcar algo que todavía no se ha consultado', () => {
  it('lo mete en la cola y sus oficinas entran cuando llegan, sin relanzar la búsqueda', async () => {
    // Se llega por un enlace con un trámite ya elegido: la primera pasada
    // consulta solo ese, y el otro se marca después.
    window.history.replaceState(null, '', `/#cp=08402&t=${EXTRANJERO.id}`)
    const api = apiQueContestaPorTurnos([
      [cola([EXTRANJERO, JUBILAR]), resuelto({ tramite: EXTRANJERO, oficinas: [LA_DEL_EXTRANJERO] })],
      [cola([EXTRANJERO, JUBILAR]), resuelto({ tramite: JUBILAR, oficinas: [LA_DE_JUBILARSE] })],
    ])
    const persona = montarPortada()

    await listaDeOficinas()
    await persona.click(casilla(JUBILAR))

    await waitFor(() => expect(screen.getByText('LA DE JUBILARSE')).toBeTruthy())
    // Lo de antes sigue donde estaba: no se ha vuelto a empezar, se ha sumado.
    expect(screen.getByText('LA DEL EXTRANJERO')).toBeTruthy()
    expect(api.peticiones).toEqual([
      { url: '/api/busqueda', cuerpo: { cp: '08402', tramites: [EXTRANJERO.id] } },
      { url: '/api/busqueda', cuerpo: { cp: '08402', tramites: [JUBILAR.id] } },
    ])
  })

  it('lo que ya viene de camino no se pide dos veces', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))

    api.contar(cola([EXTRANJERO, JUBILAR]))
    api.contar(resuelto({ tramite: EXTRANJERO, oficinas: [LA_DEL_EXTRANJERO] }))
    api.contar(consultando(JUBILAR))
    await listaDeOficinas()

    // La pasada de la zona entera ya lo trae: marcarlo mientras viene no puede
    // abrir una segunda cola peleándose por las fichas del freno.
    await persona.click(casilla(JUBILAR))
    api.contar(resuelto({ tramite: JUBILAR, oficinas: [LA_DE_JUBILARSE] }))
    api.cerrar()

    await waitFor(() => expect(screen.getByText('LA DE JUBILARSE')).toBeTruthy())
    expect(api.peticiones).toHaveLength(1)
  })

  it('lo marcado mientras corre una pasada espera a que termine, y sale detrás', async () => {
    // Se llega por un enlace con un trámite elegido y se marca otro **con la
    // pasada todavía abierta**: dos pasadas a la vez serían dos colas
    // peleándose por las fichas del freno del SEPE.
    window.history.replaceState(null, '', `/#cp=08402&t=${EXTRANJERO.id}`)
    const api = apiQueVaContando()
    const persona = montarPortada()

    await waitFor(() => expect(api.peticiones).toHaveLength(1))
    api.contar(cola([EXTRANJERO, JUBILAR, REANUDAR]))
    api.contar(consultando(EXTRANJERO))

    // El filtro sale con la cola, antes de que llegue un solo trámite: se
    // puede empezar a marcar mientras el resto viene.
    await screen.findByRole('checkbox', { name: REANUDAR.nombre })
    await persona.click(casilla(REANUDAR))

    // Con la pasada abierta no se ha pedido nada nuevo: está apuntado.
    expect(api.peticiones).toHaveLength(1)

    api.contar(resuelto({ tramite: EXTRANJERO, oficinas: [LA_DEL_EXTRANJERO] }))
    api.cerrar()

    await waitFor(() => expect(api.peticiones).toHaveLength(2))
    expect(api.peticiones[1].cuerpo).toEqual({ cp: '08402', tramites: [REANUDAR.id] })

    api.contar(cola([EXTRANJERO, JUBILAR, REANUDAR]))
    api.contar(resuelto({ tramite: REANUDAR, oficinas: [oficina({ id: 3, nombre: 'LA DE REANUDAR' })] }))
    api.cerrar()

    await waitFor(() => expect(screen.getByText('LA DE REANUDAR')).toBeTruthy())
    // Y lo de antes sigue donde estaba: se ha sumado, no se ha empezado otra vez.
    expect(screen.getByText('LA DEL EXTRANJERO')).toBeTruthy()
  })
  it('lo que se desmarca antes de que le llegue el turno se cae de la cola', async () => {
    window.history.replaceState(null, '', `/#cp=08402&t=${EXTRANJERO.id}`)
    const api = apiQueVaContando()
    const persona = montarPortada()

    await waitFor(() => expect(api.peticiones).toHaveLength(1))
    api.contar(cola([EXTRANJERO, JUBILAR, REANUDAR]))
    await screen.findByRole('checkbox', { name: REANUDAR.nombre })

    await persona.click(casilla(REANUDAR))
    await persona.click(casilla(REANUDAR))

    api.contar(resuelto({ tramite: EXTRANJERO, oficinas: [LA_DEL_EXTRANJERO] }))
    api.cerrar()
    await waitFor(() => expect(screen.getByText('LA DEL EXTRANJERO')).toBeTruthy())

    // Una petición al SEPE que nadie va a leer es una petición que le hemos
    // quitado a otro.
    expect(api.peticiones).toHaveLength(1)
  })
})

describe('los trámites marcados y la dirección de la página', () => {
  it('quedan escritos en la dirección, para poder compartir la búsqueda con ellos', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_CONSULTADOS)

    await buscar(persona, '08402')
    await listaDeOficinas()
    await persona.click(casilla(JUBILAR))

    expect(window.location.hash).toBe(`#cp=08402&t=${JUBILAR.id}`)

    // Y al quitarlos vuelve a ser la búsqueda de siempre: un enlace con la
    // lista entera dentro diría lo mismo y sería ilegible.
    await persona.click(casilla(JUBILAR))
    expect(window.location.hash).toBe('#cp=08402')
  })

  it('se restauran al abrir el enlace, y solo se consulta lo que trae', async () => {
    window.history.replaceState(null, '', `/#cp=08402&t=${JUBILAR.id}`)
    const api = apiQueContesta([cola([EXTRANJERO, JUBILAR]), resuelto({ tramite: JUBILAR, oficinas: [LA_DE_JUBILARSE] })])

    render(<Portada />)
    await listaDeOficinas()

    expect(casilla(JUBILAR).checked).toBe(true)
    expect(casilla(EXTRANJERO).checked).toBe(false)
    // Quien comparte el enlace ya ha elegido: consultar la zona entera sería
    // gastarle al SEPE lo que nadie ha pedido.
    expect(api.peticiones).toEqual([{ url: '/api/busqueda', cuerpo: { cp: '08402', tramites: [JUBILAR.id] } }])
  })

  it('una búsqueda nueva no arrastra los trámites de la zona anterior', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_CONSULTADOS)

    await buscar(persona, '08402')
    await listaDeOficinas()
    await persona.click(casilla(JUBILAR))

    await persona.clear(campoDelCodigoPostal())
    await buscar(persona, '08401')

    // Los identificadores de otra zona no son estos: dejarlos marcados sería
    // filtrar por algo que aquí no existe.
    await waitFor(() => expect(window.location.hash).toBe('#cp=08401'))
    expect(casilla(JUBILAR).checked).toBe(false)
  })
})
