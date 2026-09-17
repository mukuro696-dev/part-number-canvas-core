import { noteRefsIn } from "./noteTokens";
import type { BodyFont, CodeFont, PartNumberDocument, PartNumberItem, PartNumberNote, PartNumberRange, Side } from "./schema/types";
import { graphemeLength, toGraphemes } from "./graphemes";

let idCounter = 0;

/** Sequential ids are enough for a single-session editor; not persisted identity. */
export function nextItemId(): string {
  idCounter += 1;
  return `item-${idCounter}-${Date.now().toString(36)}`;
}

export function nextNoteId(): string {
  idCounter += 1;
  return `note-${idCounter}-${Date.now().toString(36)}`;
}

export function createEmptyNote(): PartNumberNote {
  return { id: nextNoteId(), text: "" };
}

export function randomDocumentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyItem(range: PartNumberRange, side: Side = "auto"): PartNumberItem {
  return {
    id: nextItemId(),
    range,
    heading: "",
    side,
    options: [{ code: "", description: "", noteRefs: [] }],
  };
}

export function buildDocument(params: {
  documentId: string;
  title: string;
  code: string;
  items: PartNumberItem[];
  createdAt: string;
  revision?: number;
  updatedAt?: string;
  bodyFont?: BodyFont;
  codeFont?: CodeFont;
  notes?: PartNumberNote[];
  pngWidth?: number;
}): PartNumberDocument {
  return {
    schemaVersion: 1,
    app: "part-number-canvas",
    documentId: params.documentId,
    revision: params.revision ?? 1,
    meta: {
      title: params.title,
      locale: "ja",
      createdAt: params.createdAt,
      updatedAt: params.updatedAt ?? new Date().toISOString(),
    },
    model: {
      code: params.code,
      items: params.items,
      notes: params.notes ?? [],
    },
    appearance: {
      codeFont: params.codeFont ?? "robotoCondensed",
      bodyFont: params.bodyFont ?? "gothic",
      background: "transparent",
      accent: "#000000",
    },
    export: {
      svgWidth: 2400,
      pngWidth: params.pngWidth ?? 2400,
    },
  };
}

export interface RangeIssue {
  itemId: string;
  /** "overlap" names the two items; "invalid" is a programming error and keeps its own text */
  kind: "invalid" | "overlap";
  /** for "invalid": the detail a developer needs */
  message?: string;
  /** for "overlap": the two headings, in the order they appear */
  names?: [string, string];
}

/**
 * Structural range checks that mirror the "保存を止めるエラー" rules from
 * the Phase 1 requirements: an item range must lie inside the code, and two
 * items may not claim the same characters. Overflow and leader-line checks
 * run on the finished layout (layout/checks.ts).
 */
export function checkItemRanges(code: string, items: PartNumberItem[]): RangeIssue[] {
  const length = graphemeLength(code);
  const issues: RangeIssue[] = [];
  for (const item of items) {
    const { start, end } = item.range;
    if (start < 0 || end <= start || end > length) {
      issues.push({
        itemId: item.id,
        kind: "invalid",
        message: `range [${start}, ${end}) is invalid for a ${length}-grapheme code`,
      });
    }
  }
  // Creating an overlapping item is refused in the editor, but editing the
  // code can still squeeze two ranges together (reflow clamps, never deletes).
  const graphemes = toGraphemes(code);
  const sorted = [...items].filter((item) => item.range.start < item.range.end).sort((a, b) => a.range.start - b.range.start);
  let reach: PartNumberItem | null = null; // the item reaching furthest right so far
  for (const next of sorted) {
    const prev = reach;
    if (!reach || next.range.end > reach.range.end) reach = next;
    if (prev && next.range.start < prev.range.end) {
      const name = (item: PartNumberItem) => item.heading.trim() || graphemes.slice(item.range.start, item.range.end).join("");
      issues.push({ itemId: next.id, kind: "overlap", names: [name(prev), name(next)] });
    }
  }
  return issues;
}

export interface ReflowResult {
  items: PartNumberItem[];
  /** how many items overlapped the edited region and had to be resized rather than just shifted */
  touched: number;
}

/**
 * When the part-number code is edited, shifts existing items' ranges to
 * follow the surviving text instead of leaving them pointing at whatever
 * now occupies their old grapheme positions (Phase 1 requirement: 型番変更時は
 * 既存範囲への影響をプレビューしてから反映する). Diff-based: finds the common
 * grapheme prefix/suffix between the old and new code, then shifts items
 * entirely outside the edited region and clamps items that overlap it.
 * Never deletes an item or drops it out of range — a range that ends up
 * empty/invalid is left for checkItemRanges to flag, the same as every
 * other blocking error in this app, rather than silently disappearing.
 */
export function reflowItemRanges(
  oldCode: string,
  newCode: string,
  items: PartNumberItem[],
  /**
   * grapheme index in `newCode` where the caret sits after the edit. With
   * repeated text ("RN-10-10" → "RN-10") the prefix/suffix diff alone can't
   * tell which copy was removed; the edit always ends at the caret.
   */
  caret?: number,
): ReflowResult {
  if (oldCode === newCode) return { items, touched: 0 };

  const oldGraphemes = toGraphemes(oldCode);
  const newGraphemes = toGraphemes(newCode);
  const maxCommon = Math.min(oldGraphemes.length, newGraphemes.length);
  const prefixLimit = caret === undefined ? maxCommon : Math.min(maxCommon, caret);
  const suffixLimit = caret === undefined ? Infinity : newGraphemes.length - caret;

  let prefix = 0;
  while (prefix < prefixLimit && oldGraphemes[prefix] === newGraphemes[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < maxCommon - prefix &&
    suffix < suffixLimit &&
    oldGraphemes[oldGraphemes.length - 1 - suffix] === newGraphemes[newGraphemes.length - 1 - suffix]
  ) {
    suffix++;
  }

  const removedCount = oldGraphemes.length - prefix - suffix;
  const delta = newGraphemes.length - prefix - suffix - removedCount;
  const editEnd = prefix + removedCount;

  let touched = 0;
  const reflowedItems = items.map((item) => {
    const { start, end } = item.range;
    let newStart = start;
    let newEnd = end;
    if (end <= prefix) {
      // entirely before the edit: untouched
    } else if (start >= editEnd) {
      // entirely after the edit: shift by the length delta
      newStart = start + delta;
      newEnd = end + delta;
    } else {
      // overlaps the edited region: clamp to span from before the edit to after it
      touched++;
      newStart = Math.min(start, prefix);
      newEnd = Math.max(prefix, end + delta);
    }
    newStart = Math.max(0, Math.min(newStart, newGraphemes.length));
    newEnd = Math.max(0, Math.min(newEnd, newGraphemes.length));
    return { ...item, range: { ...item.range, start: newStart, end: newEnd } };
  });

  return { items: reflowedItems, touched };
}

export interface NoteIssue {
  itemId: string;
  /** the heading of the item whose reference does not resolve */
  label: string;
}

/**
 * Mirrors the Phase 1 "保存を止めるエラー" rule 存在しない注記を参照する:
 * an option's noteRefs must only point at notes that actually exist.
 */
export function checkNoteReferences(items: PartNumberItem[], notes: PartNumberNote[]): NoteIssue[] {
  const noteIds = new Set(notes.map((n) => n.id));
  const issues: NoteIssue[] = [];
  for (const item of items) {
    for (const option of item.options) {
      for (const ref of new Set([...option.noteRefs, ...noteRefsIn(option.description)])) {
        if (!noteIds.has(ref)) {
          issues.push({
            itemId: item.id,
            label: item.heading || item.id,
          });
        }
      }
    }
  }
  return issues;
}
