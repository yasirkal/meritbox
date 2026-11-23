import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/unit/server-only-stub.ts") } },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: {
      MERITBOX_MASTER_KEY: "dGVzdC1tYXN0ZXIta2V5LTMyLWJ5dGVzLWxvbmchISE=",
      APP_URL: "http://localhost:3000",
    },
  },
});
