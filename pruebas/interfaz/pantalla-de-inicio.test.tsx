import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { unAndroid, unIpad, unIphone, unOrdenador, yaEnLaPantallaDeInicio } from './el-movil'
import { montarPortada } from './la-portada'

/**
 * Cómo se explica que esto se añade a la pantalla de inicio, y qué se dice de
 * los avisos que todavía no existen.
 *
 * Lo primero es trabajo obligatorio y no un adorno: en el iPhone **no hay
 * botón**. Chrome en Android ofrece instalar la web él solo; Safari no ofrece
 * nada, y sin decírselo, quien mira desde un iPhone no se entera de que esto se
 * puede tener como una aplicación. Y de paso es la restricción que manda sobre
 * la fase siguiente: en iOS los avisos solo existen si la web está en la
 * pantalla de inicio.
 *
 * Lo segundo es una regla de honradez de las de esta web: los avisos son la
 * razón por la que alguien la añadiría, y **hoy no existen**. Se dice que están
 * en camino, y no se pone ni un botón ni una casilla que dé a entender que se
 * pueden activar.
 */

function lasInstrucciones(): HTMLElement | null {
  return screen.queryByRole('region', { name: /pantalla de inicio/i })
}

describe('las instrucciones para añadirla a la pantalla de inicio', () => {
  it('en el iPhone se explican paso a paso, porque ahí no hay botón que las dé', () => {
    unIphone()
    montarPortada()

    const instrucciones = lasInstrucciones()
    expect(instrucciones?.textContent).toMatch(/compartir/i)
    expect(instrucciones?.textContent).toMatch(/añadir a pantalla de inicio/i)
  })

  it('también en el iPad, que dice ser un Mac y no lo es', () => {
    unIpad()
    montarPortada()

    expect(lasInstrucciones()).not.toBe(null)
  })

  it('en Android no se explican: ahí el navegador lo ofrece él solo', () => {
    unAndroid()
    montarPortada()

    // Explicar a mano lo que el navegador ya ofrece es una pantalla más que
    // leer, y encima con unos pasos que en Android no se llaman así.
    expect(lasInstrucciones()).toBe(null)
  })

  it('en un ordenador tampoco: esto se añade a la pantalla de inicio de un móvil', () => {
    unOrdenador()
    montarPortada()

    expect(lasInstrucciones()).toBe(null)
  })

  it('no se repiten a quien ya la tiene añadida', () => {
    unIphone()
    yaEnLaPantallaDeInicio()
    montarPortada()

    expect(lasInstrucciones()).toBe(null)
  })
})

describe('lo que se dice de los avisos', () => {
  it('se dice que están en camino y que hoy no existen', () => {
    montarPortada()

    const avisos = screen.getByText(/avisos/i)
    expect(avisos.textContent).toMatch(/todavía no/i)
    expect(avisos.textContent).toMatch(/en camino/i)
  })

  it('no hay nada que se pueda pulsar para activarlos, porque no hay nada que activar', () => {
    unIphone()
    montarPortada()

    // Un botón de «activar avisos» que no avisa de nada es exactamente la
    // promesa que esta fase no puede hacer: quien lo pulsara se iría creyendo
    // que ya no tiene que volver a mirar.
    expect(screen.queryByRole('button', { name: /avis|notific/i })).toBe(null)
    expect(screen.queryByRole('checkbox', { name: /avis|notific/i })).toBe(null)
  })
})
