import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";

// Standalone SPA build for Vercel.
// Does NOT use @cloudflare/vite-plugin or TanStack Start (no SSR).
// Server functions, server routes and head() meta are inert in this build.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  define: {
    "import.meta.env.VITE_STATIC_SELF_HOST": JSON.stringify("true"),
  },
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
  optimizeDeps: {
    include: ["@tanstack/react-query"],
    exclude: ["@tanstack/query-core"],
  },
  logLevel: "warn",
});
