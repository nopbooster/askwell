import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import globals from "globals";
import tseslint from "typescript-eslint";

const webFiles = ["apps/web/**/*.{js,jsx,mjs,ts,tsx}"];

export default tseslint.config(
  {
    ignores: [".agents/**", ".claude/**", "**/node_modules/**", "**/.next/**", "**/dist/**", "**/coverage/**", "**/next-env.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["apps/widget/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  ...[...nextCoreWebVitals, ...nextTypescript].map((config) => ({
    ...config,
    files: webFiles,
  })),
  {
    files: webFiles,
    settings: { next: { rootDir: "apps/web" } },
  },
);
