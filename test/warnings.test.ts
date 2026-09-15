import { describe, expect, it } from "vitest";
import { checkWarnings } from "../src/lib/warnings";
import { computeLayout } from "../src/lib/layout/computeLayout";
import { createEmptyItem } from "../src/lib/document";

describe("checkWarnings", () => {
  it("returns no warnings for a well-formed, balanced document", () => {
    const items = [
      (() => {
        const i = createEmptyItem({ start: 0, end: 3, unit: "grapheme" }, "left");
        i.heading = "シリーズ";
        i.options = [{ code: "ABX", description: "シリーズX", noteRefs: [] }];
        return i;
      })(),
      (() => {
        const i = createEmptyItem({ start: 8, end: 10, unit: "grapheme" }, "right");
        i.heading = "本体色";
        i.options = [{ code: "RN", description: "レッド", noteRefs: [] }];
        return i;
      })(),
    ];
    const layout = computeLayout("ABX-120-RN", items, 1600);
    expect(checkWarnings("ABX-120-RN", items, layout)).toEqual([]);
  });

  it("flags an empty heading", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    const layout = computeLayout("A", [item], 1600);
    const warnings = checkWarnings("A", [item], layout);
    expect(warnings.some((w) => w.code === "empty-heading" && w.itemId === item.id)).toBe(true);
  });

  it("flags an empty option code and empty description separately", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "", description: "", noteRefs: [] }];
    const layout = computeLayout("A", [item], 1600);
    const warnings = checkWarnings("A", [item], layout);
    expect(warnings.some((w) => w.code === "empty-option-code")).toBe(true);
    expect(warnings.some((w) => w.code === "empty-option-description")).toBe(true);
  });

  it("flags duplicate headings across items", () => {
    const a = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    a.heading = "サイズ";
    const b = createEmptyItem({ start: 2, end: 3, unit: "grapheme" });
    b.heading = "サイズ";
    const layout = computeLayout("ABCD", [a, b], 1600);
    const warnings = checkWarnings("ABCD", [a, b], layout);
    expect(warnings.some((w) => w.code === "duplicate-heading")).toBe(true);
  });

  it("does not flag two different empty-string headings as duplicates of each other", () => {
    const a = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    const b = createEmptyItem({ start: 2, end: 3, unit: "grapheme" });
    const layout = computeLayout("ABCD", [a, b], 1600);
    const warnings = checkWarnings("ABCD", [a, b], layout);
    expect(warnings.some((w) => w.code === "duplicate-heading")).toBe(false);
  });

  it("flags full-width alphanumeric characters in the code", () => {
    const layout = computeLayout("ＡＢＸ-120-RN", [], 1600);
    const warnings = checkWarnings("ＡＢＸ-120-RN", [], layout);
    expect(warnings.some((w) => w.code === "fullwidth-alnum")).toBe(true);
  });

  it("does not flag an all-ASCII code", () => {
    const layout = computeLayout("ABX-120-RN", [], 1600);
    const warnings = checkWarnings("ABX-120-RN", [], layout);
    expect(warnings.some((w) => w.code === "fullwidth-alnum")).toBe(false);
  });

  it("flags heavy wrapping when a label spans many lines", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "とても長い見出しテキストで折り返しが複数行になることを狙っています";
    item.options = [{ code: "X", description: "さらに長い説明文をここに追加して折返し行数を増やすためのテスト文字列です", noteRefs: [] }];
    const layout = computeLayout("A", [item], 1600);
    const warnings = checkWarnings("A", [item], layout);
    expect(warnings.some((w) => w.code === "heavy-wrap" && w.itemId === item.id)).toBe(true);
  });

  it("flags a one-sided layout once there are enough items", () => {
    const items = [0, 1, 2, 3].map((i) => {
      const item = createEmptyItem({ start: i, end: i + 1, unit: "grapheme" }, "left");
      item.heading = `h${i}`;
      return item;
    });
    const layout = computeLayout("ABCDEFGHIJ", items, 1600);
    const warnings = checkWarnings("ABCDEFGHIJ", items, layout);
    expect(warnings.some((w) => w.code === "one-sided")).toBe(true);
  });

  it("does not flag a small number of same-side items as one-sided", () => {
    const items = [0, 1].map((i) => {
      const item = createEmptyItem({ start: i, end: i + 1, unit: "grapheme" }, "left");
      item.heading = `h${i}`;
      return item;
    });
    const layout = computeLayout("ABCDEFGHIJ", items, 1600);
    const warnings = checkWarnings("ABCDEFGHIJ", items, layout);
    expect(warnings.some((w) => w.code === "one-sided")).toBe(false);
  });
});
