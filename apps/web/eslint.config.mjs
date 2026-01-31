import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([globalIgnores(['out/**', 'build/**', '.output/**'])]);

export default eslintConfig;
