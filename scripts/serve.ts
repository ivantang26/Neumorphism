// Production server: the static build, the JSON API and the simulated hub on
// one port (PORT, default 4322 so it can run beside `astro dev` on 4321).
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createHub } from "../server/hub.ts";
import { apiHandler } from "../server/api.ts";

const PORT = Number(process.env.PORT ?? 4322);
const HOST = process.env.HOST ?? "localhost";
const DATA = process.env.THERMO_DATA_DIR ?? "data";
const ROOT = resolve("dist");

if (!existsSync(ROOT)) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const hub = createHub({ dataDir: DATA });
const api = apiHandler({ dataDir: DATA });

function resolveFile(pathname: string): string | null {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const base = join(ROOT, clean);
  if (!base.startsWith(ROOT)) return null;
  for (const candidate of [base, join(base, "index.html"), `${base}.html`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  // Unknown /app/* routes get the app shell; the client router decides what to show.
  if (clean.startsWith("app")) return join(ROOT, "app", "index.html");
  return null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://local");
  if (url.pathname.startsWith("/api/")) return void api(req, res);

  const file = resolveFile(url.pathname);
  if (!file) {
    res.writeHead(404, { "content-type": TYPES[".html"] });
    createReadStream(join(ROOT, "404.html")).pipe(res);
    return;
  }
  const ext = extname(file);
  const immutable = url.pathname.startsWith("/_astro/");
  res.writeHead(200, {
    "content-type": TYPES[ext] ?? "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
  });
  createReadStream(file).pipe(res);
});

server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/hub")) hub.handleUpgrade(req, socket, head);
  else socket.destroy();
});

server.listen(PORT, HOST, () => {
  console.log(`Thermo running at http://${HOST}:${PORT}  (dashboard: /app, metrics: /api/metrics)`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    hub.close();
    server.close(() => process.exit(0));
  });
}
