/**
 * La mitad que no cabe en una máquina: **abrir la sesión en una invocación y
 * usarla desde otra**, hasta ver que de verdad han salido por IPs distintas.
 *
 *   node experimentos/ip-y-sesion/dos-invocaciones.mjs https://…/api/sonda
 *
 * Dos cosas que parecen adorno y son la diferencia entre medir y adivinar:
 *
 * - **Se compara contra un control, no contra cero.** Está medido (mitad
 *   local, 31-08-2026) que con la cookie buena y desde la misma IP el SEPE
 *   solo contesta ~3 de cada 8 veces. Así que un «ninguna cruzada contestó»
 *   no significa nada por sí solo: hay que ponerlo al lado de cuántas
 *   contestaron sin cruzar de IP, en el mismo rato y contra el mismo SEPE.
 * - **Los pares que no cruzaron de IP no cuentan.** Si las dos invocaciones
 *   caen por casualidad en la misma IP, ese par no ha probado nada, y
 *   sumarlo a los buenos sería contar como éxito justo lo que no se ha
 *   llegado a probar.
 */

import { esperar, PAUSA_MS } from './sonda.mjs'

const url = process.argv[2]
if (!url) {
  console.error('Falta la URL de la sonda desplegada.')
  console.error('  node experimentos/ip-y-sesion/dos-invocaciones.mjs https://…/api/sonda')
  process.exit(1)
}

const RONDAS = 10

async function invocar(cuerpo) {
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(60000),
  })
  return respuesta.json()
}

const contesto = (salida) => salida.lectura === 'json' && salida.canales > 0

const cruzados = []
let controlBuenos = 0

for (let ronda = 1; ronda <= RONDAS; ronda += 1) {
  // Cruzado: la sesión se abre en una invocación y se usa en otra.
  const abierta = await invocar({ paso: 'abrir' })
  await esperar(PAUSA_MS)
  const usada = await invocar({ paso: 'usar', jsessionid: abierta.jsessionid })

  const distintas = abierta.ip !== usada.ip
  if (distintas) cruzados.push(contesto(usada))

  console.log(
    `ronda ${ronda} cruzada:  ${abierta.ip} → ${usada.ip}` +
      ` · ${distintas ? 'IPs distintas' : 'misma IP (no cuenta)'}` +
      ` · ${contesto(usada) ? 'contestó' : 'no contestó'}`,
  )

  await esperar(PAUSA_MS)

  // Control: las dos mitades en la misma invocación, el mismo rato.
  const control = await invocar({ paso: 'ambos' })
  if (contesto(control)) controlBuenos += 1
  console.log(`ronda ${ronda} control:  ${control.ip} · ${contesto(control) ? 'contestó' : 'no contestó'}`)

  await esperar(PAUSA_MS)
}

const buenos = cruzados.filter(Boolean).length

console.log(`\ncruzadas por IPs distintas: ${cruzados.length} de ${RONDAS} · contestaron ${buenos}`)
console.log(`control (misma invocación):  ${RONDAS} · contestaron ${controlBuenos}`)

if (!cruzados.length) {
  console.log('\nNinguna ronda cruzó de IP: el experimento NO ha medido nada. Repetir.')
} else if (!controlBuenos) {
  console.log('\nEl control tampoco contestó: el SEPE no está para medir ahora. Repetir más tarde.')
} else if (buenos > 0) {
  console.log('\nHay cruzadas que contestaron: la sesión NO está atada a la IP.')
  console.log('La agenda y la reserva se pueden desplegar en serverless tal cual.')
} else {
  console.log('\nEl control contesta y ninguna cruzada lo hace: la sesión SÍ parece atada a la IP.')
  console.log('Hace falta salida con IP fija (proxy propio o IP de egreso dedicada).')
}
