import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Local automation/docs/reference folders should not block app lint gate.
    ".agent/**",
    "legacy/**",
    "보고서/**",
    "AGENTS.md",
    "walkthrough.md",
    // Generated Prisma client files should not be linted.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
