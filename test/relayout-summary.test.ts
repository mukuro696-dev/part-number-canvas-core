import { describe, expect, it } from "vitest";
import { createEmptyItem } from "../src/lib/document";
import { checkLayoutIssues } from "../src/lib/layout/checks";
import { computeLayout } from "../src/lib/layout/computeLayout";
import { RELAYOUT_MAX_ITEMS, relayoutSides } from "../src/lib/layout/relayout";
import { buildTextSummary } from "../src/lib/summary";
import type { PartNumberNote } from "../src/lib/schema/types";

const noYield = () => Promise.resolve();

describe("relayoutSides", () => {
  it("reports nothing to do when the drawing already works", async () => {
    const a = createEmptyItem({ start: 0, end: 2, unit: "grapheme" });
    a.heading = "左";
    const b = createEmptyItem({ start: 3, end: 5, unit: "grapheme" });
    b.heading = "右";
    expect(await relayoutSides("AB-CD", [a, b], 2400, [], undefined, noYield)).toEqual({ status: "already-fine" });
  });

  it("takes a better arrangement even when nothing fixes the drawing completely", async () => {
    // the same range twice: the leaders coincide on either side, but splitting the pair crosses fewer lines
    const a = createEmptyItem({ start: 1, end: 3, unit: "grapheme" }, "left");
    a.heading = "L";
    const b = createEmptyItem({ start: 1, end: 3, unit: "grapheme" }, "left");
    b.heading = "R";
    const before = computeLayout("ABCD", [a, b], 2400);
    expect(checkLayoutIssues(before).length).toBeGreaterThan(0);
    const result = await relayoutSides("ABCD", [a, b], 2400, [], undefined, noYield);
    expect(result.status).toBe("improved");
    if (result.status === "improved") {
      expect(result.moved).toBe(1);
      expect(checkLayoutIssues(computeLayout("ABCD", result.items, 2400)).length).toBeLessThan(checkLayoutIssues(before).length);
    }
  });

  it("keeps a side the user chose when the search leaves that item where it was", async () => {
    // a long code leaves little room on the left; the wide heading only fits on the right
    const wide = createEmptyItem({ start: 0, end: 1, unit: "grapheme" }, "auto");
    wide.heading = "W".repeat(40);
    const fixed = createEmptyItem({ start: 38, end: 40, unit: "grapheme" }, "right");
    fixed.heading = "右";
    const result = await relayoutSides("A".repeat(40), [wide, fixed], 2400, [], undefined, noYield);
    expect(result.status === "solved" || result.status === "improved").toBe(true);
    if (result.status === "solved" || result.status === "improved") {
      expect(result.items.find((i) => i.id === fixed.id)?.side).toBe("right");
      expect(result.items.find((i) => i.id === wide.id)?.side).toBe("right");
      expect(result.moved).toBe(1);
    }
  });

  it("refuses to search more than the item limit", async () => {
    // every item on the same range and side: the leaders coincide, so the drawing is broken
    const items = Array.from({ length: RELAYOUT_MAX_ITEMS + 1 }, (_, i) => {
      const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" }, "left");
      item.heading = `h${i}`;
      return item;
    });
    const code = "A".repeat(RELAYOUT_MAX_ITEMS + 1);
    expect(await relayoutSides(code, items, 2400, [], undefined, noYield)).toEqual({ status: "too-many", count: RELAYOUT_MAX_ITEMS + 1 });
  });
});

describe("buildTextSummary", () => {
  it("lists code, items in reading order, and note texts in drawing number order without markers", () => {
    const n1: PartNumberNote = { id: "n1", text: "後で作った注記" };
    const n0: PartNumberNote = { id: "n0", text: "先に作った注記" };
    const left = createEmptyItem({ start: 0, end: 2, unit: "grapheme" }, "left");
    left.heading = "シリーズ";
    left.options = [
      { code: "ZQ", description: "架空シリーズ", noteRefs: [n1.id] },
      { code: "ZR", description: "", noteRefs: [] },
    ];
    const right = createEmptyItem({ start: 3, end: 5, unit: "grapheme" }, "right");
    right.heading = "";
    right.options = [{ code: "BK", description: "ブラック", noteRefs: [n0.id] }];
    const layout = computeLayout("ZQ-BK", [right, left], 2400, [n0, n1]);
    expect(buildTextSummary("ZQ-BK", layout, [n0, n1])).toBe(
      "ZQ-BK｜シリーズ：ZQ = 架空シリーズ、ZR｜BK = ブラック｜※1 後で作った注記｜※2 先に作った注記",
    );
  });
});
