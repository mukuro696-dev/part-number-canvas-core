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
    const layout = computeLayout("ABX-120-RN", items, 2400);
    expect(checkWarnings("ABX-120-RN", items, layout)).toEqual([]);
  });

  it("flags an empty heading", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    const layout = computeLayout("A", [item], 2400);
    const warnings = checkWarnings("A", [item], layout);
    expect(warnings.some((w) => w.code === "empty-heading" && w.itemId === item.id)).toBe(true);
  });

  it("flags an empty option code and empty description separately", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "", description: "", noteRefs: [] }];
    const layout = computeLayout("A", [item], 2400);
    const warnings = checkWarnings("A", [item], layout);
    expect(warnings.some((w) => w.code === "empty-option-code")).toBe(true);
    expect(warnings.some((w) => w.code === "empty-option-description")).toBe(true);
  });

  it("flags duplicate headings across items", () => {
    const a = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    a.heading = "サイズ";
    const b = createEmptyItem({ start: 2, end: 3, unit: "grapheme" });
    b.heading = "サイズ";
    const layout = computeLayout("ABCD", [a, b], 2400);
    const warnings = checkWarnings("ABCD", [a, b], layout);
    expect(warnings.some((w) => w.code === "duplicate-heading")).toBe(true);
  });

  it("does not flag two different empty-string headings as duplicates of each other", () => {
    const a = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    const b = createEmptyItem({ start: 2, end: 3, unit: "grapheme" });
    const layout = computeLayout("ABCD", [a, b], 2400);
    const warnings = checkWarnings("ABCD", [a, b], layout);
    expect(warnings.some((w) => w.code === "duplicate-heading")).toBe(false);
  });

  it("flags full-width alphanumeric characters in the code", () => {
    const layout = computeLayout("ＡＢＸ-120-RN", [], 2400);
    const warnings = checkWarnings("ＡＢＸ-120-RN", [], layout);
    expect(warnings.some((w) => w.code === "fullwidth-alnum")).toBe(true);
  });

  it("does not flag an all-ASCII code", () => {
    const layout = computeLayout("ABX-120-RN", [], 2400);
    const warnings = checkWarnings("ABX-120-RN", [], layout);
    expect(warnings.some((w) => w.code === "fullwidth-alnum")).toBe(false);
  });

  it("flags heavy wrapping when a label spans many lines", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "とても長い見出しテキストで折り返しが複数行になることを狙っています";
    item.options = [{ code: "X", description: "さらに長い説明文をここに追加して折返し行数を増やすためのテスト文字列です", noteRefs: [] }];
    const layout = computeLayout("A", [item], 480);
    const warnings = checkWarnings("A", [item], layout);
    expect(warnings.some((w) => w.code === "heavy-wrap" && w.itemId === item.id)).toBe(true);
  });

  it("flags a one-sided layout once there are enough items", () => {
    const items = [0, 1, 2, 3].map((i) => {
      const item = createEmptyItem({ start: i, end: i + 1, unit: "grapheme" }, "left");
      item.heading = `h${i}`;
      return item;
    });
    const layout = computeLayout("ABCDEFGHIJ", items, 2400);
    const warnings = checkWarnings("ABCDEFGHIJ", items, layout);
    expect(warnings.some((w) => w.code === "one-sided")).toBe(true);
  });

  it("does not flag a small number of same-side items as one-sided", () => {
    const items = [0, 1].map((i) => {
      const item = createEmptyItem({ start: i, end: i + 1, unit: "grapheme" }, "left");
      item.heading = `h${i}`;
      return item;
    });
    const layout = computeLayout("ABCDEFGHIJ", items, 2400);
    const warnings = checkWarnings("ABCDEFGHIJ", items, layout);
    expect(warnings.some((w) => w.code === "one-sided")).toBe(false);
  });

  it("flags an item whose column is narrower than its shortest unbreakable content", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" }, "left");
    item.heading = "h";
    item.options = [{ code: "X", description: "Supercalifragilisticexpialidocious-unbreakable-token", noteRefs: [] }];
    const layout = computeLayout("AB", [item], 600);
    const warnings = checkWarnings("AB", [item], layout);
    expect(warnings.some((w) => w.code === "width-shortfall" && w.itemId === item.id)).toBe(true);
  });
});

describe("checkWarnings: kinds and part-number characters", () => {
  it("marks unwritten fields as todo and style issues as notice", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    const layout = computeLayout("ＡB", [item], 2400);
    const warnings = checkWarnings("ＡB", [item], layout);
    expect(warnings.find((w) => w.code === "empty-heading")?.kind).toBe("todo");
    expect(warnings.find((w) => w.code === "fullwidth-alnum")?.kind).toBe("notice");
  });

  it("warns about characters the Latin-only part-number fonts lack, without doubling up on full-width alphanumerics", () => {
    const only = (code: string) => checkWarnings(code, [], computeLayout(code, [], 2400)).map((w) => w.code);
    expect(only("ＡＢ-12")).toEqual(["fullwidth-alnum"]);
    expect(only("AB-型式")).toEqual(["non-ascii-code"]);
    expect(only("AB-12 /x")).toEqual([]);
  });
});

describe("checkWarnings: empty note text", () => {
  it("lists a note with no text as something not yet written, using its drawing number", () => {
    const note = { id: "n1", text: "  " };
    const layout = computeLayout("AB", [], 2400, [note]);
    const warning = checkWarnings("AB", [], layout, [note]).find((w) => w.code === "empty-note-text");
    expect(warning).toMatchObject({ kind: "todo", number: 1 });
  });
});

describe("checkWarnings: references written in the text", () => {
  it("does not call a note unreferenced when the text refers to it but noteRefs lags behind", () => {
    const note = { id: "n", text: "注記本文" };
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "h";
    item.options = [{ code: "X", description: "説明{{note:n}}", noteRefs: [] }];
    const layout = computeLayout("AB", [item], 2400, [note]);
    expect(checkWarnings("AB", [item], layout, [note]).some((w) => w.code === "unreferenced-note")).toBe(false);
  });
});

describe("checkWarnings: characters the diagram cannot carry", () => {
  it("notices control characters pasted into any text", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "見出し\u0008";
    const layout = computeLayout("AB", [item], 2400);
    expect(checkWarnings("AB", [item], layout).find((w) => w.code === "invalid-characters")?.kind).toBe("notice");
    const clean = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    clean.heading = "見出し";
    expect(checkWarnings("AB", [clean], computeLayout("AB", [clean], 2400)).some((w) => w.code === "invalid-characters")).toBe(false);
  });
});

describe("checkWarnings: characters the font has no glyph for", () => {
  /**
   * The engine is told what the fonts can draw; it never decides that itself,
   * because which fonts an application bundles is that application's business.
   * These use a stand-in that can draw ASCII and kana and nothing else.
   */
  const asciiAndKana = (char: string) => /[\x20-\x7e぀-ヿ]/.test(char);
  const itemWith = (heading: string, description = "せつめい") => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = heading;
    item.options = [{ code: "A", description, noteRefs: [] }];
    return item;
  };
  const check = (code: string, item: ReturnType<typeof itemWith>, notes: { id: string; text: string }[] = []) =>
    checkWarnings(code, [item], computeLayout(code, [item], 2400), notes, { isDrawable: asciiAndKana });

  it("says nothing while every character can be drawn", () => {
    expect(check("AB-1", itemWith("しりーず")).some((w) => w.code === "undrawable-characters")).toBe(false);
  });

  it("names the characters that would be missing, as something to look at rather than an error", () => {
    const warning = check("AB-1", itemWith("見出し")).find((w) => w.code === "undrawable-characters");
    expect(warning?.kind).toBe("notice");
    // the finding carries the characters; the sentence about them is the caller's
    expect(warning?.missing).toContain("見");
    expect(warning?.missing).toContain("出");
  });

  it("looks at the part number, the options and the notes too", () => {
    const fromCode = check("亜-1", itemWith("しりーず")).find((w) => w.code === "undrawable-characters");
    expect(fromCode?.missing).toContain("亜");

    const fromDescription = check("AB-1", itemWith("しりーず", "説")).find((w) => w.code === "undrawable-characters");
    expect(fromDescription?.missing).toContain("説");

    const fromNote = check("AB-1", itemWith("しりーず"), [{ id: "n1", text: "注" }]).find(
      (w) => w.code === "undrawable-characters",
    );
    expect(fromNote?.missing).toContain("注");
  });

  it("lists each character once however often it appears", () => {
    const many = itemWith("亜唖娃阿哀愛挨姶逢葵茜");
    const warning = check("AB-1", many).find((w) => w.code === "undrawable-characters");
    // all of them: trimming the list for display is the caller's decision
    expect(warning?.missing).toHaveLength(11);

    const repeated = itemWith("亜亜亜");
    const once = check("AB-1", repeated).find((w) => w.code === "undrawable-characters");
    expect(once?.missing.filter((c) => c === "亜")).toHaveLength(1);
  });

  it("is not raised at all when the caller says nothing about the fonts", () => {
    const item = itemWith("見出し");
    const warnings = checkWarnings("AB-1", [item], computeLayout("AB-1", [item], 2400));
    expect(warnings.some((w) => w.code === "undrawable-characters")).toBe(false);
  });

  it("keeps the older guess about non-ASCII part numbers for callers that know nothing, and drops it for those that do", () => {
    const item = itemWith("しりーず");
    const layout = computeLayout("亜-1", [item], 2400);
    expect(checkWarnings("亜-1", [item], layout).map((w) => w.code)).toContain("non-ascii-code");
    expect(checkWarnings("亜-1", [item], layout, [], { isDrawable: asciiAndKana }).map((w) => w.code)).not.toContain(
      "non-ascii-code",
    );
  });
});
