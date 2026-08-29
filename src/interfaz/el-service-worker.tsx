'use client'

import { useEffect } from 'react'

/**
 * Le dice al navegador que se quede con la carcasa (`public/sw.js`), que es lo
 * que hace que esto abra sin cobertura.
 *
 * No pinta nada: es un efecto y vive en un componente porque el registro es del
 * navegador y el layout se pinta en el servidor.
 *
 * Que falle no rompe nada y por eso no se cuenta: sin carcasa, la web funciona
 * exactamente igual mientras haya red, que es como funcionaba antes de esto.
 * Pasa de verdad —modo privado, `localhost` sin HTTPS, un navegador viejo— y no
 * es una avería que quien mira pueda arreglar.
 */
export function ElServiceWorker() {
  useEffect(() => {
    // En desarrollo no: los ficheros de la aplicación cambian a cada guardado y
    // servirlos de la caché sería depurar contra código de hace dos cambios.
    if (process.env.NODE_ENV === 'development') return
    if (!('serviceWorker' in window.navigator)) return

    void window.navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return null
}
