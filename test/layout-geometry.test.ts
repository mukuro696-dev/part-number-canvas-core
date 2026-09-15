import { describe, expect, it } from "vitest";
import { rectIntersectsSegment, segmentsCrossExcludingSharedEndpoints, segmentsIntersect } from "../src/lib/layout/geometry";

describe("segmentsIntersect", () => {
  it("detects a simple X crossing", () => {
    const s1 = { a: { x: 0, y: 0 }, b: { x: 10, y: 10 } };
    const s2 = { a: { x: 0, y: 10 }, b: { x: 10, y: 0 } };
    expect(segmentsIntersect(s1, s2)).toBe(true);
  });

  it("returns false for parallel non-touching segments", () => {
    const s1 = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } };
    const s2 = { a: { x: 0, y: 5 }, b: { x: 10, y: 5 } };
    expect(segmentsIntersect(s1, s2)).toBe(false);
  });

  it("returns true when segments touch at a shared endpoint", () => {
    const s1 = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } };
    const s2 = { a: { x: 10, y: 0 }, b: { x: 10, y: 10 } };
    expect(segmentsIntersect(s1, s2)).toBe(true);
  });
});

describe("segmentsCrossExcludingSharedEndpoints", () => {
  it("ignores two leader lines that share their anchor on the code row", () => {
    const s1 = { a: { x: 100, y: 200 }, b: { x: 100, y: 100 } };
    const s2 = { a: { x: 100, y: 200 }, b: { x: 300, y: 250 } };
    expect(segmentsCrossExcludingSharedEndpoints(s1, s2)).toBe(false);
  });

  it("flags two leader lines that cross mid-line", () => {
    const s1 = { a: { x: 0, y: 0 }, b: { x: 100, y: 100 } };
    const s2 = { a: { x: 100, y: 0 }, b: { x: 0, y: 100 } };
    expect(segmentsCrossExcludingSharedEndpoints(s1, s2)).toBe(true);
  });
});

describe("rectIntersectsSegment", () => {
  const rect = { x: 10, y: 10, width: 20, height: 20 };

  it("detects a segment passing straight through a rect", () => {
    const seg = { a: { x: 0, y: 20 }, b: { x: 40, y: 20 } };
    expect(rectIntersectsSegment(rect, seg)).toBe(true);
  });

  it("detects a segment endpoint inside the rect", () => {
    const seg = { a: { x: 15, y: 15 }, b: { x: 100, y: 100 } };
    expect(rectIntersectsSegment(rect, seg)).toBe(true);
  });

  it("returns false for a segment nowhere near the rect", () => {
    const seg = { a: { x: 0, y: 0 }, b: { x: 5, y: 0 } };
    expect(rectIntersectsSegment(rect, seg)).toBe(false);
  });
});
