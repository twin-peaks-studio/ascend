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
  ]),
  // Custom rules
  {
    rules: {
      // No console statements in production code (use logger utility instead)
      "no-console": "error",
      "no-debugger": "error",
      "no-alert": "error",
    },
  },
  // Allow console in logger files (they need console to output)
  {
    files: ["**/lib/logger/**/*.ts", "**/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
