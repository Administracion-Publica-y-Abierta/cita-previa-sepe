// Qué cuenta como dato personal, en un solo sitio.
//
// Lo usan el extractor (para limpiar) y los tests (para comprobar que lo
// limpiado sigue limpio). Está compartido a propósito: si mañana hay que
// reconocer un patrón nuevo, añadirlo aquí arregla las dos cosas a la vez, en
// vez de dejar una copia vieja pasando por buena lo que la otra ya rechaza.

/**
 * Los reemplazos mantienen la forma del dato para que nada se rompa por
 * longitud, pero no son de nadie: 00000000T no es un DNI asignado.
 */
export const PATRONES_PERSONALES = [
  { nombre: 'DNI', patron: /\b\d{8}[A-HJ-NP-TV-Z]\b/gi, reemplazo: '00000000T' },
  { nombre: 'NIE', patron: /\b[XYZ]\d{7}[A-HJ-NP-TV-Z]\b/gi, reemplazo: '00000000T' },
  // Móvil español. Los teléfonos de las oficinas empiezan por 9 o por 0901 y no
  // encajan aquí, que es justo lo que se quiere: son públicos y la ficha de la
  // oficina los enseña.
  { nombre: 'móvil', patron: /\b[67]\d{8}\b/g, reemplazo: '600000000' },
  { nombre: 'correo', patron: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, reemplazo: 'persona@ejemplo.invalid' },
]

const REEMPLAZOS = new Set(PATRONES_PERSONALES.map((p) => p.reemplazo))

export function anonimizar(texto) {
  let limpio = texto
  for (const { patron, reemplazo } of PATRONES_PERSONALES) limpio = limpio.replace(patron, reemplazo)
  return limpio
}

/**
 * Cuántos datos personales quedan en `texto`, por tipo.
 *
 * Devuelve cuentas y nunca los valores encontrados. Es deliberado: quien llama
 * a esto lo hace para avisar de que algo se ha colado, y un aviso que imprime
 * el DNI que acaba de encontrar lo deja escrito en la consola y en el registro
 * de CI, que es exactamente la fuga que se quería evitar.
 */
export function contarDatosPersonales(texto) {
  const cuentas = []
  for (const { nombre, patron } of PATRONES_PERSONALES) {
    const encontrados = (texto.match(patron) ?? []).filter((valor) => !REEMPLAZOS.has(valor))
    if (encontrados.length) cuentas.push({ nombre, cantidad: encontrados.length })
  }
  return cuentas
}
