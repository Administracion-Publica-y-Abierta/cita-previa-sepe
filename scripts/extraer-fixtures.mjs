#!/usr/bin/env node
// Extrae los fixtures de test a partir de capturas de red reales del SEPE.
//
// Existe como script versionado, y no como una extracción manual hecha una vez,
// porque el SEPE cambia sus identificadores de trámite sin avisar: cuando eso
// pase habrá capturas nuevas y los fixtures tendrán que rehacerse enteros. Que
// sea reproducible es lo que hace que rehacerlos cueste un minuto.
//
// Los .har crudos NO entran al repositorio: llevan el DNI en las URLs de la
// parte de reserva y el JSESSIONID en las cabeceras. Por eso la anonimización
// ocurre aquí, al extraer, y no se confía en que el .har venga limpio.
//
// Reconstruye el directorio de fixtures entero en cada pasada: lo que no salga
// de las capturas que se le pasen, desaparece. Es lo que garantiza que los
// fixtures sean siempre exactamente lo que hay en las capturas y nada más, así
// que hay que pasarle TODAS las capturas, no solo la nueva.
//
//   node scripts/extraer-fixtures.mjs                 # lee ./capturas
//   node scripts/extraer-fixtures.mjs ~/Downloads     # lee un directorio
//   node scripts/extraer-fixtures.mjs a.har b.har     # lee capturas sueltas

import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { anonimizar, contarDatosPersonales } from './datos-personales.mjs'

const RAIZ = resolve(import.meta.dirname, '..')
const DESTINO = join(RAIZ, 'pruebas', 'fixtures', 'sepe')

// Solo los endpoints de lectura de la Fase 1. Los de la reserva (reservaCita,
// calendarioServicio, los formularios) se dejan fuera a propósito: son los que
// llevan datos personales y no se usan todavía.
//
// `discriminadores` son los parámetros que distinguen una grabación de otra del
// mismo endpoint. Sirven para dos cosas: nombrar el fichero y, en los tests,
// decidir qué grabación contesta a cada petición. Se listan a mano porque una
// petición al SEPE lleva quince parámetros y solo dos o tres cambian la
// respuesta.
const ENDPOINTS = {
  cargaComboNivelesTramitesCPEntidad: {
    discriminadores: ['nivel', 'idsNiveles', 'codigoPostal'],
    // Niveles 1 y 2 del árbol de trámites. JSON.
  },
  cargarComboGruposTramitesByNivel: {
    discriminadores: ['idsNiveles', 'codigoPostal'],
    // Nivel 3. Este llega como HTML con <option>: es el que hay que parsear y
    // por tanto el fixture que más falta hace.
  },
  cargaTiposAtencionMapa: {
    discriminadores: ['codigoPostal', 'idGrupoServicio'],
    // La llamada buena: ya trae `listaOficina` con el primer hueco de cada
    // oficina, así que no hace falta pedir el mapa por separado.
  },
  cargaOficinasMapa: {
    discriminadores: ['codigoPostal', 'idGrupoServicio'],
    // Solo se usa como red de seguridad cuando la anterior viene vacía.
  },
}

// Se anonimiza aquí, en la puerta de entrada, y no más tarde: de estos
// parámetros salen el nombre del fichero y los discriminadores, así que
// limpiarlos después dejaría un DNI escrito en el nombre de un fixture.
function parametros(entrada) {
  const params = new URLSearchParams(new URL(entrada.request.url).search)
  const cuerpo = entrada.request.postData?.text ?? ''
  if (cuerpo) for (const [k, v] of new URLSearchParams(cuerpo)) params.set(k, v)
  return Object.fromEntries([...params].map(([k, v]) => [k, anonimizar(v)]))
}

function cuerpoDeRespuesta(entrada) {
  const contenido = entrada.response.content ?? {}
  const texto = contenido.text ?? ''
  return contenido.encoding === 'base64' ? Buffer.from(texto, 'base64').toString('utf8') : texto
}

function esJson(tipoContenido) {
  return tipoContenido.includes('json')
}

// La clave es mecánica y no un nombre bonito escrito a mano: al volver a
// extraer con capturas nuevas los ficheros deben caer en el mismo sitio sin que
// nadie tenga que renombrarlos.
function claveDe(endpoint, discriminadores) {
  const partes = Object.entries(discriminadores)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}-${v}`)
  return [endpoint, ...partes].join('--').replace(/[^\w.-]+/g, '_')
}

// Un resumen legible para que el índice se pueda revisar en un diff sin abrir
// un JSON de 36 KB.
function resumirRespuesta(cuerpo, tipoContenido) {
  if (!esJson(tipoContenido)) {
    const opciones = cuerpo.match(/<option/g)?.length ?? 0
    return opciones ? `HTML con ${opciones} <option>` : `HTML de ${cuerpo.length} caracteres`
  }
  let datos
  try {
    datos = JSON.parse(cuerpo)
  } catch {
    return `JSON ilegible de ${cuerpo.length} caracteres`
  }
  if (Array.isArray(datos.listaOficina)) {
    const conHueco = datos.listaOficina.filter((o) => o.primerHuecoDisponible).length
    return `${datos.listaOficina.length} oficinas, ${conHueco} con hueco`
  }
  if (Array.isArray(datos.listaNivelesTramites)) {
    return `${datos.listaNivelesTramites.length} niveles de trámite`
  }
  return `JSON de ${cuerpo.length} caracteres`
}

function capturasDe(argumentos) {
  const entradas = argumentos.length ? argumentos : [join(RAIZ, 'capturas')]
  const ficheros = []
  for (const entrada of entradas) {
    const ruta = resolve(entrada)
    let info
    try {
      info = statSync(ruta)
    } catch {
      console.error(`No existe: ${ruta}`)
      continue
    }
    if (info.isDirectory()) {
      for (const f of readdirSync(ruta).sort()) if (f.endsWith('.har')) ficheros.push(join(ruta, f))
    } else if (ruta.endsWith('.har')) {
      ficheros.push(ruta)
    }
  }
  return ficheros
}

function extraer(ficheros) {
  const grabaciones = []
  for (const fichero of ficheros) {
    const har = JSON.parse(readFileSync(fichero, 'utf8'))
    for (const entrada of har.log.entries) {
      const endpoint = new URL(entrada.request.url).pathname.split('/').pop()
      const config = ENDPOINTS[endpoint]
      if (!config) continue
      if (entrada.response.status !== 200) continue

      const params = parametros(entrada)
      const discriminadores = {}
      for (const nombre of config.discriminadores) discriminadores[nombre] = params[nombre] ?? ''

      const tipoContenido = entrada.response.content?.mimeType ?? 'text/plain'
      const cuerpo = anonimizar(cuerpoDeRespuesta(entrada))
      if (!cuerpo) continue

      grabaciones.push({
        clave: claveDe(endpoint, discriminadores),
        endpoint,
        metodo: entrada.request.method,
        discriminadores,
        capturaOrigen: basename(fichero),
        capturadoEn: entrada.startedDateTime,
        resumen: resumirRespuesta(cuerpo, tipoContenido),
        respuesta: { estado: entrada.response.status, tipoContenido, cuerpo },
      })
    }
  }
  return grabaciones
}

function comprobarQueNoQuedaNadaPersonal(grabaciones) {
  const sospechas = []
  for (const g of grabaciones) {
    for (const { nombre, cantidad } of contarDatosPersonales(JSON.stringify(g))) {
      // Se dice cuántos y de qué tipo, nunca cuáles: este mensaje acaba en la
      // consola y en el registro de CI.
      sospechas.push(`${g.clave}: ${cantidad} coincidencia(s) de ${nombre}`)
    }
  }
  // Abortar y no escribir nada: es preferible quedarse sin fixtures a publicar
  // el DNI de alguien.
  if (sospechas.length) {
    console.error('La anonimización ha dejado pasar algo con pinta de dato personal:')
    for (const s of sospechas) console.error(`  ${s}`)
    process.exit(1)
  }
}

function escribir(grabaciones) {
  rmSync(DESTINO, { recursive: true, force: true })
  mkdirSync(DESTINO, { recursive: true })

  const indice = grabaciones.map((g) => {
    const json = esJson(g.respuesta.tipoContenido)
    const fichero = `${g.clave}.${json ? 'json' : 'html'}`
    // El JSON se reindenta porque un fixture también se lee en una revisión de
    // código, y el cliente lo va a parsear igual. El HTML se deja tal cual: sus
    // espacios son parte de lo que el parseador tiene que aguantar.
    const contenido = json ? `${JSON.stringify(JSON.parse(g.respuesta.cuerpo), null, 2)}\n` : g.respuesta.cuerpo
    writeFileSync(join(DESTINO, fichero), contenido)
    return {
      clave: g.clave,
      endpoint: g.endpoint,
      metodo: g.metodo,
      discriminadores: g.discriminadores,
      capturaOrigen: g.capturaOrigen,
      capturadoEn: g.capturadoEn,
      resumen: g.resumen,
      respuesta: { estado: g.respuesta.estado, tipoContenido: g.respuesta.tipoContenido, cuerpo: fichero },
    }
  })

  writeFileSync(
    join(DESTINO, 'indice.json'),
    `${JSON.stringify(
      {
        generadoPor: 'scripts/extraer-fixtures.mjs',
        aviso: 'Fichero generado. No editar a mano: se rehace al volver a extraer.',
        grabaciones: indice,
      },
      null,
      2,
    )}\n`,
  )
  return indice
}

const ficheros = capturasDe(process.argv.slice(2))
if (!ficheros.length) {
  console.error(
    'No se ha encontrado ninguna captura .har.\n' +
      'Las capturas viven fuera del repositorio. Pasa su ruta:\n' +
      '  node scripts/extraer-fixtures.mjs ~/Downloads',
  )
  process.exit(1)
}

// La misma llamada puede aparecer en varias capturas, o dos veces en una. Se
// queda la última leída —las capturas se ordenan por nombre, y el nombre lleva
// la fecha— para que el fixture sea el tráfico más reciente y para que el
// resultado no dependa de con qué grabación se tropiece antes quien busque.
function sinDuplicados(grabaciones) {
  const porClave = new Map()
  for (const g of grabaciones) porClave.set(g.clave, g)
  return [...porClave.values()]
}

const grabaciones = sinDuplicados(extraer(ficheros))
if (!grabaciones.length) {
  console.error('Las capturas no contienen ninguno de los endpoints de lectura.')
  process.exit(1)
}

comprobarQueNoQuedaNadaPersonal(grabaciones)
const indice = escribir(grabaciones)

console.log(`Capturas leídas: ${ficheros.map((f) => basename(f)).join(', ')}`)
console.log(`Fixtures escritos en pruebas/fixtures/sepe (${indice.length}):`)
for (const g of indice) console.log(`  ${g.clave}  →  ${g.resumen}`)
