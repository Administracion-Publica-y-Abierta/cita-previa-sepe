import { describe, expect, it } from 'vitest'
import type { TramiteEnCola } from '@/sepe/cola'
import type { LoQueVaLlegando, TramiteResuelto } from './lo-que-va-llegando'
import { NADA_TODAVIA } from './lo-que-va-llegando'
import { agrupados, loQueHayQuePedir, marcando, soloLoElegido } from './tramites-elegidos'

/**
 * El filtro de trámites, sin pantalla por medio.
 *
 * Lo que se prueba aquí es lo que decide qué se enseña y qué se le pide al
 * SEPE, que es donde de verdad puede salir mal: un filtro que tira lo ya
 * traído, o uno que vuelve a preguntar por algo que ya se sabe.
 */

const COBRANDO = { id: 155, nombre: 'Estoy cobrando y ha cambiado mi situación' }
const FINALIZADO = { id: 158, nombre: 'He finalizado un trabajo' }

function tramite(id: number, nombre: string, grupo = COBRANDO): TramiteEnCola {
  return { id, nombre, grupo }
}

const EXTRANJERO = tramite(23, 'Voy a salir al extranjero')
const JUBILAR = tramite(17, 'Me voy a jubilar')
const TRABAJO = tramite(14, 'He encontrado trabajo', FINALIZADO)

function resuelto(tramite: TramiteEnCola): TramiteResuelto {
  return {
    tipo: 'tramite',
    idTramite: tramite.id,
    nombreTramite: tramite.nombre,
    canal: null,
    consultadoEn: 0,
    desdeCache: false,
    caducada: false,
    estado: 'ok',
    oficinas: [],
  }
}

function llegando(parcial: Partial<LoQueVaLlegando> = {}): LoQueVaLlegando {
  return { ...NADA_TODAVIA, fase: 'buscando', ...parcial }
}

describe('los trámites agrupados como los agrupa el SEPE', () => {
  it('los reparte en sus grupos sin cambiarles el orden ni el nombre', () => {
    expect(agrupados([EXTRANJERO, TRABAJO, JUBILAR])).toEqual([
      { grupo: COBRANDO, tramites: [EXTRANJERO, JUBILAR] },
      { grupo: FINALIZADO, tramites: [TRABAJO] },
    ])
  })

  it('los grupos salen en el orden en que el SEPE los lista', () => {
    expect(agrupados([TRABAJO, EXTRANJERO]).map(({ grupo }) => grupo.nombre)).toEqual([
      FINALIZADO.nombre,
      COBRANDO.nombre,
    ])
  })
})

describe('marcar y desmarcar', () => {
  it('se pueden marcar varios a la vez', () => {
    expect(marcando(marcando([], EXTRANJERO.id, true), JUBILAR.id, true)).toEqual([EXTRANJERO.id, JUBILAR.id])
  })

  it('desmarcar quita solo el suyo', () => {
    expect(marcando([EXTRANJERO.id, JUBILAR.id], EXTRANJERO.id, false)).toEqual([JUBILAR.id])
  })

  it('marcar dos veces el mismo no lo duplica', () => {
    expect(marcando([EXTRANJERO.id], EXTRANJERO.id, true)).toEqual([EXTRANJERO.id])
  })
})

describe('lo que se mira con el filtro puesto', () => {
  const estado = llegando({
    cola: [EXTRANJERO, JUBILAR],
    resueltos: [resuelto(EXTRANJERO), resuelto(JUBILAR)],
  })

  it('sin nada marcado se miran todos: quien no elige no filtra', () => {
    expect(soloLoElegido(estado, [])).toBe(estado)
  })

  it('con uno marcado, lo demás sale de la vista', () => {
    const mirado = soloLoElegido(estado, [JUBILAR.id])

    expect(mirado.resueltos.map((uno) => uno.idTramite)).toEqual([JUBILAR.id])
    expect(mirado.cola).toEqual([JUBILAR])
  })

  it('lo desmarcado se guarda entero: volver a marcarlo lo devuelve tal cual', () => {
    expect(soloLoElegido(estado, [JUBILAR.id]).resueltos).toHaveLength(1)

    // El filtro mira y no tira: se aplica siempre sobre todo lo que ha
    // llegado, así que volver a marcar devuelve lo de antes sin otra consulta
    // al SEPE.
    expect(soloLoElegido(estado, [EXTRANJERO.id, JUBILAR.id]).resueltos).toHaveLength(2)
    expect(soloLoElegido(estado, []).resueltos).toHaveLength(2)
  })

  it('no dice que se está consultando algo que no se mira', () => {
    const consultandoOtro = llegando({ cola: [EXTRANJERO, JUBILAR], consultando: EXTRANJERO })

    // Si no, la pantalla contaría el progreso de un trámite cuyas oficinas no
    // se van a enseñar, junto a un «faltan 0 trámites» que lo desmiente.
    expect(soloLoElegido(consultandoOtro, [JUBILAR.id]).consultando).toBeNull()
    expect(soloLoElegido(consultandoOtro, [EXTRANJERO.id]).consultando).toEqual(EXTRANJERO)
  })
})

describe('lo que hay que ir a pedirle al SEPE', () => {
  const estado = llegando({ cola: [EXTRANJERO, JUBILAR, TRABAJO], resueltos: [resuelto(EXTRANJERO)] })

  it('marcar uno que aún no se ha consultado lo mete en la cola', () => {
    expect(loQueHayQuePedir([JUBILAR.id], estado, [])).toEqual([JUBILAR.id])
  })

  it('volver a marcar uno que ya llegó no gasta otra consulta', () => {
    expect(loQueHayQuePedir([EXTRANJERO.id], estado, [])).toEqual([])
  })

  it('no pide lo que ya viene de camino', () => {
    expect(loQueHayQuePedir([JUBILAR.id, TRABAJO.id], estado, [JUBILAR.id])).toEqual([TRABAJO.id])
    expect(loQueHayQuePedir([JUBILAR.id, TRABAJO.id], estado, 'todos')).toEqual([])
  })

  it('no le pide al SEPE nada que no esté en la cola de la zona', () => {
    // El fragmento de la dirección lo escribe cualquiera, y un identificador
    // inventado ahí no puede convertirse en una petición al SEPE.
    expect(loQueHayQuePedir([99999], estado, [])).toEqual([])
  })
})
