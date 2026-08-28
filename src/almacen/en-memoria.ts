import type { Reloj } from '@/nucleo/reloj'
import type { Almacen } from './almacen'

/**
 * El almacén mientras dure la memoria del proceso.
 *
 * No es solo el doble de los tests: es lo que usa `npm run dev` cuando no hay
 * Redis configurado, y en un servidor de siempre —un proceso, una máquina—
 * sería suficiente. Lo que no vale es serverless, que es justo donde esto se
 * despliega: por eso existe el de Redis y por eso los dos pasan la misma
 * batería.
 *
 * Caduca por el reloj inyectado y no por `Date.now()`: si mirase la hora del
 * sistema, un test que adelanta el reloj para pasar el TTL de la caché no
 * vería caducar nada.
 */
export function crearAlmacenEnMemoria(reloj: Reloj): Almacen {
  const datos = new Map<string, { valor: unknown; caducaEn: number }>()

  function vigente(clave: string) {
    const entrada = datos.get(clave)
    if (!entrada) return undefined
    if (entrada.caducaEn <= reloj.ahora()) {
      datos.delete(clave)
      return undefined
    }
    return entrada
  }

  return {
    async leer<T>(clave: string): Promise<T | null> {
      return (vigente(clave)?.valor as T | undefined) ?? null
    },

    async guardar(clave, valor, vidaMs) {
      datos.set(clave, { valor, caducaEn: reloj.ahora() + vidaMs })
    },

    async reservar(clave, vidaMs) {
      const entrada = vigente(clave)
      if (entrada) return entrada.caducaEn - reloj.ahora()
      datos.set(clave, { valor: 1, caducaEn: reloj.ahora() + vidaMs })
      return 0
    },

    async sumarUno(clave, vidaMs) {
      const sumado = Number(vigente(clave)?.valor ?? 0) + 1
      datos.set(clave, { valor: sumado, caducaEn: reloj.ahora() + vidaMs })
      return sumado
    },

    async olvidar(clave) {
      datos.delete(clave)
    },
  }
}
