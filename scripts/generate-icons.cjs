// Generate the full PWA/iOS icon set from the supplied raster source.
//
// Uses @resvg/resvg-js because this machine's win32-arm64 target does not
// support sharp. The same artwork is used for standard and maskable icons;
// the source already keeps its tile artwork inside the maskable safe zone.
//
// Run: node scripts/generate-icons.cjs
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ICONS_DIR = path.join(ROOT, "icons");
const SOURCE_PATH = path.join(ICONS_DIR, "icon-source.png");

function sourceSvg(size, sourceDataUri) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <image width="${size}" height="${size}" href="${sourceDataUri}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
}

function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  if (!fs.existsSync(SOURCE_PATH)) {
    console.error("icons/icon-source.png is missing.");
    process.exitCode = 1;
    return;
  }

  let Resvg;
  try {
    ({ Resvg } = require("@resvg/resvg-js"));
  } catch (e) {
    console.error("@resvg/resvg-js is not installed — run `npm install` first.");
    process.exitCode = 1;
    return;
  }

  const sourceDataUri = `data:image/png;base64,${fs.readFileSync(SOURCE_PATH).toString("base64")}`;
  const targets = [
    [1024, "icon-1024.png"],
    [512, "icon-512.png"],
    [192, "icon-192.png"],
    [180, "apple-touch-icon.png"],
    [512, "icon-512-maskable.png"],
    [192, "icon-192-maskable.png"],
  ];

  for (const [size, name] of targets) {
    const resvg = new Resvg(sourceSvg(size, sourceDataUri), {
      fitTo: { mode: "width", value: size },
    });
    fs.writeFileSync(path.join(ICONS_DIR, name), resvg.render().asPng());
    console.log(`wrote ${name} (${size}x${size})`);
  }
}

main();
