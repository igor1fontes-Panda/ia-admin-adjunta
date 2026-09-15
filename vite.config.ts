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
    // The app intentionally ships one entry chunk for static hosts; keep the warning aligned with that constraint.
    chunkSizeWarningLimit: 1100,
    // Single-file index chunk: the public Supabase config lives in
    // src/lib/data.ts and MUST stay in the lazily-shared core chunk the
    // platform builder deploys. Route-level code splitting is disabled so
    // every host (Freebuff static, Vercel, any CDN) serves a working app
    // from index.html alone.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
