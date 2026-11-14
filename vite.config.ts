import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  preview: {
    port: 4174,
    host: "127.0.0.1",
  },
  test: {
    testTimeout: 20000,
  },
});
