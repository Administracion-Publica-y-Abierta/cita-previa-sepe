import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { ElServiceWorker } from '@/interfaz/el-service-worker'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cita previa SEPE',
  description:
    'Mira si hay cita del SEPE cerca de ti, sin dar el DNI. Proyecto independiente, sin relación con el SEPE.',
  // El iPhone no mira el manifiesto para esto: sin `apple-touch-icon` lo que
  // deja en la pantalla de inicio es una captura de la página, y sin
  // `appleWebApp` la abre dentro de Safari con su barra en vez de a pantalla
  // completa.
  icons: { apple: '/iconos/apple-touch-icon-180.png' },
  appleWebApp: { capable: true, title: 'Cita SEPE', statusBarStyle: 'default' },
}

// El color de la barra del navegador cuando esto se abre como aplicación. Es
// el mismo que declara el manifiesto: dos colores distintos serían dos barras
// distintas según por dónde se abra.
export const viewport: Viewport = { themeColor: '#171717' }

// Las props se escriben a mano en vez de usar el `LayoutProps` global de Next:
// ese tipo lo genera `next build` dentro de `.next`, que no se versiona, así
// que `npm run tipos` fallaría en un clon recién hecho.
export default function RootLayout({ children }: { children: ReactNode }) {
  // `lang="es"` no es decorativo: es lo que hace que un lector de pantalla lea
  // esto en castellano, y la web es para cualquier ciudadano.
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <ElServiceWorker />
      </body>
    </html>
  )
}
