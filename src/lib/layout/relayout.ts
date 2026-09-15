import type { PartNumberItem, PartNumberNote, Side } from "../schema/types";
import { checkLayoutIssues } from "./checks";
import { approxMeasure, computeLayout, type MeasureText } from "./computeLayout";

/** 2^12 layouts is the most a button press should cost. */
export const RELAYOUT_MAX_ITEMS = 12;
const YIELD_EVERY = 256;

export type RelayoutResult =
  | { status: "already-fine" }
  | { status: "too-many"; count: number }
  | { status: "solved" | "improved"; items: PartNumberItem[]; moved: number }
  | { status: "no-better" };

type Score = [broken: number, shortfalls: number];

const better = (a: Score, b: Score) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/**
 * 「置き場所を組み直す」: starting from the sides items are drawn on
 * now, tries flipping as few items as possible, and keeps the
 * first arrangement where nothing breaks — or, failing that, the best one
 * found if it beats the current drawing. Runs only when asked; never
 * reorders anything on its own.
 *
 * Items the user left on "auto" go back to "auto" when they land where
 * automatic placement would put them anyway; a side the user chose is
 * only replaced when the search actually moves that item.
 */
export async function relayoutSides(
  code: string,
  items: PartNumberItem[],
  svgWidth: number,
  notes: PartNumberNote[],
  measure: MeasureText = approxMeasure,
  yieldToUi: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
): Promise<RelayoutResult> {
  const scoreOf = (candidate: PartNumberItem[]): Score => {
    const layout = computeLayout(code, candidate, svgWidth, notes, measure);
    return [checkLayoutIssues(layout).length, layout.shortfalls.length];
  };
  const bandsOf = (candidate: PartNumberItem[]) =>
    new Map(computeLayout(code, candidate, svgWidth, notes, measure).placed.map((p) => [p.item.id, p.band]));

  const current = scoreOf(items);
  if (current[0] === 0 && current[1] === 0) return { status: "already-fine" };
  if (items.length > RELAYOUT_MAX_ITEMS) return { status: "too-many", count: items.length };

  const natural = bandsOf(items.map((item) => ({ ...item, side: "auto" as Side })));
  const currentBands = bandsOf(items);
  const flip = (side: "left" | "right"): "left" | "right" => (side === "left" ? "right" : "left");

  const masks = Array.from({ length: 1 << items.length }, (_, mask) => mask);
  const flips = (mask: number) => {
    let count = 0;
    for (let m = mask; m; m &= m - 1) count++;
    return count;
  };
  masks.sort((a, b) => flips(a) - flips(b) || a - b);

  let best: { score: Score; items: PartNumberItem[] } | null = null;
  for (let i = 0; i < masks.length; i++) {
    if (i > 0 && i % YIELD_EVERY === 0) await yieldToUi();
    const mask = masks[i];
    const candidate = items.map((item, k) => {
      const currentSide = currentBands.get(item.id)!;
      const want = (mask >> k) & 1 ? flip(currentSide) : currentSide;
      return { ...item, side: want as Side };
    });
    const score = scoreOf(candidate);
    if (score[0] === 0 && score[1] === 0) {
      best = { score, items: candidate };
      break;
    }
    if (better(score, best?.score ?? current)) best = { score, items: candidate };
  }
  if (!best) return { status: "no-better" };

  const chosen = best.items.map((item, k) => {
    const original = items[k];
    const naturalSide = natural.get(item.id)!;
    if (original.side === "auto" && item.side === naturalSide) return { ...item, side: "auto" as Side };
    if (original.side === item.side) return { ...item, side: original.side };
    return item;
  });
  const chosenBands = bandsOf(chosen);
  const moved = chosen.filter((item) => chosenBands.get(item.id) !== currentBands.get(item.id)).length;
  const solved = best.score[0] === 0 && best.score[1] === 0;
  return { status: solved ? "solved" : "improved", items: chosen, moved };
}
