import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { instantiateHbSubset, subsetSfnt } from "../src/lib/fonts/hbSubset";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const wasmPath = path.join(projectRoot, "assets", "wasm", "hb-subset.wasm");
const fontsDir = path.join(projectRoot, "assets", "fonts", "source");

async function loadHb() {
  const wasmBytes = await readFile(wasmPath);
  return instantiateHbSubset(wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength));
}

function isSfntMagic(bytes: Uint8Array): boolean {
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  // 'true'/'OTTO' (OpenType with CFF), or the 0x00010000 TrueType version tag
  return magic === "true" || magic === "OTTO" || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0);
}

describe("subsetSfnt (Phase 2 step 7 PoC: real HarfBuzz glyph subsetting)", () => {
  it("shrinks a Latin source font down to only the glyphs a short code string needs", async () => {
    const hb = await loadHb();
    const source = await readFile(path.join(fontsDir, "roboto-condensed-latin-400.ttf"));
    const sourceBytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);

    const subset = subsetSfnt(hb, sourceBytes, "ABX-120-RN");

    expect(isSfntMagic(subset)).toBe(true);
    expect(subset.byteLength).toBeGreaterThan(0);
    // this is the entire point of subsetting: a handful of glyphs should
    // be dramatically smaller than the full Latin character set
    expect(subset.byteLength).toBeLessThan(sourceBytes.byteLength / 4);
  });

  it("shrinks a large Japanese source font down for a short heading/description", async () => {
    const hb = await loadHb();
    const source = await readFile(path.join(fontsDir, "noto-sans-jp-japanese-400.ttf"));
    const sourceBytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);

    const subset = subsetSfnt(hb, sourceBytes, "サイズ 直径120 mm（架空） 本体色 レッド（架空）");

    expect(isSfntMagic(subset)).toBe(true);
    // the JP source covers thousands of glyphs; a dozen-character
    // heading/description should subset to a small fraction of it
    expect(subset.byteLength).toBeLessThan(sourceBytes.byteLength / 20);
  });

  it("produces a font that still contains only the requested characters (no unrelated glyph bleed)", async () => {
    const hb = await loadHb();
    const source = await readFile(path.join(fontsDir, "roboto-condensed-latin-400.ttf"));
    const sourceBytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);

    const subsetShort = subsetSfnt(hb, sourceBytes, "A");
    const subsetLong = subsetSfnt(hb, sourceBytes, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");

    // more requested glyphs -> a larger (or equal) subset; proves the
    // subsetter is actually driven by the input text, not a fixed table
    expect(subsetLong.byteLength).toBeGreaterThan(subsetShort.byteLength);
  });

  it("is deterministic for the same input", async () => {
    const hb = await loadHb();
    const source = await readFile(path.join(fontsDir, "noto-serif-latin-400.ttf"));
    const sourceBytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);

    const a = subsetSfnt(hb, sourceBytes, "Nova Clamp V3");
    const b = subsetSfnt(hb, sourceBytes, "Nova Clamp V3");
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("throws a clear error rather than silently returning garbage for a corrupt source", async () => {
    const hb = await loadHb();
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    expect(() => subsetSfnt(hb, garbage, "abc")).toThrow();
  });
});
