import { describe, expect, it } from 'vitest'
import {
  aplicando,
  contando,
  deLaDireccion,
  enLaDireccion,
  hayFiltros,
  KM_MAXIMO,
  KM_MINIMO,
  nombreDelFiltro,
  quienLasTapa,
  quitando,
  SIN_FILTROS,
  type Filtros,
} from './filtros'
import type { OficinaConSuTramite } from './lo-que-va-llegando'

/**
 * Los filtros son funciones puras y se prueban como tales: entra una lista de
 * oficinas y salen las que se ven. Es lo que permite que la pantalla no tenga
 * que montarse para saber si «por la tarde» deja fuera lo que tiene que dejar.
 */

/** El instante desde el que se miden «hoy», «esta semana» y «este mes». */
const LUNES = Date.parse('2026-08-17T10:00:00')

function oficina(parcial: Partial<OficinaConSuTramite> = {}): OficinaConSuTramite {
  return {
    id: 1,
    nombre: 'GRANOLLERS - SEPE',
    direccion: 'AVDA. MARIE CURIE, 25-27',
    telefono: '0901010210',
    horarioAtencion: '08:30 a 14:00',
    lat: 41.59,
    lng: 2.28,
    km: 2,
    primerHueco: '2026-08-17T09:00:00',
    idServicio: 631,
    servicio: 'Voy a salir al extranjero',
    oficinaVirtual: false,
    tramite: { id: 631, nombre: 'Voy a salir al extranjero' },
    otrosConHueco: 0,
    ...parcial,
  }
}

function con(parcial: Partial<Filtros>): Filtros {
  return { ...SIN_FILTROS, ...parcial }
}

/** Los identificadores de las que quedan, que es lo único que interesa comprobar. */
function ids(oficinas: OficinaConSuTramite[]): number[] {
  return oficinas.map((una) => una.id)
}

describe('el filtro de distancia', () => {
  const cerca = oficina({ id: 1, km: 2.4 })
  const lejos = oficina({ id: 2, km: 31 })

  it('baja hasta unos pocos kilómetros', () => {
    expect(KM_MINIMO).toBeLessThanOrEqual(3)
  })

  it('deja solo lo que cae dentro del radio', () => {
    expect(ids(aplicando([cerca, lejos], con({ km: 5 }), LUNES))).toEqual([1])
  })

  it('en el tope no filtra nada, ni siquiera lo que esté más lejos que el tope', () => {
    const lejísimos = oficina({ id: 3, km: KM_MAXIMO + 40 })
    expect(ids(aplicando([cerca, lejísimos], SIN_FILTROS, LUNES))).toEqual([1, 3])
  })
})

describe('el filtro de franja', () => {
  // Es la hora del **primer** hueco de la oficina, no su agenda: el desglose
  // por horas del SEPE pide DNI y esta fase no lo pide.
  const porLaManana = oficina({ id: 1, primerHueco: '2026-08-17T09:00:00' })
  const porLaTarde = oficina({ id: 2, primerHueco: '2026-08-17T16:30:00' })
  const sinHueco = oficina({ id: 3, primerHueco: null })

  it('deja las que abren su primer hueco por la mañana', () => {
    expect(ids(aplicando([porLaManana, porLaTarde, sinHueco], con({ franja: 'manana' }), LUNES))).toEqual([1])
  })

  it('deja las que abren su primer hueco por la tarde', () => {
    expect(ids(aplicando([porLaManana, porLaTarde, sinHueco], con({ franja: 'tarde' }), LUNES))).toEqual([2])
  })

  it('las dos de la tarde ya son tarde', () => {
    const justoDespues = oficina({ id: 4, primerHueco: '2026-08-17T14:00:00' })
    expect(ids(aplicando([justoDespues], con({ franja: 'tarde' }), LUNES))).toEqual([4])
    expect(ids(aplicando([justoDespues], con({ franja: 'manana' }), LUNES))).toEqual([])
  })

  it('sin franja, la que no tiene hueco sigue en la lista', () => {
    expect(ids(aplicando([sinHueco], SIN_FILTROS, LUNES))).toEqual([3])
  })
})

describe('el filtro de fecha', () => {
  const hoy = oficina({ id: 1, primerHueco: '2026-08-17T18:00:00' })
  const enTresDias = oficina({ id: 2, primerHueco: '2026-08-20T09:00:00' })
  const enVeinteDias = oficina({ id: 3, primerHueco: '2026-09-06T09:00:00' })
  const enDosMeses = oficina({ id: 4, primerHueco: '2026-10-20T09:00:00' })
  const todas = [hoy, enTresDias, enVeinteDias, enDosMeses]

  it('«hoy» es el mismo día, contando lo que queda de mañana', () => {
    expect(ids(aplicando(todas, con({ cuando: 'hoy' }), LUNES))).toEqual([1])
  })

  it('«esta semana» son los siete días que vienen', () => {
    expect(ids(aplicando(todas, con({ cuando: 'semana' }), LUNES))).toEqual([1, 2])
  })

  it('«este mes» son los treinta días que vienen', () => {
    expect(ids(aplicando(todas, con({ cuando: 'mes' }), LUNES))).toEqual([1, 2, 3])
  })

  it('una oficina sin hueco no cae en ninguna fecha', () => {
    const sinHueco = oficina({ id: 5, primerHueco: null })
    expect(ids(aplicando([sinHueco], con({ cuando: 'mes' }), LUNES))).toEqual([])
  })
})

describe('el orden', () => {
  const lejosYPronto = oficina({ id: 1, km: 20, primerHueco: '2026-08-17T09:00:00' })
  const cercaYTarde = oficina({ id: 2, km: 2, primerHueco: '2026-09-30T09:00:00' })
  const cercaYSinHueco = oficina({ id: 3, km: 1, primerHueco: null })
  const revueltas = [cercaYTarde, cercaYSinHueco, lejosYPronto]

  it('por distancia, de la más cercana a la más lejana', () => {
    expect(ids(aplicando(revueltas, SIN_FILTROS, LUNES))).toEqual([3, 2, 1])
  })

  it('por lo pronto que sea el hueco, y la que no tiene se va al final', () => {
    expect(ids(aplicando(revueltas, con({ orden: 'antes' }), LUNES))).toEqual([1, 2, 3])
  })
})

describe('el contador', () => {
  it('dice cuántas se ven de cuántas hay', () => {
    const oficinas = [oficina({ id: 1, km: 2 }), oficina({ id: 2, km: 40 })]
    expect(contando(oficinas, con({ km: 5 }), LUNES)).toEqual({ visibles: 1, total: 2 })
  })
})

describe('qué filtro las está tapando', () => {
  const lejos = oficina({ id: 1, km: 40, primerHueco: '2026-08-17T09:00:00' })

  it('con resultados no tapa nadie', () => {
    expect(quienLasTapa([lejos], SIN_FILTROS, LUNES)).toEqual([])
  })

  it('señala el filtro que, quitado él solo, devuelve resultados', () => {
    expect(quienLasTapa([lejos], con({ km: 5 }), LUNES)).toEqual(['distancia'])
  })

  it('cuando harían falta dos, no señala a ninguno: el arreglo es quitarlos todos', () => {
    // Lejos y por la mañana: quitar la distancia no la trae, y quitar la
    // franja tampoco. Los dos juntos sí, y entonces no hay un culpable.
    expect(quienLasTapa([lejos], con({ km: 5, franja: 'tarde' }), LUNES)).toEqual([])
  })

  it('con dos oficinas, cada filtro tapa la suya y quitar cualquiera vale', () => {
    const porLaTarde = oficina({ id: 2, km: 2, primerHueco: '2026-08-17T16:00:00' })
    expect(quienLasTapa([lejos, porLaTarde], con({ km: 5, franja: 'manana' }), LUNES)).toEqual([
      'distancia',
      'franja',
    ])
  })

  it('sin oficinas no hay nada que tapar: no ha llegado nada todavía', () => {
    expect(quienLasTapa([], con({ km: 5 }), LUNES)).toEqual([])
  })

  it('cada filtro se puede nombrar para poder ofrecer quitarlo', () => {
    expect(nombreDelFiltro('distancia')).toBe('distancia')
    expect(nombreDelFiltro('franja')).toBe('franja horaria')
    expect(nombreDelFiltro('fecha')).toBe('fecha')
  })
})

describe('quitar filtros', () => {
  it('sin nada puesto no hay filtros que quitar', () => {
    expect(hayFiltros(SIN_FILTROS)).toBe(false)
  })

  it('el orden no cuenta como filtro: no deja fuera a nadie', () => {
    expect(hayFiltros(con({ orden: 'antes' }))).toBe(false)
  })

  it('cualquiera de los tres cuenta', () => {
    expect(hayFiltros(con({ km: 5 }))).toBe(true)
    expect(hayFiltros(con({ franja: 'tarde' }))).toBe(true)
    expect(hayFiltros(con({ cuando: 'hoy' }))).toBe(true)
  })

  it('quitar uno deja los demás y respeta el orden elegido', () => {
    const puestos = con({ km: 5, franja: 'tarde', cuando: 'hoy', orden: 'antes' })
    expect(quitando(puestos, 'distancia')).toEqual(con({ franja: 'tarde', cuando: 'hoy', orden: 'antes' }))
    expect(quitando(puestos, 'franja')).toEqual(con({ km: 5, cuando: 'hoy', orden: 'antes' }))
    expect(quitando(puestos, 'fecha')).toEqual(con({ km: 5, franja: 'tarde', orden: 'antes' }))
  })
})

describe('los filtros en la dirección de la página', () => {
  it('lo que no se ha tocado no ocupa sitio en la dirección', () => {
    expect(enLaDireccion(SIN_FILTROS)).toBe('')
  })

  it('van y vuelven iguales', () => {
    const puestos = con({ km: 7, franja: 'tarde', cuando: 'semana', orden: 'antes' })
    expect(deLaDireccion(enLaDireccion(puestos))).toEqual(puestos)
  })

  it('convive con lo que ya había en la dirección', () => {
    expect(deLaDireccion(`cp=08401&${enLaDireccion(con({ km: 7 }))}`)).toEqual(con({ km: 7 }))
  })

  it('una dirección vacía es no tener filtros', () => {
    expect(deLaDireccion('')).toEqual(SIN_FILTROS)
  })

  it('lo que llega escrito a mano y no vale se ignora, en vez de tumbar la pantalla', () => {
    expect(deLaDireccion('km=hola&franja=madrugada&cuando=siglo&orden=alfabetico')).toEqual(SIN_FILTROS)
    expect(deLaDireccion('km=0')).toEqual(SIN_FILTROS)
    expect(deLaDireccion(`km=${KM_MAXIMO + 500}`)).toEqual(SIN_FILTROS)
  })
})
