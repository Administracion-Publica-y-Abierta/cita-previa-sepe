import type { Fetch } from '@/nucleo/dependencias'
import type { Reloj } from '@/nucleo/reloj'

/**
 * Un Redis de mentira que habla el protocolo REST de verdad.
 *
 * No es una tercera costura: el almacén de Redis recibe el `fetch` por
 * parámetro igual que el cliente SEPE, así que esto entra por la costura que
 * ya había. Lo que se gana es que la misma batería de comportamiento corra
 * contra las dos implementaciones y que la de producción no sea la única sin
 * probar.
 *
 * Solo entiende los comandos que el almacén manda. Cualquier otro revienta:
 * un doble que contesta a lo que no sabe deja pasar errores de verdad.
 */
export const URL_DE_REDIS = 'https://redis-de-mentira.upstash.io'
export const FICHA_DE_REDIS = 'una-ficha-cualquiera'

interface Entrada {
  valor: string
  /** Instante en que caduca, según el reloj inyectado. */
  caducaEn: number
}

export function crearRedisFalso(reloj: Reloj): Fetch {
  const datos = new Map<string, Entrada>()

  function vigente(clave: string): Entrada | undefined {
    const entrada = datos.get(clave)
    if (!entrada) return undefined
    // Caducar al leer es lo que hace Redis de cara al cliente: una clave
    // vencida no existe, la haya recogido ya o no.
    if (entrada.caducaEn <= reloj.ahora()) {
      datos.delete(clave)
      return undefined
    }
    return entrada
  }

  function ejecutar(orden: string[]): unknown {
    const [comando, clave, ...resto] = orden
    switch (comando.toUpperCase()) {
      case 'GET':
        return vigente(clave)?.valor ?? null

      case 'SET': {
        const [valor, ...banderas] = resto
        const soloSiNoEsta = banderas.some((b) => b.toUpperCase() === 'NX')
        if (soloSiNoEsta && vigente(clave)) return null
        const px = banderas.findIndex((b) => b.toUpperCase() === 'PX')
        if (px === -1) throw new Error('El almacén tiene que guardar siempre con caducidad.')
        datos.set(clave, { valor, caducaEn: reloj.ahora() + Number(banderas[px + 1]) })
        return 'OK'
      }

      case 'PTTL': {
        const entrada = vigente(clave)
        // -2 es "no existe", y es exactamente lo que Redis contesta.
        return entrada ? entrada.caducaEn - reloj.ahora() : -2
      }

      case 'INCRBY': {
        const entrada = vigente(clave)
        const sumado = Number(entrada?.valor ?? 0) + Number(resto[0])
        // Sin caducidad todavía: la pone el PEXPIRE que viene detrás, igual
        // que en Redis de verdad.
        datos.set(clave, { valor: String(sumado), caducaEn: entrada?.caducaEn ?? Number.POSITIVE_INFINITY })
        return sumado
      }

      case 'PEXPIRE': {
        const entrada = vigente(clave)
        if (!entrada) return 0
        entrada.caducaEn = reloj.ahora() + Number(resto[0])
        return 1
      }

      case 'DEL':
        return datos.delete(clave) ? 1 : 0

      default:
        throw new Error(`El Redis de mentira no entiende ${comando}.`)
    }
  }

  return async (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url
    if (!url.startsWith(URL_DE_REDIS)) throw new Error(`El Redis de mentira no atiende en ${url}.`)
    if (init?.headers && new Headers(init.headers).get('authorization') !== `Bearer ${FICHA_DE_REDIS}`) {
      return new Response(JSON.stringify({ error: 'WRONGPASS' }), { status: 401 })
    }

    const orden = JSON.parse(String(init?.body ?? '[]')) as string[]
    return new Response(JSON.stringify({ result: ejecutar(orden) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}
