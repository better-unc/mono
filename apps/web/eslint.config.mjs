import { defineConfig, globalIgnores } from "eslint/config";
import { tanstackConfig } from '@tanstack/eslint-config'

const eslintConfig = defineConfig([
  ...tanstackConfig,
  globalIgnores([
    "out/**",
    "build/**",
    ".output/**",
  ]),
]);

export default eslintConfig;
