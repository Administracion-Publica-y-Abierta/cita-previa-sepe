import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const alias = { '@': resolve(import.meta.dirname, 'src') }

export default defineConfig({
  test: {
    // Tres proyectos y no uno para todo, por lo que cuesta cada entorno:
    // montar un DOM por fichero cuesta, y lo que más se ejecuta aquí —cliente
    // SEPE, caché, freno y rutas— no lo necesita; los que sí lo necesitan son
    // los `.tsx`. Y levantar la aplicación y un navegador cuesta mucho más,
    // así que eso es un proyecto aparte con dos pruebas como mucho.
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'servidor',
          environment: 'node',
          include: ['pruebas/**/*.test.ts', 'src/**/*.test.ts'],
          exclude: ['pruebas/navegador/**'],
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
      {
        resolve: { alias },
        test: {
          // El tercero, y el que cuesta: levanta la aplicación y un Chromium.
          // Son dos pruebas como mucho y por eso se puede permitir; si algún
          // día son diez, lo que hay que mirar es qué hacen aquí y no cómo
          // hacerlas más rápidas.
          name: 'navegador',
          environment: 'node',
          include: ['pruebas/navegador/**/*.test.ts'],
          globalSetup: ['./pruebas/navegador/el-servidor.ts'],
          // Un arranque de Next y una pasada entera no caben en los cinco
          // segundos de siempre.
          testTimeout: 180_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
})
