import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '@/app/manifest'
import { metadata, viewport } from '@/app/layout'
import { iconos } from '../scripts/iconos.mjs'

/**
 * Lo que hace que esto se pueda añadir a la pantalla de inicio y arranque como
 * una aplicación, comprobado donde vive de verdad: el manifiesto y los ficheros
 * de los iconos.
 *
 * Se prueba aquí y no en la pantalla porque nada de esto se ve al mirar la web:
 * un manifiesto sin icono de 512 px o con `display: browser` deja una web que
 * funciona igual de bien y que **el móvil ya no ofrece instalar**. El fallo no
 * da la cara, que es la razón de que se compruebe leyendo los ficheros.
 */

const PUBLICO = join(import.meta.dirname, '..', 'public')

/** Lo que dice la propia imagen que mide, leído de su cabecera IHDR. */
function loQueMide(camino: string): { ancho: number; alto: number } {
  const bytes = readFileSync(camino)
  // Los ocho primeros bytes son la firma PNG; luego va el IHDR, y sus dos
  // primeros campos son ancho y alto en 32 bits.
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return { ancho: bytes.readUInt32BE(16), alto: bytes.readUInt32BE(20) }
}

describe('el manifiesto', () => {
  it('pide arrancar a pantalla completa, con su color y desde la portada', () => {
    const declarado = manifest()

    // `standalone` es lo que quita la barra del navegador: sin él, abrir desde
    // el icono es abrir una pestaña más.
    expect(declarado.display).toBe('standalone')
    expect(declarado.start_url).toBe('/')
    expect(declarado.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(declarado.background_color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('trae los dos tamaños de icono que el móvil pide para instalar', () => {
    const tamanos = (manifest().icons ?? []).map((icono) => icono.sizes)

    expect(tamanos).toContain('192x192')
    expect(tamanos).toContain('512x512')
  })

  it('cada icono existe y mide lo que dice medir', () => {
    for (const icono of manifest().icons ?? []) {
      const [ancho, alto] = String(icono.sizes).split('x').map(Number)
      expect(loQueMide(join(PUBLICO, String(icono.src)))).toEqual({ ancho, alto })
      expect(icono.type).toBe('image/png')
    }
  })

  it('hay un icono recortable, que es el que Android no rodea de blanco', () => {
    // Sin `maskable`, Android mete el icono entero dentro de su forma y le pone
    // un fondo blanco alrededor. Con él, el dibujo se deja sitio para que lo
    // recorten y el icono se ve como los demás del móvil.
    const recortables = (manifest().icons ?? []).filter((icono) => icono.purpose === 'maskable')

    expect(recortables.length).toBeGreaterThan(0)
  })
})

describe('el iPhone, que no lee el manifiesto para esto', () => {
  it('tiene su propio icono, y del tamaño que pide', () => {
    // iOS ignora los iconos del manifiesto: si no encuentra `apple-touch-icon`,
    // lo que deja en la pantalla de inicio es una captura de la página.
    const apple = metadata.icons as { apple: string }

    expect(loQueMide(join(PUBLICO, apple.apple))).toEqual({ ancho: 180, alto: 180 })
  })

  it('se declara como aplicación web, que es lo que le quita la barra de Safari', () => {
    expect(metadata.appleWebApp).toMatchObject({ capable: true })
  })
})

describe('el color de la barra', () => {
  it('lo declara la página y coincide con el del manifiesto', () => {
    expect(viewport.themeColor).toBe(manifest().theme_color)
  })
})

describe('los iconos del repositorio', () => {
  it('son exactamente los que dibuja el script', () => {
    // Están guardados y no generados en cada build a propósito: el manifiesto
    // apunta a rutas fijas y un icono que se rehace en cada despliegue es un
    // icono que puede cambiar sin que nadie lo mire. Esta comprobación es lo
    // que evita lo contrario: que el dibujo cambie y los ficheros se queden.
    for (const { nombre, bytes } of iconos()) {
      expect([...readFileSync(join(PUBLICO, nombre))]).toEqual([...bytes])
    }
  })
})
