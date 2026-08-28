import { cleanup, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { enHoraDeConsulta } from '@/interfaz/formato'
import { olvidarLaCobertura } from '@/interfaz/cobertura'
import { olvidarLoLeido } from '@/interfaz/lo-que-recuerda-el-navegador'
import { conCobertura, sinCobertura } from './cobertura'
import {
  buscar,
  campoDelCodigoPostal,
  listaDeOficinas,
  loQueImpide,
  montarPortada,
} from './la-portada'
import {
  apiQueContesta,
  apiSinConexion,
  CONSULTADO_EN,
  oficina,
  pasadaDeUnTramite,
} from './sepe-en-el-navegador'

/**
 * Lo que pasa cuando se abre esto sin cobertura, que es la mitad de por qué
 * merece la pena añadirlo a la pantalla de inicio.
 *
 * Quien busca cita del SEPE mira desde el móvil, muchas veces al día y donde
 * pilla. Sin service worker, un icono en la pantalla de inicio con el metro por
 * dentro de un túnel abre **la página de error del navegador**: la aplicación
 * parece rota justo cuando más se agradece que no lo esté. Con él abre, y lo
 * que enseña es lo último que se consultó **diciendo de cuándo es**, que es la
 * única forma honrada de enseñar un dato viejo.
 *
 * La regla es la misma que gobierna el resto de la pantalla: un dato que no se
 * ha podido comprobar no puede leerse como uno recién traído.
 */

/**
 * Cómo se vuelve a abrir la aplicación desde el icono: sin fragmento y de cero.
 *
 * Lo de cero incluye lo que los módulos se guardan de la vez anterior —si había
 * red y qué había guardado—, que en un móvil de verdad se van con la página. Lo
 * que sí sobrevive es el almacenamiento del navegador, que es justo lo que se
 * está probando.
 */
function volverAAbrirla(): void {
  cleanup()
  window.history.replaceState(null, '', '/')
  olvidarLaCobertura()
  olvidarLoLeido()
}

describe('la aplicación abierta sin cobertura', () => {
  it('enseña el último resultado consultado, con el día y la hora en que se consultó', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())
    await buscar(persona, '08402')
    await listaDeOficinas()

    volverAAbrirla()
    sinCobertura()
    const api = apiSinConexion()
    montarPortada()

    // La lista está, que es lo que evita la página de error del navegador.
    await listaDeOficinas()
    // Y con la fecha entera, no solo la hora: lo guardado puede ser de ayer, y
    // «consultado a las 13:37» de un dato de ayer es una hora que engaña.
    expect(screen.getByText(/consultado el/i).textContent).toContain(
      enHoraDeConsulta(CONSULTADO_EN),
    )
    // Sin red no se sale a preguntar: no hay a dónde.
    expect(api.peticiones).toEqual([])
  })

  it('dice que no hay conexión, para que lo viejo no se lea como recién traído', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())
    await buscar(persona, '08402')
    await listaDeOficinas()

    volverAAbrirla()
    sinCobertura()
    apiSinConexion()
    montarPortada()

    await listaDeOficinas()
    expect(loQueImpide().textContent).toMatch(/sin conexión/i)
  })

  it('deja el código postal de lo que se está mirando, para poder volver a comprobarlo', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())
    await buscar(persona, '08402')
    await listaDeOficinas()

    volverAAbrirla()
    sinCobertura()
    apiSinConexion()
    montarPortada()

    await listaDeOficinas()
    expect(campoDelCodigoPostal().value).toBe('08402')
  })

  it('vuelve a preguntar en cuanto se le pide, y entonces lo guardado se sustituye', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())
    await buscar(persona, '08402')
    await listaDeOficinas()

    volverAAbrirla()
    sinCobertura()
    apiSinConexion()
    const segunda = montarPortada()
    await listaDeOficinas()

    conCobertura()
    apiQueContesta(pasadaDeUnTramite({ oficinas: [oficina({ nombre: 'MATARÓ - SEPE' })] }))
    await segunda.click(screen.getByRole('button', { name: /volver a comprobar/i }))

    await waitFor(() => expect(screen.getByText(/MATARÓ/)).toBeTruthy())
    expect(screen.queryByText(/sin conexión/i)).toBe(null)
  })
})

describe('la cobertura se mira al abrir, y no se cambia de idea sola', () => {
  it('lo guardado no desaparece de delante porque el móvil diga que ya hay red', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())
    await buscar(persona, '08402')
    await listaDeOficinas()

    volverAAbrirla()
    sinCobertura()
    apiSinConexion()
    const segunda = montarPortada()
    await listaDeOficinas()

    // Se sale del túnel: el navegador dice que ya hay red. Si eso se mirara en
    // cada pintado, la lista se iría sola al primer tecleo y quedaría una
    // pantalla diciendo que busca sin que nadie busque nada.
    conCobertura()
    await segunda.type(campoDelCodigoPostal(), '1')

    await listaDeOficinas()
    expect(loQueImpide().textContent).toMatch(/sin conexión/i)
  })
})

describe('una búsqueda que se queda sin red', () => {
  it('enseña lo último de esa misma zona en vez de una pantalla en blanco', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())
    await buscar(persona, '08402')
    await listaDeOficinas()

    // La red se cae con la lista delante: se pide comprobar y no se llega.
    apiSinConexion()
    await persona.click(screen.getByRole('button', { name: /volver a comprobar/i }))

    // Lo que se enseña vuelve a ser lo guardado, y dicho como tal: quedarse sin
    // red no puede dejar la pantalla peor que estaba.
    await listaDeOficinas()
    await waitFor(() => expect(loQueImpide().textContent).toMatch(/sin conexión/i))
  })

  it('no enseña lo guardado de otra zona: sería contestar por un sitio que nadie ha preguntado', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())
    await buscar(persona, '08402')
    await listaDeOficinas()

    apiSinConexion()
    await persona.clear(campoDelCodigoPostal())
    await buscar(persona, '28013')

    await waitFor(() => expect(loQueImpide().textContent).toMatch(/no se ha podido conectar/i))
    expect(screen.queryByRole('list', { name: /oficinas/i })).toBe(null)
  })
})

describe('lo que se guarda se cuenta en la portada', () => {
  it('se dice que la última lista se queda en el navegador, y para qué', () => {
    // La portada promete que no se guarda nada de nadie, y desde esta fase se
    // guarda una cosa más. O se dice ahí, o la promesa deja de ser verdad.
    montarPortada()

    // El párrafo entero y no el titulillo en negrita, que es lo que devuelve
    // buscar por ese texto.
    const promesa = screen.getByText(/qué guardamos de ti/i).closest('p')

    expect(promesa?.textContent).toMatch(/sin cobertura/i)
  })
})

describe('con cobertura', () => {
  it('no se enseña lo guardado: hay red para preguntar y nadie ha preguntado todavía', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())
    await buscar(persona, '08402')
    await listaDeOficinas()

    volverAAbrirla()
    apiSinConexion()
    montarPortada()

    // El campo sí se propone, que es lo que ya hacía. Lo que no sale es una
    // lista de oficinas de hace un rato sin que nadie la haya pedido.
    expect(campoDelCodigoPostal().value).toBe('08402')
    expect(screen.queryByRole('list', { name: /oficinas/i })).toBe(null)
  })
})
