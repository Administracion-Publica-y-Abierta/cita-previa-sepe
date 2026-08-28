#!/usr/bin/env node
import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Los iconos de la aplicación, dibujados aquí y guardados en el repositorio.
 *
 * Se dibujan con código y no con un editor por lo mismo que los fixtures salen
 * de un script: así el icono de 192 y el de 512 son el mismo dibujo y no dos
 * ficheros que alguien tiene que acordarse de rehacer los dos. Y se guardan
 * —en vez de generarse en cada build, como el worker de MapLibre— porque el
 * manifiesto apunta a rutas fijas y un icono que se rehace en cada despliegue
 * es un icono que puede cambiar sin que nadie lo mire.
 *
 * El PNG se escribe a mano, con `zlib`, que ya viene con Node. Una librería de
 * imágenes para pintar cuatro círculos serían megabytes de dependencia y una
 * cadena de suministro más que vigilar, en un proyecto cuyo despliegue entero
 * cabe en un plan gratuito.
 *
 * Para rehacerlos: `npm run iconos`.
 */

/** La tinta de la aplicación en claro, que es el color de la barra. */
const FONDO = [0x17, 0x17, 0x17]
const MARCA = [0xff, 0xff, 0xff]

/**
 * Cuánto sitio se deja alrededor del dibujo, en tanto por uno del lado.
 *
 * El recortable deja mucho más porque Android recorta el icono con la forma
 * que tenga el móvil —círculo, cuadrado redondeado, gota— y solo garantiza que
 * se vea el 80% central. Lo que asome fuera de ahí se pierde.
 */
const MARGEN = 0.09
const MARGEN_RECORTABLE = 0.21

/** Cuántas muestras por lado se toman de cada píxel para que el borde no sierre. */
const MUESTRAS = 3

export function iconos() {
  return [
    { nombre: join('iconos', 'icono-192.png'), bytes: png(dibujar(192, MARGEN)) },
    { nombre: join('iconos', 'icono-512.png'), bytes: png(dibujar(512, MARGEN)) },
    {
      nombre: join('iconos', 'icono-recortable-512.png'),
      bytes: png(dibujar(512, MARGEN_RECORTABLE)),
    },
    // El de iOS, que no lee el manifiesto: 180 px es lo que pide el iPhone de
    // más resolución, y de ahí para abajo lo reduce él.
    { nombre: join('iconos', 'apple-touch-icon-180.png'), bytes: png(dibujar(180, MARGEN)) },
  ]
}

/**
 * Un reloj, que es de lo que va esto: a qué hora te pueden atender.
 *
 * Devuelve, para cada punto del lienzo, cuánto de él cae dentro del dibujo —de
 * 0 a 1—. Que sea una función del punto y no una lista de órdenes de pintado es
 * lo que permite dibujarlo a cualquier tamaño y suavizar el borde tomando
 * varias muestras por píxel.
 */
function reloj(lado, margen) {
  const centro = lado / 2
  const marca = lado * (1 - 2 * margen)

  /** El radio exterior de la esfera y el grosor de su aro. */
  const radio = marca * 0.42
  const aro = marca * 0.075

  const manecilla = marca * 0.055
  const eje = marca * 0.035

  // Las diez y diez, que es como se dibujan los relojes desde que se dibujan
  // relojes: las dos manecillas arriba y sin taparse entre ellas.
  const horaria = haciaLaHora(centro, 10, radio * 0.50)
  const minutera = haciaLaHora(centro, 2, radio * 0.72)

  return (x, y) => {
    const distancia = Math.hypot(x - centro, y - centro)
    if (distancia <= radio && distancia >= radio - aro) return true
    if (distancia <= eje) return true
    if (aSegmento(x, y, centro, centro, horaria.x, horaria.y) <= manecilla / 2) return true
    if (aSegmento(x, y, centro, centro, minutera.x, minutera.y) <= manecilla / 2) return true
    return false
  }
}

/** Adónde apunta una manecilla: las 12 son arriba y las horas van a derechas. */
function haciaLaHora(centro, hora, largo) {
  const angulo = (hora / 12) * 2 * Math.PI
  return { x: centro + Math.sin(angulo) * largo, y: centro - Math.cos(angulo) * largo }
}

/** Distancia de un punto al segmento, que es lo que da a las manecillas la punta redonda. */
function aSegmento(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const largo = dx * dx + dy * dy
  const t = largo === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / largo))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

/** El lienzo entero, en filas de píxeles RGB. */
function dibujar(lado, margen) {
  const dentro = reloj(lado, margen)
  const pixeles = Buffer.alloc(lado * lado * 3)

  for (let fila = 0; fila < lado; fila += 1) {
    for (let columna = 0; columna < lado; columna += 1) {
      let cubierto = 0
      for (let sy = 0; sy < MUESTRAS; sy += 1) {
        for (let sx = 0; sx < MUESTRAS; sx += 1) {
          const x = columna + (sx + 0.5) / MUESTRAS
          const y = fila + (sy + 0.5) / MUESTRAS
          if (dentro(x, y)) cubierto += 1
        }
      }

      const parte = cubierto / (MUESTRAS * MUESTRAS)
      const donde = (fila * lado + columna) * 3
      for (let canal = 0; canal < 3; canal += 1) {
        pixeles[donde + canal] = Math.round(FONDO[canal] + (MARCA[canal] - FONDO[canal]) * parte)
      }
    }
  }

  return { lado, pixeles }
}

const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** El PNG completo: firma, cabecera, píxeles comprimidos y final. */
function png({ lado, pixeles }) {
  const cabecera = Buffer.alloc(13)
  cabecera.writeUInt32BE(lado, 0)
  cabecera.writeUInt32BE(lado, 4)
  // Ocho bits por canal, color verdadero sin transparencia, y nada de
  // entrelazado: el icono es opaco y se ve entero de una vez.
  cabecera.set([8, 2, 0, 0, 0], 8)

  // Cada fila va precedida de su método de filtrado. Se usa el 0 —ninguno—
  // porque un icono de dos colores ya comprime a nada.
  const crudo = Buffer.alloc(lado * (1 + lado * 3))
  for (let fila = 0; fila < lado; fila += 1) {
    crudo[fila * (1 + lado * 3)] = 0
    pixeles.copy(crudo, fila * (1 + lado * 3) + 1, fila * lado * 3, (fila + 1) * lado * 3)
  }

  return Buffer.concat([
    FIRMA,
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

/** Un trozo de PNG: longitud, nombre, datos y su comprobación. */
function trozo(nombre, datos) {
  const longitud = Buffer.alloc(4)
  longitud.writeUInt32BE(datos.length, 0)

  const cuerpo = Buffer.concat([Buffer.from(nombre, 'ascii'), datos])
  const comprobacion = Buffer.alloc(4)
  comprobacion.writeUInt32BE(crc32(cuerpo), 0)

  return Buffer.concat([longitud, cuerpo, comprobacion])
}

const TABLA = Array.from({ length: 256 }, (_, byte) => {
  let valor = byte
  for (let vuelta = 0; vuelta < 8; vuelta += 1) {
    valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1
  }
  return valor >>> 0
})

function crc32(datos) {
  let valor = 0xffffffff
  for (const byte of datos) valor = TABLA[(valor ^ byte) & 0xff] ^ (valor >>> 8)
  return (valor ^ 0xffffffff) >>> 0
}

/** Escribirlos solo cuando se llama al script, no cuando lo importa un test. */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const publico = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
  for (const { nombre, bytes } of iconos()) {
    const camino = join(publico, nombre)
    await mkdir(dirname(camino), { recursive: true })
    await writeFile(camino, bytes)
  }
}
