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
 *   node experimentos/ip-y-sesion/desde-aqui.mjs [intentos por caso]
 *
 * Lo que se compara no son tres respuestas sino **tres tasas**, y no a ojo:
 * está medido en este repositorio que el mismo trámite contesta vacío y con 46
 * oficinas con treinta segundos de diferencia, así que a la tasa a la que el
 * SEPE contesta —unas 3 de cada 8— un «el control contestó y el otro no» sale
 * por casualidad demasiado a menudo. La conclusión la firma Fisher, no el ojo.
 */

import { fisherUnaCola, LISTON } from './estadistica.mjs'
import { abrirSesion, esperar, ipDeSalida, PAUSA_MS, usarSesion } from './sonda.mjs'

/** Un JSESSIONID con la forma que tienen los del SEPE, pero que nadie ha repartido. */
const INVENTADA = 'JSESSIONID=0000000000000000000000000000000A.sede-cita-previa-1'

const INTENTOS_POR_CASO = Number(process.argv[2]) || 8

console.log('Experimento: ¿el SEPE ata la sesión a la IP? — mitad local')
console.log(`${new Date().toISOString()} · IP de salida: ${(await ipDeSalida()) ?? 'desconocida'}`)
console.log(`${INTENTOS_POR_CASO} intentos por caso\n`)

/**
 * Abre sesión y devuelve la cookie, o revienta.
 *
 * Sin esto, una portada que contestara sin repartir cookie —un 5xx, una
 * pantalla del cortafuegos— convertiría el control en una copia exacta del
 * caso «sin ninguna cookie», y el guion seguiría imprimiendo conclusiones
 * sobre nada.
 */
async function cookieNueva() {
  const { estado, jsessionid } = await abrirSesion()
  if (!jsessionid) {
    throw new Error(`la portada contestó ${estado} sin repartir JSESSIONID: no hay control que valga`)
  }
  return jsessionid
}

const casos = [
  {
    nombre: 'cookie recién repartida',
    // Se reabre la sesión en cada intento, que es lo que hace
    // `src/sepe/cliente.ts` cuando una respuesta no trae lo que debía.
    galleta: cookieNueva,
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
  console.log(
    `${caso.nombre.padEnd(31)} ${contestadas}/${INTENTOS_POR_CASO} contestaron  · ${caso.porque}`,
  )
}

console.log()

const [control, ...resto] = tasas
const sinCookieBuena = resto.reduce((suma, caso) => suma + caso.contestadas, 0)
const totalSinCookieBuena = resto.length * INTENTOS_POR_CASO

if (control.contestadas === 0) {
  console.log('El control no ha contestado ni una vez: el SEPE no está para medir ahora.')
  console.log('No se concluye nada. Repetir más tarde.')
} else {
  const p = fisherUnaCola(
    control.contestadas,
    INTENTOS_POR_CASO,
    sinCookieBuena,
    totalSinCookieBuena,
  )

  console.log(
    `control ${control.contestadas}/${INTENTOS_POR_CASO} · ` +
      `sin cookie buena ${sinCookieBuena}/${totalSinCookieBuena} · Fisher p = ${p.toFixed(4)}`,
  )

  if (p < LISTON) {
    console.log('\nEl control contesta bastante más que el resto: el endpoint SÍ mira la sesión.')
    console.log('Entonces la mitad de las dos IPs (dos-invocaciones.mjs) sí mide algo.')
  } else {
    console.log(`\nLa diferencia no llega al listón (p < ${LISTON}): no se concluye nada.`)
    console.log('O el endpoint no mira la sesión, o hacen falta más intentos. Repetir con más.')
  }
}
