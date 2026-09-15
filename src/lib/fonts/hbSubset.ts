/**
 * Minimal, direct binding to HarfBuzz's hb-subset WASM export (the same
 * binary the `subset-font` package uses), reimplemented here so it can
 * be instantiated with `fetch()` in the browser rather than
 * `fs.readFile` — `subset-font` itself is Node-only because of its
 * WOFF2 codec chain. We sidestep that by working only with SFNT
 * (TrueType/OpenType) input, pre-converted once at build time
 * (see scripts/prepare-font-sources.mjs) — no format conversion happens
 * at runtime, so hb-subset.wasm is the only WASM this app loads.
 *
 * See https://github.com/harfbuzz/harfbuzzjs (MIT) for the calling
 * convention this mirrors.
 */

const HB_MEMORY_MODE_WRITABLE = 2;
const HB_SUBSET_SETS_LAYOUT_FEATURE_TAG = 6;
const HB_SUBSET_FLAGS_NO_HINTING = 0x00000001;

interface HbSubsetExports {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_set(input: number, setType: number): number;
  hb_subset_input_get_flags(input: number): number;
  hb_subset_input_set_flags(input: number, flags: number): void;
  hb_subset_input_unicode_set(input: number): number;
  hb_set_clear(set: number): void;
  hb_set_invert(set: number): void;
  hb_set_add(set: number, value: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, length: number): number;
  hb_blob_get_length(blob: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_subset_or_fail(face: number, input: number): number;
}

export interface HbSubsetModule {
  exports: HbSubsetExports;
}

export async function instantiateHbSubset(wasmBytes: ArrayBuffer): Promise<HbSubsetModule> {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  return { exports: instance.exports as unknown as HbSubsetExports };
}

/**
 * Subsets an SFNT (TrueType/OpenType) font down to only the glyphs
 * needed to render `text`, returning a new SFNT buffer. This is the
 * "使用グリフだけをサブセット埋め込み" requirement (Phase 1 §9/§10).
 */
export function subsetSfnt(hb: HbSubsetModule, sfntBytes: Uint8Array, text: string): Uint8Array {
  const { exports } = hb;

  const input = exports.hb_subset_input_create_or_fail();
  if (input === 0) throw new Error("hb_subset_input_create_or_fail failed");

  const fontBuffer = exports.malloc(sfntBytes.byteLength);
  new Uint8Array(exports.memory.buffer).set(sfntBytes, fontBuffer);

  const blob = exports.hb_blob_create(fontBuffer, sfntBytes.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0);
  const face = exports.hb_face_create(blob, 0);
  exports.hb_blob_destroy(blob);

  // keep all layout features (equivalent to --layout-features=*)
  const layoutFeatures = exports.hb_subset_input_set(input, HB_SUBSET_SETS_LAYOUT_FEATURE_TAG);
  exports.hb_set_clear(layoutFeatures);
  exports.hb_set_invert(layoutFeatures);

  // drop hinting instructions: irrelevant at the sizes this app renders text
  exports.hb_subset_input_set_flags(input, exports.hb_subset_input_get_flags(input) | HB_SUBSET_FLAGS_NO_HINTING);

  const unicodes = exports.hb_subset_input_unicode_set(input);
  for (const ch of text) {
    exports.hb_set_add(unicodes, ch.codePointAt(0)!);
  }

  let subsetFace: number;
  try {
    subsetFace = exports.hb_subset_or_fail(face, input);
    if (subsetFace === 0) throw new Error("hb_subset_or_fail failed (corrupt font, or no matching glyphs?)");
  } finally {
    exports.hb_subset_input_destroy(input);
  }

  const resultBlob = exports.hb_face_reference_blob(subsetFace);
  const offset = exports.hb_blob_get_data(resultBlob, 0);
  const length = exports.hb_blob_get_length(resultBlob);
  if (length === 0) {
    exports.hb_blob_destroy(resultBlob);
    exports.hb_face_destroy(subsetFace);
    exports.hb_face_destroy(face);
    exports.free(fontBuffer);
    throw new Error("hb-subset produced an empty result");
  }

  // copy out of WASM memory before freeing/destroying — the heap view
  // may be re-read from `exports.memory.buffer` above but grab a fresh
  // view here in case of any intervening growth
  const result = new Uint8Array(exports.memory.buffer).slice(offset, offset + length);

  exports.hb_blob_destroy(resultBlob);
  exports.hb_face_destroy(subsetFace);
  exports.hb_face_destroy(face);
  exports.free(fontBuffer);

  return result;
}
