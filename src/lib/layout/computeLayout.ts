import type { PartNumberItem, PartNumberNote } from "../schema/types";
import { toGraphemes } from "../graphemes";
import { itemsWithInlineNotes, noteRefsIn, parseDescription } from "../noteTokens";
import type { Point, Rect } from "./geometry";
import { notationFor, type Notation } from "../notation";

export type TextRole = "code" | "heading" | "body";
/** Width in px of `text` set in the font for `role` at `size`. */
export type MeasureText = (text: string, role: TextRole, size: number) => number;

/** Everything below is a multiple of this 8px grid unit. */
const U = 8;
/** Body size (option code and description); type sizes are fixed ratios of it. */
const BODY = 4 * U;

// Sizes and spacing for a 2400-wide canvas, derived from the grid and the body
// size alone: one type scale, one spacing scale, nothing measured from elsewhere.
export const LAYOUT = {
  /** blank kept at the left and right edges of the canvas; everything between is usable */
  edge: 6 * U,
  /** the part number is the subject of the drawing: 3.5 × body */
  codeSize: 3.5 * BODY,
  /** baseline of the code row */
  codeY: 3.5 * BODY,
  headingSize: 1.125 * BODY,
  optionSize: BODY,
  footnoteSize: 0.8125 * BODY,
  /** code baseline to underline */
  underlineGap: 3 * U,
  underlineInset: U / 2,
  /** underline and leaders share one thin weight */
  underlineStroke: U / 2,
  leaderStroke: U / 2,
  /** heading baseline to its rule */
  headingGap: 2 * U,
  /** baseline-to-baseline between options */
  optionLead: 1.5 * BODY,
  /** baseline-to-baseline inside one wrapped description — tighter, so option boundaries read */
  softLead: 1.25 * BODY,
  gutter: 9 * U,
  tierGap: 8 * U,
  /** room under the code row for leaders to run before the first heading */
  topLow: 12 * U,
  /** a right-column label starts this far from its own vertical leader */
  foldGap: 4 * U,
  supScale: 0.6,
  maxWrapLines: 3,
  /** line height of the footnote list, as a multiple of its size */
  footnoteLineHeight: 1.5,
  footnoteTopPadding: 5 * U,
  footnoteGap: 2 * U,
  bottomPadding: 6 * U,
} as const;

const SEPARATOR = "\u00a0=\u00a0";
const BREAK_AFTER = "・／/、，,";
/** never at the start of a line (行頭禁則) */
const NO_LINE_START = "、。，．,.）)］]｝}」』】〕〉》・：；:;！!？?ー々ゝゞぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ％%";
/** never at the end of a line (行末禁則) */
const NO_LINE_END = "（(［[｛{「『【〔〈《";
const UNIT = /^(V|A|W|Hz|DC|AC|VDC|VAC|mm|cm|m|kg|g|s|ms|°C|Ω|%)$/i;

const isWide = (g: string) => (g.codePointAt(0) ?? 0) >= 0x2e80;

/** Heuristic widths for environments without text measurement (tests, SSR). */
export const approxMeasure: MeasureText = (text, role, size) => {
  let em = 0;
  for (const g of toGraphemes(text)) {
    if (isWide(g)) em += 1;
    else if (g === " " || g === "\u00a0") em += 0.26;
    else em += role === "code" ? 0.5 : 0.56;
  }
  return em * size;
};

/** Keeps "12 - 24 V" from breaking inside the range or before the unit. */
function keepUnits(text: string): string {
  return text
    .replace(/(\d)\s+-\s+(\d)/g, "$1\u00a0-\u00a0$2")
    .split(" ")
    // "24 V、" still keeps the V: trailing punctuation doesn't stop a word from being a unit
    .reduce((acc, word, i) => (i === 0 ? word : acc + (UNIT.test(word.replace(/[、。，．,.)）]+$/, "")) ? "\u00a0" : " ") + word), "");
}

/** A stretch of one description line: plain text, or note marks drawn superscript (e.g. "※1※2"). */
export interface DescRun {
  text: string;
  sup: boolean;
}

export interface OptionLayout {
  codeText: string;
  codeWidth: number;
  /** wrapped description, each line a sequence of runs */
  descLines: DescRun[][];
  /** baseline of the first description line */
  y: number;
}

export interface LabelLayout {
  x: number;
  headingText: string;
  headingY: number;
  codeColumnWidth: number;
  options: OptionLayout[];
  bbox: Rect;
}

export interface PlacedItemLayout {
  item: PartNumberItem;
  band: "left" | "right";
  underline: { a: Point; b: Point };
  /** code row -> down -> across to the label edge; one bend only */
  leader: { points: Point[] };
  /** the rule under the heading, run to the far edge of the content so the line never looks cut */
  rule: { a: Point; b: Point };
  label: LabelLayout;
}

export interface FootnoteLayout {
  number: number;
  lines: string[];
  /** baseline of the first line */
  y: number;
}

export interface WidthShortfall {
  itemId: string;
  available: number;
  required: number;
}

export interface DiagramLayout {
  svgWidth: number;
  height: number;
  codeRowY: number;
  codeX: number;
  graphemes: string[];
  charX: (index: number) => number;
  placed: PlacedItemLayout[];
  footnotes: FootnoteLayout[];
  footnoteX: number;
  /** null when there are no notes */
  footnotesRuleY: number | null;
  footnotesRuleEndX: number;
  shortfalls: WidthShortfall[];
  /** note id -> the number shown in the drawing; the one numbering everything else should use */
  noteNumbers: Map<string, number>;
  /**
   * The punctuation this diagram was drawn with, decided once here from the
   * document's own text. The exporter and the text summary read it back rather
   * than deciding again, so the three cannot disagree about one document.
   */
  notation: Notation;
}

interface Token {
  text: string;
  /** note numbers, drawn and measured superscript */
  marker: boolean;
  /** tokens sharing a non-negative id must stay on one line (units glued by keepUnits, a marker and the character before it) */
  glue: number;
}

function toRuns(tokens: Token[]): DescRun[] {
  const runs: DescRun[] = [];
  for (const t of tokens) {
    const last = runs[runs.length - 1];
    if (last && !last.sup && !t.marker) last.text += t.text;
    else runs.push({ text: t.text, sup: t.marker });
  }
  return runs;
}

function lineWidth(tokens: Token[], size: number, measure: MeasureText): number {
  return toRuns(tokens).reduce((w, run) => w + (run.text ? measure(run.text, "body", run.sup ? size * LAYOUT.supScale : size) : 0), 0);
}

/**
 * Splits into grapheme tokens and glues what must not break: each Latin
 * word or number (a character break inside "24V" or "ABX" reads as a typo)
 * and each run keepUnits joined with no-break spaces. A word may still
 * break after "/" or ",". Glue ids start at `firstId`.
 */
function glueTokens(text: string, firstId: number): { tokens: Token[]; nextId: number } {
  const graphemes = toGraphemes(text);
  const glue = new Array<number>(graphemes.length).fill(-1);
  const starts: number[] = [];
  let offset = 0;
  for (const g of graphemes) {
    starts.push(offset);
    offset += g.length;
  }
  let id = firstId;
  for (const m of text.matchAll(/[^ \/,\u{2e80}-\u{10ffff}]+[\/,]?(?:\u00a0[^ \/,\u{2e80}-\u{10ffff}]+[\/,]?)*/gu)) {
    const from = m.index;
    const to = from + m[0].length;
    starts.forEach((at, i) => {
      if (at >= from && at < to) glue[i] = id;
    });
    id++;
  }
  return { tokens: graphemes.map((g, i) => ({ text: g, marker: false, glue: glue[i] })), nextId: id };
}

/**
 * Tokens for a description with inline note references. Adjacent references
 * become one superscript token ("※1※2", ascending), bound to the character
 * before it so a line never starts with a marker. References to notes that
 * don't exist draw nothing (the blocking check reports them).
 */
function descriptionTokens(description: string, noteNumbers: Map<string, number>, noteMark: string): Token[] {
  const tokens: Token[] = [];
  let nextId = 0;
  let pending: number[] = [];
  /** glues tokens[from..to] (inclusive) into one unit */
  const glueRange = (from: number, to: number) => {
    const existing = tokens.slice(from, to + 1).find((t) => t.glue >= 0)?.glue;
    const id = existing ?? nextId++;
    for (let k = from; k <= to; k++) {
      const old = tokens[k].glue;
      if (old >= 0 && old !== id) for (const t of tokens) if (t.glue === old) t.glue = id;
      tokens[k].glue = id;
    }
  };
  const flush = () => {
    if (pending.length === 0) return;
    const text = [...new Set(pending)].sort((a, b) => a - b).map((n) => `${noteMark}${n}`).join("");
    tokens.push({ text, marker: true, glue: -1 });
    // bind the marker to the last visible character before it, spaces in between included
    let k = tokens.length - 2;
    while (k >= 0 && tokens[k].text.trim() === "") k--;
    if (k >= 0) glueRange(k, tokens.length - 1);
    pending = [];
  };
  for (const segment of parseDescription(description)) {
    if (segment.kind === "note") {
      const n = noteNumbers.get(segment.id);
      if (n !== undefined) pending.push(n);
      continue;
    }
    flush();
    const glued = glueTokens(keepUnits(segment.text), nextId);
    tokens.push(...glued.tokens);
    nextId = glued.nextId;
  }
  flush();
  // a marker at the very start has nothing before it: bind it to what follows instead
  if (tokens[0]?.marker) {
    let k = 1;
    while (k < tokens.length && tokens[k].text.trim() === "") k++;
    if (k < tokens.length) glueRange(0, k);
  }
  return tokens;
}

/** Whether a line may break between `a` and `b`: not inside a glued unit, and not against 禁則. */
function canBreakBetween(a: Token, b: Token): boolean {
  if (a.glue >= 0 && a.glue === b.glue) return false;
  return !NO_LINE_START.includes(b.text) && !NO_LINE_END.includes(a.text);
}

/** Last place in `line` to break before, preferring spaces and CJK punctuation, never inside a glued unit. */
function breakBefore(line: Token[], next: Token | null): number {
  for (let j = line.length - 1; j > 0; j--) {
    const prev = line[j - 1].text;
    if ((prev === " " || BREAK_AFTER.includes(prev)) && canBreakBetween(line[j - 1], line[j])) return j;
  }
  if (next && canBreakBetween(line[line.length - 1], next)) return line.length;
  for (let j = line.length - 1; j > 0; j--) {
    if (canBreakBetween(line[j - 1], line[j])) return j;
  }
  // the unit alone is wider than the column; the width-shortfall warning covers it
  return line.length;
}

function wrapTokens(tokens: Token[], maxWidth: number, indent: number, measure: MeasureText): Token[][] {
  const size = LAYOUT.optionSize;
  if (tokens.length === 0) return [[]];

  // the column is sized from the same measurements, so allow for float rounding: a label exactly as wide as its column must not wrap
  const limitFor = (lineIndex: number) => (lineIndex === 0 ? maxWidth : maxWidth - indent) + 0.5;
  const lines: Token[][] = [];
  let current: Token[] = [];
  // what a break carries over is fed through again, so it is checked against the next line's own (indented) limit
  const queue = [...tokens];
  while (queue.length > 0) {
    const token = queue.shift()!;
    const next = [...current, token];
    if (current.length > 0 && lineWidth(next, size, measure) > limitFor(lines.length)) {
      const cut = breakBefore(current, token);
      if (cut === current.length && !canBreakBetween(current[current.length - 1], token)) {
        // one unit wider than the column: let it overflow rather than tear it (width-shortfall reports it)
        current = next;
        continue;
      }
      lines.push(current.slice(0, cut));
      queue.unshift(...current.slice(cut), token);
      current = [];
    } else {
      current = next;
    }
  }
  if (current.length > 0) lines.push(current);

  if (lines.length > 1 && lines[lines.length - 1].every((t) => t.marker)) {
    const markerLine = lines.pop()!;
    const prev = lines[lines.length - 1];
    const merged = [...prev, ...markerLine];
    if (prev.length <= 1 || lineWidth(merged, size, measure) <= limitFor(lines.length - 1)) {
      lines[lines.length - 1] = merged;
    } else {
      const cut = breakBefore(prev, null);
      if (cut >= prev.length) {
        // nowhere legal to break the previous line: the marker joins it even if that overflows
        lines[lines.length - 1] = merged;
      } else {
        lines[lines.length - 1] = prev.slice(0, cut);
        lines.push([...prev.slice(cut), ...markerLine]);
      }
    }
  }
  return lines;
}

function linesToRuns(lines: Token[][]): DescRun[][] {
  return lines.map((line) => {
    const runs = toRuns(line);
    const last = runs[runs.length - 1];
    if (last && !last.sup) last.text = last.text.trimEnd();
    return runs.filter((r) => r.text !== "" || runs.length === 1);
  });
}

/**
 * Wraps a description at spaces or after CJK punctuation, falling back to
 * a character break outside units like "24 V". Inline note references
 * (`{{note:ID}}`) become superscript numbers where they stand; a marker
 * never starts a line and never sits alone on one (禁則) — it
 * rejoins the previous line, taking that line's last word with it when
 * the joined line would be too wide.
 */
export function wrapDescription(
  description: string,
  noteNumbers: Map<string, number>,
  maxWidth: number,
  indent: number,
  measure: MeasureText,
  // required: a default here would quietly draw ※ into an English diagram
  noteMark: string,
): DescRun[][] {
  return linesToRuns(wrapTokens(descriptionTokens(description, noteNumbers, noteMark), maxWidth, indent, measure));
}

/**
 * Numbers notes in the order a reader meets them: items in the given order
 * (left column top to bottom, then right), options top to bottom. Notes no
 * option refers to follow in document order.
 */
export function numberNotes(itemsInReadingOrder: PartNumberItem[], notes: PartNumberNote[]): Map<string, number> {
  const exists = new Set(notes.map((n) => n.id));
  const numbers = new Map<string, number>();
  for (const item of itemsInReadingOrder) {
    for (const option of item.options) {
      for (const ref of noteRefsIn(option.description)) {
        if (exists.has(ref) && !numbers.has(ref)) numbers.set(ref, numbers.size + 1);
      }
    }
  }
  for (const note of notes) if (!numbers.has(note.id)) numbers.set(note.id, numbers.size + 1);
  return numbers;
}

/** The widest piece the wrapper can never split: a glued unit (with its marker) or a character kept together by 禁則. */
function minimumTokenWidth(desc: string, noteNumbers: Map<string, number>, measure: MeasureText, noteMark: string): number {
  const tokens = descriptionTokens(desc, noteNumbers, noteMark);
  let widest = 0;
  let group: Token[] = [];
  const close = () => {
    const visible = group.filter((t) => t.text.trim() !== "" || t.marker);
    if (visible.length > 0) widest = Math.max(widest, lineWidth(visible, LAYOUT.optionSize, measure));
    group = [];
  };
  tokens.forEach((t, i) => {
    if (i > 0 && canBreakBetween(tokens[i - 1], t)) close();
    group.push(t);
  });
  close();
  return widest;
}

interface Cell {
  item: PartNumberItem;
  headingText: string;
  headingWidth: number;
  codeColumnWidth: number;
  natural: number;
  min: number;
  mid: number;
  x: number;
  width: number;
}

/**
 * Pure layout shared by the renderer and the pre-save checks. Sides are
 * fixed first (left of the code's
 * centre goes left), the code row is shifted right so deeper left leaders
 * clear the text above them, the left column is packed toward its own
 * leaders, the right column steps down from each leader, and the finished
 * drawing is centred on the canvas.
 */
export function computeLayout(
  code: string,
  items: PartNumberItem[],
  svgWidth: number,
  notes: PartNumberNote[] = [],
  measure: MeasureText = approxMeasure,
  notation: Notation = notationFor(code, items, notes),
): DiagramLayout {
  // data written before inline references keeps its old look: references land at the end
  items = itemsWithInlineNotes(items);
  const drawX = LAYOUT.edge;
  const drawW = svgWidth - drawX * 2;

  const graphemes = toGraphemes(code);
  const xs = [0];
  for (let i = 1; i <= graphemes.length; i++) xs.push(measure(graphemes.slice(0, i).join(""), "code", LAYOUT.codeSize));
  const codeWidth = xs[graphemes.length];

  const placements = items.map((item) => {
    const start = Math.max(0, Math.min(item.range.start, graphemes.length));
    const end = Math.max(0, Math.min(item.range.end, graphemes.length));
    return { item, mid: (xs[start] + xs[end]) / 2 };
  });
  const sideOf = (p: { item: PartNumberItem; mid: number }): "left" | "right" =>
    p.item.side === "left" || p.item.side === "right" ? p.item.side : p.mid <= codeWidth / 2 ? "left" : "right";
  const leftPlacements = placements.filter((p) => sideOf(p) === "left").sort((a, b) => a.item.range.start - b.item.range.start);
  const rightPlacements = placements.filter((p) => sideOf(p) === "right").sort((a, b) => b.item.range.start - a.item.range.start);

  // Sides and column order don't depend on label widths, so notes can be
  // numbered in reading order before any label is measured, and wrapping
  // then measures the real marker (number in reading order, then wrap the numbered text).
  const noteNumberById = numberNotes([...leftPlacements, ...rightPlacements].map((p) => p.item), notes);

  const toCell = ({ item, mid }: { item: PartNumberItem; mid: number }): Cell => {
    // blank-only text counts as empty, the same as the warnings do
    const headingText = item.heading.trim() ? item.heading : notation.missingHeading;
    const headingWidth = measure(headingText, "heading", LAYOUT.headingSize);
    const codeColumnWidth = Math.max(
      0,
      ...item.options.map((o) => (o.code.trim() ? measure(o.code + SEPARATOR, "body", LAYOUT.optionSize) : 0)),
    );
    const descWidth = Math.max(
      0,
      ...item.options.map((o) => lineWidth(descriptionTokens(o.description, noteNumberById, notation.noteMark), LAYOUT.optionSize, measure)),
    );
    const tokenWidth = Math.max(0, ...item.options.map((o) => minimumTokenWidth(o.description, noteNumberById, measure, notation.noteMark)));
    return {
      item,
      headingText,
      headingWidth,
      codeColumnWidth,
      natural: Math.max(headingWidth, codeColumnWidth + descWidth),
      min: Math.max(headingWidth, codeColumnWidth + tokenWidth),
      mid,
      x: 0,
      width: 0,
    };
  };
  const left = leftPlacements.map(toCell);
  const right = rightPlacements.map(toCell);

  // A deeper left item's vertical leader runs down past the text of the
  // shallower ones; shift the code row right so that path is clear.
  const leftNatural = Math.max(0, ...left.map((c) => c.natural));
  const deepMids = left.slice(1).map((c) => c.mid);
  const clearDeep = deepMids.length > 0 ? leftNatural + LAYOUT.gutter - Math.min(...deepMids) : 0;
  // and far enough that every left label fits between the margin and its own leader
  // — but never so far that the code row or a right label's minimum width leaves the canvas
  const fitLeft = Math.max(0, ...left.map((c) => c.natural + LAYOUT.foldGap - c.mid));
  const shiftRoom = Math.min(drawW - codeWidth, ...right.map((c) => drawW - c.mid - LAYOUT.foldGap - c.min));
  const codeShift = Math.max(0, Math.min(Math.max(clearDeep, fitLeft), shiftRoom));
  const codeX = drawX + codeShift;
  const dropX = (c: Cell) => codeX + c.mid;

  for (const c of right) {
    c.x = dropX(c) + LAYOUT.foldGap;
    c.width = drawX + drawW - c.x;
  }
  const rightMinX = right.length > 0 ? Math.min(...right.map((c) => c.x)) : drawX + drawW + LAYOUT.gutter;

  // Pack the left column toward its leaders: move it right until the widest
  // item just reaches its own line, never past its leader.
  const ownRight = (c: Cell) => Math.min(dropX(c) - LAYOUT.foldGap, rightMinX - LAYOUT.gutter, drawX + drawW);
  const leftX = left.length > 0 ? Math.max(LAYOUT.edge, Math.min(...left.map((c) => ownRight(c) - c.natural))) : drawX;
  for (const c of left) {
    c.x = leftX;
    c.width = ownRight(c) - leftX;
  }

  const shortfalls: WidthShortfall[] = [...left, ...right]
    .filter((c) => c.width < c.min)
    .map((c) => ({ itemId: c.item.id, available: Math.round(c.width), required: Math.round(c.min) }));

  const codeRowY = LAYOUT.codeY;
  const underlineY = codeRowY + LAYOUT.underlineGap;

  const placed: PlacedItemLayout[] = [];
  let bottom = underlineY;
  let minX = codeX;
  let maxX = codeX + codeWidth;
  const span = (a: number, b: number) => {
    minX = Math.min(minX, a, b);
    maxX = Math.max(maxX, a, b);
  };

  for (const [band, column] of [["left", left], ["right", right]] as const) {
    let tierTop = underlineY + LAYOUT.topLow;
    for (const c of column) {
      const indent = LAYOUT.optionSize;
      const descWidth = Math.max(1, c.width - c.codeColumnWidth);
      const headingY = tierTop + LAYOUT.headingSize;
      const ruleY = headingY + LAYOUT.headingGap;

      let y = ruleY + LAYOUT.optionLead;
      let contentWidth = c.headingWidth;
      const options: OptionLayout[] = c.item.options.map((o) => {
        const codeText = o.code.trim() ? o.code + SEPARATOR : "";
        const lines = wrapTokens(descriptionTokens(o.description, noteNumberById, notation.noteMark), descWidth, indent, measure);
        lines.forEach((line, i) => {
          contentWidth = Math.max(contentWidth, c.codeColumnWidth + (i > 0 ? indent : 0) + lineWidth(line, LAYOUT.optionSize, measure));
        });
        const descLines = linesToRuns(lines);
        const option: OptionLayout = {
          codeText,
          codeWidth: codeText ? measure(codeText, "body", LAYOUT.optionSize) : 0,
          descLines,
          y,
        };
        y += LAYOUT.softLead * (descLines.length - 1) + LAYOUT.optionLead;
        return option;
      });
      const lastBaseline = y - LAYOUT.optionLead;
      const height = lastBaseline - tierTop;

      const [s, e] = [c.item.range.start, c.item.range.end];
      const startX = codeX + xs[Math.max(0, Math.min(s, graphemes.length))];
      const endX = codeX + xs[Math.max(0, Math.min(e, graphemes.length))];
      const dx = dropX(c);
      const ruleEnd = Math.max(dx, c.x + contentWidth);

      placed.push({
        item: c.item,
        band,
        underline: {
          a: { x: startX + LAYOUT.underlineInset, y: underlineY },
          b: { x: endX - LAYOUT.underlineInset, y: underlineY },
        },
        leader: {
          points: [
            { x: dx, y: underlineY },
            { x: dx, y: ruleY },
            { x: c.x, y: ruleY },
          ],
        },
        rule: { a: { x: c.x, y: ruleY }, b: { x: ruleEnd, y: ruleY } },
        label: {
          x: c.x,
          headingText: c.headingText,
          headingY,
          codeColumnWidth: c.codeColumnWidth,
          options,
          bbox: { x: c.x, y: tierTop, width: contentWidth, height },
        },
      });
      span(c.x, ruleEnd);
      span(startX, endX);
      bottom = Math.max(bottom, lastBaseline);
      tierTop = lastBaseline + LAYOUT.tierGap;
    }
  }

  // Centre the finished drawing; the margins are a result, not a setting.
  const shift = (svgWidth - (maxX - minX)) / 2 - minX;
  const moveX = (p: Point): Point => ({ x: p.x + shift, y: p.y });
  for (const p of placed) {
    p.underline = { a: moveX(p.underline.a), b: moveX(p.underline.b) };
    p.leader = { points: p.leader.points.map(moveX) };
    p.rule = { a: moveX(p.rule.a), b: moveX(p.rule.b) };
    p.label.x += shift;
    p.label.bbox = { ...p.label.bbox, x: p.label.bbox.x + shift };
  }
  const shiftedCodeX = codeX + shift;

  const footnotes: FootnoteLayout[] = [];
  let footnotesRuleY: number | null = null;
  // footnotes start under the drawing's left edge and may use the canvas out to its right margin
  const footnoteX = minX + shift;
  let footnotesRuleEndX = maxX + shift;
  let cursor = bottom;
  if (notes.length > 0) {
    footnotesRuleY = bottom + LAYOUT.footnoteTopPadding;
    cursor = footnotesRuleY + LAYOUT.footnoteGap;
    const maxWidth = svgWidth - LAYOUT.edge - footnoteX;
    [...notes].sort((a, b) => noteNumberById.get(a.id)! - noteNumberById.get(b.id)!).forEach((note) => {
      const number = noteNumberById.get(note.id)!;
      const lines = wrapFootnote(`${notation.noteMark}${number} ${note.text}`, maxWidth, measure);
      for (const line of lines) {
        footnotesRuleEndX = Math.max(footnotesRuleEndX, footnoteX + measure(line, "body", LAYOUT.footnoteSize));
      }
      const firstBaseline = cursor + LAYOUT.footnoteSize;
      footnotes.push({ number, lines, y: firstBaseline });
      cursor = firstBaseline + (lines.length - 1) * LAYOUT.footnoteSize * LAYOUT.footnoteLineHeight + LAYOUT.footnoteGap;
    });
  }

  return {
    svgWidth,
    height: Math.round(cursor + LAYOUT.bottomPadding),
    codeRowY,
    codeX: shiftedCodeX,
    graphemes,
    notation,
    charX: (index: number) => shiftedCodeX + xs[Math.max(0, Math.min(index, graphemes.length))],
    placed,
    footnotes,
    footnoteX,
    footnotesRuleY,
    footnotesRuleEndX,
    shortfalls,
    noteNumbers: noteNumberById,
  };
}

function wrapFootnote(text: string, maxWidth: number, measure: MeasureText): string[] {
  const lines: string[] = [];
  let current = "";
  for (const g of toGraphemes(text)) {
    const next = current + g;
    if (current && measure(next, "body", LAYOUT.footnoteSize) > maxWidth) {
      const cut = Math.max(current.lastIndexOf(" "), ...[...BREAK_AFTER].map((ch) => current.lastIndexOf(ch)));
      if (cut > 0) {
        lines.push(current.slice(0, cut + 1).trimEnd());
        current = current.slice(cut + 1) + g;
      } else {
        lines.push(current);
        current = g;
      }
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
