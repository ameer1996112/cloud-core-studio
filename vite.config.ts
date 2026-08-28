import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  css: { transformer: "lightningcss" },
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
        "./src/routes/_authenticated/member/schedule.tsx",
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
