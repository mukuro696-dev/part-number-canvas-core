import { describe, expect, it } from "vitest";
import { createEmptyItem } from "../src/lib/document";
import {
  itemsWithInlineNotes,
  itemsWithoutNote,
  noteRefsIn,
  noteToken,
  parseDescription,
  plainDescription,
  withInlineNotes,
} from "../src/lib/noteTokens";

describe("inline note references", () => {
  it("splits a description into text and references, leaving ordinary braces alone", () => {
    const description = `設定{{2}}倍${noteToken("n1")}です`;
    expect(parseDescription(description)).toEqual([
      { kind: "text", text: "設定{{2}}倍" },
      { kind: "note", id: "n1" },
      { kind: "text", text: "です" },
    ]);
    expect(plainDescription(description)).toBe("設定{{2}}倍です");
  });

  it("derives noteRefs in order of first appearance without repeats", () => {
    expect(noteRefsIn(`a${noteToken("x")}b${noteToken("y")}${noteToken("x")}`)).toEqual(["x", "y"]);
  });

  it("moves references that exist only in noteRefs to the end of the text, once", () => {
    const option = { code: "A", description: `説明${noteToken("x")}`, noteRefs: ["x", "y"] };
    const migrated = withInlineNotes(option);
    expect(migrated.description).toBe(`説明${noteToken("x")}${noteToken("y")}`);
    expect(migrated.noteRefs).toEqual(["x", "y"]);
    // already inline: nothing changes, and the same objects come back
    expect(withInlineNotes(migrated)).toBe(migrated);
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.options = [migrated];
    const items = [item];
    expect(itemsWithInlineNotes(items)).toBe(items);
  });

  it("does not bring back a reference the user removed from the text once noteRefs follows the text", () => {
    const edited = { code: "A", description: "説明", noteRefs: noteRefsIn("説明") };
    expect(withInlineNotes(edited).description).toBe("説明");
  });

  it("removes every reference to a deleted note from descriptions and noteRefs", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.options = [
      { code: "A", description: `a${noteToken("gone")}b${noteToken("kept")}${noteToken("gone")}`, noteRefs: ["gone", "kept"] },
      { code: "B", description: "untouched", noteRefs: [] },
    ];
    const [cleaned] = itemsWithoutNote([item], "gone");
    expect(cleaned.options[0]).toEqual({ code: "A", description: `ab${noteToken("kept")}`, noteRefs: ["kept"] });
    expect(cleaned.options[1]).toBe(item.options[1]);
  });
});

describe("inline note references: older data", () => {
  it("keeps the other references when a note is deleted from data that only had noteRefs", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.options = [{ code: "A", description: "定格電圧", noteRefs: ["a", "b"] }];
    const [cleaned] = itemsWithoutNote([item], "a");
    expect(cleaned.options[0].noteRefs).toEqual(["b"]);
    expect(cleaned.options[0].description).toBe(`定格電圧${noteToken("b")}`);
  });
});
