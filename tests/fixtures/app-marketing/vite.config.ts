import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const fixtureRoot = resolve(import.meta.dirname);
const projectRoot = resolve(fixtureRoot, "../../..");

export default defineConfig(({ mode }) => {
  if (mode === "production") {
    throw new Error("The app-marketing fixture is development-only.");
  }

  return {
    root: fixtureRoot,
    publicDir: resolve(projectRoot, "public"),
    plugins: [react()],
    resolve: {
      alias: { "@": resolve(projectRoot, "src") },
    },
    server: {
      host: "127.0.0.1",
      strictPort: true,
    },
  };
});
