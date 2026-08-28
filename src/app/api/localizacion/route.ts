import { appDeProduccion } from '@/nucleo/app-de-produccion'
import { conCodigoPostal } from '../errores'

/**
 * `POST /api/localizacion` con `{"cp": "08401"}` → dónde cae ese código postal.
 *
 * Es POST y no GET por una sola razón, y no es de estilo: **el alojamiento
 * registra la URL entera de cada petición, la cadena de consulta incluida**, y
 * lo hace solo por existir, sin que nadie lo pida. Un `GET
 * /api/localizacion?cp=08401` deja escrito en el registro de Vercel de dónde es
 * cada persona que ha mirado si hay cita del paro; y en este proyecto eso, unido
 * al trámite, dice que alguien está en el paro. El cuerpo de un POST no se
 * registra.
 *
 * Lo que se pierde es que la consulta no se pueda compartir por enlace ni
 * guardar en favoritos. Aquí no hace falta: el hero recuerda el último código
 * postal en el propio navegador.
 */
export function POST(peticion: Request): Promise<Response> {
  return conCodigoPostal(peticion, (codigoPostal) => appDeProduccion().geocodificador.localizar(codigoPostal))
}
