/**
 * La mitad que no cabe en una máquina: **abrir la sesión en una invocación y
 * usarla desde otra**, hasta ver que de verdad han salido por IPs distintas.
 *
 *   node experimentos/ip-y-sesion/dos-invocaciones.mjs https://…/api/sonda [rondas]
 *
 * Tres cosas que parecen adorno y son la diferencia entre medir y adivinar:
 *
 * - **Se compara contra un control, no contra cero.** Está medido (mitad
 *   local, 31-08-2026) que con la cookie buena y desde la misma IP el SEPE
 *   solo contesta ~3 de cada 8 veces. Así que un «ninguna cruzada contestó»
 *   no significa nada por sí solo: hay que ponerlo al lado de cuántas
 *   contestaron sin cruzar de IP, en el mismo rato y contra el mismo SEPE.
 * - **Los pares que no cruzaron de IP no cuentan**, y tampoco cuentan los
 *   pares en los que no se ha podido saber por dónde salieron. Sumar como
 *   éxito lo que no se ha llegado a probar es la forma barata de contestar que
 *   no.
 * - **La conclusión la firma Fisher.** Con el SEPE contestando 3 de cada 8, un
 *   0 de 3 cruzadas contra un 1 de 3 controles no dice nada, y dicho con
 *   aplomo mandaría a alguien a contratar una IP de egreso que igual no hace
 *   falta.
 */

import { fisherUnaCola, LISTON } from './estadistica.mjs'
import { esperar, PAUSA_MS } from './sonda.mjs'

const url = process.argv[2]
if (!url) {
  console.error('Falta la URL de la sonda desplegada.')
  console.error('  node experimentos/ip-y-sesion/dos-invocaciones.mjs https://…/api/sonda [rondas]')
  process.exit(1)
}

const RONDAS = Number(process.argv[3]) || 10

/** Por debajo de esto no se dice nada, salga lo que salga. */
const MINIMO_CRUZADAS = 5

async function invocar(cuerpo) {
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(70000),
  })

  // Una página de error del alojamiento no puede tumbar la pasada entera: una
  // ronda cuesta varias peticiones al SEPE con sus pausas, y volver a
  // empezar por un 502 es tirar todas las que ya se habían pagado.
  if (!respuesta.ok) return { fallo: `la sonda contestó ${respuesta.status}` }
  try {
    return await respuesta.json()
  } catch {
    return { fallo: 'la sonda no contestó JSON' }
  }
}

const contesto = (salida) => salida.lectura === 'json' && salida.canales > 0

const cruzadas = []
let controlBuenos = 0
let controlTotal = 0
let descartadas = 0

for (let ronda = 1; ronda <= RONDAS; ronda += 1) {
  // Cruzada: la sesión se abre en una invocación y se usa en otra.
  const abierta = await invocar({ paso: 'abrir' })
  await esperar(PAUSA_MS)
  const usada = abierta.fallo ? { fallo: abierta.fallo } : await invocar({ paso: 'usar', jsessionid: abierta.jsessionid })

  if (abierta.fallo || usada.fallo) {
    descartadas += 1
    console.log(`ronda ${ronda} cruzada:  descartada (${abierta.fallo ?? usada.fallo})`)
  } else if (!abierta.ip || !usada.ip) {
    // No se sabe por dónde salió alguna de las dos. Contarla como cruzada
    // sería inventarse la mitad del experimento.
    descartadas += 1
    console.log(`ronda ${ronda} cruzada:  descartada (no se sabe la IP de salida)`)
  } else if (abierta.ip === usada.ip) {
    console.log(`ronda ${ronda} cruzada:  ${abierta.ip} → ${usada.ip} · misma IP (no cuenta)`)
  } else {
    cruzadas.push(contesto(usada))
    console.log(
      `ronda ${ronda} cruzada:  ${abierta.ip} → ${usada.ip} · IPs distintas · ` +
        `${contesto(usada) ? 'contestó' : 'no contestó'}`,
    )
  }

  await esperar(PAUSA_MS)

  // Control: las dos mitades en la misma invocación, el mismo rato.
  const control = await invocar({ paso: 'ambos' })
  if (control.fallo) {
    console.log(`ronda ${ronda} control:  descartado (${control.fallo})`)
  } else {
    controlTotal += 1
    if (contesto(control)) controlBuenos += 1
    console.log(`ronda ${ronda} control:  ${control.ip ?? '?'} · ${contesto(control) ? 'contestó' : 'no contestó'}`)
  }

  await esperar(PAUSA_MS)
}

const buenas = cruzadas.filter(Boolean).length

console.log(`\ncruzadas válidas: ${cruzadas.length} · contestaron ${buenas}`)
console.log(`control:          ${controlTotal} · contestaron ${controlBuenos}`)
if (descartadas) console.log(`descartadas:      ${descartadas}`)

if (cruzadas.length < MINIMO_CRUZADAS) {
  console.log(`\nMenos de ${MINIMO_CRUZADAS} cruzadas válidas: el experimento NO ha medido nada.`)
  console.log('Repetir con más rondas: hacen falta invocaciones que salgan por IPs distintas.')
} else if (controlBuenos === 0) {
  console.log('\nEl control tampoco contestó nunca: el SEPE no está para medir ahora.')
  console.log('Repetir más tarde. Un cero cruzado sin control que lo respalde no dice nada.')
} else if (buenas > 0) {
  console.log('\nHay cruzadas que contestaron: la sesión NO está atada a la IP.')
  console.log('La agenda y la reserva se pueden desplegar en serverless tal cual.')
} else {
  const p = fisherUnaCola(controlBuenos, controlTotal, buenas, cruzadas.length)
  console.log(`\nFisher p = ${p.toFixed(4)}`)

  if (p < LISTON) {
    console.log('El control contesta y ninguna cruzada lo hace: la sesión SÍ parece atada a la IP.')
    console.log('Hace falta salida con IP fija (proxy propio o IP de egreso dedicada).')
  } else {
    console.log(`La diferencia no llega al listón (p < ${LISTON}): todavía no se concluye nada.`)
    console.log('Repetir con más rondas antes de tocar la arquitectura por esto.')
  }
}
