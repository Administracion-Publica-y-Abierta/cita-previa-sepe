import { provinciaDe } from '@/localizacion/provincias'

/**
 * Lo que el navegador sabe de un código postal antes de preguntar a nadie.
 *
 * Comparte la tabla de provincias con el servidor a propósito: si el navegador
 * tuviera su propia idea de qué es un código postal español, el día que la
 * tabla cambie los dos dirían cosas distintas y quien pregunta vería un campo
 * aceptado que el servidor rechaza. La comprobación de aquí es un adelanto de
 * la del servidor, no una segunda opinión.
 */

/** Un código postal español son cinco dígitos. Ni cuatro ni seis. */
export const DIGITOS = 5

/**
 * Lo que se deja escribir en el campo: dígitos, y como mucho cinco.
 *
 * Filtrar al teclear y no al enviar es lo que evita el aviso más inútil de
 * todos —«esto no es un número»— sobre algo que la web podía no haber dejado
 * teclear.
 */
export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, DIGITOS)
}

/**
 * Qué le pasa a este código postal, o `null` si no le pasa nada.
 *
 * Los dos avisos dicen qué hacer y no solo qué está mal: quien escribe cuatro
 * dígitos no tiene por qué saber que aquí son cinco, y quien escribe un código
 * de otro país no tiene por qué saber que los dos primeros son la provincia.
 */
export function avisoDe(codigoPostal: string): string | null {
  if (codigoPostal.length < DIGITOS) return 'El código postal tiene cinco dígitos.'
  if (!provinciaDe(codigoPostal)) {
    return 'No parece un código postal español: los dos primeros dígitos son la provincia, del 01 al 52.'
  }
  return null
}
