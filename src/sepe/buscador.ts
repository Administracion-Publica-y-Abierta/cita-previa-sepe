import type { Geocodificador, Localizacion } from '@/localizacion/geocodificador'
import type { Reloj } from '@/nucleo/reloj'
import { SepeNoResponde, SepeSinAgenda, type ClienteSepe } from './cliente'
import type { CacheDeConsultas, Consultado, EstadoDeLaConsulta } from './consultas'
import { SinFicha } from './freno'
import { oficinasDelTramite, type Canal } from './mapa'
import { aOficina, type Oficina } from './oficinas'

export interface Busqueda {
  estado: EstadoDeLaConsulta
  /** Instante real de la consulta al SEPE, para poder decir de cuándo es el dato. */
  consultadoEn: number
  /** No se ha llamado al SEPE: la respuesta ya estaba guardada. */
  desdeCache: boolean
  /** Lo guardado ha pasado su TTL y se sirve igual porque el SEPE no contesta. */
  caducada: boolean
  /** Por dónde se atiende este trámite, tal como lo lista el SEPE. */
  canal: Canal | null
  /** De dónde salen los kilómetros, y con cuánta confianza. */
  localizacion: Localizacion
  oficinas: Oficina[]
}

export interface Consulta {
  codigoPostal: string
  idTramite: number
}

export interface Buscador {
  buscar(consulta: Consulta): Promise<Busqueda>
}

export function crearBuscador(piezas: {
  clienteSepe: ClienteSepe
  geocodificador: Geocodificador
  reloj: Reloj
  cache: CacheDeConsultas
}): Buscador {
  const { clienteSepe, geocodificador, reloj, cache } = piezas

  return {
    async buscar({ codigoPostal, idTramite }: Consulta): Promise<Busqueda> {
      // Primero la localización: sus coordenadas viajan en la petición al SEPE
      // y además son la referencia de todas las distancias.
      const localizacion = await geocodificador.localizar(codigoPostal)

      const servido = await cache.obtener({ codigoPostal, idTramite }, async () => {
        try {
          const { canal, oficinas } = await clienteSepe.enUnaSesion((sesion) =>
            oficinasDelTramite(sesion, { idTramite, codigoPostal, origen: localizacion }),
          )
          return { estado: 'ok' as const, consultadoEn: reloj.ahora(), canal, oficinas }
        } catch (error) {
          if (error instanceof SepeSinAgenda) return vacia('sin-agenda', reloj.ahora())
          if (error instanceof SepeNoResponde) return vacia('sepe-no-responde', reloj.ahora())
          // El freno no ha dado ficha: no se ha llegado a llamar al SEPE. No es
          // una avería suya, y saltarse el freno no era una opción.
          if (error instanceof SinFicha) return vacia('vuelve-en-un-momento', reloj.ahora())
          // Lo demás sale tal cual: un fallo de red o un fallo nuestro no es una
          // respuesta del SEPE y no debe disfrazarse de una.
          throw error
        }
      })

      return {
        estado: servido.estado,
        consultadoEn: servido.consultadoEn,
        desdeCache: servido.desdeCache,
        caducada: servido.caducada,
        // `?? null` porque lo guardado puede ser de antes de que el canal
        // existiera: una entrada vieja de la caché no puede sacar `undefined`
        // por una ruta que promete `Canal | null`.
        canal: servido.canal ?? null,
        localizacion,
        // La distancia se calcula aquí y no se guarda: las oficinas de la caché
        // pueden estar contestándole a otro código postal, y los kilómetros son
        // de quien pregunta.
        oficinas: servido.oficinas.map((cruda) => aOficina(cruda, localizacion)),
      }
    },
  }
}

function vacia(estado: EstadoDeLaConsulta, consultadoEn: number): Consultado {
  return { estado, consultadoEn, canal: null, oficinas: [] }
}
