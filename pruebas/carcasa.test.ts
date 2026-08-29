import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ficherosDe } from './ayudantes/ficheros'
import { montarLaCarcasa, NO_SE_METE } from './ayudantes/la-carcasa'

/**
 * La carcasa: lo que hace que abrir esto sin cobertura enseñe la aplicación y
 * no la página de error del navegador.
 *
 * Es todo lo que este service worker hace, y decirlo así de corto es media
 * comprobación: **no recibe avisos, no pide permiso de notificaciones y no
 * lleva ninguna clave**. Eso llega con el flujo de avisos, y hasta entonces un
 * service worker que ya pidiera permisos sería pedirlos para nada —y en iOS,
 * pedirlos antes de que la web esté en la pantalla de inicio es pedir algo que
 * ni siquiera existe—.
 */

const RAIZ = join(import.meta.dirname, '..')
const CARCASA = readFileSync(join(RAIZ, 'public', 'sw.js'), 'utf8')

/** Un fichero de la aplicación de los que llevan su versión en el nombre. */
const UN_TROZO = '/_next/static/chunks/8401.js'

/** La portada tal como la manda Next: con sus ficheros nombrados dentro. */
const PORTADA = `<html>la portada<script src="${UN_TROZO}"></script></html>`

function laAplicacion(): Record<string, string> {
  return { '/': PORTADA, [UN_TROZO]: 'la aplicación', '/manifest.webmanifest': '{}' }
}

describe('abrir la aplicación sin cobertura', () => {
  it('enseña la portada guardada en vez de la página de error del navegador', async () => {
    const carcasa = montarLaCarcasa(laAplicacion())
    await carcasa.instalar()

    carcasa.sinRed()
    const respuesta = await carcasa.pedir('/')

    expect(await respuesta?.text()).toBe(PORTADA)
  })

  it('enseña también los ficheros de la aplicación, que es lo que la deja usable', async () => {
    // Sin ellos la portada abre y se queda en un esqueleto: no hay con qué
    // pintar la lista guardada ni con qué volver a comprobar cuando haya red.
    //
    // Y se guardan **en la instalación**, leyéndolos de la propia portada, sin
    // que nadie los haya pedido a través de la carcasa: en la primera visita la
    // página los pidió antes de que este service worker existiera. Quien
    // instala y se mete en el metro antes de volver a abrirla se quedaría si no
    // con la carcasa vacía.
    const carcasa = montarLaCarcasa(laAplicacion())
    await carcasa.instalar()

    carcasa.sinRed()
    const respuesta = await carcasa.pedir(UN_TROZO, { modo: 'no-cors' })

    expect(await respuesta?.text()).toBe('la aplicación')
  })

  it('enseña también el manifiesto, que es lo que la hace una aplicación y no una pestaña', async () => {
    const carcasa = montarLaCarcasa(laAplicacion())
    await carcasa.instalar()
    await carcasa.pedir('/manifest.webmanifest', { modo: 'no-cors' })

    carcasa.sinRed()
    const respuesta = await carcasa.pedir('/manifest.webmanifest', { modo: 'no-cors' })

    expect(await respuesta?.text()).toBe('{}')
  })

  it('si no hay nada guardado, se aparta: la página del navegador explica más que una en blanco', async () => {
    const carcasa = montarLaCarcasa(laAplicacion())
    // Sin instalar no hay nada guardado. Es el caso de quien abre por primera
    // vez ya sin cobertura.
    carcasa.sinRed()

    await expect(carcasa.pedir('/')).rejects.toThrow()
  })
})

describe('con cobertura', () => {
  it('la portada que se enseña es la de ahora, no la guardada', async () => {
    const carcasa = montarLaCarcasa(laAplicacion())
    await carcasa.instalar()

    carcasa.contesta('/', 'la portada de hoy')
    const respuesta = await carcasa.pedir('/')

    expect(await respuesta?.text()).toBe('la portada de hoy')
  })

  it('y la que se guarda pasa a ser esa, para la próxima vez que no haya red', async () => {
    const carcasa = montarLaCarcasa(laAplicacion())
    await carcasa.instalar()

    carcasa.contesta('/', 'la portada de hoy')
    await carcasa.pedir('/')

    carcasa.sinRed()
    expect(await (await carcasa.pedir('/'))?.text()).toBe('la portada de hoy')
  })

  it('un fichero ya guardado no se vuelve a pedir: llevan la versión en el nombre', async () => {
    const carcasa = montarLaCarcasa(laAplicacion())
    await carcasa.pedir(UN_TROZO, { modo: 'no-cors' })
    const hastaAhora = carcasa.aLaRed.length

    await carcasa.pedir(UN_TROZO, { modo: 'no-cors' })

    expect(carcasa.aLaRed.length).toBe(hastaAhora)
  })
})

describe('lo que la carcasa no toca', () => {
  it('lo que se le pregunta al SEPE, ni de ida ni de vuelta', async () => {
    // Una respuesta del SEPE guardada sería justo lo contrario de lo que esta
    // web promete: se enseñaría un hueco de hace horas como si fuera de ahora.
    // De cuándo es el dato lo lleva la propia respuesta y lo cuenta la pantalla.
    const carcasa = montarLaCarcasa(laAplicacion())
    await carcasa.instalar()

    expect(await carcasa.pedir('/api/busqueda', { metodo: 'POST', modo: 'no-cors' })).toBe(NO_SE_METE)
    expect(await carcasa.pedir('/api/busqueda', { modo: 'no-cors' })).toBe(NO_SE_METE)
  })

  it('nada de otro sitio: las teselas del mapa y el geocodificador no son nuestros', async () => {
    const carcasa = montarLaCarcasa(laAplicacion())
    await carcasa.instalar()

    expect(await carcasa.pedir('https://tiles.example/12/2048/1536.pbf', { modo: 'no-cors' })).toBe(
      NO_SE_METE,
    )
  })
})

describe('una versión nueva', () => {
  it('se lleva por delante la carcasa de la anterior', async () => {
    const carcasa = montarLaCarcasa(laAplicacion())
    await carcasa.instalar()
    await carcasa.activar()

    // Queda una sola caché: la de esta versión. Si se fueran acumulando, el
    // navegador acabaría echando la buena por falta de sitio.
    expect(carcasa.cajones()).toHaveLength(1)
    expect(carcasa.loGuardadoEn(carcasa.cajones()[0])).toContain(
      'https://cita-previa-sepe.example/',
    )
  })
})

describe('quién le dice al navegador que se la quede', () => {
  it('la aplicación, desde el layout: una carcasa que nadie registra no existe', () => {
    // Comprobación de las de mirar el código, y por lo de siempre: sin esta
    // línea todo lo de arriba sigue pasando y la aplicación no abre sin red.
    expect(readFileSync(join(RAIZ, 'src', 'app', 'layout.tsx'), 'utf8')).toContain(
      '<ElServiceWorker />',
    )
  })
})

describe('lo que este service worker no hace todavía', () => {
  it('no escucha avisos ni pide permiso para enseñarlos', () => {
    // El día que existan los avisos, esto se amplía a conciencia y con su
    // issue. Lo que no puede pasar es que se cuele de lado: un `push` aquí
    // dentro es una promesa que la web no está haciendo en ninguna pantalla.
    // Se busca lo que sería usarlo y no la palabra suelta, para que este mismo
    // fichero pueda explicar en un comentario por qué no está.
    expect(CARCASA).not.toMatch(
      /addEventListener\(\s*['"]push|showNotification|pushManager|applicationServerKey|requestPermission/i,
    )
  })

  it('no hay ninguna clave de envío en el repositorio', () => {
    for (const fichero of ficherosDe(join(RAIZ, 'src'))) {
      expect(readFileSync(fichero, 'utf8')).not.toMatch(
        /vapid|applicationServerKey|pushManager|requestPermission/i,
      )
    }
  })

  it('no se usa `next-pwa`, que está sin mantenimiento', () => {
    // Un generador de service workers abandonado deja escrito en el sitio un
    // fichero que nadie de aquí sabe leer. Este se escribe a mano y cabe en una
    // pantalla, que para lo que hace es lo justo.
    const paquetes = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'))
    const declarados = Object.keys({ ...paquetes.dependencies, ...paquetes.devDependencies })

    expect(declarados.filter((nombre) => /pwa|workbox/i.test(nombre))).toEqual([])
  })

  it('no hay más de un service worker: dos se pisarían el sitio', () => {
    const sueltos = readdirSync(join(RAIZ, 'public')).filter((nombre) => /sw|worker/i.test(nombre))

    expect(sueltos).toEqual(['sw.js'])
  })
})
