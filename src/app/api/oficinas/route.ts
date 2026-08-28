import { appDeProduccion } from '@/nucleo/app-de-produccion'
import { conCodigoPostal } from '../errores'

/**
 * `POST /api/oficinas` con `{"cp": "08401"}` → las oficinas del primer trámite
 * que el SEPE ofrece en esa zona, con su primer hueco y su distancia.
 *
 * Es la ruta del hero, y por eso no recibe trámite: quien llega escribe un
 * código postal y pulsa un botón. Elegir trámite llega después (issue #10).
 *
 * Es POST y no GET por la misma razón que las otras dos, y no es de estilo:
 * **el alojamiento registra la URL entera de cada petición, la cadena de
 * consulta incluida**, y lo hace solo por existir. Un `GET
 * /api/oficinas?cp=08401` deja escrito en el registro de dónde es cada persona
 * que ha mirado si hay cita del paro. El cuerpo de un POST no se registra.
 *
 * **Aviso de coste, y está sin resolver.** Esto es el catálogo entero —una
 * petición por rama y una por trámite, todas con el freno de 2,5 s— más la del
 * mapa. Para 08401 eso pasa del medio minuto, más de lo que aguanta una
 * función en el plan gratuito.
 *
 * La caché del issue #6 **no** lo arregla: guarda las consultas del mapa, que
 * son una, y el catálogo no tiene caché delante, que son diez. O sea que el
 * trozo caro se paga entero en cada visita. Falta ponerle al catálogo su
 * propia caché —su TTL es de días, no de minutos: el árbol de trámites cambia
 * cuando el SEPE lo cambia, no cada rato— y hasta entonces esta ruta no
 * aguanta producción.
 */
export function POST(peticion: Request): Promise<Response> {
  return conCodigoPostal(peticion, (codigoPostal) => appDeProduccion().primerTramite.buscar(codigoPostal))
}
