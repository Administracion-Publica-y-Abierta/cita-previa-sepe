import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const alias = { '@': resolve(import.meta.dirname, 'src') }

export default defineConfig({
  test: {
    // Dos proyectos y no uno con jsdom para todo: montar un DOM por fichero
    // cuesta, y lo que más se ejecuta aquí —cliente SEPE, caché, freno y
    // rutas— no lo necesita. Los que sí lo necesitan son los `.tsx`.
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'servidor',
          environment: 'node',
          include: ['pruebas/**/*.test.ts', 'src/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'interfaz',
          environment: 'jsdom',
          include: ['pruebas/**/*.test.tsx', 'src/**/*.test.tsx'],
          setupFiles: ['./pruebas/interfaz/preparar.ts'],
        },
      },
    ],
  },
})
