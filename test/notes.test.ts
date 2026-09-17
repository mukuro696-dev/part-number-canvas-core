import { describe, expect, it } from "vitest";
import { JAPANESE_NOTATION } from "../src/lib/notation";
import { checkNoteReferences, createEmptyItem } from "../src/lib/document";
import { LAYOUT, approxMeasure, computeLayout, wrapDescription } from "../src/lib/layout/computeLayout";
import { checkWarnings } from "../src/lib/warnings";
import type { PartNumberNote } from "../src/lib/schema/types";
import { noteRefsIn, noteToken } from "../src/lib/noteTokens";
import type { DescRun } from "../src/lib/layout/computeLayout";

/** lines as strings, with superscript runs written as ^text */
const show = (lines: DescRun[][]) => lines.map((line) => line.map((r) => (r.sup ? `^${r.text}` : r.text)).join(""));

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
    const layout = computeLayout("AB", [], 2400, [note]);
    const warnings = checkWarnings("AB", [], layout, [note]);
    expect(warnings.some((w) => w.code === "unreferenced-note")).toBe(true);
  });

  it("does not flag a note that is referenced by an item's option", () => {
    const note: PartNumberNote = { id: "note-1", text: "参照される注記" };
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "X", description: "d", noteRefs: [note.id] }];
    const layout = computeLayout("AB", [item], 2400, [note]);
    const warnings = checkWarnings("AB", [item], layout, [note]);
    expect(warnings.some((w) => w.code === "unreferenced-note")).toBe(false);
  });
});

describe("computeLayout: footnotes", () => {
  it("renders no footnotes block when there are no notes", () => {
    const layout = computeLayout("AB", [], 2400, []);
    expect(layout.footnotes).toEqual([]);
    expect(layout.footnotesRuleY).toBeNull();
  });

  it("lists every note, numbered in document order, below the item stacks", () => {
    const notes: PartNumberNote[] = [
      { id: "n1", text: "最初の注記" },
      { id: "n2", text: "二番目の注記" },
    ];
    const layout = computeLayout("AB", [], 2400, notes);
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

  it("draws references from older data (noteRefs only) as a superscript at the end of the description", () => {
    const note: PartNumberNote = { id: "n1", text: "注記" };
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "X", description: "説明", noteRefs: [note.id] }];
    const layout = computeLayout("AB", [item], 2400, [note]);
    const option = layout.placed[0].label.options[0];
    expect(show(option.descLines)).toEqual(["説明^※1"]);
    expect(option.codeText).toBe("X\u00a0=\u00a0");
  });

  it("draws an inline reference where it stands, and joins adjacent ones in ascending order", () => {
    const noteA: PartNumberNote = { id: "a", text: "注記A" };
    const noteB: PartNumberNote = { id: "b", text: "注記B" };
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    const description = `端子台${noteToken(noteB.id)}${noteToken(noteA.id)}・3極${noteToken(noteA.id)}`;
    item.options = [{ code: "X", description, noteRefs: noteRefsIn(description) }];
    const layout = computeLayout("AB", [item], 2400, [noteA, noteB]);
    // b is met first, so it is 1; the same note may appear twice
    expect(layout.noteNumbers.get(noteB.id)).toBe(1);
    expect(show(layout.placed[0].label.options[0].descLines)).toEqual(["端子台^※1※2・3極^※2"]);
  });

  it("never leaves the marker alone on a wrapped line (禁則)", () => {
    const note: PartNumberNote = { id: "n1", text: "注記" };
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "X", description: "とても長い説明文をここに入れて何行にも折り返させます", noteRefs: [note.id] }];
    const layout = computeLayout("AB", [item], 600, [note]);
    const lines = show(layout.placed[0].label.options[0].descLines);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.at(-1)!.endsWith("^※1")).toBe(true);
    expect(lines.at(-1)).not.toBe("^※1");
  });

  it("draws nothing for a reference to a note that doesn't exist (the blocking check reports it)", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "X", description: "説明", noteRefs: ["does-not-exist"] }];
    const layout = computeLayout("AB", [item], 2400, []);
    expect(show(layout.placed[0].label.options[0].descLines)).toEqual(["説明"]);
  });
});

describe("wrapDescription: units and markers", () => {
  const numbers = new Map([
    ["a", 1],
    ["b", 2],
    ["c", 3],
  ]);
  const refs = (...ids: string[]) => ids.map(noteToken).join("");

  it("breaks before a unit like \"12 - 24 V\" instead of inside it when there is no space to break at", () => {
    const lines = wrapDescription("電圧12 - 24 V", numbers, 140, 0, approxMeasure, JAPANESE_NOTATION.noteMark);
    expect(show(lines)).toEqual(["電圧", "12\u00a0-\u00a024\u00a0V"]);
  });

  it("takes the previous line's last character along when the marker would overflow that line", () => {
    const lines = wrapDescription(`あいうえ${refs("a", "b", "c")}`, numbers, 130, 0, approxMeasure, JAPANESE_NOTATION.noteMark);
    expect(show(lines)).toEqual(["あいう", "え^※1※2※3"]);
    for (const line of lines) {
      const width = line.reduce(
        (w, run) => w + approxMeasure(run.text, "body", run.sup ? LAYOUT.optionSize * LAYOUT.supScale : LAYOUT.optionSize),
        0,
      );
      expect(width).toBeLessThanOrEqual(130);
    }
  });

  it("still joins the marker onto the previous line when it fits", () => {
    expect(show(wrapDescription(`あいうえ${refs("a")}`, numbers, 160, 0, approxMeasure, JAPANESE_NOTATION.noteMark))).toEqual(["あいうえ^※1"]);
  });

  it("never starts a line with a marker placed in the middle of the text", () => {
    // "あいう" fills the line; the marker must go down together with "う"
    const lines = show(wrapDescription(`あいう${refs("a")}えお`, numbers, 100, 0, approxMeasure, JAPANESE_NOTATION.noteMark));
    expect(lines.every((line) => !line.startsWith("^"))).toBe(true);
    expect(lines.join("")).toBe("あいう^※1えお");
  });

  it("keeps a unit together when a reference follows it", () => {
    const lines = show(wrapDescription(`電圧12 V${refs("a")}`, numbers, 110, 0, approxMeasure, JAPANESE_NOTATION.noteMark));
    expect(lines.at(-1)).toBe("12\u00a0V^※1");
  });
});

describe("note numbering in reading order", () => {
  it("numbers notes by where they are first referenced in the drawing, not by creation order", () => {
    const first: PartNumberNote = { id: "created-first", text: "先に作った注記" };
    const second: PartNumberNote = { id: "created-second", text: "後に作った注記" };
    // left item (range at the start) refers to the note created second
    const leftItem = createEmptyItem({ start: 0, end: 2, unit: "grapheme" }, "left");
    leftItem.heading = "左";
    leftItem.options = [{ code: "A", description: "説明", noteRefs: [second.id] }];
    const rightItem = createEmptyItem({ start: 6, end: 8, unit: "grapheme" }, "right");
    rightItem.heading = "右";
    rightItem.options = [{ code: "B", description: "説明", noteRefs: [first.id] }];
    const layout = computeLayout("AB-CD-EF", [rightItem, leftItem], 2400, [first, second]);

    expect(layout.noteNumbers.get(second.id)).toBe(1);
    expect(layout.noteNumbers.get(first.id)).toBe(2);
    const byItem = new Map(layout.placed.map((p) => [p.item.id, show(p.label.options[0].descLines)]));
    expect(byItem.get(leftItem.id)).toEqual(["説明^※1"]);
    expect(byItem.get(rightItem.id)).toEqual(["説明^※2"]);
    // the footnote list is drawn in number order
    expect(layout.footnotes.map((f) => f.number)).toEqual([1, 2]);
    expect(layout.footnotes[0].lines[0]).toContain("後に作った注記");
  });

  it("puts notes nobody refers to after the referenced ones", () => {
    const unused: PartNumberNote = { id: "unused", text: "未参照" };
    const used: PartNumberNote = { id: "used", text: "参照あり" };
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.options = [{ code: "X", description: "d", noteRefs: [used.id] }];
    const layout = computeLayout("AB", [item], 2400, [unused, used]);
    expect(layout.noteNumbers.get(used.id)).toBe(1);
    expect(layout.noteNumbers.get(unused.id)).toBe(2);
  });
});

describe("wrapDescription: cases found in the post-implementation review", () => {
  const numbers = new Map([["n", 1]]);
  const charWidth: Parameters<typeof wrapDescription>[4] = (text) => [...text].length * 10;
  const width = (line: ReturnType<typeof wrapDescription>[number]) =>
    line.reduce((w, r) => w + charWidth(r.text, "body", r.sup ? LAYOUT.optionSize * LAYOUT.supScale : LAYOUT.optionSize), 0);

  it("re-checks what a break carries over against the next line's indented limit", () => {
    const lines = wrapDescription("あ いうえおかきくけこ", numbers, 100, 40, charWidth, JAPANESE_NOTATION.noteMark);
    lines.forEach((line, i) => expect(width(line)).toBeLessThanOrEqual(i === 0 ? 100 : 60));
  });

  it("binds a marker at the very start to what follows, so it never sits alone", () => {
    const lines = show(wrapDescription(`${noteToken("n")}あいう`, numbers, 20, 0, charWidth, JAPANESE_NOTATION.noteMark));
    expect(lines[0]).not.toBe("^※1");
  });

  it("binds a marker after a space to the word before the space", () => {
    const lines = show(wrapDescription(`ABC ${noteToken("n")}`, numbers, 40, 0, charWidth, JAPANESE_NOTATION.noteMark));
    expect(lines.every((line) => !line.trim().startsWith("^"))).toBe(true);
  });

  it("does not split a Latin word or number such as 24V by characters when it fits a line", () => {
    const lines = show(wrapDescription("電圧は24VDC", numbers, 70, 0, charWidth, JAPANESE_NOTATION.noteMark));
    expect(lines).toContain("24VDC");
  });

  it("keeps closing brackets and punctuation off the start of a line, and opening brackets off the end (禁則)", () => {
    const closing = show(wrapDescription("あいう）", numbers, 30, 0, charWidth, JAPANESE_NOTATION.noteMark));
    expect(closing.every((line) => !line.startsWith("）"))).toBe(true);
    const opening = show(wrapDescription("あい（う", numbers, 30, 0, charWidth, JAPANESE_NOTATION.noteMark));
    expect(opening.every((line) => !line.endsWith("（"))).toBe(true);
  });
});

describe("computeLayout: shift limit and minimum width", () => {
  it("never pushes the code row past the canvas to clear deep left leaders", () => {
    const first = createEmptyItem({ start: 0, end: 1, unit: "grapheme" }, "left");
    first.heading = "項目1";
    first.options = [{ code: "A", description: "説明文".repeat(150), noteRefs: [] }];
    const second = createEmptyItem({ start: 1, end: 2, unit: "grapheme" }, "left");
    second.heading = "項目2";
    const layout = computeLayout("AB", [first, second], 2400);
    expect(layout.charX(2)).toBeLessThanOrEqual(2400);
    expect(layout.codeX).toBeGreaterThanOrEqual(0);
  });

  it("counts a unit and the marker bound to it together when deciding the minimum width", () => {
    const note: PartNumberNote = { id: "n", text: "注記" };
    const withMarker = createEmptyItem({ start: 0, end: 1, unit: "grapheme" }, "left");
    withMarker.heading = "h";
    withMarker.options = [{ code: "", description: `W${"W".repeat(20)} V${noteToken(note.id)}`, noteRefs: [note.id] }];
    const plain = createEmptyItem({ start: 0, end: 1, unit: "grapheme" }, "left");
    plain.heading = "h";
    plain.options = [{ code: "", description: `W${"W".repeat(20)} V`, noteRefs: [] }];
    const required = (item: typeof plain, notes: PartNumberNote[]) => computeLayout("AB", [item], 300, notes).shortfalls[0]?.required ?? 0;
    expect(required(withMarker, [note])).toBeGreaterThan(required(plain, []));
  });
});
