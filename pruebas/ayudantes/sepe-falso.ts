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

/** Una entrada de cualquiera de los tres niveles del árbol de trámites. */
export interface EntradaDelArbol {
  id: number
  nombre: string
}

/**
 * Los niveles 1 y 2 del árbol, puestos a mano.
 *
 * Sirven para lo que las grabaciones no pueden: cambiarle el árbol al SEPE y
 * comprobar que el catálogo que sale es el nuevo. Con el árbol grabado, un
 * catálogo con los identificadores escritos a mano pasaría el test igual.
 */
export function nivelesDelSepe(
  nivel: 1 | 2,
  idsNiveles: string,
  entradas: EntradaDelArbol[],
): RespuestaAMano {
  return {
    endpoint: 'cargaComboNivelesTramitesCPEntidad',
    cuando: { nivel: String(nivel), idsNiveles },
    tipoContenido: 'application/json; charset=UTF-8',
    cuerpo: JSON.stringify({
      tipoNivelServicio: { idJerarquiaTramite: 5, nivel },
      listaTiposTramites: [],
      listaNivelesTramites: entradas.map((entrada) => ({
        idServicio: entrada.id,
        nivel,
        esServicio: false,
        ultimoNivel: nivel === 2,
        codigoEntidad: null,
        auxServicio: entrada.nombre,
      })),
    }),
  }
}

/**
 * El nivel 3 de un trámite, con la forma exacta con la que lo manda el SEPE:
 * HTML, un `<select>` con sus `<option>`, los atributos repartidos en varias
 * líneas y el «--- Seleccionar ---» delante.
 *
 * La lista vacía es un caso real y no un apaño: hay trámites cuyo combo de
 * subtrámites vuelve sin nada dentro.
 */
export function subtramitesDelSepe(idsNiveles: number, entradas: EntradaDelArbol[]): RespuestaAMano {
  const opciones = entradas
    .map(
      (entrada) => `
			<option value="${entrada.id}"
				data-ids-jerarquia-tramites="5"
				data-entidad-oficina="SEPE"
				data-esservicio="true">${entrada.nombre}</option> `,
    )
    .join('\n')

  return {
    endpoint: 'cargarComboGruposTramitesByNivel',
    cuando: { idsNiveles: String(idsNiveles) },
    tipoContenido: 'text/html; charset=UTF-8',
    cuerpo: `
	<label for="comboTiposServicios">Subtr&aacute;mite(*)</label>
	<select title="Subtr&aacute;mite" id="comboTiposServicios" class="combo">
			<option value="">--- Seleccionar ---</option>
${opciones}
	</select>`,
  }
}
