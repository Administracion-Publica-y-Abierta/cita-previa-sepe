import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cita previa SEPE',
  description:
    'Mira si hay cita del SEPE cerca de ti, sin dar el DNI. Proyecto independiente, sin relación con el SEPE.',
}

// Las props se escriben a mano en vez de usar el `LayoutProps` global de Next:
// ese tipo lo genera `next build` dentro de `.next`, que no se versiona, así
// que `npm run tipos` fallaría en un clon recién hecho.
export default function RootLayout({ children }: { children: ReactNode }) {
  // `lang="es"` no es decorativo: es lo que hace que un lector de pantalla lea
  // esto en castellano, y la web es para cualquier ciudadano.
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
