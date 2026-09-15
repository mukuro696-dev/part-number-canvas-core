// Generates the PWA/app icons from a small inline SVG (an abstract
// "segmented code + two callouts" motif — deliberately generic, not
// tied to any real product or company). One-off/reproducible: rerun
// after changing the design or accent color.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(import.meta.dirname, "..", "public", "icons");
const ACCENT = "#2563eb";

function buildIconSvg({ size, contentScale, squareBg = false }) {
  const half = size / 2;
  const s = contentScale;
  const pt = (x, y) => [half + x * s, half + y * s];
  const baselineY = 8;

  const [x1, y1] = pt(-56, baselineY);
  const [x2, y2] = pt(56, baselineY);
  const ticks = [-56, -19, 19, 56]
    .map((tx) => {
      const [tx1, ty1] = pt(tx, baselineY - 14);
      const [tx2, ty2] = pt(tx, baselineY + 14);
      return `<line x1="${tx1}" y1="${ty1}" x2="${tx2}" y2="${ty2}" stroke="white" stroke-width="${7 * s}" stroke-linecap="round"/>`;
    })
    .join("");
  const [lx1, ly1] = pt(-37, baselineY - 14);
  const [ldx, ldy] = pt(-52, baselineY - 52);
  const [rx1, ry1] = pt(37, baselineY + 14);
  const [rdx, rdy] = pt(52, baselineY + 52);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${squareBg ? 0 : size * 0.2}" fill="${ACCENT}"/>
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="white" stroke-width="${7 * s}" stroke-linecap="round"/>
    ${ticks}
    <line x1="${lx1}" y1="${ly1}" x2="${ldx}" y2="${ldy}" stroke="white" stroke-width="${5 * s}" stroke-linecap="round"/>
    <circle cx="${ldx}" cy="${ldy}" r="${9 * s}" fill="white"/>
    <line x1="${rx1}" y1="${ry1}" x2="${rdx}" y2="${rdy}" stroke="white" stroke-width="${5 * s}" stroke-linecap="round"/>
    <circle cx="${rdx}" cy="${rdy}" r="${9 * s}" fill="white"/>
  </svg>`;
}

await mkdir(OUT_DIR, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192, contentScale: 0.85 },
  { name: "icon-512.png", size: 512, contentScale: 0.85 },
  { name: "icon-512-maskable.png", size: 512, contentScale: 0.62, squareBg: true },
  { name: "favicon-32.png", size: 32, contentScale: 0.85 },
  { name: "apple-touch-icon.png", size: 180, contentScale: 0.72 }, // no OS-level mask on iOS; keep clear of rounded corners
];

for (const t of targets) {
  const svg = buildIconSvg(t);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(path.join(OUT_DIR, t.name), png);
  console.log(`${t.name}  ${png.length} bytes`);
}
