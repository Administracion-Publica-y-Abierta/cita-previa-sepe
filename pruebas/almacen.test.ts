import { describe, expect, it } from 'vitest'
import type { Almacen } from '@/almacen/almacen'
import { crearAlmacenEnMemoria } from '@/almacen/en-memoria'
import { crearAlmacenRedis } from '@/almacen/redis'
import { crearRedisFalso, FICHA_DE_REDIS, URL_DE_REDIS } from './ayudantes/redis-falso'
import { crearRelojFalso, type RelojFalso } from './ayudantes/reloj-falso'
import { INSTANTE_DE_LAS_CAPTURAS } from './ayudantes/montar-app'

/**
 * La misma batería contra las dos implementaciones.
 *
 * Es la única forma de que "el freno vive fuera del proceso" signifique algo:
 * lo que se prueba con el almacén en memoria solo vale en producción si el de
 * Redis se comporta igual, y eso no se comprueba leyéndolo.
 */
const IMPLEMENTACIONES: { nombre: string; crear: (reloj: RelojFalso) => Almacen }[] = [
  { nombre: 'en memoria', crear: (reloj) => crearAlmacenEnMemoria(reloj) },
  {
    nombre: 'en Redis',
    crear: (reloj) =>
      crearAlmacenRedis({ fetch: crearRedisFalso(reloj), url: URL_DE_REDIS, ficha: FICHA_DE_REDIS }),
  },
]

const UN_MINUTO = 60_000

for (const { nombre, crear } of IMPLEMENTACIONES) {
  describe(`el almacén compartido ${nombre}`, () => {
    function montar() {
      const reloj = crearRelojFalso(INSTANTE_DE_LAS_CAPTURAS)
      return { reloj, almacen: crear(reloj) }
    }

    it('devuelve lo guardado, con su forma entera y no como texto', async () => {
      const { almacen } = montar()

      await almacen.guardar('consulta', { estado: 'ok', oficinas: [{ id: 5079 }] }, UN_MINUTO)

      expect(await almacen.leer('consulta')).toEqual({ estado: 'ok', oficinas: [{ id: 5079 }] })
    })

    it('no sabe nada de una clave que nadie ha guardado', async () => {
      const { almacen } = montar()

      expect(await almacen.leer('nunca-escrita')).toBeNull()
    })

    it('olvida lo guardado en cuanto pasa su vida', async () => {
      const { almacen, reloj } = montar()
      await almacen.guardar('consulta', { estado: 'ok' }, UN_MINUTO)

      await reloj.avanzar(UN_MINUTO - 1)
      expect(await almacen.leer('consulta')).not.toBeNull()

      await reloj.avanzar(1)
      expect(await almacen.leer('consulta')).toBeNull()
    })

    it('solo una reserva se lleva la clave, y la otra sabe cuánto le falta', async () => {
      const { almacen } = montar()

      expect(await almacen.reservar('ficha', 2500)).toBe(0)
      expect(await almacen.reservar('ficha', 2500)).toBe(2500)
    })

    it('la reserva se libera sola al vencer su vida, no antes', async () => {
      const { almacen, reloj } = montar()
      await almacen.reservar('ficha', 2500)

      await reloj.avanzar(2400)
      expect(await almacen.reservar('ficha', 2500)).toBe(100)

      await reloj.avanzar(100)
      expect(await almacen.reservar('ficha', 2500)).toBe(0)
    })

    it('quien ha terminado puede soltar la reserva antes de tiempo', async () => {
      const { almacen } = montar()
      await almacen.reservar('consultando', UN_MINUTO)

      await almacen.olvidar('consultando')

      expect(await almacen.reservar('consultando', UN_MINUTO)).toBe(0)
    })

    it('cuenta desde cero y acumula, sin que nadie lea y escriba por su cuenta', async () => {
      const { almacen } = montar()

      expect(await almacen.sumarUno('vacios', UN_MINUTO)).toBe(1)
      expect(await almacen.sumarUno('vacios', UN_MINUTO)).toBe(2)
      expect(await almacen.leer('vacios')).toBe(2)
    })

    it('la cuenta también caduca: un rato sin tráfico y se empieza de nuevo', async () => {
      const { almacen, reloj } = montar()
      for (let i = 0; i < 3; i += 1) await almacen.sumarUno('vacios', UN_MINUTO)

      await reloj.avanzar(UN_MINUTO)

      expect(await almacen.leer('vacios')).toBeNull()
      expect(await almacen.sumarUno('vacios', UN_MINUTO)).toBe(1)
    })

    it('una reserva conseguida se ve desde fuera, que es como se sabe que alguien está en ello', async () => {
      const { almacen } = montar()

      await almacen.reservar('consultando', UN_MINUTO)

      expect(await almacen.leer('consultando')).not.toBeNull()
    })
  })
}
