import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Portada from '@/app/page'
import { BOTON, buscar, campoDelCodigoPostal, CODIGO_POSTAL, listaDeOficinas, montarPortada } from './la-portada'
import {
  apiQueContesta,
  apiQueContestaCuandoSeLeDiga,
  apiQueNoContesta,
  oficina,
  respuesta,
} from './sepe-en-el-navegador'

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

    expect(screen.getByText(/esto no es el sepe/i)).toBeTruthy()
    expect(screen.getAllByText(/proyecto independiente/i).length).toBeGreaterThan(0)
    // Lo que no hace, y es lo que más confusión ahorra: aquí no se reserva.
    expect(screen.getByText(/todavía no se reserva la cita/i)).toBeTruthy()
    expect(screen.getByText(/pueden cambiar en cualquier momento/i)).toBeTruthy()
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
    expect(screen.getByText(/qué guardamos de ti: nada/i)).toBeTruthy()
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

    const campo = campoDelCodigoPostal()
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

  it('avisa en el momento, sin esperar al botón, en cuanto están los cinco dígitos', async () => {
    const persona = montarPortada()
    const api = apiQueContesta(respuesta())

    await persona.type(screen.getByLabelText(CODIGO_POSTAL), '99999')

    // Nadie ha pulsado nada: con los cinco dígitos puestos ya se sabe que ese
    // código postal no existe, y hacer esperar al botón para decirlo es hacer
    // esperar por nada.
    expect((await screen.findByRole('alert')).textContent).toMatch(/no parece un código postal español/i)
    expect(api.peticiones).toEqual([])
  })

  it('no regaña a media escritura: con menos de cinco dígitos no dice nada', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta())

    await persona.type(screen.getByLabelText(CODIGO_POSTAL), '084')

    // Quien va por el tercer dígito lo está haciendo bien.
    expect(screen.queryByRole('alert')).toBe(null)
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

  it('se recorre entera con el teclado, oficina por oficina y en orden', async () => {
    const persona = montarPortada()
    const telefonos = ['900000001', '900000002', '900000003', '900000004', '900000005']
    apiQueContesta(
      respuesta({
        oficinas: telefonos.map((telefono, i) => oficina({ id: i + 1, nombre: `OFICINA ${i}`, telefono })),
      }),
    )

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Tabulando desde el campo se llega al teléfono de **todas** las oficinas,
    // en el mismo orden en que se leen, sin saltarse ninguna y sin quedarse
    // atrapado: la lista es el camino equivalente al mapa, no un adorno que se
    // ve pero no se recorre. Con dos oficinas esto no probaba nada.
    const alcanzados: string[] = []
    screen.getByLabelText(CODIGO_POSTAL).focus()
    for (let salto = 0; salto < 30 && alcanzados.length < telefonos.length; salto += 1) {
      await persona.tab()
      const enfocado = document.activeElement
      if (enfocado instanceof HTMLAnchorElement && enfocado.href.startsWith('tel:')) {
        alcanzados.push(enfocado.textContent ?? '')
      }
    }

    expect(alcanzados).toEqual(telefonos)
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
    apiQueNoContesta()

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

  it('«hay cola» no se cuenta como que no hay citas', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta({ estado: 'vuelve-en-un-momento', tramite: null, oficinas: [] }))

    await buscar(persona, '08402')

    // El freno no ha dado ficha. Quien lea «no hay citas» deja de mirar, y lo
    // que pasa es que ahora mismo hay mucha gente preguntando.
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/vuelve a probar en un momento/i))
    expect(screen.getByRole('status').textContent).not.toMatch(/no hay citas/i)
    expect(screen.queryByRole('list', { name: /oficinas/i })).toBe(null)
  })

  it('dice que el dato es viejo cuando se sirve lo caducado porque el SEPE no contesta', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta({ caducada: true, desdeCache: true }))

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Enseñar un hueco guardado hace horas como si fuera de ahora es dar por
    // vigente algo que puede llevar cogido desde entonces.
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/datos de hace un rato/i))
  })

  it('una respuesta reciente servida de la caché no se anuncia como vieja', async () => {
    const persona = montarPortada()
    apiQueContesta(respuesta({ caducada: false, desdeCache: true }))

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Venir de la caché dentro de su TTL solo quiere decir que ha ido rápido.
    expect(screen.getByRole('status').textContent).not.toMatch(/hace un rato/i)
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

    // Otra visita: se desmonta la pantalla y se vuelve a montar, con el mismo
    // navegador detrás. Sin desmontar quedarían dos portadas a la vez, que es
    // algo que no le pasa a nadie.
    cleanup()
    window.history.replaceState(null, '', '/')
    render(<Portada />)

    expect(campoDelCodigoPostal().value).toBe('08402')
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

describe('cuando se cruzan dos búsquedas', () => {
  it('una respuesta que llega tarde no pisa a la búsqueda pedida después', async () => {
    const api = apiQueContestaCuandoSeLeDiga()
    window.history.replaceState(null, '', '/#cp=08401')
    render(<Portada />)

    // Mientras la del enlace sigue en el aire se pide otra. Hoy el botón
    // deshabilitado lo hace difícil, pero el orden en que contesta el servidor
    // no lo decide esta pantalla, y de esto no se puede depender de un
    // atributo: en cuanto haya un segundo sitio desde el que buscar —los
    // filtros del issue #11— vuelven a cruzarse.
    fireEvent.change(screen.getByLabelText(CODIGO_POSTAL), { target: { value: '08402' } })
    fireEvent.submit(screen.getByLabelText(CODIGO_POSTAL).closest('form')!)

    await waitFor(() => expect(api.peticiones).toHaveLength(2))

    // Contesta primero la segunda y después la primera, que es justo el orden
    // que rompería la pantalla.
    api.contestar(1, respuesta({ oficinas: [oficina({ id: 2, nombre: 'LA QUE SE HA PEDIDO' })] }))
    await waitFor(() => expect(screen.getByText('LA QUE SE HA PEDIDO')).toBeTruthy())

    api.contestar(0, respuesta({ oficinas: [oficina({ id: 1, nombre: 'LA VIEJA' })] }))

    await waitFor(() => expect(screen.getByText('LA QUE SE HA PEDIDO')).toBeTruthy())
    expect(screen.queryByText('LA VIEJA')).toBe(null)
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
    expect(campoDelCodigoPostal().value).toBe('08402')
    expect(api.peticiones).toEqual([{ url: '/api/oficinas', cuerpo: { cp: '08402' } }])
  })

  it('el código postal que llega por enlace también se recuerda para la próxima', async () => {
    apiQueContesta(respuesta())
    window.history.replaceState(null, '', '/#cp=08402')
    render(<Portada />)
    await listaDeOficinas()

    // Quien entra siempre por su marcador también lo ha «usado»: si solo se
    // recordara lo tecleado, nunca vería el campo relleno al entrar sin él.
    expect(window.localStorage.getItem('ultimo-codigo-postal')).toBe('08402')

    cleanup()
    window.history.replaceState(null, '', '/')
    render(<Portada />)

    expect(campoDelCodigoPostal().value).toBe('08402')
  })

  it('un fragmento con basura dentro no lanza ninguna búsqueda', async () => {
    const api = apiQueContesta(respuesta())
    window.history.replaceState(null, '', '/#cp=no-es-un-codigo-postal')

    render(<Portada />)

    await waitFor(() => expect(screen.getByRole('button', { name: BOTON })).toBeTruthy())
    expect(api.peticiones).toEqual([])
    expect(campoDelCodigoPostal().value).toBe('')
  })
})
