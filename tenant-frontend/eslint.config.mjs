// /workspace/circular/eslint.config.mjs
// Config ESM (".mjs") con Flat Config + compat para presets clásicos.
// Mantiene Next + TS + TanStack Query, y añade overrides limpios para JS/JSX y tests.

import { dirname } from "node:path";             // ✅ ESM: import desde node:
import { fileURLToPath } from "node:url";        // ✅ ESM: util para __dirname
import { FlatCompat } from "@eslint/eslintrc";   // Compat de presets "extends" clásicos

// ── Emulación de __dirname en ESM ───────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Compat para usar "extends" heredado con Flat Config ────────────────────────
const compat = new FlatCompat({
  baseDirectory: __dirname, // donde resolverá los presets heredados
});

// ── Export principal de la config (Flat Config) ────────────────────────────────
const eslintConfig = [
  // ⛔ Ignorar artefactos de build y dependencias
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "public/**",
      "next-env.d.ts",
      "jest.config.js",
      "next.config.ts",
      "server.js",
      "scripts/**/*.mjs",
      "e2e/**/*.ts",
    ],
  },

  // 🏗️ Presets base de Next + TypeScript (vía compat)
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 🔌 Reglas recomendadas de TanStack Query
  ...compat.extends("plugin:@tanstack/query/recommended"),

  // ✅ Reglas para TU código fuente (TS y JS en src/)
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "off", // Permitimos "any" en código app
      "@typescript-eslint/no-unused-vars": [
        "warn", // En app preferimos "warn" (no rompe CI)
        {
          argsIgnorePattern: "^_", // ignora args que empiecen por _
          varsIgnorePattern: "^_", // ignora vars que empiecen por _
          ignoreRestSiblings: true, // ignora resto del objeto al hacer rest/spread
        },
      ],

      // React Hooks
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // React
      "react/no-unescaped-entities": "warn",

      // Next
      "@next/next/no-img-element": "warn",

      // JS genéricas
      "prefer-const": "warn",

      // TanStack Query
      "@tanstack/query/exhaustive-deps": "warn",
    },
  },

  // 🧹 Solo JS/JSX: apaga reglas TS que no aplican en archivos no-TS
  {
    files: ["src/**/*.{js,jsx}"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },

  // 🧪 SOLO tests: .test/.spec (TS/TSX)
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}","**/*setupTests.ts"],

    // ⚙️ Si usas Jest o Playwright, descomenta el env correspondiente:
    // env: { jest: true },
    // env: { "playwright/playwright-test": true },

    // 🔔 Si usas Vitest o prefieres no instalar plugins de env, declara globals:
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },

    rules: {
      // Opción A (silenciar del todo en tests):
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",

      // ── Opción B alternativa (más estricta): descomentar si prefieres warn + subrayar
      // "@typescript-eslint/no-unused-vars": ["warn", {
      //   "argsIgnorePattern": "^_",
      //   "varsIgnorePattern": "^_",
      //   "caughtErrorsIgnorePattern": "^_"
      // }],
    },
  },
];

export default eslintConfig;

// Nota: no añadimos logs; si necesitas trazar qué override aplica, avísame y meto
//       un "TEMP LOG" con console.warn() y un flag que puedas borrar en prod.
