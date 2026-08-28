import type { Fetch } from '@/nucleo/dependencias'
import { registro } from '@/nucleo/registro'
import type { Reloj } from '@/nucleo/reloj'
import type { Almacen } from './almacen'
import { crearAlmacenEnMemoria } from './en-memoria'
import { crearAlmacenRedis } from './redis'

/**
 * El almacén que toque según el entorno.
 *
 * Redis gestionado en plan gratuito es la recomendación para esta fase, y se
 * prefiere a Postgres por una razón operativa concreta: el proyecto gratuito
 * de Supabase **se pausa a los siete días sin actividad**, y esta fase puede
 * pasar semanas sin una sola visita. Supabase entra en el Flujo B, donde el
 * barrido programado lo mantiene despierto solo.
 *
 * Sin configurar cae al almacén en memoria, que es lo correcto en local —un
 * proceso, un ordenador— y lo que avisa a gritos si alguien despliega sin
 * Redis: el aviso queda en el registro del alojamiento.
 */
/** Desplegado sin Redis: el freno no valdría nada y no se sigue adelante. */
export class SinAlmacenCompartido extends Error {
  constructor() {
    // Sin nombres de variables ni valores: este mensaje acaba en el registro.
    super('No hay almacén compartido configurado y sin él no hay freno que valga.')
    this.name = 'SinAlmacenCompartido'
  }
}

export function almacenDeProduccion(dependencias: { fetch: Fetch; reloj: Reloj }): Almacen {
  // Los dos nombres son los mismos secretos: el primero es como los llama la
  // integración de Vercel y el segundo como los llama Upstash directamente.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const ficha = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !ficha) {
    // Desplegado esto no es un aviso, es una avería. Un aviso en el registro
    // del alojamiento no lo lee nadie, y mientras tanto cada invocación estaría
    // llamando al SEPE con su propio ritmo, que es exactamente lo que
    // `CONTRIBUTING.md` no admite. Antes no arrancar.
    if (process.env.NODE_ENV === 'production') throw new SinAlmacenCompartido()
    registro.aviso('no hay almacén compartido configurado: el freno y la caché solo valen dentro de este proceso')
    return crearAlmacenEnMemoria(dependencias.reloj)
  }

  return crearAlmacenRedis({ fetch: dependencias.fetch, url, ficha })
}
