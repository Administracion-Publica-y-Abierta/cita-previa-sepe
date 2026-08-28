/**
 * Los pocos números que se ajustan sin tocar código.
 *
 * La lista es corta a propósito: un parámetro es una decisión que se aplaza, y
 * aplazar decisiones sale caro. Están aquí los tres que **hoy no se pueden
 * decidir bien** porque no hay nada medido —cuánto vale una respuesta guardada
 * y con qué grano se agrupan las consultas—, y ninguno más.
 *
 * El ritmo de peticiones al SEPE **no está aquí y no va a estarlo**: no es un
 * ajuste, es la regla de `CONTRIBUTING.md`.
 */
export type AnchoDeClave = 'codigo-postal' | 'provincia'

export interface Configuracion {
  /** Cuánto vale una respuesta guardada antes de volver a preguntar al SEPE. */
  ttlMs: number
  /**
   * Cuánto se conserva una respuesta buena para poder servirla marcada como
   * vieja si el SEPE se cae. Pasado el TTL ya no se sirve como fresca; hasta
   * aquí sigue siendo mejor que una pantalla de error.
   */
  vidaMaximaMs: number
  /**
   * Con qué se agrupan las consultas: el código postal entero, o sus dos
   * primeros dígitos, que son la provincia.
   *
   * Arranca por código postal completo, que es obviamente correcto y tiene
   * peor tasa de acierto. Ensancharlo a provincia multiplicaría los aciertos
   * —y no hace falta ninguna tabla: son dos caracteres— pero **hoy no está
   * medido**: la única evidencia son 08401 y 08402, que son adyacentes y se
   * piden con las mismas coordenadas, así que no prueban nada sobre 08001
   * frente a 08240. Por eso es un valor y no está cableado: el día que alguien
   * lo compruebe con dos códigos postales lejanos de la misma provincia, se
   * cambia aquí y ya está.
   */
  anchoDeClave: AnchoDeClave
}

export const CONFIGURACION_POR_DEFECTO: Configuracion = {
  // 90 segundos es la primera apuesta, no una medida: depende de con qué ritmo
  // libera huecos el SEPE, y eso solo se sabe mirándolo desplegado.
  ttlMs: 90_000,
  vidaMaximaMs: 3_600_000,
  anchoDeClave: 'codigo-postal',
}

/** Lo que diga el entorno, y lo de arriba para todo lo que no diga. */
export function configuracionDelEntorno(entorno: NodeJS.ProcessEnv = process.env): Configuracion {
  return {
    ttlMs: numero(entorno.CACHE_TTL_MS, CONFIGURACION_POR_DEFECTO.ttlMs),
    vidaMaximaMs: numero(entorno.CACHE_VIDA_MAXIMA_MS, CONFIGURACION_POR_DEFECTO.vidaMaximaMs),
    anchoDeClave:
      entorno.CACHE_ANCHO_DE_CLAVE === 'provincia' ? 'provincia' : CONFIGURACION_POR_DEFECTO.anchoDeClave,
  }
}

function numero(crudo: string | undefined, porDefecto: number): number {
  const valor = Number(crudo)
  // Una variable de entorno mal escrita no puede acabar en un TTL de `NaN`:
  // eso sería una caché que no caduca nunca o que no guarda nada, y las dos
  // fallan calladas.
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto
}
