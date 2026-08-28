import type { MetadataRoute } from 'next'

/**
 * Lo que hace que esto se pueda añadir a la pantalla de inicio.
 *
 * Importa más de lo que parece para lo que esta web es: quien busca cita del
 * SEPE mira **muchas veces al día**, y desde el móvil. Un icono en la pantalla
 * de inicio es la diferencia entre volver a mirar y no volver.
 *
 * El nombre dice que no es oficial, y no es un escrúpulo de más: el icono se
 * queda en la pantalla de inicio del móvil, lejos del aviso de la portada, y
 * ahí es donde alguien podría acabar creyendo que ha instalado la aplicación
 * del SEPE. El sitio de esa aclaración es este, que es donde se lee al
 * instalar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cita previa SEPE — no oficial',
    // Lo que cabe debajo del icono, que son unos doce caracteres.
    short_name: 'Cita SEPE',
    description:
      'Mira si hay cita del SEPE cerca de ti, sin dar el DNI. Proyecto independiente, sin relación con el SEPE.',
    lang: 'es',
    start_url: '/',
    // Sin barra de navegador: abierta desde el icono, esto tiene que
    // comportarse como una aplicación y no como una pestaña más.
    display: 'standalone',
    // El blanco es el de la página, para que la pantalla de arranque no dé un
    // fogonazo de otro color antes de que la web aparezca.
    background_color: '#ffffff',
    theme_color: '#171717',
    icons: [
      { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // El mismo dibujo con más aire alrededor: Android recorta el icono con la
      // forma del móvil y solo respeta el 80% central.
      {
        src: '/iconos/icono-recortable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
