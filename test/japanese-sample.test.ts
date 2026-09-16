// The engine is built around Japanese text — line-break rules, glued units,
// note markers that must not start a line — but most fixtures are in English.
// This one runs a Japanese document through the whole chain, so the example in
// `fixtures/` is a working sample rather than a file nobody opens.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { validateDocument } from "../src/lib/schema/validate";
import { computeLayout, numberNotes } from "../src/lib/layout/computeLayout";
import { checkLayoutIssues } from "../src/lib/layout/checks";
import { checkWarnings } from "../src/lib/warnings";
import { itemsWithInlineNotes } from "../src/lib/noteTokens";
import { checkSvgSafety } from "../src/lib/svg-safety";
import { DiagramSvg } from "../src/components/DiagramSvg";
import type { PartNumberDocument } from "../src/lib/schema/types";

const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/rack-unit-240.json", import.meta.url)), "utf-8"),
) as PartNumberDocument;

const layoutOf = (doc: PartNumberDocument) =>
  computeLayout(doc.model.code, itemsWithInlineNotes(doc.model.items), doc.export.svgWidth, doc.model.notes);

describe("the Japanese sample document", () => {
  it("is a valid v1 document", () => {
    expect(validateDocument(sample)).toEqual({ valid: true, errors: [] });
  });

  it("lays out without collisions and with nothing left to fill in", () => {
    const layout = layoutOf(sample);
    expect(checkLayoutIssues(layout)).toEqual([]);
    const todo = checkWarnings(sample.model.code, sample.model.items, layout, sample.model.notes).filter(
      (w) => w.kind === "todo",
    );
    expect(todo).toEqual([]);
  });

  it("turns its inline reference into a numbered marker beside the text it follows", () => {
    const layout = layoutOf(sample);
    const numbers = numberNotes(itemsWithInlineNotes(sample.model.items), sample.model.notes);
    expect(numbers.get("note-sample")).toBe(1);

    // the marker rides along with 「ラックマウント」, not on a line of its own
    const runs = layout.placed
      .flatMap((p) => p.label.options)
      .flatMap((option) => option.descLines)
      .flat();
    const marker = runs.findIndex((run) => run.sup);
    expect(marker).toBeGreaterThan(0);
    expect(runs[marker].text).toBe("※1");
    expect(runs[marker - 1].text).toContain("ラックマウント");

    // and the note itself is drawn under the diagram
    expect(layout.footnotes.map((f) => f.number)).toEqual([1]);
  });

  it("renders to markup that keeps the Japanese text and passes the safety scan", () => {
    const markup = renderToStaticMarkup(
      DiagramSvg({
        layout: layoutOf(sample),
        code: sample.model.code,
        background: sample.appearance.background,
        accent: sample.appearance.accent,
      }),
    );
    expect(checkSvgSafety(markup)).toEqual([]);
    expect(markup).toContain("取付方式");
    expect(markup).toContain("PNC-240-RS-W");
    // the inline token never reaches the drawing
    expect(markup).not.toContain("{{note:");
  });
});
