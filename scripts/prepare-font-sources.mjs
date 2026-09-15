// One-off/reproducible step that converts the vendored WOFF2 sources
// (self-hosted, SIL OFL licensed) into plain SFNT (TrueType/OpenType).
// The client-side subsetter (src/lib/fonts/subset.ts) only needs to
// depend on HarfBuzz's own hb-subset.wasm at runtime — no other WASM
// codec chain in the browser bundle — because it starts from SFNT.
// This script itself only needs to run once per source-font update
// (in Node, where the WOFF2 decoder's fs-based loader works fine).
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import fontverter from "fontverter";

const SOURCE_DIR = path.join(import.meta.dirname, "..", "assets", "fonts", "source");

const FILES = [
  "biz-udpgothic-japanese-400",
  "biz-udpgothic-latin-400",
  "noto-sans-jp-japanese-400",
  "noto-sans-latin-400",
  "noto-serif-jp-japanese-400",
  "noto-serif-latin-400",
  "roboto-condensed-latin-400",
  "barlow-condensed-latin-400",
  "ibm-plex-sans-condensed-latin-400",
];

for (const name of FILES) {
  const woff2Path = path.join(SOURCE_DIR, `${name}.woff2`);
  const sfntPath = path.join(SOURCE_DIR, `${name}.ttf`);
  const woff2Bytes = await readFile(woff2Path);
  const sfntBytes = await fontverter.convert(woff2Bytes, "sfnt");
  await writeFile(sfntPath, sfntBytes);
  const hash = createHash("sha256").update(sfntBytes).digest("hex");
  console.log(`${name}.ttf  sha256:${hash}  (${sfntBytes.length} bytes)`);
}
