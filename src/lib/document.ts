import type { BodyFont, CodeFont, PartNumberDocument, PartNumberItem, PartNumberNote, PartNumberRange, Side } from "./schema/types";
import { graphemeLength } from "./graphemes";

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
      accent: "#2563eb",
    },
    export: {
      svgWidth: 1600,
      pngWidth: 2400,
    },
  };
}

export interface RangeIssue {
  itemId: string;
  message: string;
}

/**
 * Structural range checks that mirror the "保存を止めるエラー" rules from
 * the Phase 1 requirements (invalid item range). Collision/overflow/
 * leader-line-crossing checks are deferred to Phase 2 step 5.
 */
export function checkItemRanges(code: string, items: PartNumberItem[]): RangeIssue[] {
  const length = graphemeLength(code);
  const issues: RangeIssue[] = [];
  for (const item of items) {
    const { start, end } = item.range;
    if (start < 0 || end <= start || end > length) {
      issues.push({
        itemId: item.id,
        message: `range [${start}, ${end}) is invalid for a ${length}-grapheme code`,
      });
    }
  }
  return issues;
}

export interface NoteIssue {
  itemId: string;
  message: string;
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
      for (const ref of option.noteRefs) {
        if (!noteIds.has(ref)) {
          issues.push({
            itemId: item.id,
            message: `項目「${item.heading || item.id}」が存在しない注記を参照しています`,
          });
        }
      }
    }
  }
  return issues;
}
