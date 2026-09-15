import { describe, expect, it } from "vitest";
import { graphemeLength, toGraphemes } from "../src/lib/graphemes";

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
