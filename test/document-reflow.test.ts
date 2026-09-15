import { describe, expect, it } from "vitest";
import { checkItemRanges, reflowItemRanges } from "../src/lib/document";
import { createEmptyItem } from "../src/lib/document";

describe("reflowItemRanges", () => {
  it("returns the same items untouched when the code hasn't changed", () => {
    const item = createEmptyItem({ start: 2, end: 5, unit: "grapheme" });
    const result = reflowItemRanges("ABCDEFG", "ABCDEFG", [item]);
    expect(result.touched).toBe(0);
    expect(result.items[0].range).toEqual({ start: 2, end: 5, unit: "grapheme" });
  });

  it("shifts an item entirely after an insertion earlier in the code", () => {
    // "AB-CDE" -> "AB-XX-CDE": inserted "XX-" after index 3
    const item = createEmptyItem({ start: 3, end: 6, unit: "grapheme" }); // "CDE"
    const result = reflowItemRanges("AB-CDE", "AB-XX-CDE", [item]);
    expect(result.touched).toBe(0);
    expect(result.items[0].range).toEqual({ start: 6, end: 9, unit: "grapheme" });
  });

  it("shifts an item entirely after a deletion earlier in the code", () => {
    // "AB-XX-CDE" -> "AB-CDE": removed "XX-"
    const item = createEmptyItem({ start: 6, end: 9, unit: "grapheme" }); // "CDE"
    const result = reflowItemRanges("AB-XX-CDE", "AB-CDE", [item]);
    expect(result.touched).toBe(0);
    expect(result.items[0].range).toEqual({ start: 3, end: 6, unit: "grapheme" });
  });

  it("leaves an item entirely before the edit untouched", () => {
    const item = createEmptyItem({ start: 0, end: 2, unit: "grapheme" }); // "AB"
    const result = reflowItemRanges("AB-CDE", "AB-XYZDE", [item]);
    expect(result.touched).toBe(0);
    expect(result.items[0].range).toEqual({ start: 0, end: 2, unit: "grapheme" });
  });

  it("clamps an item that overlaps the edited region and counts it as touched", () => {
    // "ABCDE" -> "ABXYZDE": edit replaces "C" with "XYZ" at index 2
    const item = createEmptyItem({ start: 1, end: 3, unit: "grapheme" }); // "BC", overlaps the edit
    const result = reflowItemRanges("ABCDE", "ABXYZDE", [item]);
    expect(result.touched).toBe(1);
    // start clamps to at most the edit's prefix (2), end reaches at least the shifted edit end
    expect(result.items[0].range.start).toBeLessThanOrEqual(2);
    expect(result.items[0].range.end).toBeGreaterThanOrEqual(2);
  });

  it("clamps ranges to the new code's length instead of leaving them out of bounds", () => {
    // "ABCDEFG" -> "AB": everything after "AB" is gone
    const item = createEmptyItem({ start: 4, end: 7, unit: "grapheme" });
    const result = reflowItemRanges("ABCDEFG", "AB", [item]);
    expect(result.items[0].range.start).toBeLessThanOrEqual(2);
    expect(result.items[0].range.end).toBeLessThanOrEqual(2);
  });

  it("never removes an item, even if its range collapses to empty", () => {
    const item = createEmptyItem({ start: 4, end: 7, unit: "grapheme" });
    const result = reflowItemRanges("ABCDEFG", "AB", [item]);
    expect(result.items).toHaveLength(1);
  });

  it("handles multiple items independently", () => {
    const before = createEmptyItem({ start: 0, end: 2, unit: "grapheme" });
    const after = createEmptyItem({ start: 5, end: 7, unit: "grapheme" });
    // "AB-CD-EF" -> "AB-CD-WORLD-EF": insertion happens between the two items
    const result = reflowItemRanges("AB-CD-EF", "AB-CD-WORLD-EF", [before, after]);
    expect(result.items[0].range).toEqual({ start: 0, end: 2, unit: "grapheme" });
    expect(result.items[1].range.start).toBeGreaterThanOrEqual(5);
    expect(result.items[1].range.end).toBeGreaterThan(7);
  });
});

describe("reflowItemRanges: repeated text with a caret hint", () => {
  it("keeps the surviving copy when the earlier of two identical runs is deleted", () => {
    const item = createEmptyItem({ start: 6, end: 8, unit: "grapheme" });
    // "RN-10-10" → delete "10-" at [3,6); the caret is left at 3
    const result = reflowItemRanges("RN-10-10", "RN-10", [item], 3);
    expect(result.items[0].range).toMatchObject({ start: 3, end: 5 });
  });

  it("falls back to the plain diff without a caret", () => {
    const item = createEmptyItem({ start: 0, end: 2, unit: "grapheme" });
    const result = reflowItemRanges("RN-10", "XRN-10", [item]);
    expect(result.items[0].range).toMatchObject({ start: 1, end: 3 });
  });
});

describe("checkItemRanges: overlapping items", () => {
  it("flags two items claiming the same characters, naming them by heading or code text", () => {
    const a = createEmptyItem({ start: 0, end: 10, unit: "grapheme" });
    a.heading = "長い範囲";
    const b = createEmptyItem({ start: 1, end: 2, unit: "grapheme" });
    const c = createEmptyItem({ start: 4, end: 5, unit: "grapheme" });
    const issues = checkItemRanges("ABCDEFGHIJ", [a, b, c]);
    // c overlaps a even though b sits between them
    expect(issues.map((i) => i.itemId).sort()).toEqual([b.id, c.id].sort());
    expect(issues.find((i) => i.itemId === c.id)?.message).toContain("「長い範囲」と「E」");
  });

  it("accepts ranges that only touch", () => {
    const a = createEmptyItem({ start: 0, end: 2, unit: "grapheme" });
    const b = createEmptyItem({ start: 2, end: 4, unit: "grapheme" });
    expect(checkItemRanges("ABCD", [a, b])).toEqual([]);
  });
});
