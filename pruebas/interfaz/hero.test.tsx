import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Portada from '@/app/page'
import { apiQueContesta, oficina, respuesta } from './sepe-en-el-navegador'

/**
 * La primera pantalla, probada como la usa quien llega: se escribe un código
 * postal, se pulsa el botón y se lee la lista. Nada de comprobar estado
 * interno ni llamadas a funciones nuestras.
 *
 * Se monta la portada entera y no solo el hero: la mitad de lo que este issue
 * pide —que se entienda qué hace la web y qué no, que esto no es el SEPE, que
 * aquí no se reserva— vive en lo que hay alrededor del formulario, y probar el
 * hero suelto dejaría eso sin probar.
 */

const CODIGO_POSTAL = 'Código postal'
const BOTON = /comprobar horas/i

function montarPortada(): UserEvent {
  const persona = userEvent.setup()
  render(<Portada />)
  return persona
}

async function buscar(persona: UserEvent, codigoPostal: string): Promise<void> {
  await persona.type(screen.getByLabelText(CODIGO_POSTAL), codigoPostal)
  await persona.click(screen.getByRole('button', { name: BOTON }))
}

/** La lista de oficinas, una vez ha llegado. */
async function listaDeOficinas(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole('list', { name: /oficinas/i }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('la primera pantalla', () => {
  it('tiene un único campo y un único botón', () => {
    montarPortada()

    // Un solo campo de todo tipo, no solo un solo campo de texto: quien llega
    // no tiene que decidir nada antes de empezar.
    expect(document.querySelectorAll('input, select, textarea')).toHaveLength(1)
    expect(screen.getByLabelText(CODIGO_POSTAL)).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: BOTON })).toBeTruthy()
  })

  it('dice en la propia pantalla qué hace y qué no hace', () => {
    montarPortada()

    const texto = document.body.textContent ?? ''
    expect(texto).toMatch(/no es (la web d)?el sepe/i)
    expect(texto).toMatch(/proyecto independiente/i)
    // Lo que no hace, y es lo que más confusión ahorra: aquí no se reserva.
    expect(texto).toMatch(/no se reserva|todavía no se (puede )?reserva/i)
    expect(texto).toMatch(/pueden cambiar/i)
  })

  it('enseña el enlace a la sede oficial, que es donde se reserva de verdad', () => {
    montarPortada()

    const sede = screen.getByRole('link', { name: /sede electrónica del sepe/i })
    expect(sede.getAttribute('href')).toBe('https://sede.sepe.gob.es/citaprevia')
  })

  it('enseña el enlace al código fuente y dice que no se guarda ningún dato', () => {
    montarPortada()

    const fuente = screen.getByRole('link', { name: /código fuente/i })
    expect(fuente.getAttribute('href')).toContain('github.com')
    expect(document.body.textContent).toMatch(/qué guardamos de ti: nada/i)
  })

  it('no pide el DNI en ningún momento, ni antes ni después de buscar', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta())

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Sigue habiendo un solo campo, y no se llama DNI. Nadie entrega un dato
    // antes de saber si le merece la pena, y aquí tampoco después.
    expect(document.querySelectorAll('input, select, textarea')).toHaveLength(1)
    expect(screen.queryByLabelText(/dni|nif|documento/i)).toBe(null)
  })
})

describe('el campo de código postal', () => {
  it('no deja escribir nada que no sean cinco dígitos', async () => {
    const persona = montarPortada()

    const campo = screen.getByLabelText(CODIGO_POSTAL) as HTMLInputElement
    await persona.type(campo, '0a8b40-1 234')

    expect(campo.value).toBe('08401')
  })

  it('avisa de que faltan dígitos antes de lanzar una búsqueda que iba a fallar', async () => {
    const persona = montarPortada()
    const api = apiQueContesta(respuesta())

    await buscar(persona, '084')

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/cinco dígitos/i))
    expect(api.peticiones).toEqual([])
  })

  it('avisa de que no es español un código de cinco dígitos con provincia inexistente', async () => {
    const persona = montarPortada()
    const api = apiQueContesta(respuesta())

    await buscar(persona, '99999')

    expect((await screen.findByRole('alert')).textContent).toMatch(/no parece un código postal español/i)
    expect(api.peticiones).toEqual([])
  })

  it('marca el campo como inválido para quien no ve el aviso', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta())

    await buscar(persona, '084')

    const campo = screen.getByLabelText(CODIGO_POSTAL)
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    // El aviso está atado al campo: quien lo tenga enfocado lo oye sin tener
    // que ir a buscarlo por la página.
    expect(campo.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id)
  })

  it('el aviso desaparece en cuanto el código postal pasa a ser válido', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta())

    await buscar(persona, '084')
    expect(screen.queryByRole('alert')).toBeTruthy()

    await persona.type(screen.getByLabelText(CODIGO_POSTAL), '01')

    await waitFor(() => expect(screen.queryByRole('alert')).toBe(null))
  })
})

describe('la lista de oficinas del primer trámite', () => {
  it('sale tras buscar, con todo lo que hace falta de cada oficina', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta())

    await buscar(persona, '08402')

    const fila = within(await listaDeOficinas()).getByRole('listitem')
    expect(fila.textContent).toContain('GRANOLLERS-PERIFERIA - SEPE')
    expect(fila.textContent).toContain('AVDA. MARIE CURIE, 25-27')
    expect(fila.textContent).toContain('08:30 a 14:00')
    // La distancia, redondeada: los seis decimales que salen del cálculo no le
    // dicen nada a nadie.
    expect(fila.textContent).toMatch(/1,4\s*km/)
    // El teléfono es un enlace para poder llamar desde el móvil, que es donde
    // se va a usar esto.
    expect(within(fila).getByRole('link', { name: /0901010210/ }).getAttribute('href')).toBe('tel:0901010210')
  })

  it('enseña el primer hueco en hora española y no en la del servidor', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta())

    await buscar(persona, '08402')

    const fila = within(await listaDeOficinas()).getByRole('listitem')
    // Las nueve de la mañana del 17 de agosto es lo que dice el SEPE y lo que
    // tiene que leerse, esté el servidor en la zona que esté.
    expect(fila.textContent).toMatch(/17 de agosto de 2026/)
    expect(fila.textContent).toMatch(/9:00/)
  })

  it('distingue las oficinas con hueco de las que no lo tienen, y no solo por el color', async () => {
    const persona = montarPortada()
    apiQueContesta(
      respuesta({
        oficinas: [
          oficina({ id: 1, nombre: 'CON HUECO', primerHueco: '2026-08-17T09:00:00' }),
          oficina({ id: 2, nombre: 'SIN HUECO', primerHueco: null }),
        ],
      }),
    )

    await buscar(persona, '08402')

    const filas = within(await listaDeOficinas()).getAllByRole('listitem')
    expect(filas[0].textContent).toMatch(/con hueco/i)
    expect(filas[1].textContent).toMatch(/sin hueco/i)
  })

  it('dice de qué trámite son las oficinas, con el nombre que le da el SEPE', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta())

    await buscar(persona, '08402')

    // La lista son las oficinas *de algo*, y quien pregunta no ha elegido ese
    // algo: sin decirlo, no se puede leer.
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /resultado/i }).textContent).toContain(
        'Voy a salir al extranjero',
      ),
    )
  })

  it('resume en una línea lo que ha salido, para que un lector de pantalla lo anuncie', async () => {
    const persona = montarPortada()
    apiQueContesta(
      respuesta({
        oficinas: [
          oficina({ id: 1, primerHueco: '2026-08-17T09:00:00' }),
          oficina({ id: 2, primerHueco: null }),
        ],
      }),
    )

    await buscar(persona, '08402')

    // Un `status` es una región viva: se anuncia sola al cambiar, sin robar el
    // foco. La lista entera no puede estar dentro —cuarenta y seis oficinas
    // leídas de corrido no las aguanta nadie—, así que se anuncia el resumen.
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/2 oficinas/))
    expect(screen.getByRole('status').textContent).toMatch(/1 con hueco/)
  })

  it('se recorre entera con el teclado', async () => {
    const persona = montarPortada()
    apiQueContesta(
      respuesta({
        oficinas: [
          oficina({ id: 1, nombre: 'PRIMERA', telefono: '900000001' }),
          oficina({ id: 2, nombre: 'SEGUNDA', telefono: '900000002' }),
        ],
      }),
    )

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Desde el campo se llega a los teléfonos de las dos oficinas tabulando, y
    // sin pasar por ningún sitio que no se pueda enfocar: la lista es el camino
    // equivalente al mapa, no un adorno que se ve pero no se recorre.
    const alcanzables: string[] = []
    screen.getByLabelText(CODIGO_POSTAL).focus()
    for (let salto = 0; salto < 12; salto += 1) {
      await persona.tab()
      const enfocado = document.activeElement
      if (enfocado instanceof HTMLElement && enfocado.textContent) alcanzables.push(enfocado.textContent)
    }

    expect(alcanzables.join(' | ')).toContain('900000001')
    expect(alcanzables.join(' | ')).toContain('900000002')
  })

  it('un trámite sin ninguna oficina con hueco se dice, no se enseña una lista vacía', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta({ oficinas: [oficina({ primerHueco: null })] }))

    await buscar(persona, '08402')

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/ninguna con hueco|0 con hueco/i),
    )
  })
})

describe('mientras se busca y cuando la búsqueda no sale', () => {
  it('avisa de que está buscando, y de que tarda porque el SEPE se pregunta despacio', async () => {
    const persona = montarPortada()
    // El `fetch` que nunca contesta: es la única forma de mirar el estado de
    // "buscando" sin carreras.
    vi.stubGlobal('fetch', () => new Promise<Response>(() => {}))

    await buscar(persona, '08402')

    const esperando = await screen.findByRole('status')
    expect(esperando.textContent).toMatch(/buscando/i)
    expect(screen.getByRole('button', { name: BOTON }).hasAttribute('disabled')).toBe(true)
  })

  it('un SEPE que no responde se cuenta como avería y no como "no hay citas"', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta({ estado: 'sepe-no-responde', tramite: null, oficinas: [] }))

    await buscar(persona, '08402')

    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/no (está )?respond/i))
    expect(screen.queryByRole('list', { name: /oficinas/i })).toBe(null)
  })

  it('un código postal que el servidor rechaza se enseña como aviso del campo', async () => {
    const persona = montarPortada()
    apiQueContesta({
      estado: 400,
      cuerpo: { error: 'codigo-postal-invalido', mensaje: 'El código postal debe tener cinco dígitos.' },
    })

    // El navegador lo da por bueno y lo tumba el servidor, que es la
    // autoridad. Hoy los dos usan la misma tabla de provincias y no pueden
    // discrepar; el día que discrepen, quien pregunta tiene que enterarse
    // pegado al campo y no en una pantalla de avería.
    await buscar(persona, '08402')

    expect((await screen.findByRole('alert')).textContent).toMatch(/código postal/i)
  })
})

describe('lo que la web recuerda', () => {
  it('propone el último código postal usado la próxima vez', async () => {
    const primera = montarPortada()
    apiQueContesta(respuesta())
    await buscar(primera, '08402')
    await listaDeOficinas()

    // Otra visita: el navegador es el mismo, la página se monta de cero.
    screen.getByLabelText(CODIGO_POSTAL) // el de la primera visita, aún montado
    window.history.replaceState(null, '', '/')
    render(<Portada />)

    const campos = screen.getAllByLabelText(CODIGO_POSTAL) as HTMLInputElement[]
    expect(campos.at(-1)?.value).toBe('08402')
  })

  it('lo recuerda en el navegador y no en ningún servidor nuestro', async () => {
    const persona = montarPortada()
    const api = apiQueContesta(respuesta())

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Lo único que sale hacia fuera es la consulta, y va en el cuerpo de un
    // POST: la URL de la API no lleva el código postal dentro.
    expect(api.peticiones).toHaveLength(1)
    expect(api.peticiones[0].url).not.toContain('08402')
    expect(api.peticiones[0].cuerpo).toEqual({ cp: '08402' })
    expect(window.localStorage.getItem('ultimo-codigo-postal')).toBe('08402')
  })
})

describe('la búsqueda en la dirección de la página', () => {
  it('queda reflejada al buscar', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta())

    await buscar(persona, '08402')
    await listaDeOficinas()

    expect(window.location.hash).toBe('#cp=08402')
  })

  it('va en el fragmento, que es la parte de la URL que no viaja al servidor', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta())

    await buscar(persona, '08402')
    await listaDeOficinas()

    // La regla de este proyecto es que el código postal no aparezca en ninguna
    // URL que el alojamiento registre. El fragmento no se manda en la petición
    // —ni siquiera al abrir el enlace—, así que la búsqueda se puede compartir
    // sin que quede escrito de dónde es quien la abre.
    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/')
  })

  it('abrir un enlace compartido enseña la misma búsqueda, sin tocar nada', async () => {
    const api = apiQueContesta(respuesta())
    window.history.replaceState(null, '', '/#cp=08402')

    render(<Portada />)

    expect(within(await listaDeOficinas()).getAllByRole('listitem')).toHaveLength(1)
    expect((screen.getByLabelText(CODIGO_POSTAL) as HTMLInputElement).value).toBe('08402')
    expect(api.peticiones).toEqual([{ url: '/api/oficinas', cuerpo: { cp: '08402' } }])
  })

  it('un fragmento con basura dentro no lanza ninguna búsqueda', async () => {
    const api = apiQueContesta(respuesta())
    window.history.replaceState(null, '', '/#cp=no-es-un-codigo-postal')

    render(<Portada />)

    await waitFor(() => expect(screen.getByRole('button', { name: BOTON })).toBeTruthy())
    expect(api.peticiones).toEqual([])
    expect((screen.getByLabelText(CODIGO_POSTAL) as HTMLInputElement).value).toBe('')
  })
})
