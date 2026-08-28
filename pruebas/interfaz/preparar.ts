import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { pantalla } from './pantalla'

/** Se empieza siempre en un móvil. El que quiera escritorio lo dice. */
beforeEach(() => {
  pantalla({ dosColumnas: false })
})

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
  vi.unstubAllGlobals()
})
