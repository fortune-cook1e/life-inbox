import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const baseConfig = tseslint.config(
  {
    ignores: ["**/.next/**", "**/dist/**", "**/coverage/**", "**/drizzle/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.config.{js,mjs,ts}", "**/scripts/**/*.{js,mjs,ts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
);

export default baseConfig;
