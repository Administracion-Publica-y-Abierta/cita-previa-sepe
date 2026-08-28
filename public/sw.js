/**
 * La carcasa de la aplicación, para que abra sin cobertura.
 *
 * Esto es lo único que hace y conviene que esté escrito: guarda la portada y
 * los ficheros de la aplicación, y cuando no hay red los saca de ahí. Lo que se
 * enseña entonces —el último resultado consultado, con el día y la hora en que
 * se consultó— lo pone la propia pantalla desde el almacenamiento del
 * navegador; aquí abajo no hay ni un dato del SEPE.
 *
 * Lo que **no** hace, y no es un olvido: no recibe avisos, no pide permiso de
 * notificaciones y no lleva ninguna clave de envío. Eso llega con el flujo de
 * avisos y con su issue. Mientras tanto, un service worker que ya pidiera
 * permisos los estaría pidiendo para nada, y en iOS ni siquiera se pueden pedir
 * hasta que la web está añadida a la pantalla de inicio.
 *
 * Está escrito a mano, sin generador. Cabe en una pantalla, y para lo que hace
 * es más barato que arrastrar una herramienta que lo escriba —y que abandonen—.
 *
 * Se registra solo en producción: en desarrollo los ficheros de la aplicación
 * cambian a cada guardado y servirlos de la caché sería depurar contra código
 * de hace dos cambios. Para probar esto: `npm run build && npm start`.
 */

/**
 * El nombre lleva versión porque al activarse se borra todo lo que no se llame
 * así: es lo que impide que las carcasas de todos los despliegues se vayan
 * acumulando hasta que el navegador eche la buena por falta de sitio.
 */
const CARCASA = 'carcasa-1'

/** Lo imprescindible para que la aplicación abra: la portada. */
const PORTADA = '/'

/**
 * Lo que se guarda según se pide, y ya no se vuelve a pedir.
 *
 * Todo esto lleva la versión en el nombre o no cambia nunca: un fichero de
 * `_next/static` con otro contenido tiene otro nombre, así que servirlo de la
 * caché no puede dejar a nadie con una versión vieja.
 */
const DE_LA_APLICACION = ['/_next/static/', '/iconos/', '/mapa/', '/favicon.ico']

/**
 * El manifiesto va aparte: hace falta sin red —es lo que el móvil lee para
 * abrir esto como una aplicación— pero no lleva versión en el nombre, así que
 * se pide a la red primero y solo se cae a lo guardado si no hay.
 */
const MANIFIESTO = '/manifest.webmanifest'

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CARCASA)
      .then((cajon) => cajon.add(PORTADA))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(nombres.filter((nombre) => nombre !== CARCASA).map((viejo) => caches.delete(viejo))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return

  const direccion = new URL(peticion.url)

  // Lo de fuera no se toca: las teselas del mapa y el geocodificador no son
  // nuestros, y guardar lo ajeno es responder por algo que no controlamos.
  if (direccion.origin !== self.location.origin) return

  // Y lo que se le pregunta al SEPE, tampoco. Guardar una respuesta suya sería
  // justo lo contrario de lo que esta web promete: enseñar un hueco de hace
  // horas como si fuera de ahora. De cuándo es cada dato lo lleva la respuesta
  // y lo cuenta la pantalla, que es donde se puede decir con todas las letras.
  if (direccion.pathname.startsWith('/api/')) return

  if (peticion.mode === 'navigate') {
    // Toda navegación se contesta con la portada: hoy es la única página que
    // hay, y lo guardado se guardó con esa clave.
    evento.respondWith(deLaRedPrimero(peticion, PORTADA))
    return
  }

  if (direccion.pathname === MANIFIESTO) {
    evento.respondWith(deLaRedPrimero(peticion, MANIFIESTO))
    return
  }

  if (DE_LA_APLICACION.some((principio) => direccion.pathname.startsWith(principio))) {
    evento.respondWith(deLaCarcasa(peticion))
  }
})

/**
 * Primero la red, y lo guardado de respaldo.
 *
 * En este orden y no al revés porque lo que se pide así no lleva versión en el
 * nombre: servirlo de la caché teniendo red dejaría a todo el mundo con la
 * versión anterior hasta vaciar el navegador.
 */
async function deLaRedPrimero(peticion, clave) {
  try {
    const respuesta = await fetch(peticion)
    if (respuesta.ok) {
      const cajon = await caches.open(CARCASA)
      await cajon.put(clave, respuesta.clone())
    }
    return respuesta
  } catch (sinRed) {
    const guardada = await caches.match(clave)
    if (guardada) return guardada

    // Sin red y sin nada guardado no hay aplicación que abrir. Se deja pasar el
    // error para que salga la página del navegador, que dice qué ha pasado:
    // una página en blanco nuestra parecería que la rota es la web.
    throw sinRed
  }
}

/** Los ficheros de la aplicación: de la caché si están, y si no, de la red y a la caché. */
async function deLaCarcasa(peticion) {
  const guardada = await caches.match(peticion)
  if (guardada) return guardada

  const respuesta = await fetch(peticion)
  if (respuesta.ok) {
    const cajon = await caches.open(CARCASA)
    await cajon.put(peticion, respuesta.clone())
  }
  return respuesta
}
