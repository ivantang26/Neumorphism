// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { createHub } from "./server/hub.ts";
import { apiHandler } from "./server/api.ts";

// In dev the simulated hub (WebSocket on /hub) and the small JSON API run
// inside the Vite dev server, so `npm run dev` is the whole system.
// `npm run preview` (scripts/serve.ts) wires the same two pieces to the build.
/** @returns {import("astro").AstroIntegration} */
function thermoHub() {
  return {
    name: "thermo-hub",
    hooks: {
      "astro:server:setup": ({ server }) => {
        const hub = createHub({ dataDir: process.env.THERMO_DATA_DIR ?? "data" });
        const api = apiHandler({ dataDir: process.env.THERMO_DATA_DIR ?? "data" });
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/api/")) api(req, res);
          else next();
        });
        // Vite's HMR socket only answers its own `vite-hmr` protocol, so /hub is ours.
        server.httpServer?.on("upgrade", (req, socket, head) => {
          if (req.url?.startsWith("/hub")) hub.handleUpgrade(req, socket, head);
        });
        server.httpServer?.on("close", () => hub.close());
      },
    },
  };
}

export default defineConfig({
  site: "https://thermo.example",
  output: "static",
  integrations: [react(), thermoHub()],
  trailingSlash: "ignore",
  vite: {
    css: { modules: { localsConvention: "camelCase" } },
  },
});
