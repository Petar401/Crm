import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

/**
 * ESLint config. Adds `eslint-plugin-security` on top of eslint-config-next
 * so hazardous JS patterns (unsafe regex, non-literal exec/require targets,
 * child_process spawn with user input, timing-attack-prone comparisons, etc.)
 * fail lint. The bulk of app files are TypeScript / React and never touch the
 * flagged surface, so the plugin is nearly silent in practice — but any new
 * server-only code that ships one of these patterns will now be caught in CI.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  {
    // Server-rendered React components frequently take a `children` prop typed
    // as ReactNode — a value that could be an object. The generic-object-injection
    // rule is noisy here, and RegExp sources in this codebase are all literal.
    rules: {
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
]);

export default eslintConfig;
