import { createConfig } from "@gitbruv/eslint-config";

export default [
  ...createConfig({ node: true }),
  {
    ignores: ["next-env.d.ts"],
  },
];
