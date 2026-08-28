import type { NextConfig } from 'next'

// Sin nada que configurar todavía. El proxy hacia el SEPE no va aquí: son
// Route Handlers, porque hay que poner la cabecera `Cookie` con el
// `JSESSIONID` a mano y eso un reescritor de rutas no lo hace.
const nextConfig: NextConfig = {}

export default nextConfig
