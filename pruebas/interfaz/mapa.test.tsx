import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Portada from '@/app/page'
import { apiQueContesta, oficina, respuesta } from './sepe-en-el-navegador'

/**
 * El mapa, probado desde donde se puede.
 *
 * En un test no hay WebGL —jsdom no pinta— y eso no es una limitación que
 * haya que rodear: es **exactamente** la situación de quien entra con un
 * navegador viejo, con la aceleración desactivada o con un lector de pantalla.
 * Lo que se prueba aquí es lo que esa persona tiene que seguir teniendo, que
 * es todo. Lo que el mapa dibuja cuando sí hay WebGL se prueba como datos en
 * `src/interfaz/mapa/`.
 */

const CODIGO_POSTAL = 'Código postal'
const BOTON = /comprobar horas/i
const VER_EL_MAPA = /ver .*mapa/i
const VOLVER = /volver a la lista/i

function montarPortada(): UserEvent {
  const persona = userEvent.setup()
  render(<Portada />)
  return persona
}

async function buscar(persona: UserEvent, codigoPostal: string): Promise<void> {
  await persona.type(screen.getByLabelText(CODIGO_POSTAL), codigoPostal)
  await persona.click(screen.getByRole('button', { name: BOTON }))
}

async function listaDeOficinas(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('list', { name: /oficinas/i }))
}

const DOS_OFICINAS = respuesta({
  oficinas: [
    oficina({ id: 1, nombre: 'GRANOLLERS-PERIFERIA - SEPE', primerHueco: '2026-08-17T09:00:00' }),
    oficina({ id: 2, nombre: 'MOLLET DEL VALLES - SEPE', primerHueco: null }),
  ],
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('el mapa y la lista, uno al lado del otro', () => {
  it('no hay mapa hasta que hay oficinas que enseñar', () => {
    montarPortada()

    expect(screen.queryByRole('region', { name: /mapa/i })).toBe(null)
    expect(screen.queryByRole('button', { name: VER_EL_MAPA })).toBe(null)
  })

  it('sale con la lista en cuanto llegan las oficinas', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_OFICINAS)

    await buscar(persona, '08402')
    await listaDeOficinas()

    expect(screen.getByRole('region', { name: /mapa/i })).toBeTruthy()
  })

  it('en un navegador que no puede pintar mapas la lista sigue estando entera', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_OFICINAS)

    await buscar(persona, '08402')

    // Sin WebGL no hay un solo punto dibujado, y aun así están las dos
    // oficinas con todo lo suyo. La lista no es el resumen del mapa: es el
    // resultado completo, y el mapa es la otra forma de mirarlo.
    const filas = within(await listaDeOficinas()).getAllByRole('listitem')
    expect(filas).toHaveLength(2)
    expect(filas[0].textContent).toContain('GRANOLLERS-PERIFERIA - SEPE')
    expect(filas[0].textContent).toContain('AVDA. MARIE CURIE, 25-27')
    expect(filas[1].textContent).toMatch(/sin hueco/i)
  })

  it('dice, para quien no lo ve, que en la lista está lo mismo que en el mapa', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_OFICINAS)

    await buscar(persona, '08402')
    await listaDeOficinas()

    expect(screen.getByRole('region', { name: /mapa/i }).textContent).toMatch(/lista/i)
  })
})

describe('el mapa en una pantalla de móvil', () => {
  it('se abre a pantalla completa y se vuelve a la lista, que sigue donde estaba', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_OFICINAS)

    await buscar(persona, '08402')
    await listaDeOficinas()

    // De pie en la calle no caben las dos cosas a la vez: se enseña una y se
    // pasa a la otra, y volver no puede costar una búsqueda nueva.
    await persona.click(screen.getByRole('button', { name: VER_EL_MAPA }))
    expect(screen.getByRole('button', { name: VOLVER })).toBeTruthy()

    await persona.click(screen.getByRole('button', { name: VOLVER }))
    expect(screen.queryByRole('button', { name: VOLVER })).toBe(null)
    expect(within(await listaDeOficinas()).getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('llegar hasta la oficina', () => {
  it('cada oficina se abre en la aplicación de mapas del móvil', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_OFICINAS)

    await buscar(persona, '08402')

    const fila = within(await listaDeOficinas()).getAllByRole('listitem')[0]
    const enlace = within(fila).getByRole('link', { name: /cómo llegar/i })

    // Las coordenadas y no la dirección escrita: la del SEPE no lleva
    // municipio, y buscarla tal cual manda a otra ciudad.
    expect(enlace.getAttribute('href')).toContain('41.594542,2.289705')
  })
})

describe('la oficina señalada', () => {
  it('pasar por una tarjeta la señala, y salirse la deja como estaba', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_OFICINAS)

    await buscar(persona, '08402')

    const filas = within(await listaDeOficinas()).getAllByRole('listitem')
    await persona.hover(filas[1])

    // Señalada aquí y resaltada en el mapa son la misma cosa: es el punto de
    // unión entre las dos vistas.
    expect(filas[1].getAttribute('aria-current')).toBe('true')
    expect(filas[0].hasAttribute('aria-current')).toBe(false)

    await persona.unhover(filas[1])
    expect(filas[1].hasAttribute('aria-current')).toBe(false)
  })

  it('llegar a una tarjeta con el teclado la señala igual que el ratón', async () => {
    const persona = montarPortada()
    apiQueContesta(DOS_OFICINAS)

    await buscar(persona, '08402')
    const filas = within(await listaDeOficinas()).getAllByRole('listitem')

    // Quien no usa ratón también relaciona las dos vistas: sin esto, la
    // sincronía entre lista y mapa sería solo para quien puede señalar.
    within(filas[1]).getAllByRole('link')[0].focus()

    await waitFor(() => expect(filas[1].getAttribute('aria-current')).toBe('true'))
  })
})
