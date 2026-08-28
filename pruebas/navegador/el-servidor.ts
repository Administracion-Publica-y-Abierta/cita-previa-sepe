import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import type { TestProject } from 'vitest/node'

/**
 * La aplicación levantada de verdad, una sola vez para toda la tirada.
 *
 * Es lo que separa esta prueba de las de interfaz: allí se monta un árbol de
 * React en jsdom, aquí se sirve la web que se despliega —empaquetada, con su
 * CSS y con el worker de MapLibre donde el navegador lo va a pedir—. Media
 * docena de fallos solo existen a este lado: el que este mismo proyecto
 * documenta en `scripts/copiar-el-mapa.mjs` es uno.
 *
 * El servidor **no habla con el SEPE**: la única ruta que lo haría la contesta
 * el navegador desde `el-sepe-grabado.ts`, y todo lo que salga de esta máquina
 * se corta. Lo que este proceso sirve es la web, y nada más.
 */

const RAIZ = resolve(import.meta.dirname, '..', '..')

const NEXT = resolve(RAIZ, 'node_modules', '.bin', 'next')

/** Lo que se espera a que `next dev` conteste antes de darlo por muerto. */
const ARRANQUE_MS = 120_000

declare module 'vitest' {
  interface ProvidedContext {
    /** Dónde está la aplicación levantada, con puerto y todo. */
    servidor: string
  }
}

export default async function levantarLaAplicacion(proyecto: TestProject): Promise<() => Promise<void>> {
  // El worker de MapLibre lo pone `predev` cuando se arranca con npm, y aquí se
  // arranca a `next` directamente: sin esto el mapa pintaría el fondo y ni una
  // calle, que es justo el fallo que esa copia existe para evitar.
  await ejecutar(process.execPath, [resolve(RAIZ, 'scripts', 'copiar-el-mapa.mjs')])

  const puerto = await unPuertoLibre()
  // `localhost` y no `127.0.0.1`: en desarrollo Next solo sirve sus chunks a
  // los orígenes que reconoce, y el de la interfaz de loopback no es uno de
  // ellos. Con la dirección numérica la página llega pero no arranca —los
  // scripts vuelven con un 403— y lo que se probaría es un HTML sin JavaScript.
  const servidor = `http://localhost:${puerto}`
  const proceso = spawn(NEXT, ['dev', '--port', String(puerto)], {
    cwd: RAIZ,
    stdio: 'pipe',
    // Sin heredar la salida: `next dev` habla mucho y lo que importa de él es
    // si contesta, que es lo que se comprueba abajo.
    env: { ...process.env, FORCE_COLOR: '0' },
  })

  const registro: string[] = []
  proceso.stdout?.on('data', (trozo) => registro.push(String(trozo)))
  proceso.stderr?.on('data', (trozo) => registro.push(String(trozo)))

  try {
    await esperarA(servidor, proceso, registro)
  } catch (error) {
    // Por el mismo camino que al terminar bien: si el arranque se ha ido a
    // medias, el servidor puede estar levantándose todavía, y es justo cuando
    // hace falta la escalada a SIGKILL que `apagar` sabe hacer.
    await apagar(proceso)
    throw error
  }

  proyecto.provide('servidor', servidor)

  return () => apagar(proceso)
}

/**
 * Que no quede un `next dev` suelto ocupando un puerto después de la tirada.
 *
 * Se le pide que se vaya y se le espera; si no se va, se le corta. Lo segundo
 * hace falta porque quien atiende la señal es el `next` que lanza al servidor
 * de verdad, y una tirada interrumpida a mitad puede pillarlo arrancando.
 */
/**
 * Si el proceso ya no está.
 *
 * Se miran las dos cosas y no solo el código de salida: a quien se muere por
 * una señal —un Ctrl-C que llega a todo el grupo, el asesino de memoria, un
 * job de CI cancelado— Node le deja el código en `null` y le pone la señal.
 * Mirando solo el código, un servidor ya muerto se daría por vivo: al arrancar
 * eso son dos minutos sondeando un puerto que no va a contestar, y al apagar
 * es esperar para siempre un `exit` que ya se emitió.
 */
function haMuerto(proceso: ChildProcess): boolean {
  return proceso.exitCode !== null || proceso.signalCode !== null
}

function apagar(proceso: ChildProcess): Promise<void> {
  if (haMuerto(proceso)) return Promise.resolve()

  return new Promise((seguir) => {
    const aLaFuerza = setTimeout(() => proceso.kill('SIGKILL'), 5_000)
    proceso.once('exit', () => {
      clearTimeout(aLaFuerza)
      seguir()
    })
    proceso.kill('SIGTERM')
  })
}

/**
 * Espera a que la portada conteste, y no solo a que el puerto abra: en
 * desarrollo la primera petición es la que compila, y una prueba que empezara
 * antes de eso se comería el tiempo de compilación como si fuera lentitud del
 * navegador.
 */
async function esperarA(servidor: string, proceso: ChildProcess, registro: string[]): Promise<void> {
  const limite = Date.now() + ARRANQUE_MS

  for (;;) {
    if (haMuerto(proceso)) {
      throw new Error(`La aplicación se ha muerto al arrancar:\n${registro.join('')}`)
    }

    try {
      const respuesta = await fetch(servidor)
      if (respuesta.ok) return
    } catch {
      // Todavía no escucha: se vuelve a probar hasta que se acabe el plazo.
    }

    if (Date.now() > limite) {
      throw new Error(`La aplicación no ha contestado en ${ARRANQUE_MS / 1000} s:\n${registro.join('')}`)
    }

    await new Promise((seguir) => setTimeout(seguir, 250))
  }
}

/** Un puerto que ahora mismo está libre, para no chocar con lo que corra el que ejecute los tests. */
function unPuertoLibre(): Promise<number> {
  return new Promise((devolver, fallar) => {
    const sonda = createServer()
    sonda.once('error', fallar)
    sonda.listen(0, '127.0.0.1', () => {
      const direccion = sonda.address()
      if (typeof direccion === 'string' || direccion === null) {
        sonda.close(() => fallar(new Error('No se ha podido reservar un puerto.')))
        return
      }
      sonda.close(() => devolver(direccion.port))
    })
  })
}

function ejecutar(orden: string, argumentos: string[]): Promise<void> {
  return new Promise((seguir, fallar) => {
    const proceso = spawn(orden, argumentos, { cwd: RAIZ, stdio: 'inherit' })
    proceso.on('error', fallar)
    proceso.on('exit', (codigo) =>
      codigo === 0 ? seguir() : fallar(new Error(`${orden} ha salido con ${codigo}.`)),
    )
  })
}
