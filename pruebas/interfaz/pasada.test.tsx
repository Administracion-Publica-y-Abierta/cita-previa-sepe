import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buscar, listaDeOficinas, montarPortada } from './la-portada'
import {
  apiQueContestaPorTurnos,
  apiQueVaContando,
  cola,
  consultando,
  oficina,
  pendientes,
  resuelto,
} from './sepe-en-el-navegador'

/**
 * La búsqueda que va llegando, mirada desde la pantalla.
 *
 * Lo que se prueba aquí es lo que hace que valga la pena todo lo demás: que la
 * lista salga con el **primer** trámite y no a los cuarenta y cuatro segundos,
 * que se vea qué se está consultando mientras el resto viene, y que la
 * pantalla se pueda usar mientras tanto.
 */

const PRESTACION = { id: 501, nombre: 'Prestación contributiva' }
const SUBSIDIO = { id: 502, nombre: 'Subsidio por desempleo' }
const CERTIFICADO = { id: 503, nombre: 'Certificado de prestaciones' }

function filas(lista: HTMLElement): HTMLElement[] {
  return within(lista).getAllByRole('listitem')
}

describe('la búsqueda que va llegando', () => {
  it('enseña la lista con el primer trámite, sin esperar a los demás', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))

    api.contar(cola([PRESTACION, SUBSIDIO]))
    api.contar(consultando(PRESTACION))
    api.contar(
      resuelto({ tramite: PRESTACION, oficinas: [oficina({ id: 1, nombre: 'LA DEL PRIMER TRÁMITE' })] }),
    )

    // Con el segundo trámite todavía sin consultar, ya hay lista que mirar.
    await waitFor(() => expect(filas(screen.getByRole('list', { name: /oficinas/i }))).toHaveLength(1))
    expect(screen.getByText('LA DEL PRIMER TRÁMITE')).toBeTruthy()

    api.contar(consultando(SUBSIDIO))
    api.contar(resuelto({ tramite: SUBSIDIO, oficinas: [oficina({ id: 2, nombre: 'LA DEL SEGUNDO' })] }))
    api.cerrar()

    // Y el segundo entra al lado del primero, sin tirar lo que ya había.
    await waitFor(() => expect(filas(screen.getByRole('list', { name: /oficinas/i }))).toHaveLength(2))
    expect(screen.getByText('LA DEL PRIMER TRÁMITE')).toBeTruthy()
  })

  it('dice qué trámite se está consultando y cuánto falta', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))

    api.contar(cola([PRESTACION, SUBSIDIO, CERTIFICADO]))
    api.contar(consultando(PRESTACION))

    // Una pantalla callada cuarenta segundos es una pantalla que parece
    // colgada, y quien la ve así se va antes de que llegue nada.
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/prestación contributiva/i))
    expect(screen.getByRole('status').textContent).toMatch(/faltan 3 trámites/i)

    api.contar(resuelto({ tramite: PRESTACION, oficinas: [oficina({ id: 1 })] }))
    api.contar(consultando(SUBSIDIO))

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/subsidio por desempleo/i))
    expect(screen.getByRole('status').textContent).toMatch(/faltan 2 trámites/i)
    // Y lo que ya ha llegado se sigue contando mientras el resto viene.
    expect(screen.getByRole('status').textContent).toMatch(/1 oficina/i)
  })

  it('la pantalla se puede usar mientras siguen llegando resultados', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))

    api.contar(cola([PRESTACION, SUBSIDIO]))
    api.contar(consultando(PRESTACION))
    api.contar(resuelto({ tramite: PRESTACION, oficinas: [oficina({ id: 1, nombre: 'UNA' })] }))
    await waitFor(() => expect(filas(screen.getByRole('list', { name: /oficinas/i }))).toHaveLength(1))

    // Se señala una oficina con la pasada todavía a medias: la lista y el mapa
    // no se quedan bloqueados esperando a que termine.
    await persona.hover(filas(await listaDeOficinas())[0])
    expect(filas(await listaDeOficinas())[0].getAttribute('aria-current')).toBe('true')
    expect(screen.getByRole('status').textContent).toMatch(/falta/i)

    api.cerrar()
  })

  it('un trámite que el SEPE no contesta no se lleva por delante lo que sí llegó', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))

    api.contar(cola([PRESTACION, SUBSIDIO]))
    api.contar(resuelto({ tramite: PRESTACION, estado: 'sepe-no-responde', oficinas: [] }))
    api.contar(resuelto({ tramite: SUBSIDIO, oficinas: [oficina({ id: 1, nombre: 'LA QUE SÍ LLEGÓ' })] }))
    api.cerrar()

    await waitFor(() => expect(screen.getByText('LA QUE SÍ LLEGÓ')).toBeTruthy())
  })

  it('la misma oficina en dos trámites sale una vez, con el hueco más temprano y su trámite', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))

    api.contar(cola([PRESTACION, SUBSIDIO]))
    api.contar(
      resuelto({
        tramite: PRESTACION,
        oficinas: [oficina({ id: 1, nombre: 'GRANOLLERS', primerHueco: '2026-08-20T09:00:00' })],
      }),
    )
    api.contar(
      resuelto({
        tramite: SUBSIDIO,
        oficinas: [oficina({ id: 1, nombre: 'GRANOLLERS', primerHueco: '2026-08-17T09:00:00' })],
      }),
    )
    api.cerrar()

    // Una oficina es un sitio, y lo que se pregunta es cuándo es lo más pronto
    // que atienden ahí. Sin decir de qué trámite es esa hora, no sirve para ir.
    await waitFor(() => expect(filas(screen.getByRole('list', { name: /oficinas/i }))).toHaveLength(1))
    const fila = filas(await listaDeOficinas())[0]
    expect(fila.textContent).toMatch(/17 de agosto de 2026/)
    expect(fila.textContent).toContain('Subsidio por desempleo')
    // Y que ahí se atiende algo más: enseñar solo la hora más temprana sin
    // decirlo dejaría creer que esa oficina solo hace ese trámite.
    expect(fila.textContent).toMatch(/también tiene hueco para otro trámite/i)
  })

  it('el título cuenta los trámites que contestaron, no los que se intentaron', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))

    api.contar(cola([PRESTACION, SUBSIDIO, CERTIFICADO]))
    api.contar(resuelto({ tramite: PRESTACION, oficinas: [oficina({ id: 1 })] }))
    api.contar(resuelto({ tramite: SUBSIDIO, estado: 'sepe-no-responde', oficinas: [] }))
    api.contar(resuelto({ tramite: CERTIFICADO, estado: 'sin-agenda', oficinas: [] }))
    api.cerrar()

    // «Resultados de 3 trámites» con dos que no contestaron sería prometer en
    // el título lo que la lista no tiene.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
        'Resultados para «Prestación contributiva»',
      ),
    )
  })
})

describe('cuando la pasada no cabe en una respuesta', () => {
  it('vuelve a pedir solo lo que falta, y lo que faltaba entra en la lista', async () => {
    const persona = montarPortada()
    const api = apiQueContestaPorTurnos([
      [
        cola([PRESTACION, SUBSIDIO]),
        resuelto({ tramite: PRESTACION, oficinas: [oficina({ id: 1, nombre: 'LA PRIMERA' })] }),
        pendientes([SUBSIDIO]),
      ],
      [
        cola([PRESTACION, SUBSIDIO]),
        resuelto({ tramite: SUBSIDIO, oficinas: [oficina({ id: 2, nombre: 'LA SEGUNDA' })] }),
      ],
    ])

    await buscar(persona, '08402')

    await waitFor(() => expect(screen.getByText('LA SEGUNDA')).toBeTruthy())
    expect(screen.getByText('LA PRIMERA')).toBeTruthy()

    // Dos peticiones y ninguna preguntando «¿ya está?»: la segunda pide los
    // trámites que faltaban, y viajan solo sus identificadores.
    expect(api.peticiones).toEqual([
      { url: '/api/busqueda', cuerpo: { cp: '08402' } },
      { url: '/api/busqueda', cuerpo: { cp: '08402', tramites: [SUBSIDIO.id] } },
    ])
  })

  it('no encadena peticiones para siempre si lo que falta no mengua', async () => {
    const persona = montarPortada()
    const sinAvanzar = [cola([PRESTACION, SUBSIDIO]), pendientes([PRESTACION, SUBSIDIO])]
    const api = apiQueContestaPorTurnos([sinAvanzar, sinAvanzar, sinAvanzar])

    await buscar(persona, '08402')

    // Mejor no consultar nada que una cadena de peticiones al SEPE que no lleva
    // a ninguna parte. Pero se dice, y como lo que es: no se ha podido
    // preguntar. Por eso se busca en la alerta y no en el titular.
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/ningún trámite/i))
    expect(screen.getByRole('alert').textContent).not.toMatch(/no hay citas/i)
    expect(api.peticiones.length).toBeLessThanOrEqual(2)
  })

  it('lo que se quedó sin consultar se dice, en vez de enseñar lo traído como si fuera todo', async () => {
    const persona = montarPortada()
    apiQueContestaPorTurnos([
      [
        cola([PRESTACION, SUBSIDIO, CERTIFICADO]),
        resuelto({ tramite: PRESTACION, oficinas: [oficina({ id: 1 })] }),
        pendientes([SUBSIDIO, CERTIFICADO]),
      ],
      // La segunda invocación no avanza: se corta ahí.
      [cola([PRESTACION, SUBSIDIO, CERTIFICADO]), pendientes([SUBSIDIO, CERTIFICADO])],
    ])

    await buscar(persona, '08402')

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/han quedado 2 trámites sin consultar/i),
    )
    // Y lo que sí llegó se sigue contando: no se tira nada.
    expect(screen.getByRole('status').textContent).toMatch(/1 oficina/i)
  })
})
