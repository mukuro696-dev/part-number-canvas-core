import { describe, expect, it } from "vitest";
import { checkNoteReferences, createEmptyItem } from "../src/lib/document";
import { computeLayout } from "../src/lib/layout/computeLayout";
import { checkWarnings } from "../src/lib/warnings";
import type { PartNumberNote } from "../src/lib/schema/types";

describe("checkNoteReferences", () => {
  it("flags an option that references a note id that doesn't exist", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.options = [{ code: "X", description: "d", noteRefs: ["missing-note"] }];
    const issues = checkNoteReferences([item], []);
    expect(issues).toHaveLength(1);
    expect(issues[0].itemId).toBe(item.id);
  });

  it("does not flag a reference to a note that exists", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    const note: PartNumberNote = { id: "note-1", text: "注記本文" };
    item.options = [{ code: "X", description: "d", noteRefs: [note.id] }];
    expect(checkNoteReferences([item], [note])).toEqual([]);
  });

  it("passes for items with no noteRefs at all", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    expect(checkNoteReferences([item], [])).toEqual([]);
  });
});

describe("checkWarnings: unreferenced-note", () => {
  it("flags a note that no option references", () => {
    const note: PartNumberNote = { id: "note-1", text: "使われていない注記" };
    const layout = computeLayout("AB", [], 1600, [note]);
    const warnings = checkWarnings("AB", [], layout, [note]);
    expect(warnings.some((w) => w.code === "unreferenced-note")).toBe(true);
  });

  it("does not flag a note that is referenced by an item's option", () => {
    const note: PartNumberNote = { id: "note-1", text: "参照される注記" };
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "X", description: "d", noteRefs: [note.id] }];
    const layout = computeLayout("AB", [item], 1600, [note]);
    const warnings = checkWarnings("AB", [item], layout, [note]);
    expect(warnings.some((w) => w.code === "unreferenced-note")).toBe(false);
  });
});

describe("computeLayout: footnotes", () => {
  it("renders no footnotes block when there are no notes", () => {
    const layout = computeLayout("AB", [], 1600, []);
    expect(layout.footnotes).toEqual([]);
    expect(layout.footnotesRuleY).toBeNull();
  });

  it("lists every note, numbered in document order, below the item stacks", () => {
    const notes: PartNumberNote[] = [
      { id: "n1", text: "最初の注記" },
      { id: "n2", text: "二番目の注記" },
    ];
    const layout = computeLayout("AB", [], 1600, notes);
    expect(layout.footnotesRuleY).not.toBeNull();
    expect(layout.footnotes).toHaveLength(2);
    expect(layout.footnotes[0].number).toBe(1);
    expect(layout.footnotes[0].lines[0]).toContain("最初の注記");
    expect(layout.footnotes[1].number).toBe(2);
    expect(layout.footnotes[1].lines[0]).toContain("二番目の注記");
    // second footnote sits below the first
    expect(layout.footnotes[1].y).toBeGreaterThan(layout.footnotes[0].y);
    // the overall canvas grows to fit the footnotes block
    expect(layout.height).toBeGreaterThan(layout.footnotes[1].y);
  });

  it("appends a superscript reference marker to an option's body text for each note it references", () => {
    const note: PartNumberNote = { id: "n1", text: "注記" };
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "X", description: "説明", noteRefs: [note.id] }];
    const layout = computeLayout("AB", [item], 1600, [note]);
    const bodyText = layout.placed[0].label.bodyLines.join("");
    expect(bodyText).toContain("¹");
  });

  it("silently drops a dangling noteRef from the marker instead of crashing (blocking-error path handles the rest)", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "X", description: "説明", noteRefs: ["does-not-exist"] }];
    expect(() => computeLayout("AB", [item], 1600, [])).not.toThrow();
    const layout = computeLayout("AB", [item], 1600, []);
    const bodyText = layout.placed[0].label.bodyLines.join("");
    expect(bodyText).toBe("X — 説明");
  });
});
