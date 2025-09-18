import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // ⛔ Ignorar build y dependencias
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "public/**",
    ],
  },

  // Config básica de Next.js + TypeScript
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Plugin de TanStack Query recomendado
  ...compat.extends("plugin:@tanstack/query/recommended"),

  // ✅ Reglas aplicadas solo a tu código fuente
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
      // TS
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // React Hooks
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // React
      "react/no-unescaped-entities": "warn",

      // Next
      "@next/next/no-img-element": "warn",
      "prefer-const": "warn",

      // TanStack Query
      "@tanstack/query/exhaustive-deps": "warn",
    },
  },

  // 🧹 En archivos JS/JSX, desactiva reglas de TS que no aplican
  {
    files: ["src/**/*.{js,jsx}"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
];
