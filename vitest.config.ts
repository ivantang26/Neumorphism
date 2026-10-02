import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  css: { modules: { localsConvention: "camelCase" } },
  test: { include: ["tests/**/*.test.{ts,tsx}"] },
});
