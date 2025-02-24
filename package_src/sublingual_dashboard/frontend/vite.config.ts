import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5361,
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Relative to the config file (frontend/)
    outDir: "../server/frontend_build",
    emptyOutDir: true,
    // Optionally set a base path if your Flask server serves the static files from a specific URL.
    // base: "/",
  }
}));
