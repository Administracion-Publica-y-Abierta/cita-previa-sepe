import type { RespuestaAMano } from './fetch-falso'

/**
 * Respuestas del SEPE puestas a mano, para lo que no hay grabado.
 *
 * La portada está aquí y no en los fixtures porque el extractor solo guarda
 * los endpoints de `/cita/`: la portada son 1,3 MB de JavaScript de los que no
 * se lee nada, y lo único que interesa de ella —la cookie de sesión— viaja en
 * una cabecera que no se guarda. Los otros dos casos son los que el SEPE hace
 * de verdad cuando va mal, y ninguno se puede grabar a voluntad.
 */

/**
 * La portada. Todo test que consulte al SEPE la necesita: es donde se abre la
 * sesión, antes de cualquier POST.
 *
 * El `endpoint` es la cadena vacía porque el `fetch` falso llama endpoint al
 * último tramo de la ruta, y la portada es `/citapreviasepe/`, con barra final.
 */
export function portadaDelSepe(): RespuestaAMano {
  return {
    endpoint: '',
    tipoContenido: 'text/html; charset=UTF-8',
    cuerpo: '<html lang="es"><head><title>Cita previa SEPE</title></head><body></body></html>',
  }
}

/**
 * El SEPE contesta 200 con el cuerpo vacío.
 *
 * Es un caso real y con significado propio: no es una avería —con la sesión
 * recién hecha pasa igual— y tampoco es "no hay huecos". Está medido que el
 * mismo trámite devuelve vacío y 46 oficinas con treinta segundos de
 * diferencia.
 */
export function sepeCuerpoVacio(endpoint: string, veces?: number): RespuestaAMano {
  return { endpoint, tipoContenido: 'application/json; charset=UTF-8', cuerpo: '', veces }
}

/**
 * El SEPE saturado: donde tenía que ir JSON manda una página de error, y con
 * un 200 delante, que es lo que hace de verdad.
 */
export function sepeSaturado(endpoint: string, veces?: number): RespuestaAMano {
  return {
    endpoint,
    tipoContenido: 'text/html; charset=UTF-8',
    cuerpo: '<html lang="es"><body><h1>El servicio no está disponible en este momento.</h1></body></html>',
    veces,
  }
}

/**
 * El SEPE contesta bien, con su JSON en regla, pero sin una sola oficina.
 *
 * Es la otra cara del cuerpo vacío y se distingue de él a propósito: aquí ha
 * contestado, y lo que dice es que de ese trámite no hay nada en esa zona.
 */
export function sepeSinOficinas(endpoint: string): RespuestaAMano {
  return {
    endpoint,
    tipoContenido: 'application/json; charset=UTF-8',
    cuerpo: JSON.stringify({ listTipoAtencion: [], listaTramites: [], listaOficina: [] }),
  }
}
