import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * jsdom no trae `matchMedia`, y la pantalla de resultados lo necesita para
 * saber si caben las dos columnas. Se pone aquí y contestando que **no** caben:
 * lo que se prueba es la pantalla estrecha, que es donde se va a usar esto y
 * donde el mapa y la lista tienen que convivir sin pelearse.
 */
window.matchMedia = (consulta: string): MediaQueryList =>
  ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

/**
 * Cada test empieza con el DOM vacío y sin nada recordado del anterior.
 *
 * Lo segundo no es rutina: el hero recuerda el último código postal en el
 * navegador, así que sin limpiar, un test heredaría el campo relleno del que
 * fuera antes y pasaría o fallaría según en qué orden se ejecuten.
 */
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})
