'use client'

import { useEffect } from 'react'

/**
 * Lo que va apareciendo al bajar por la portada.
 *
 * Es adorno, y por eso está escrito para que su fallo no se note: los bloques
 * nacen **visibles** (`data-dentro="no"` es lo único que los esconde, y solo se
 * pone aquí), así que un navegador sin `IntersectionObserver` —o esta misma
 * página con el JavaScript a medio cargar— enseña la portada entera y no le
 * falta nada.
 *
 * Va en su propio componente y no dentro de la portada porque la portada es un
 * componente de servidor: esto es lo único de esas secciones que necesita
 * navegador, y meterlo dentro arrastraría al cliente todo el texto que no lo
 * necesita.
 */
export function LoQueAparece() {
  useLoQueAparece()
  return null
}

export function useLoQueAparece(): void {
  useEffect(() => {
    const bloques = document.querySelectorAll('.aparece')

    // Sin observador se enseña todo de golpe. Es la misma regla que gobierna el
    // resto de la web: lo que se degrada, se degrada enseñando de más.
    if (typeof IntersectionObserver === 'undefined') {
      for (const bloque of bloques) bloque.setAttribute('data-dentro', 'si')
      return
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue
          entrada.target.setAttribute('data-dentro', 'si')
          observador.unobserve(entrada.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    for (const bloque of bloques) {
      // Lo que ya se ve al abrir **no se esconde nunca**, ni siquiera un
      // instante. Esconderlo para volver a enseñarlo es hacer parpadear lo
      // primero que lee quien llega, y si algo saliera mal por el camino sería
      // el hero lo que desaparece.
      if (bloque.getBoundingClientRect().top < window.innerHeight) {
        bloque.setAttribute('data-dentro', 'si')
        continue
      }

      bloque.setAttribute('data-dentro', 'no')
      observador.observe(bloque)
    }

    return () => observador.disconnect()
  }, [])
}
