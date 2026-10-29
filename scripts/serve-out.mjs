/**
 * Minimal static server for the exported site (`out/`), used for local testing
 * of the production build, the PWA and offline behaviour: `npm run build && npm run serve`.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const candidates = [clean, join(clean, "index.html"), `${clean}.html`];
  for (const candidate of candidates) {
    const full = join(root, candidate);
    if (!full.startsWith(root)) continue;
    try {
      if ((await stat(full)).isFile()) return full;
    } catch {
      /* try next */
    }
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let file = await resolveFile(url.pathname);
  let status = 200;
  if (!file) {
    file = await resolveFile("/404.html");
    status = 404;
  }
  if (!file) {
    res.writeHead(404).end("Not found");
    return;
  }
  const isImmutable = url.pathname.startsWith("/_next/static/");
  res.writeHead(status, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": isImmutable ? "public, max-age=31536000, immutable" : url.pathname === "/sw.js" ? "no-cache" : "no-cache",
  });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving out/ at http://localhost:${port}`));
