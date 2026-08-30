import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const auditRoot = fileURLToPath(new URL(".", import.meta.url));
const artifactOutput = fileURLToPath(new URL("../../artifacts/ui-audit/current", import.meta.url));
const sourceRoot = fileURLToPath(new URL("../../src", import.meta.url));

export default defineConfig({
  root: auditRoot,
  publicDir: fileURLToPath(new URL("../../public", import.meta.url)),
  appType: "spa",
  define: {
    "import.meta.env.UI_AUDIT_FIXTURES": JSON.stringify(process.env.UI_AUDIT_FIXTURES),
  },
  resolve: { alias: { "@": sourceRoot }, dedupe: ["react", "react-dom"] },
  plugins: [tailwindcss(), react()],
  build: {
    outDir: artifactOutput,
    emptyOutDir: true,
  },
});
