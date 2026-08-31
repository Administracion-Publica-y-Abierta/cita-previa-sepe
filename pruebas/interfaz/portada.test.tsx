import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Portada from '@/app/page'
import { BOTON, buscar, campoDelCodigoPostal, listaDeOficinas, montarPortada } from './la-portada'
import {
  apiQueContesta,
  apiQueVaContando,
  cola,
  hueco,
  oficina,
  pasadaDeUnTramite,
  resuelto,
  tramite,
} from './sepe-en-el-navegador'

/**
 * La portada entera: lo que rodea a la búsqueda y lo que la búsqueda le hace a
 * la página.
 *
 * Lo de aquí no lo cubría nada hasta ahora porque no existía: la pantalla que
 * ganó la ronda de diseño llegó sin un solo test. Lo que se prueba es lo que
 * esa pantalla promete y lo de antes no hacía —que la vista baje sola a los
 * resultados, que el selector de trámites diga siempre cuánto hay marcado, que
 * las secciones de abajo estén y se puedan recorrer— y, sobre todo, que la
 * página entera **se recorra con el teclado en un orden que tenga sentido**.
 *
 * Lo demás sigue donde estaba: el resumen y los percances en `estados`, los
 * filtros en `filtros`, los trámites en `filtro`, el mapa en `mapa` y lo que se
 * abre sin cobertura en `sin-cobertura`. Este fichero no los repite.
 */

const COBRANDO = { id: 155, nombre: 'Estoy cobrando prestación/subsidio y ha cambiado mi situación' }
const EXTRANJERO = tramite({ id: 23, nombre: 'Voy a salir al extranjero', grupo: COBRANDO })
const JUBILAR = tramite({ id: 17, nombre: 'Me voy a jubilar', grupo: COBRANDO })

/**
 * `scrollIntoView` no existe en jsdom, así que se pone y se quita.
 *
 * Es la única forma de mirar esto: bajar a los resultados no deja rastro en el
 * DOM, y lo que hay que comprobar es que se pide —y **cuándo** se pide—, que es
 * justo donde está la decisión.
 */
function apuntarLoQueBaja(): ReturnType<typeof vi.fn> {
  const bajar = vi.fn()
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: bajar,
    writable: true,
  })
  return bajar
}

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('al buscar, la vista baja a los resultados', () => {
  it('baja cuando lo ha pedido una persona pulsando el botón', async () => {
    const bajar = apuntarLoQueBaja()
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())

    await buscar(persona, '08402')
    await listaDeOficinas()

    // La pasada dura casi un minuto y lo que hay que ver es cómo se va
    // llenando: quien se queda mirando el campo mientras la lista crece fuera
    // de la pantalla cree que no ha pasado nada.
    expect(bajar).toHaveBeenCalled()
  })

  it('no baja con un código postal mal escrito, que es cuando hay que mirar el campo', async () => {
    const bajar = apuntarLoQueBaja()
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())

    await buscar(persona, '084')

    await screen.findByRole('alert')
    // Lo que hay que ver es el aviso pegado al campo, y bajar a unos resultados
    // que no existen lo dejaría fuera de la pantalla.
    expect(bajar).not.toHaveBeenCalled()
  })

  it('no baja al abrir un enlace compartido: quien lo abre no ha pulsado nada', async () => {
    const bajar = apuntarLoQueBaja()
    apiQueContesta(pasadaDeUnTramite())
    window.history.replaceState(null, '', '/#cp=08402')

    render(<Portada />)
    await listaDeOficinas()

    // Una página que se mueve sola al cargar se lee como un fallo.
    expect(bajar).not.toHaveBeenCalled()
  })

  it('un envío que no arranca nada no deja la bajada apuntada para la siguiente búsqueda', async () => {
    const bajar = apuntarLoQueBaja()
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())

    await buscar(persona, '08402')
    await listaDeOficinas()
    expect(bajar).toHaveBeenCalledTimes(1)

    // Se teclea un código postal a medias y se envía: no arranca nada.
    await persona.clear(campoDelCodigoPostal())
    await persona.type(campoDelCodigoPostal(), '084')
    await persona.click(screen.getByRole('button', { name: BOTON }))
    await screen.findByRole('alert')

    // La siguiente búsqueda no la ha pedido el botón de buscar, así que la
    // página no puede dar un salto que nadie ha pedido.
    await persona.click(screen.getByRole('button', { name: /volver a comprobar/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: BOTON }).hasAttribute('disabled')).toBe(false))
    expect(bajar).toHaveBeenCalledTimes(1)
  })
})

describe('ordenar la lista', () => {
  it('reordena lo que ya está aquí sin volver a pedirle nada al SEPE', async () => {
    const persona = montarPortada()
    const api = apiQueContesta(
      pasadaDeUnTramite({
        oficinas: [
          oficina({ id: 1, nombre: 'LA DE AL LADO', km: 2, primerHueco: hueco(10, 9) }),
          oficina({ id: 2, nombre: 'LA DE LEJOS', km: 30, primerHueco: hueco(1, 9) }),
        ],
      }),
    )

    await buscar(persona, '08402')
    await listaDeOficinas()
    expect(await nombresDeLasOficinas()).toEqual(['LA DE AL LADO', 'LA DE LEJOS'])

    await persona.selectOptions(screen.getByLabelText(/ordenar/i), 'antes')

    // Ordenar es una comparación sobre lo que ya ha llegado: lo caro —salir al
    // SEPE— ya se pagó, y volver a pagarlo por cambiar de orden sería gastarle
    // al servicio una pasada que nadie ha pedido.
    expect(await nombresDeLasOficinas()).toEqual(['LA DE LEJOS', 'LA DE AL LADO'])
    expect(api.peticiones).toHaveLength(1)
  })
})

describe('el selector de trámites', () => {
  it('dice siempre cuántos hay marcados, también cuando no hay ninguno', async () => {
    const persona = montarPortada()
    apiQueContesta([
      cola([EXTRANJERO, JUBILAR]),
      resuelto({ tramite: EXTRANJERO, oficinas: [oficina({ id: 1 })] }),
      resuelto({ tramite: JUBILAR, oficinas: [oficina({ id: 2 })] }),
    ])

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Con ninguno marcado no se dice «0», que se leería como que no hay nada:
    // se dice lo que quiere decir, que es que se enseñan todos.
    expect(screen.getByText(/ninguno marcado: se enseñan los 2/i)).toBeTruthy()

    await persona.click(screen.getByRole('checkbox', { name: JUBILAR.nombre }))

    // Un recuento a la vista es lo que deja ver que la lista está corta porque
    // uno la ha acortado, y no porque no haya citas.
    await waitFor(() => expect(screen.getByText(/1 de 2 marcados/i)).toBeTruthy())
  })
})

describe('cuando el corte de distancia se lo lleva todo', () => {
  it('dice a cuánto está la más cercana, en vez de dejar la lista en blanco', async () => {
    const persona = montarPortada()
    apiQueContesta(
      pasadaDeUnTramite({
        oficinas: [oficina({ id: 1, nombre: 'LA DE LEJOS', km: 30, primerHueco: hueco(1, 9) })],
      }),
    )

    await buscar(persona, '08402')
    await listaDeOficinas()

    // El deslizador se mueve con `fireEvent`: `userEvent` no sabe arrastrar un
    // `range`, y es la excepción que ya estaba escrita.
    fireEvent.change(screen.getByLabelText(/distancia máxima/i), { target: { value: '5' } })

    // En una zona rural cuya oficina más próxima esté a ciento veinte, una
    // lista vacía sin este dato no dice si hay que ampliar el radio o cambiar
    // de zona.
    expect(screen.getByText(/la más cercana está a 30 km/i)).toBeTruthy()
  })
})

describe('mientras no se sabe qué trámites hay en la zona', () => {
  it('se dice que se están pidiendo, en vez de dejar el hueco vacío', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))

    // Descubrir el árbol de una zona nueva son unos treinta segundos con el
    // freno de por medio, y una franja en blanco debajo del campo se lee como
    // que falta algo.
    expect(screen.getByText(/pidiéndole al sepe qué trámites hay en tu zona/i)).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBe(null)

    api.contar(cola([EXTRANJERO, JUBILAR]))

    // Y en cuanto llega la cola —antes de que llegue una sola oficina— se puede
    // empezar a marcar.
    await screen.findByRole('checkbox', { name: EXTRANJERO.nombre })
    expect(screen.queryByText(/pidiéndole al sepe/i)).toBe(null)

    api.cerrar()
  })
})

describe('lo que se lee cuando no se está buscando', () => {
  it('explica cuándo salen las horas, que es lo único que hay para quien no encontró nada', () => {
    montarPortada()

    expect(screen.getByRole('heading', { name: /las horas no salen a cualquier hora/i })).toBeTruthy()
    // Y dicho como lo que es —una pista— y no como un horario que el SEPE no
    // publica en ninguna parte.
    expect(screen.getByText(/tómatelo como una pista/i)).toBeTruthy()
  })

  it('explica cómo funciona esto, y que el último paso no es aquí', () => {
    montarPortada()

    const como = screen.getByRole('heading', { name: /tres pasos/i })
    expect(como.textContent).toMatch(/el último no es aquí/i)
    expect(screen.getByRole('heading', { name: /reservas en el sepe/i })).toBeTruthy()
  })

  it('las preguntas están todas y se abren con el teclado', async () => {
    const persona = montarPortada()

    const preguntas = screen.getAllByText(/^¿/)
    expect(preguntas.length).toBeGreaterThanOrEqual(5)

    // Son `details` de verdad: se llega con el tabulador y se abren con Intro,
    // sin que nadie tenga que programar un acordeón.
    const primera = preguntas[0]
    primera.focus()
    expect(document.activeElement).toBe(primera)

    const cerrada = preguntas[1] as HTMLElement
    const suDetalle = cerrada.closest('details') as HTMLDetailsElement
    expect(suDetalle.open).toBe(false)

    await persona.click(cerrada)
    expect(suDetalle.open).toBe(true)
  })

  it('se llega a la sede del SEPE desde arriba y sin bajar a buscarla', () => {
    montarPortada()

    // Quien encuentra su hueco tiene el enlace a mano en la barra: subir a
    // buscarlo o rebuscarlo en el pie es perder la oficina que se acaba de ver.
    const enLaBarra = screen.getByRole('link', { name: /reservar en el sepe/i })
    expect(enLaBarra.getAttribute('href')).toBe('https://sede.sepe.gob.es/citaprevia')
  })
})

describe('lo que va apareciendo al bajar', () => {
  it('sin observador se enseña todo: el adorno no puede esconder la página', () => {
    // En jsdom no hay `IntersectionObserver`, que es exactamente lo que le pasa
    // a un navegador viejo. Lo que no puede pasar entonces es que las secciones
    // se queden escondidas para siempre esperando un aviso que no va a llegar.
    expect(typeof IntersectionObserver).toBe('undefined')

    montarPortada()

    const bloques = document.querySelectorAll('.aparece')
    expect(bloques.length).toBeGreaterThan(0)
    for (const bloque of bloques) {
      expect(bloque.getAttribute('data-dentro')).toBe('si')
    }
  })
})

describe('la portada se recorre entera con el teclado', () => {
  it('de la barra al campo y del campo al botón, sin nada por el camino que solo valga con ratón', async () => {
    const persona = montarPortada()

    const parada = await recorrer(persona, 12)

    // La barra va delante porque va delante en la página; lo que importa es
    // que el campo esté antes que el botón y que entre los dos no haya nada.
    const campo = parada.indexOf(campoDelCodigoPostal())
    const boton = parada.indexOf(screen.getByRole('button', { name: BOTON }))
    expect(campo).toBeGreaterThanOrEqual(0)
    expect(boton).toBe(campo + 1)
  })

  it('se sigue bajando hasta las preguntas, que también se recorren', async () => {
    const persona = montarPortada()

    const parada = await recorrer(persona, 30)
    const resumenes = screen.getAllByText(/^¿/)

    // La página no se acaba en el botón: quien navega con teclado tiene que
    // poder llegar a lo que explica de qué va esto.
    expect(parada).toContain(resumenes[0])
  })
})

/** Los elementos por los que se pasa tabulando desde el principio. */
async function recorrer(persona: UserEvent, saltos: number): Promise<Element[]> {
  const parada: Element[] = []
  document.body.focus()

  for (let salto = 0; salto < saltos; salto += 1) {
    await persona.tab()
    const enfocado = document.activeElement
    if (!enfocado || enfocado === document.body) break
    if (parada.includes(enfocado)) break
    parada.push(enfocado)
  }

  return parada
}

/** Los nombres de las oficinas que se ven ahora mismo, en el orden en que están. */
async function nombresDeLasOficinas(): Promise<string[]> {
  return within(await listaDeOficinas())
    .queryAllByRole('heading', { level: 3 })
    .map((titulo) => titulo.textContent ?? '')
}
