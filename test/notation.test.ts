import { describe, expect, it } from "vitest";
import { NOTATIONS, notationFor } from "../src/lib/notation";
import { computeLayout } from "../src/lib/layout/computeLayout";
import { buildTextSummary } from "../src/lib/summary";
import { createEmptyItem } from "../src/lib/document";

const itemWith = (heading: string, code: string, description: string) => {
  const item = createEmptyItem({ start: 0, end: 3, unit: "grapheme" });
  item.heading = heading;
  item.options = [{ code, description, noteRefs: [] }];
  return item;
};

describe("notationFor", () => {
  it("reads a document with no Japanese in it as Latin", () => {
    expect(notationFor("CBL-2M", [itemWith("Length", "2M", "2 m")], [])).toBe(NOTATIONS.latin);
  });

  it("reads one Japanese character anywhere as Japanese", () => {
    expect(notationFor("CBL-2M", [itemWith("Length", "2M", "2 m")], [{ id: "n1", text: "受注生産" }])).toBe(
      NOTATIONS.cjk,
    );
    expect(notationFor("CBL-2M", [itemWith("長さ", "2M", "2 m")], [])).toBe(NOTATIONS.cjk);
    expect(notationFor("型番-2M", [itemWith("Length", "2M", "2 m")], [])).toBe(NOTATIONS.cjk);
  });

  it("treats an empty document as Latin rather than guessing", () => {
    expect(notationFor("", [], [])).toBe(NOTATIONS.latin);
  });

  it("is not fooled by ASCII punctuation, digits or units", () => {
    expect(notationFor("A-1/B", [itemWith("Size (mm)", "1", "10 mm, +/-0.5")], [])).toBe(NOTATIONS.latin);
  });

  it("sees ideographs from above the BMP, which need the pattern's u flag", () => {
    // U+20B9F, a CJK Extension B ideograph: two UTF-16 code units, one character
    expect(notationFor("A-1", [itemWith("\u{20b9f}", "1", "10 mm")], [])).toBe(NOTATIONS.cjk);
  });
});

describe("the notation reaches everything the document is turned into", () => {
  const latin = [itemWith("Length", "2M", "2 m")];
  const japanese = [itemWith("長さ", "2M", "2 m")];
  const note = [{ id: "n1", text: "made to order" }];

  it("marks the footnote list in the drawing with the document's own mark", () => {
    const en = computeLayout("CBL-2M", latin, 2400, note);
    expect(en.footnotes[0].lines[0].startsWith("*1")).toBe(true);

    const ja = computeLayout("CBL-2M", japanese, 2400, note);
    expect(ja.footnotes[0].lines[0].startsWith("※1")).toBe(true);
  });

  it("carries the decision on the layout, so the summary cannot disagree with the drawing", () => {
    const layout = computeLayout("CBL-2M", latin, 2400, note);
    const summary = buildTextSummary("CBL-2M", layout, note);
    expect(summary).toContain("*1 made to order");
    expect(summary).toContain("Length: 2M = 2 m");
    // none of the Japanese punctuation the summary used to be built from
    expect(summary).not.toMatch(/[、：｜※]/);
  });

  it("keeps the Japanese summary exactly as it was", () => {
    const layout = computeLayout("CBL-2M", japanese, 2400, [{ id: "n1", text: "受注生産" }]);
    const summary = buildTextSummary("CBL-2M", layout, [{ id: "n1", text: "受注生産" }]);
    expect(summary).toContain("※1 受注生産");
    expect(summary).toContain("長さ：2M = 2 m");
  });

  it("uses the document's own language for the empty-heading placeholder", () => {
    const blank = createEmptyItem({ start: 0, end: 3, unit: "grapheme" });
    blank.options = [{ code: "2M", description: "2 m" }].map((o) => ({ ...o, noteRefs: [] }));
    expect(computeLayout("CBL-2M", [blank], 2400).placed[0].label.headingText).toBe("(no heading)");

    const blankJa = createEmptyItem({ start: 0, end: 3, unit: "grapheme" });
    blankJa.options = [{ code: "2M", description: "長さ 2 m", noteRefs: [] }];
    expect(computeLayout("CBL-2M", [blankJa], 2400).placed[0].label.headingText).toBe("(見出し未設定)");
  });
});
