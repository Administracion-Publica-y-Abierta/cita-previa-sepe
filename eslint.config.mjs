import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Se repiten las exclusiones de eslint-config-next porque declarar las
  // nuestras sustituye a las suyas en vez de sumarse.
  globalIgnores([
    // Las suyas:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // La nuestra: el worker de MapLibre, que es código ajeno ya compilado y
    // que se copia aquí en cada build.
    "public/mapa/**",
  ]),
]);

export default eslintConfig;
