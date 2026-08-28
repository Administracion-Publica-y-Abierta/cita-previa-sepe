import { appDeProduccion } from '@/nucleo/app-de-produccion'
import { conCodigoPostal } from '../errores'

/**
 * `POST /api/tramites` con `{"cp": "08401"}` → el árbol de trámites que el SEPE
 * ofrece en esa zona, con los nombres con los que él mismo los llama.
 *
 * Es POST y no GET por la misma razón que la localización, y no es de estilo:
 * **el alojamiento registra la URL entera de cada petición, la cadena de
 * consulta incluida**, y lo hace solo por existir. Un `GET
 * /api/tramites?cp=08401` deja escrito en el registro de dónde es cada persona
 * que ha mirado si hay cita del paro. El cuerpo de un POST no se registra.
 *
 * Aviso de coste: descubrir el árbol entero son una petición por rama y una por
 * trámite, todas con el freno de 2,5 s. Para 08401 eso es medio minuto, más de
 * lo que aguanta una función en el plan gratuito. Lo que lo hace viable es la
 * caché compartida de delante (issue #6): esta ruta se consulta una vez cada
 * mucho y se sirve de ahí. Lo que no se hace, por mucho que abarate, es volver
 * a escribir los identificadores a mano.
 */
export function POST(peticion: Request): Promise<Response> {
  return conCodigoPostal(peticion, (codigoPostal) => appDeProduccion().catalogo.de(codigoPostal))
}
