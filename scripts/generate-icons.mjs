/**
 * Renders the whole icon set from one artwork definition: web/PWA icons in public/icons and the
 * source art for the native app (assets/), which `@capacitor/assets` turns into Android launcher
 * icons and splash screens. Run with `npm run icons`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicIcons = join(root, "public", "icons");
const assets = join(root, "assets");

// The default theme (Sage): near-black green with a soft off-white grid and a leaf-green cell.
const DARK = { bg: "#0f140d", ink: "#e8eddf", accent: "#a3d977" };
const LIGHT = { bg: "#eef0e8", ink: "#1b2118", accent: "#46702a" };

/**
 * The mark on a 512 canvas: a 3x3 grid with one resolved cell.
 * `scale` shrinks it toward the centre; `bg` null leaves the canvas transparent.
 */
function artwork({ colors, bg, rounded = false, scale = 1 }) {
  const size = 300 * scale;
  const x0 = 256 - size / 2;
  const cell = size / 3;
  const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${bg ? `<rect width="512" height="512" ${rounded ? 'rx="116"' : ""} fill="${bg}"/>` : ""}
  <g stroke="${colors.ink}" stroke-opacity="0.4" stroke-width="${6 * scale}" stroke-linecap="round">
    ${line(x0 + cell, x0 + 14 * scale, x0 + cell, x0 + size - 14 * scale)}
    ${line(x0 + 2 * cell, x0 + 14 * scale, x0 + 2 * cell, x0 + size - 14 * scale)}
    ${line(x0 + 14 * scale, x0 + cell, x0 + size - 14 * scale, x0 + cell)}
    ${line(x0 + 14 * scale, x0 + 2 * cell, x0 + size - 14 * scale, x0 + 2 * cell)}
  </g>
  <rect x="${x0}" y="${x0}" width="${size}" height="${size}" rx="${44 * scale}" fill="none" stroke="${colors.ink}" stroke-width="${11 * scale}"/>
  <rect x="${x0 + cell + 14 * scale}" y="${x0 + cell + 14 * scale}" width="${cell - 28 * scale}" height="${cell - 28 * scale}" rx="${12 * scale}" fill="${colors.accent}"/>
</svg>`;
}

async function png(dir, name, markup, size) {
  await sharp(Buffer.from(markup)).resize(size, size).png({ compressionLevel: 9 }).toFile(join(dir, name));
  console.log("wrote", join(dir === assets ? "assets" : "public/icons", name));
}

/** A large canvas of one colour with the mark centred on it (splash screens). */
async function splash(name, colors, canvas = 2732, mark = 760) {
  const art = await sharp(Buffer.from(artwork({ colors, bg: null })))
    .resize(mark, mark)
    .png()
    .toBuffer();
  await sharp({ create: { width: canvas, height: canvas, channels: 4, background: colors.bg } })
    .composite([{ input: art, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(join(assets, name));
  console.log("wrote", join("assets", name));
}

await mkdir(publicIcons, { recursive: true });
await mkdir(assets, { recursive: true });

// Web / PWA
const any = artwork({ colors: DARK, bg: DARK.bg, rounded: true });
const maskable = artwork({ colors: DARK, bg: DARK.bg, scale: 0.78 });
const full = artwork({ colors: DARK, bg: DARK.bg });
await writeFile(join(publicIcons, "icon.svg"), any);
await png(publicIcons, "icon-192.png", any, 192);
await png(publicIcons, "icon-512.png", any, 512);
await png(publicIcons, "icon-maskable-512.png", maskable, 512);
await png(publicIcons, "apple-touch-icon.png", full, 180);
await png(publicIcons, "favicon-32.png", any, 32);

// Native app source art (adaptive icon = foreground over background; Android masks it to the device's shape)
await png(assets, "icon-only.png", full, 1024);
await png(assets, "icon-foreground.png", artwork({ colors: DARK, bg: null, scale: 0.62 }), 1024);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: DARK.bg } })
  .png()
  .toFile(join(assets, "icon-background.png"));
console.log("wrote assets/icon-background.png");
await splash("splash.png", LIGHT);
await splash("splash-dark.png", DARK);
