import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { olvidarLaCobertura } from '@/interfaz/cobertura'
import { olvidarLoLeido } from '@/interfaz/lo-que-recuerda-el-navegador'
import { pantalla } from './pantalla'

/** Se empieza siempre en un móvil. El que quiera escritorio lo dice. */
beforeEach(() => {
  pantalla({ dosColumnas: false })
})

/**
 * Cada test empieza con el DOM vacío y sin nada recordado del anterior.
 *
 * Lo segundo no es rutina: el hero recuerda el último código postal y el último
 * resultado en el navegador, así que sin limpiar, un test heredaría el campo
 * relleno —o la lista entera— del que fuera antes y pasaría o fallaría según en
 * qué orden se ejecuten.
 *
 * Y con lo que se le finge al `navigator` —la cobertura, el móvil que dice ser,
 * si está añadida a la pantalla de inicio— pasa lo mismo y peor: un test que
 * quita la red deja sin ella a los siguientes, y lo que rompe entonces no se
 * parece en nada a la causa. Se borran las propiedades propias para que vuelvan
 * a mandar las del navegador.
 */
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  // Vaciar el almacenamiento no basta: el último resultado se lee una vez y se
  // recuerda en el módulo, así que sin esto el primer test que guardara algo se
  // lo dejaría puesto a todos los siguientes.
  olvidarLoLeido()
  olvidarLaCobertura()
  window.history.replaceState(null, '', '/')
  for (const propiedad of ['onLine', 'userAgent', 'maxTouchPoints', 'standalone', 'serviceWorker']) {
    Reflect.deleteProperty(window.navigator, propiedad)
  }
  vi.unstubAllGlobals()
})
