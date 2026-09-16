# Part Number Canvas — Core

A curated excerpt of the core, product-agnostic logic behind a browser-only
tool for turning a part number / model code string into an annotated,
leader-line diagram (select a substring, label what it means, export SVG/PNG).

This is **not the full application** — it's the reusable core: the layout
engine, SVG renderer, schema/validation, and a few small self-contained
utilities. The full product's UI, page shell, PWA/asset config, and
project-specific styling are intentionally out of scope here.

## What's in this repository

| Path | What it is |
|---|---|
| `schema/part-number-canvas.v1.schema.json` | JSON Schema for the exchange/document format |
| `src/lib/schema/` | Schema types and validation. The validator is compiled from the schema ahead of time (`scripts/build-schema-validator.mjs`, Ajv's standalone code generation) and committed as `validator.generated.mjs`, so nothing calls `new Function` in the browser and a page embedding it needs no `'unsafe-eval'` in its Content-Security-Policy |
| `src/lib/graphemes.ts` | Grapheme-cluster-aware string helpers (`Intl.Segmenter`-based) |
| `src/lib/xmlText.ts` | Finds and strips the characters XML does not allow. One of them anywhere in the text makes the whole SVG unparseable, so an export fails with nothing useful to show the reader |
| `src/lib/document.ts` | Document construction and structural validation (item ranges, note references) |
| `src/lib/warnings.ts` | Non-blocking content checks (empty fields, duplicate headings, unreferenced notes, layout balance, ...) |
| `src/lib/layout/` | The pure-function SVG layout engine: label placement, leader-line routing, wrapping (with Japanese line-break rules), note numbering in reading order, geometric collision/crossing checks, canvas-based text measurement, and an on-demand left/right re-arrangement search |
| `src/lib/noteTokens.ts` | Inline note references inside option descriptions (`{{note:ID}}`): parsing, migration from the older end-of-text form, and cleanup when a note is deleted |
| `src/lib/summary.ts` | A plain-text summary of a diagram (for alt text or spec drafts) |
| `src/components/DiagramSvg.tsx` | The SVG renderer (React component, safe by construction — no script/foreignObject/external refs, and no style attribute, which a strict `style-src` blocks and no hash can allow) |
| `src/lib/svg-safety.ts` | A static scan that rejects unsafe SVG output before it's ever offered for download |
| `src/lib/export/pngExport.ts` | Canvas-based SVG→PNG rasterization |
| `src/lib/fonts/hbSubset.ts` | A thin wrapper around HarfBuzz's WASM subsetter (`hb-subset`), for client-side, glyph-level font subsetting |
| `src/lib/storage/db.ts` | A small promisified IndexedDB wrapper |
| `src/lib/consent/` | A minimal, localStorage-only cookie/consent-category store (GPC-aware) |
| `fixtures/*.json` | Fictional example documents used by the tests. `rack-unit-240.json` is the Japanese one — the typography rules above are what this engine exists for, so it runs through validation, layout, note numbering and rendering in `test/japanese-sample.test.ts` |
| `assets/fonts/`, `assets/wasm/` | Redistributable font/WASM binaries the tests exercise, with license/attribution records |
| `test/` | Unit tests for everything above |

Everything here is generic: no real company names, product names, or
internal hostnames. Fixtures use fictional data only.

## Running the code

This repo intentionally ships as a source excerpt, without its own
`package.json` — see [CONTRIBUTING.md](./CONTRIBUTING.md) for what you need
to wire up to run the tests yourself.

## License

MIT — see [LICENSE](./LICENSE). Bundled font/WASM assets under `assets/`
carry their own licenses, recorded alongside them
(`assets/fonts/README.md`, `assets/fonts/licenses/`, `assets/wasm/`).

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
