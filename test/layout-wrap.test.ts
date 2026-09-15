import { describe, expect, it } from "vitest";
import { wrapText } from "../src/lib/layout/wrap";
import { toGraphemes } from "../src/lib/graphemes";

describe("wrapText", () => {
  it("returns a single line when the text already fits", () => {
    expect(wrapText("直径120 mm", 20)).toEqual(["直径120 mm"]);
  });

  it("returns an empty array for empty/whitespace-only input", () => {
    expect(wrapText("", 10)).toEqual([]);
    expect(wrapText("   ", 10)).toEqual([]);
  });

  it("breaks on whitespace when a line would otherwise overflow", () => {
    const lines = wrapText("stainless steel large size clamp", 12);
    for (const line of lines) {
      expect(toGraphemes(line).length).toBeLessThanOrEqual(12);
    }
    expect(lines.join(" ")).toBe("stainless steel large size clamp");
  });

  it("hard-breaks a run with no spaces (e.g. Japanese) without splitting a grapheme cluster", () => {
    const text = "サイズ寸法は架空の公差表記であり実在製品の仕様ではない";
    const lines = wrapText(text, 8);
    expect(lines.join("")).toBe(text);
    for (const line of lines) {
      expect(toGraphemes(line).length).toBeLessThanOrEqual(8);
    }
  });

  it("never splits a combining-mark grapheme cluster across lines", () => {
    const eAcute = "é";
    const text = `${eAcute.repeat(5)}`;
    const lines = wrapText(text, 3);
    for (const line of lines) {
      const graphemes = toGraphemes(line);
      expect(graphemes.every((g) => g === eAcute)).toBe(true);
    }
    expect(lines.join("")).toBe(text);
  });

  it("throws for a non-positive maxCharsPerLine", () => {
    expect(() => wrapText("abc", 0)).toThrow();
  });
});
