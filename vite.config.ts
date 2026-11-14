import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  preview: {
    port: 4174,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  test: {
    testTimeout: 20000,
  },
});
