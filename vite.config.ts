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
    // Vercel preview hostnames are generated per sandbox; allow the active preview host.
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts")) return "charts";
          if (id.includes("node_modules/framer-motion")) return "motion";
          return undefined;
        },
      },
    },
  },
});
