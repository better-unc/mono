import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/** @param {{ node?: boolean }} options */
export function createConfig({ node = false } = {}) {
  return tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.strict,
    ...tseslint.configs.stylistic,
    {
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-non-null-assertion": "warn",
        "@typescript-eslint/consistent-type-definitions": "off",
        "no-empty": ["error", { allowEmptyCatch: true }],
        "no-console": node ? "off" : "warn",
      },
    },
    {
      files: ["**/*.js", "**/*.cjs"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
        "no-undef": "off",
      },
    },
    {
      ignores: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.output/**",
        "**/out/**",
        "**/build/**",
        "**/*-env.d.ts",
      ],
    }
  );
}

export default createConfig();
