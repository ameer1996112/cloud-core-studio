import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { clientModuleMetadata } from "./tools/ui-audit/client-module-metadata.ts";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  css: { transformer: "lightningcss" },
  build: { manifest: true },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  plugins: [
    clientModuleMetadata(projectRoot),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/*.server.*", "**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    react(),
  ],
  server: {
    host: "::",
    port: 8080,
    watch: {
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
    },
    warmup: {
      clientFiles: [
        "./src/routes/auth.tsx",
        "./src/routes/__root.tsx",
        "./src/routes/_authenticated/route.tsx",
        "./src/routes/_authenticated/member/index.tsx",
        "./src/routes/member.schedule.tsx",
        "./src/components/app-shell/AppShell.tsx",
        "./src/components/visual/VisualClassCard.tsx",
      ],
      ssrFiles: [
        "./src/routes/auth.tsx",
        "./src/routes/__root.tsx",
        "./src/routes/_authenticated/route.tsx",
        "./src/routes/_authenticated/member/index.tsx",
        "./src/lib/member.functions.ts",
      ],
    },
  },
});
