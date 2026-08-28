import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { enHoraDeConsulta } from '@/interfaz/formato'
import {
  BOTON,
  buscar,
  campoDelCodigoPostal,
  elAvisoDelCampo,
  elResumen,
  laFrescura,
  listaDeOficinas,
  loQueImpide,
  montarPortada,
} from './la-portada'
import {
  apiQueContesta,
  apiQueVaContando,
  apiSinConexion,
  CENTRO_DE_LA_PROVINCIA,
  cola,
  CONSULTADO_EN,
  oficina,
  pasadaDeUnTramite,
  pasadaSinCola,
  resuelto,
  tramite,
} from './sepe-en-el-navegador'

/**
 * Lo que se le dice a quien pregunta cuando la respuesta no es una lista de
 * oficinas, y de cuándo es lo que sí lo es.
 *
 * De todo lo que hay en esta fase, esto es lo que más se va a agradecer: está
 * medido que el mismo trámite devuelve vacío y 46 oficinas con treinta segundos
 * de diferencia, así que **«no hay huecos» y «el SEPE no está contestando» no
 * se pueden parecer**. No son lo mismo y quien pregunta no hace lo mismo en
 * cada caso: con lo primero se va a otra oficina, con lo segundo se vuelve a
 * mirar en un rato.
 *
 * De ahí sale la forma de la pantalla que se prueba aquí: el titular vive en la
 * región viva y cuenta lo que hay; lo que ha impedido preguntar vive aparte y
 * se anuncia como alerta; y debajo va siempre de cuándo es el dato y el botón
 * para volver a comprobarlo.
 */

const PRESTACION = tramite({ id: 501, nombre: 'Prestación contributiva' })
const SUBSIDIO = tramite({ id: 502, nombre: 'Subsidio por desempleo' })

/** Media hora antes que el resto, para que las dos horas no se puedan confundir. */
const MEDIA_HORA_ANTES = CONSULTADO_EN - 1_800_000

function botonDeVolverAComprobar(): HTMLElement {
  return screen.getByRole('button', { name: /volver a comprobar/i })
}

describe('«no hay huecos» y «el SEPE no está contestando»', () => {
  it('no tener huecos es un resultado: se cuenta en el titular y sin alerta ninguna', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite({ oficinas: [oficina({ primerHueco: null })] }))

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Aquí sí se ha podido preguntar, y la respuesta es que ahora mismo no hay
    // hueco. Es información: quien la lee sabe que puede probar en otra zona.
    expect(elResumen().textContent).toMatch(/ninguna con hueco/i)
    expect(screen.queryByRole('alert')).toBe(null)
  })

  it('un SEPE que no contesta no se cuenta en el titular: se dice aparte y como alerta', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite({ estado: 'sepe-no-responde', oficinas: [] }))

    await buscar(persona, '08402')

    // Lo que ha pasado no es que no haya huecos, es que no se ha podido
    // preguntar. Un lector de pantalla lo anuncia como alerta, y el titular no
    // dice ni una cifra que se pueda leer como un resultado.
    await waitFor(() => expect(loQueImpide().textContent).toMatch(/no responde/i))
    expect(elResumen().textContent).not.toMatch(/oficina|hueco/i)
  })

  it('las dos cosas no se pueden confundir: solo una de ellas es una alerta', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite({ oficinas: [oficina({ primerHueco: null })] }))
    await buscar(persona, '08402')
    await listaDeOficinas()
    const sinHuecos = elResumen().textContent

    apiQueContesta(pasadaDeUnTramite({ estado: 'sepe-no-responde', oficinas: [] }))
    await persona.click(botonDeVolverAComprobar())

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBe(null))
    expect(loQueImpide().textContent).not.toBe(sinHuecos)
  })

  it('con un trámite vacío y otro que falló no se afirma que no haya oficinas', async () => {
    const persona = montarPortada()
    apiQueContesta([
      cola([PRESTACION, SUBSIDIO]),
      resuelto({ tramite: PRESTACION, oficinas: [] }),
      resuelto({ tramite: SUBSIDIO, estado: 'sepe-no-responde', oficinas: [] }),
    ])

    await buscar(persona, '08402')

    // «El SEPE no atiende estos trámites en ninguna oficina» hablaría también
    // del que no contestó, del que no se sabe nada. Eso lo cuenta la alerta.
    await waitFor(() => expect(loQueImpide().textContent).toMatch(/no responde/i))
    expect(elResumen().textContent).not.toMatch(/ninguna oficina/i)
  })
  it('el aviso del campo y el percance conviven, y cada uno se pide por su nombre', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite({ estado: 'sepe-no-responde', oficinas: [] }))

    await buscar(persona, '08402')
    await waitFor(() => expect(loQueImpide()).toBeTruthy())

    // Teclear un código postal malo con una búsqueda fallida delante pone dos
    // `alert` en la pantalla a la vez. Son dos cosas distintas —una se arregla
    // escribiendo bien, la otra volviendo en un rato— y por eso se llaman.
    await persona.clear(campoDelCodigoPostal())
    await persona.type(campoDelCodigoPostal(), '99999')

    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(elAvisoDelCampo().textContent).toMatch(/provincia/i)
    expect(loQueImpide().textContent).toMatch(/no responde/i)
  })
})

describe('de cuándo es lo que se está mirando', () => {
  it('dice la hora a la que se consultó al SEPE, y no la de ahora', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())

    await buscar(persona, '08402')
    await listaDeOficinas()

    // La hora es la del evento y no la del reloj del navegador: una respuesta
    // servida de la caché se consultó cuando se consultó, y decir que es de
    // ahora sería dar por vigente un hueco que puede llevar cogido un rato.
    expect(laFrescura().textContent).toContain(enHoraDeConsulta(CONSULTADO_EN))
  })

  it('con varios trámites enseña la hora del más viejo, que es lo único que se puede prometer', async () => {
    const persona = montarPortada()
    apiQueContesta([
      cola([PRESTACION, SUBSIDIO]),
      resuelto({ tramite: PRESTACION, consultadoEn: MEDIA_HORA_ANTES, oficinas: [oficina({ id: 1 })] }),
      resuelto({ tramite: SUBSIDIO, consultadoEn: CONSULTADO_EN, oficinas: [oficina({ id: 2 })] }),
    ])

    await buscar(persona, '08402')
    await listaDeOficinas()

    // La lista mezcla los dos, así que la hora buena es la del más viejo:
    // quedarse con la del más reciente sería prometer de la mitad de la lista
    // una frescura que no tiene.
    await waitFor(() => expect(laFrescura().textContent).toContain(enHoraDeConsulta(MEDIA_HORA_ANTES)))
    expect(laFrescura().textContent).not.toContain(enHoraDeConsulta(CONSULTADO_EN))
  })

  it('lo servido caducado se dice que es viejo, y de cuándo es', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite({ caducada: true, desdeCache: true }))

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Enseñar un hueco guardado hace un rato como si fuera de ahora es dar por
    // vigente algo que puede llevar cogido desde entonces.
    await waitFor(() => expect(laFrescura().textContent).toMatch(/no son de ahora/i))
    expect(laFrescura().textContent).toContain(enHoraDeConsulta(CONSULTADO_EN))
  })
})

describe('volver a comprobar', () => {
  it('se ofrece en cuanto hay algo que mirar', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite())

    await buscar(persona, '08402')
    await listaDeOficinas()

    expect(botonDeVolverAComprobar()).toBeTruthy()
  })

  it('vuelve a preguntar por lo que se está mirando, y no por lo que haya quedado en el campo', async () => {
    const persona = montarPortada()
    const api = apiQueContesta(pasadaDeUnTramite())

    await buscar(persona, '08402')
    await listaDeOficinas()

    // Alguien que teclea otro código postal y no llega a buscarlo sigue
    // mirando la lista de antes: volver a comprobar es comprobar **eso**.
    await persona.clear(campoDelCodigoPostal())
    await persona.type(campoDelCodigoPostal(), '28001')
    await persona.click(botonDeVolverAComprobar())

    await waitFor(() => expect(api.peticiones).toHaveLength(2))
    expect(api.peticiones[1].cuerpo).toEqual({ cp: '08402' })
  })

  it('con trámites marcados vuelve a preguntar solo por esos, y no por la zona entera', async () => {
    // Se entra por un enlace que ya trae elegido un trámite, que es la forma de
    // llegar aquí con algo marcado sin tocar las casillas.
    window.history.replaceState(null, '', `/#cp=08402&t=${PRESTACION.id}`)
    const api = apiQueContesta([cola([PRESTACION, SUBSIDIO]), resuelto({ tramite: PRESTACION })])
    const persona = montarPortada()

    await listaDeOficinas()
    await persona.click(botonDeVolverAComprobar())

    // Lo que se está mirando es un trámite, no la zona: volver a comprobar no
    // puede costarle al SEPE los que nadie tiene delante.
    await waitFor(() => expect(api.peticiones).toHaveLength(2))
    expect(api.peticiones[1].cuerpo).toEqual({ cp: '08402', tramites: [PRESTACION.id] })
  })

  it('no se puede pedir otra vez mientras se está comprobando', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))
    api.contar(cola([PRESTACION]))
    api.contar(resuelto({ tramite: PRESTACION }))
    await listaDeOficinas()

    // Con la pasada a medias, insistir no trae nada nuevo y sí le mete al SEPE
    // otra ronda de peticiones frenadas.
    expect(botonDeVolverAComprobar().hasAttribute('disabled')).toBe(true)

    api.cerrar()
    await waitFor(() => expect(botonDeVolverAComprobar().hasAttribute('disabled')).toBe(false))
  })

  it('también se ofrece cuando no se ha podido consultar nada, que es cuando más falta hace', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaSinCola('sepe-no-responde'))

    await buscar(persona, '08402')

    await waitFor(() => expect(botonDeVolverAComprobar()).toBeTruthy())
  })
})

describe('el SEPE saturado', () => {
  it('se explica con palabras normales, sin ningún código de error a la vista', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaSinCola('sepe-no-responde'))

    await buscar(persona, '08402')

    const dicho = (await waitFor(() => loQueImpide())).textContent ?? ''
    expect(dicho).toMatch(/vuelve a probar/i)
    // Ni el estado interno, ni un número de error, ni la palabra «error»: nada
    // de eso le dice a nadie qué hacer ahora.
    expect(dicho).not.toMatch(/sepe-no-responde|\berror\b|\bhttp\b|\b\d{3}\b/i)
  })

  it('«hay cola» tampoco se cuenta como que no hay citas', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite({ estado: 'vuelve-en-un-momento', oficinas: [] }))

    await buscar(persona, '08402')

    // El freno no ha dado ficha, así que no se ha llegado a preguntar.
    await waitFor(() => expect(loQueImpide().textContent).toMatch(/vuelve a probar en un momento/i))
    expect(screen.queryByRole('list', { name: /oficinas/i })).toBe(null)
  })
})

describe('los dos casos degradados', () => {
  it('con el centroide provincial se avisa de que la distancia es aproximada, y aun así hay resultados', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite({ localizacion: CENTRO_DE_LA_PROVINCIA }))

    await buscar(persona, '08402')
    const lista = await listaDeOficinas()

    // Una lista de oficinas con la distancia marcada como aproximada sirve;
    // una pantalla de error por un servicio de terceros que hoy no contesta, no.
    expect(screen.getByText(/decenas de kilómetros/i)).toBeTruthy()
    expect(lista.textContent).toMatch(/GRANOLLERS/)
  })

  it('sin conexión se dice, en vez de dejar la pantalla girando', async () => {
    const persona = montarPortada()
    apiSinConexion()

    await buscar(persona, '08402')

    await waitFor(() => expect(loQueImpide().textContent).toMatch(/conexión/i))
    // Y se puede volver a intentar: el botón de buscar deja de estar apagado.
    expect(screen.getByRole('button', { name: BOTON }).hasAttribute('disabled')).toBe(false)
  })

  it('si lo único que llegó fue un SEPE caído, la conexión cortada no lo tapa', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))
    api.contar(cola([PRESTACION, SUBSIDIO]))
    api.contar(resuelto({ tramite: PRESTACION, estado: 'sepe-no-responde', oficinas: [] }))
    await waitFor(() => expect(loQueImpide()).toBeTruthy())

    api.romper()
    // Se espera a que la caída esté pintada y no al texto: con el botón
    // apagado la pasada sigue viva, y afirmar sobre la alerta antes de eso es
    // afirmar sobre lo de antes, que ya decía lo que se quiere comprobar.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: BOTON }).hasAttribute('disabled')).toBe(false),
    )

    // No hay ni una oficina que enseñar, así que lo que hay que contar es por
    // qué. «La conexión se ha cortado» taparía lo que de verdad pasó —el SEPE
    // no contestaba ya antes de que se fuera la red— y además lo bajaría de
    // avería a aviso, que es la distinción entera de este issue.
    expect(loQueImpide().textContent).toMatch(/no responde/i)
  })

  it('una conexión que se corta a media pasada no tira lo que ya había llegado', async () => {
    const persona = montarPortada()
    const api = apiQueVaContando()

    await buscar(persona, '08402')
    await waitFor(() => expect(api.peticiones).toHaveLength(1))
    api.contar(cola([PRESTACION, SUBSIDIO]))
    api.contar(resuelto({ tramite: PRESTACION, oficinas: [oficina({ nombre: 'LA QUE SÍ LLEGÓ' })] }))
    await listaDeOficinas()

    api.romper()

    await waitFor(() => expect(loQueImpide().textContent).toMatch(/conexión/i))
    expect(screen.getByText('LA QUE SÍ LLEGÓ')).toBeTruthy()
  })
})

describe('lo que se enseña no lleva nada de quien pregunta', () => {
  it('el mensaje del servidor no se enseña: el aviso es nuestro', async () => {
    const persona = montarPortada()
    apiQueContesta({
      estado: 400,
      cuerpo: {
        error: 'codigo-postal-invalido',
        mensaje: 'El código postal 08402 no vale <img src=x onerror=alert(1)>',
      },
    })

    await buscar(persona, '08402')

    // Enseñar el texto de la respuesta sería a la vez una vía de inyección y
    // una forma de que lo tecleado vuelva a la pantalla sin que nadie lo decida.
    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toMatch(/código postal/i)
    expect(aviso.textContent).not.toContain('08402')
    expect(document.body.textContent).not.toContain('onerror')
  })

  it('ningún mensaje repite el código postal tecleado', async () => {
    const persona = montarPortada()
    apiQueContesta(pasadaDeUnTramite({ estado: 'sepe-no-responde', oficinas: [] }))

    await buscar(persona, '08402')

    await waitFor(() => expect(loQueImpide().textContent).toMatch(/no responde/i))
    expect(loQueImpide().textContent).not.toContain('08402')
    expect(elResumen().textContent).not.toContain('08402')
  })
})
