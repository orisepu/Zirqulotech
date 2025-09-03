import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tanstackQuery from "@tanstack/eslint-plugin-query";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Config básica de Next.js + TypeScript
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Plugin de TanStack Query recomendado
  ...compat.extends("plugin:@tanstack/query/recommended"),

  // Reglas adicionales (puedes quitar o ajustar a tu gusto)
  {
    plugins: {
      "@tanstack/query": tanstackQuery,
    },
    rules: {
      // Requiere que declares todas las dependencias en queries/mutations
      "@tanstack/query/exhaustive-deps": "warn",

      // Asegura que uses correctamente `queryKey` en `useQuery`
      "@tanstack/query/prefer-query-key-array": "warn",

      // Requiere declarar `queryFn` cuando se usa `useQuery`
      "@tanstack/query/require-query-fn": "warn",

      // Requiere usar funciones `async` si vas a hacer peticiones
      "@tanstack/query/prefer-async-query-fn": "warn",

      // (opcional) Podrías forzar a tener un `queryKey` consistente
      // "@tanstack/query/enforce-query-key-order": "warn",
    },
  },
];
