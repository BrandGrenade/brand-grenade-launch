import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Handler tests must exercise source handlers, not generated RPC stubs.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts", "src/**/*.test.tsx"] },
});