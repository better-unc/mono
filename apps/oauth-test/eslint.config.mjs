import { createConfig } from "@gitbruv/eslint-config";

export default [
  ...createConfig({ node: true, tsconfigRootDir: import.meta.dirname }),
  {
    ignores: ["next-env.d.ts"],
  },
];
