import { describe, expect, it } from "vitest";
import { graphemeLength, toGraphemes, toHalfWidthAlnum } from "../src/lib/graphemes";

describe("graphemes", () => {
  it("counts ASCII part numbers by character", () => {
    expect(graphemeLength("ABX-120-RN")).toBe(10);
  });

  it("counts a combining-mark sequence as one grapheme cluster", () => {
    const eAcute = "é"; // "e" + combining acute accent
    expect(graphemeLength(eAcute)).toBe(1);
    expect(graphemeLength(eAcute)).not.toBe(eAcute.length);
  });

  it("splits into the same number of segments as its length", () => {
    const segments = toGraphemes("ABX-120-RN");
    expect(segments.join("")).toBe("ABX-120-RN");
    expect(segments.length).toBe(10);
  });
});

describe("toHalfWidthAlnum", () => {
  it("converts full-width letters and digits to half-width", () => {
    expect(toHalfWidthAlnum("ＡＢ１２")).toBe("AB12");
  });

  it("leaves already-half-width text unchanged", () => {
    expect(toHalfWidthAlnum("ABX-120-RN")).toBe("ABX-120-RN");
  });

  it("leaves full-width punctuation alone (not just alphanumerics)", () => {
    expect(toHalfWidthAlnum("ＤＣ１２〜２４Ｖ")).toBe("DC12〜24V");
  });

  it("never changes the string length", () => {
    const input = "ＡB３-ｃ";
    expect(toHalfWidthAlnum(input).length).toBe(input.length);
  });
});
