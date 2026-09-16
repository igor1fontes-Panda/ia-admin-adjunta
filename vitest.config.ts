import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: { lines: 50, functions: 40, statements: 50, branches: 35 },
      exclude: ["src/test-setup.ts", "src/data.mock.ts", "src/types.ts"],
    },
  },
});
