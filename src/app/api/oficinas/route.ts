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
 * Aviso de coste: esto es el catálogo entero —una petición por rama y una por
 * trámite, todas con el freno de 2,5 s— más la del mapa. Para 08401 eso pasa
 * del medio minuto, más de lo que aguanta una función en el plan gratuito. Lo
 * que lo hace viable es la caché compartida de delante (issue #6).
 */
export function POST(peticion: Request): Promise<Response> {
  return conCodigoPostal(peticion, (codigoPostal) => appDeProduccion().primerTramite.buscar(codigoPostal))
}
