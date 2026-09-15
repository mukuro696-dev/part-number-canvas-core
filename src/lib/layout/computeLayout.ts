import type { PartNumberItem, PartNumberNote } from "../schema/types";
import { toGraphemes } from "../graphemes";
import { wrapText } from "./wrap";
import type { Point, Rect } from "./geometry";

export const LAYOUT = {
  marginX: 60,
  charWidth: 38,
  fontSize: 44,
  codeRowTopPadding: 20,
  underlineGap: 14,
  underlineTrim: 4,
  labelGap: 16,
  bottomPadding: 24,
  headingFontSize: 18,
  headingLineHeight: 22,
  headingCharWidth: 11,
  bodyFontSize: 15,
  bodyLineHeight: 18,
  bodyCharWidth: 9,
  labelMaxWidth: 260,
  /** fixed offset between a right-column item's own leader and where its label text starts */
  rightLabelOffset: 16,
  /** gap between the item stacks and the footnotes block's divider line */
  footnoteTopPadding: 24,
  /** gap between the divider line and the first footnote's text */
  footnoteRuleGap: 16,
  /** gap between consecutive footnote entries */
  footnoteGap: 6,
} as const;

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPT_DIGITS[d] ?? d)
    .join("");
}

export interface LabelLayout {
  anchor: "start";
  x: number;
  headingLines: string[];
  bodyLines: string[];
  bbox: Rect;
}

export interface PlacedItemLayout {
  item: PartNumberItem;
  /** which of the two columns below the code row this item's label stacks into */
  band: "left" | "right";
  underline: { a: Point; b: Point };
  /** a single-bend leader: code row -> bend -> label edge (never more than one bend) */
  leader: { points: Point[] };
  label: LabelLayout;
}

export interface FootnoteLayout {
  number: number;
  lines: string[];
  /** top of this footnote's text block */
  y: number;
}

export interface DiagramLayout {
  svgWidth: number;
  height: number;
  codeRowY: number;
  graphemes: string[];
  charX: (index: number) => number;
  placed: PlacedItemLayout[];
  footnotes: FootnoteLayout[];
  /** y of the divider line above the footnotes block; null when there are no notes */
  footnotesRuleY: number | null;
}

/**
 * A superscript marker (¹, ², ...) appended to an option's body text for
 * each note it references, so the reference is visible directly in the
 * diagram output rather than only in the editor.
 */
function labelBodyText(item: PartNumberItem, noteNumberById: Map<string, number>): string {
  const opt = item.options[0];
  if (!opt) return "";
  const base = [opt.code, opt.description].filter(Boolean).join(" — ");
  const numbers = opt.noteRefs
    .map((ref) => noteNumberById.get(ref))
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);
  if (numbers.length === 0) return base;
  const marker = numbers.map(toSuperscript).join(",");
  return base ? `${base}${marker}` : marker;
}

function computeLabelMetrics(item: PartNumberItem, noteNumberById: Map<string, number>) {
  const headingMaxChars = Math.max(1, Math.floor(LAYOUT.labelMaxWidth / LAYOUT.headingCharWidth));
  const bodyMaxChars = Math.max(1, Math.floor(LAYOUT.labelMaxWidth / LAYOUT.bodyCharWidth));

  const headingLines = wrapText(item.heading || "(見出し未設定)", headingMaxChars);
  const bodyText = labelBodyText(item, noteNumberById);
  const bodyLines = bodyText ? wrapText(bodyText, bodyMaxChars) : [];

  const headingWidth = Math.max(0, ...headingLines.map((l) => toGraphemes(l).length * LAYOUT.headingCharWidth));
  const bodyWidth = Math.max(0, ...bodyLines.map((l) => toGraphemes(l).length * LAYOUT.bodyCharWidth));
  const width = Math.max(headingWidth, bodyWidth, 1);

  const height =
    headingLines.length * LAYOUT.headingLineHeight +
    (bodyLines.length > 0 ? bodyLines.length * LAYOUT.bodyLineHeight : 0);

  return { headingLines, bodyLines, width, height: Math.max(height, LAYOUT.headingLineHeight) };
}

/**
 * Which column an item's label stacks into — both columns sit below the
 * code row. Split left/right by which side of the code's own center the item's
 * range falls on, rather than alternating by index — this is what keeps
 * same-column leader lines from crossing (items further from the center
 * are stacked closer to the code row; see the monotonic ordering below).
 * "side" lets an item's author override the automatic placement per
 * item (the tool intentionally does not fully automate this — see
 * Phase 1 requirements, left/right/auto).
 */
function resolveColumn(item: PartNumberItem, codeCenterIndex: number): "left" | "right" {
  if (item.side === "left") return "left";
  if (item.side === "right") return "right";
  const itemCenterIndex = (item.range.start + item.range.end) / 2;
  return itemCenterIndex < codeCenterIndex ? "left" : "right";
}

/**
 * Pure layout computation shared by rendering (DiagramSvg) and the
 * pre-save checks (bounds/crossing/piercing). Keeping this side-effect
 * free is what makes the collision checks unit-testable without a DOM.
 */
export function computeLayout(
  code: string,
  items: PartNumberItem[],
  svgWidth: number,
  notes: PartNumberNote[] = [],
): DiagramLayout {
  const graphemes = toGraphemes(code);
  const charX = (index: number) => LAYOUT.marginX + index * LAYOUT.charWidth;
  const centerX = (start: number, end: number) => (charX(start) + charX(end)) / 2;
  const codeCenterIndex = graphemes.length / 2;

  const noteNumberById = new Map(notes.map((note, i) => [note.id, i + 1]));

  const left: PartNumberItem[] = [];
  const right: PartNumberItem[] = [];
  for (const item of items) {
    (resolveColumn(item, codeCenterIndex) === "left" ? left : right).push(item);
  }

  // Left column: aligned to the shared left margin. Items further from
  // the code's center are stacked closer to the code row (shallow rank);
  // items nearer the center stack further down. This keeps each item's
  // vertical drop from ever crossing a shallower item's horizontal run
  // (which stays entirely above it — see checks.ts for the guard).
  left.sort((a, b) => a.range.start - b.range.start);
  // Right column mirrors this from the other side.
  right.sort((a, b) => b.range.start - a.range.start);

  const leftMetrics = left.map((item) => ({ item, metrics: computeLabelMetrics(item, noteNumberById) }));
  const rightMetrics = right.map((item) => ({ item, metrics: computeLabelMetrics(item, noteNumberById) }));

  const leftStackHeight = leftMetrics.reduce((sum, m) => sum + m.metrics.height + LAYOUT.labelGap, 0);
  const rightStackHeight = rightMetrics.reduce((sum, m) => sum + m.metrics.height + LAYOUT.labelGap, 0);

  const codeRowY = LAYOUT.codeRowTopPadding + LAYOUT.fontSize;
  const underlineY = codeRowY + LAYOUT.underlineGap;
  const contentBottom = underlineY + Math.max(leftStackHeight, rightStackHeight);

  const footnotes: FootnoteLayout[] = [];
  let footnotesRuleY: number | null = null;
  let cursorY = contentBottom;
  if (notes.length > 0) {
    footnotesRuleY = cursorY + LAYOUT.footnoteTopPadding;
    cursorY = footnotesRuleY + LAYOUT.footnoteRuleGap;
    const footnoteMaxChars = Math.max(1, Math.floor((svgWidth - LAYOUT.marginX * 2) / LAYOUT.bodyCharWidth));
    notes.forEach((note, i) => {
      const number = i + 1;
      const lines = wrapText(`${number}. ${note.text}`, footnoteMaxChars);
      footnotes.push({ number, lines, y: cursorY });
      cursorY += lines.length * LAYOUT.bodyLineHeight + LAYOUT.footnoteGap;
    });
    cursorY -= LAYOUT.footnoteGap;
  }
  const height = cursorY + LAYOUT.bottomPadding;

  const placed: PlacedItemLayout[] = [];
  const trim = LAYOUT.underlineTrim;

  let leftCursor = 0;
  for (const { item, metrics } of leftMetrics) {
    const { start, end } = item.range;
    const cx = centerX(start, end);
    const labelTopY = underlineY + LAYOUT.labelGap + leftCursor;
    leftCursor += metrics.height + LAYOUT.labelGap;

    // shared left margin, one bend, horizontal run spans the full label width
    const labelX = LAYOUT.marginX;
    const bendY = labelTopY;

    placed.push({
      item,
      band: "left",
      underline: { a: { x: charX(start) + trim, y: underlineY }, b: { x: charX(end) - trim, y: underlineY } },
      leader: {
        points: [
          { x: cx, y: underlineY },
          { x: cx, y: bendY },
          { x: labelX + metrics.width, y: bendY },
        ],
      },
      label: {
        anchor: "start",
        x: labelX,
        headingLines: metrics.headingLines,
        bodyLines: metrics.bodyLines,
        bbox: { x: labelX, y: labelTopY, width: metrics.width, height: metrics.height },
      },
    });
  }

  let rightCursor = 0;
  for (const { item, metrics } of rightMetrics) {
    const { start, end } = item.range;
    const cx = centerX(start, end);
    const labelTopY = underlineY + LAYOUT.labelGap + rightCursor;
    rightCursor += metrics.height + LAYOUT.labelGap;

    // each item starts its own label a fixed offset from its own leader
    // (a "staircase": no shared edge, so labels never need to realign
    // when a neighboring item's code changes width)
    const labelX = cx + LAYOUT.rightLabelOffset;
    const bendY = labelTopY;

    placed.push({
      item,
      band: "right",
      underline: { a: { x: charX(start) + trim, y: underlineY }, b: { x: charX(end) - trim, y: underlineY } },
      leader: {
        points: [
          { x: cx, y: underlineY },
          { x: cx, y: bendY },
          { x: labelX, y: bendY },
        ],
      },
      label: {
        anchor: "start",
        x: labelX,
        headingLines: metrics.headingLines,
        bodyLines: metrics.bodyLines,
        bbox: { x: labelX, y: labelTopY, width: metrics.width, height: metrics.height },
      },
    });
  }

  return { svgWidth, height, codeRowY, graphemes, charX, placed, footnotes, footnotesRuleY };
}
