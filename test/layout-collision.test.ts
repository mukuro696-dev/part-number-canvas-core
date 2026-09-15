import { describe, expect, it } from "vitest";
import { checkLayoutIssues } from "../src/lib/layout/checks";
import { computeLayout } from "../src/lib/layout/computeLayout";
import { createEmptyItem } from "../src/lib/document";
import type { DiagramLayout, PlacedItemLayout } from "../src/lib/layout/computeLayout";
import type { Point } from "../src/lib/layout/geometry";

function fakeLayout(placed: PlacedItemLayout[], overrides: Partial<DiagramLayout> = {}): DiagramLayout {
  return {
    svgWidth: 1600,
    height: 400,
    codeRowY: 200,
    graphemes: ["A", "B", "C"],
    charX: (i) => 60 + i * 38,
    placed,
    footnotes: [],
    footnotesRuleY: null,
    ...overrides,
  };
}

/** Builds a placed item whose leader is exactly the given polyline (2+ points), for testing checkLayoutIssues in isolation from computeLayout's own placement heuristics. */
function placedAt(id: string, points: Point[], bbox = { x: 0, y: 0, width: 10, height: 10 }): PlacedItemLayout {
  const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
  item.id = id;
  const first = points[0];
  return {
    item,
    band: "left",
    underline: { a: first, b: first },
    leader: { points },
    label: { anchor: "start", x: bbox.x, headingLines: ["h"], bodyLines: [], bbox },
  };
}

describe("computeLayout column assignment ('auto' side)", () => {
  it("groups an item left of the code's center into the left column, and one to the right into the right column", () => {
    const left = createEmptyItem({ start: 0, end: 2, unit: "grapheme" }, "auto");
    left.heading = "left-ish";
    const right = createEmptyItem({ start: 8, end: 10, unit: "grapheme" }, "auto");
    right.heading = "right-ish";

    const layout = computeLayout("ABCDEFGHIJ", [left, right], 1600);
    const bandOf = (id: string) => layout.placed.find((p) => p.item.id === id)?.band;
    expect(bandOf(left.id)).toBe("left");
    expect(bandOf(right.id)).toBe("right");
  });

  it("places every item's label below the code row", () => {
    const item = createEmptyItem({ start: 0, end: 2, unit: "grapheme" }, "auto");
    item.heading = "test";
    const layout = computeLayout("ABCDEFGHIJ", [item], 1600);
    const placed = layout.placed[0];
    expect(placed.label.bbox.y).toBeGreaterThan(layout.codeRowY);
    expect(placed.underline.a.y).toBeGreaterThan(layout.codeRowY);
  });

  it("does not cross same-band leader lines when each item's own label fits before its own digit position", () => {
    // Short, widely-spaced items: each label is far narrower than the gap
    // to its own digit, so the "shallower items stay left of deeper ones'
    // vertical run" invariant holds and no crossing is possible.
    const items = [
      [0, 1],
      [9, 10],
      [18, 19],
    ].map(([start, end]) => {
      const item = createEmptyItem({ start, end, unit: "grapheme" }, "auto");
      item.heading = `h${start}`;
      return item;
    });
    const layout = computeLayout("ABCDEFGHIJKLMNOPQRST", items, 1600);
    expect(checkLayoutIssues(layout).filter((i) => i.code === "leader-crossing")).toEqual([]);
  });

  it("flags a crossing when an early (shallow) item's label is wide enough to reach past a later item's own digit position", () => {
    // This is the layout tool's known, accepted limit (mirrors the
    // reference tool's own "作業者が手で直す" philosophy): the shared
    // left margin can't always keep every pair non-crossing when label
    // widths are independent of the gaps between digit positions.
    const items = [
      [0, 2],
      [2, 4],
      [4, 5],
    ].map(([start, end]) => {
      const item = createEmptyItem({ start, end, unit: "grapheme" }, "auto");
      item.heading = `h${start}`;
      item.options = [{ code: `c${start}`, description: `option ${start}`, noteRefs: [] }];
      return item;
    });
    const layout = computeLayout("ABCDEFGHIJKLMNOPQRST", items, 1600);
    expect(checkLayoutIssues(layout).some((i) => i.code === "leader-crossing")).toBe(true);
  });
});

describe("checkLayoutIssues", () => {
  it("reports no issues for a well-separated, in-bounds layout", () => {
    const layout = computeLayout(
      "ABX-120-RN",
      [
        (() => {
          const i = createEmptyItem({ start: 4, end: 7, unit: "grapheme" }, "left");
          i.heading = "サイズ";
          i.options = [{ code: "120", description: "直径120 mm", noteRefs: [] }];
          return i;
        })(),
        (() => {
          const i = createEmptyItem({ start: 8, end: 10, unit: "grapheme" }, "right");
          i.heading = "本体色";
          i.options = [{ code: "RN", description: "レッド", noteRefs: [] }];
          return i;
        })(),
      ],
      1600,
    );
    expect(checkLayoutIssues(layout)).toEqual([]);
  });

  it("flags part-number text that overflows a too-narrow canvas", () => {
    const longCode = "A".repeat(50);
    const layout = computeLayout(longCode, [], 200);
    const issues = checkLayoutIssues(layout);
    expect(issues.some((i) => i.code === "out-of-bounds")).toBe(true);
  });

  it("flags two leader lines that cross", () => {
    const a = placedAt("item-a", [{ x: 100, y: 200 }, { x: 400, y: 50 }]);
    const b = placedAt("item-b", [{ x: 400, y: 200 }, { x: 100, y: 50 }]);
    const layout = fakeLayout([a, b]);
    const issues = checkLayoutIssues(layout);
    expect(issues.some((i) => i.code === "leader-crossing")).toBe(true);
  });

  it("does not flag leader lines that share their anchor on the code row", () => {
    const a = placedAt("item-a", [{ x: 200, y: 200 }, { x: 100, y: 50 }]);
    const b = placedAt("item-b", [{ x: 200, y: 200 }, { x: 300, y: 60 }]);
    const layout = fakeLayout([a, b]);
    expect(checkLayoutIssues(layout).some((i) => i.code === "leader-crossing")).toBe(false);
  });

  it("does not flag a well-formed elbow (bend point) as a false crossing with its neighbor", () => {
    // above-band style elbow: down from the digit, then across to the label's right edge
    const a = placedAt("item-a", [{ x: 120, y: 200 }, { x: 120, y: 100 }, { x: 60, y: 100 }]);
    const b = placedAt("item-b", [{ x: 250, y: 200 }, { x: 250, y: 60 }, { x: 60, y: 60 }]);
    const layout = fakeLayout([a, b]);
    expect(checkLayoutIssues(layout).some((i) => i.code === "leader-crossing")).toBe(false);
  });

  it("flags a leader line that pierces another item's label", () => {
    const piercingLeader = placedAt(
      "item-piercer",
      [{ x: 0, y: 100 }, { x: 200, y: 100 }],
      { x: 400, y: 400, width: 10, height: 10 },
    );
    const targetLabel = placedAt(
      "item-target",
      [{ x: 500, y: 500 }, { x: 600, y: 600 }],
      { x: 90, y: 90, width: 20, height: 20 },
    );
    const layout = fakeLayout([piercingLeader, targetLabel]);
    const issues = checkLayoutIssues(layout);
    expect(issues.some((i) => i.code === "leader-pierces-label" && i.itemIds.includes("item-target"))).toBe(true);
  });

  it("flags a label bbox that falls outside the canvas", () => {
    const outOfBounds = placedAt(
      "item-oob",
      [{ x: 100, y: 100 }, { x: 100, y: -50 }],
      { x: 100, y: -50, width: 40, height: 20 },
    );
    const layout = fakeLayout([outOfBounds]);
    const issues = checkLayoutIssues(layout);
    expect(issues.some((i) => i.code === "out-of-bounds" && i.itemIds.includes("item-oob"))).toBe(true);
  });
});
