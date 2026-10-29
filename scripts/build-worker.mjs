/**
 * Bundles the puzzle-generator Web Worker into public/workers/generator.worker.js.
 *
 * The worker is built here, with esbuild, instead of by the Next.js bundler: the output is
 * one self-contained classic script at a stable URL. That makes it work identically in the
 * dev server, the static export, the service-worker cache and the Android app, where files
 * are served straight from the APK by extension.
 *
 * Runs automatically before `dev` and `build`.
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const result = await build({
  entryPoints: [join(root, "src", "features", "puzzle", "generator.worker.ts")],
  outfile: join(root, "public", "workers", "generator.worker.js"),
  bundle: true,
  format: "iife",
  target: "es2020",
  platform: "browser",
  minify: true,
  legalComments: "none",
  logLevel: "warning",
  metafile: true,
});

const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0;
console.log(`worker: built public/workers/generator.worker.js (${(bytes / 1024).toFixed(1)} KB)`);
