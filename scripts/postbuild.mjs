/**
 * After `next build`: stamp the service worker with the build id and the list of
 * every file in the static export so the whole app is cached on first visit.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");

const INCLUDE = /\.(?:html|txt|js|css|woff2|json|svg|png|ico|webmanifest)$/;
const EXCLUDE = /(?:^|\/)(?:sw\.js|404\.html|_not-found[^/]*|[^/]*\.map)$/;

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function toUrl(file) {
  const rel = relative(outDir, file).split(sep).join("/");
  // Route documents are requested as "/play/", not "/play/index.html".
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel}`;
}

try {
  await stat(outDir);
} catch {
  console.error("postbuild: out/ not found. Did `next build` produce a static export?");
  process.exit(1);
}

const files = (await walk(outDir)).filter((f) => {
  const rel = relative(outDir, f).split(sep).join("/");
  return INCLUDE.test(rel) && !EXCLUDE.test(rel);
});
const urls = [...new Set(files.map(toUrl))].sort();

const hash = createHash("sha256");
for (const file of files.sort()) {
  hash.update(relative(outDir, file));
  hash.update(await readFile(file));
}
const buildId = hash.digest("hex").slice(0, 12);

const swPath = join(outDir, "sw.js");
let sw = await readFile(swPath, "utf8");
sw = sw.replace("__BUILD_ID__", buildId).replace("/*__PRECACHE_URLS__*/ []", JSON.stringify(urls));
await writeFile(swPath, sw);

console.log(`postbuild: service worker stamped (build ${buildId}, ${urls.length} files precached).`);
