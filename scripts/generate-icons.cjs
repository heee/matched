// Generate the full PWA/iOS icon set from a hand-authored SVG source, per
// the build brief's App Icon spec: felt-green rounded square, one bone tile
// bearing the red 中 dragon, gold circular checkmark badge bottom-right.
//
// Uses @resvg/resvg-js to rasterize (no hand-rolled PNG encoder). The brief
// asked for `sharp`, matching Boys Pushup Bonanza's icon script — but this
// machine is win32-arm64, where sharp has no native binary and its wasm32
// fallback failed to load here. @resvg/resvg-js ships a real win32-arm64
// build and renders the same SVG, so it's used instead; swap back to sharp
// freely on a machine where it installs cleanly.
//
// Run: node scripts/generate-icons.cjs
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ICONS_DIR = path.join(ROOT, "icons");

// Standard icon: rounded square, content fills most of the canvas.
function iconSvg(size) {
  const r = size * 0.222;
  const tileW = size * 0.44;
  const tileH = size * 0.56;
  const tileX = (size - tileW) / 2;
  const tileY = size * 0.2;
  const badgeR = size * 0.085;
  const badgeCx = tileX + tileW * 0.92;
  const badgeCy = tileY + tileH * 0.94;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="felt" cx="30%" cy="20%" r="85%">
      <stop offset="0%" stop-color="#2a7a5c"/>
      <stop offset="55%" stop-color="#14513c"/>
      <stop offset="100%" stop-color="#0d3a2b"/>
    </radialGradient>
    <linearGradient id="bone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbf7ec"/>
      <stop offset="100%" stop-color="#ece2cc"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#felt)"/>
  <rect x="${tileX}" y="${tileY}" width="${tileW}" height="${tileH}" rx="${size * 0.028}" fill="url(#bone)"/>
  <text x="${tileX + tileW / 2}" y="${tileY + tileH * 0.68}" text-anchor="middle"
        font-family="'Noto Serif SC', 'Songti SC', serif" font-weight="700"
        font-size="${tileH * 0.62}" fill="#b5322c">中</text>
  <circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="#d9a441"/>
  <text x="${badgeCx}" y="${badgeCy + badgeR * 0.36}" text-anchor="middle"
        font-family="Figtree, sans-serif" font-weight="800" font-size="${badgeR * 1.15}" fill="#3a2708">&#10003;</text>
</svg>`;
}

// Maskable icon: same content but shrunk into the ~80% "safe zone" circle
// and no baked-in rounded corners (the OS applies its own mask shape), full
// bleed background so nothing crops to transparent.
function maskableSvg(size) {
  const scale = 0.72;
  const tileW = size * 0.44 * scale;
  const tileH = size * 0.56 * scale;
  const tileX = (size - tileW) / 2;
  const tileY = (size - tileH) / 2 - size * 0.03;
  const badgeR = size * 0.075;
  const badgeCx = tileX + tileW * 0.92;
  const badgeCy = tileY + tileH * 0.94;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="felt" cx="30%" cy="20%" r="85%">
      <stop offset="0%" stop-color="#2a7a5c"/>
      <stop offset="55%" stop-color="#14513c"/>
      <stop offset="100%" stop-color="#0d3a2b"/>
    </radialGradient>
    <linearGradient id="bone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbf7ec"/>
      <stop offset="100%" stop-color="#ece2cc"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#felt)"/>
  <rect x="${tileX}" y="${tileY}" width="${tileW}" height="${tileH}" rx="${size * 0.02}" fill="url(#bone)"/>
  <text x="${tileX + tileW / 2}" y="${tileY + tileH * 0.68}" text-anchor="middle"
        font-family="'Noto Serif SC', 'Songti SC', serif" font-weight="700"
        font-size="${tileH * 0.62}" fill="#b5322c">中</text>
  <circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="#d9a441"/>
  <text x="${badgeCx}" y="${badgeCy + badgeR * 0.36}" text-anchor="middle"
        font-family="Figtree, sans-serif" font-weight="800" font-size="${badgeR * 1.15}" fill="#3a2708">&#10003;</text>
</svg>`;
}

function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ICONS_DIR, "icon-source.svg"), iconSvg(1024));

  let Resvg;
  try {
    ({ Resvg } = require("@resvg/resvg-js"));
  } catch (e) {
    console.error("@resvg/resvg-js is not installed — run `npm install` first.");
    console.error("Falling back to writing the SVG only; PNGs were not generated.");
    process.exitCode = 1;
    return;
  }

  const targets = [
    [1024, "icon-1024.png", iconSvg],
    [512, "icon-512.png", iconSvg],
    [192, "icon-192.png", iconSvg],
    [180, "apple-touch-icon.png", iconSvg],
    [512, "icon-512-maskable.png", maskableSvg],
    [192, "icon-192-maskable.png", maskableSvg],
  ];

  for (const [size, name, svgFn] of targets) {
    const resvg = new Resvg(svgFn(size), {
      fitTo: { mode: "width", value: size },
      font: { loadSystemFonts: true },
    });
    const png = resvg.render().asPng();
    fs.writeFileSync(path.join(ICONS_DIR, name), png);
    console.log(`wrote ${name} (${size}x${size})`);
  }
}

main();
