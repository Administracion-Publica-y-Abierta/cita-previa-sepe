import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ElServiceWorker } from '@/interfaz/el-service-worker'

/**
 * El registro de la carcasa: una línea, y las dos formas en que puede salir mal
 * sin que se lleve nada por delante.
 *
 * Se prueba porque es la línea de la que cuelga todo lo demás —sin ella el
 * service worker está escrito y no lo tiene nadie— y porque falla en sitios
 * reales: modo privado, un navegador viejo, `localhost` sin HTTPS.
 */

function elNavegadorRegistra(): ReturnType<typeof vi.fn> {
  const registrar = vi.fn(() => Promise.resolve({}))
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: { register: registrar },
  })
  return registrar
}

describe('el registro de la carcasa', () => {
  it('le pide al navegador que se quede con ella', () => {
    const registrar = elNavegadorRegistra()

    render(<ElServiceWorker />)

    expect(registrar).toHaveBeenCalledWith('/sw.js')
  })

  it('no rompe nada en un navegador que no sabe de service workers', () => {
    // jsdom no lo trae, que es exactamente el caso: aquí no hay nada que
    // borrar y la propiedad no existe.
    expect(() => render(<ElServiceWorker />)).not.toThrow()
  })

  it('ni cuando el navegador lo rechaza, y sin dejar el rechazo suelto', async () => {
    const sueltos: unknown[] = []
    const apuntar = (evento: PromiseRejectionEvent) => sueltos.push(evento.reason)
    window.addEventListener('unhandledrejection', apuntar)

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { register: () => Promise.reject(new Error('modo privado')) },
    })

    render(<ElServiceWorker />)
    // Dos vueltas: el rechazo se resuelve en la primera y el aviso de que nadie
    // lo recogió sale en la siguiente.
    await new Promise((seguir) => setTimeout(seguir, 0))
    await new Promise((seguir) => setTimeout(seguir, 0))
    window.removeEventListener('unhandledrejection', apuntar)

    // Sin `catch`, esto sería una promesa rechazada sin recoger: en el navegador
    // de quien mira acaba en su consola, y aquí lo caza además el propio vitest.
    expect(sueltos).toEqual([])
  })
})
