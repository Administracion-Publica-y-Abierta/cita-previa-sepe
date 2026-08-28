import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
  test: {
    // Node y no jsdom: lo que se prueba aquí es el servidor —cliente SEPE,
    // caché, freno y rutas—. Cuando haya interfaz que probar se añadirá un
    // proyecto aparte con jsdom, sin ralentizar a estos.
    environment: 'node',
    include: ['pruebas/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
