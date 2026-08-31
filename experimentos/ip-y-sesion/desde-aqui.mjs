/**
 * La mitad del experimento que cabe en una sola máquina: **¿mira el endpoint
 * la sesión siquiera?**
 *
 * Va antes que la de las dos IPs y no es un calentamiento. Si
 * `cargaTiposAtencionMapa` contesta igual de bien sin ninguna cookie, entonces
 * mandarle una cookie desde otra IP no prueba nada —no hay sesión que atar— y
 * un «no está atada» salido de ahí sería un falso positivo: cierto por el
 * motivo equivocado. Gastar aquí unas pocas peticiones evita desplegar una
 * sonda que habría contestado que sí a cualquier cosa.
 *
 *   node experimentos/ip-y-sesion/desde-aqui.mjs
 *
 * Lo que se compara no son tres respuestas sino **tres tasas**: está medido en
 * este repositorio que el mismo trámite contesta vacío y con 46 oficinas con
 * treinta segundos de diferencia, así que un caso que falle una vez no dice
 * nada. Cada caso se intenta varias veces y se cuenta cuántas contestaron.
 */

import { abrirSesion, esperar, ipDeSalida, PAUSA_MS, usarSesion } from './sonda.mjs'

/** Un JSESSIONID con la forma que tienen los del SEPE, pero que nadie ha repartido. */
const INVENTADA = 'JSESSIONID=0000000000000000000000000000000A.sede-cita-previa-1'

const INTENTOS_POR_CASO = 8

console.log('Experimento: ¿el SEPE ata la sesión a la IP? — mitad local')
console.log(`${new Date().toISOString()} · IP de salida: ${await ipDeSalida()}\n`)

const casos = [
  {
    nombre: 'cookie recién repartida',
    // Se reabre la sesión en cada intento, que es lo que hace
    // `src/sepe/cliente.ts` cuando una respuesta no trae lo que debía.
    galleta: async () => (await abrirSesion()).jsessionid,
    porque: 'control: si esto no contesta nunca, la sonda no se puede leer',
  },
  {
    nombre: 'sin ninguna cookie',
    galleta: async () => null,
    porque: 'si contesta igual, el endpoint no mira la sesión',
  },
  {
    // Sin este caso el control tendría trampa: es el único que además pide la
    // portada justo antes, y podría estar ganando por esa visita y no por la
    // cookie. Aquí se hace la visita y se tira la cookie, así que lo único que
    // cambia respecto al control es la cookie.
    nombre: 'portada visitada, cookie tirada',
    galleta: async () => {
      await abrirSesion()
      return null
    },
    porque: 'separa «vale la cookie» de «vale haber pasado por la portada»',
  },
  {
    nombre: 'cookie inventada',
    galleta: async () => INVENTADA,
    porque: 'si contesta igual, el SEPE no comprueba que la sesión exista',
  },
]

const tasas = []

for (const caso of casos) {
  let contestadas = 0

  for (let intento = 1; intento <= INTENTOS_POR_CASO; intento += 1) {
    const galleta = await caso.galleta()
    await esperar(PAUSA_MS)
    const salida = await usarSesion(galleta, { intentos: 1 })
    if (salida.lectura === 'json' && salida.canales > 0) contestadas += 1
    await esperar(PAUSA_MS)
  }

  tasas.push({ ...caso, contestadas })
  console.log(`${caso.nombre.padEnd(26)} ${contestadas}/${INTENTOS_POR_CASO} contestaron  · ${caso.porque}`)
}

console.log()

const [control, ...resto] = tasas

if (control.contestadas === 0) {
  console.log('El control no ha contestado ni una vez: el SEPE no está para medir ahora.')
  console.log('No se concluye nada. Repetir más tarde.')
} else if (resto.every((caso) => caso.contestadas > 0)) {
  console.log('Contesta igual con cookie buena, sin cookie y con una inventada:')
  console.log('este endpoint NO mira la sesión, así que no sirve para medir si la sesión se ata a la IP.')
} else {
  console.log('El control contesta y alguno de los otros no: el endpoint sí mira la sesión.')
  console.log('Entonces la mitad de las dos IPs (dos-invocaciones.mjs) sí mide algo.')
}
