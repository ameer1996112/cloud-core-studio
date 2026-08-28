import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", ".openwa", "tmp", ".worktrees", "ios", "android"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true,
          allowExportNames: [
            "deriveClassState",
            "formatDate",
            "formatDurationLabel",
            "formatRelative",
            "formatTime",
            "moodKeyFor",
            "serializeClass",
          ],
        },
      ],
      // Supabase joins and RPCs still cross a generated-schema boundary in legacy modules.
      // Flagging every adapter as `any` produced hundreds of non-actionable warnings; new
      // boundary types are reviewed through TypeScript and tests instead.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      // These shadcn-style modules intentionally co-export variants, contexts, and components.
      "react-refresh/only-export-components": "off",
    },
  },
  eslintPluginPrettier,
);
