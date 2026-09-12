import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Freebuff requires HMR to stay disabled and dev servers bound to 0.0.0.0.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    hmr: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
