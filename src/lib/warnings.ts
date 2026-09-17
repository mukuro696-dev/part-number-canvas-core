import type { PartNumberItem, PartNumberNote } from "./schema/types";
import { LAYOUT, type DiagramLayout } from "./layout/computeLayout";
import { noteRefsIn, plainDescription } from "./noteTokens";
import { toGraphemes } from "./graphemes";
import { hasInvalidXmlChars } from "./xmlText";

/**
 * What the checks found, as facts rather than sentences.
 *
 * This engine does not know what language it is being used in, so it does not
 * write the message. Each finding names itself and carries the values a
 * message would need; whatever displays it supplies the words.
 *
 * `kind` separates "not written yet" — ordinary while drafting — from "written,
 * but worth a look".
 */
export type WarningKind = "todo" | "notice";

export type Warning =
  | { code: "empty-heading"; kind: "todo"; itemId: string; label: string }
  | { code: "empty-option-code"; kind: "todo"; itemId: string; label: string }
  | { code: "empty-option-description"; kind: "todo"; itemId: string; label: string }
  | { code: "empty-note-text"; kind: "todo"; number?: number }
  | { code: "duplicate-heading"; kind: "notice"; heading: string; count: number }
  | { code: "fullwidth-alnum"; kind: "notice" }
  | { code: "non-ascii-code"; kind: "notice" }
  | { code: "invalid-characters"; kind: "notice" }
  | { code: "heavy-wrap"; kind: "notice"; itemId: string; label: string; maxLines: number }
  | { code: "one-sided"; kind: "notice" }
  | { code: "unreferenced-note"; kind: "notice"; label: string }
  | {
      code: "undrawable-characters";
      kind: "notice";
      /** the characters with no glyph, in the order they were met */
      missing: string[];
    }
  | { code: "width-shortfall"; kind: "notice"; itemId: string; label: string; available: number; required: number };

/** Every finding that points at one item carries its id. */
export type WarningWithItem = Extract<Warning, { itemId: string }>;

const FULLWIDTH_ALNUM = /[０-９Ａ-Ｚａ-ｚ]/;
/** outside printable ASCII and not already covered by the full-width alphanumeric warning */
const NON_ASCII_OTHER = /[^\x20-\x7e０-９Ａ-Ｚａ-ｚ]/;
/** only flag a one-sided layout once there are enough items for it to mean something */
const ONE_SIDED_MIN_ITEMS = 4;

/**
 * The Phase 1 requirements' "保存を止めない警告" (non-blocking warnings):
 * 見出し・説明・コード値が空／似た項目が重複する／型番に全角英数字が
 * 含まれる／折返しが多い／片側へ項目が偏っている／未参照の注記がある／
 * 項目の幅が足りない。
 */
export interface WarningOptions {
  /**
   * Answers whether the diagram's font can draw a character. Injected rather
   * than imported, because which fonts are bundled is a decision of the
   * application around this engine, not of the engine. When it is absent the
   * check is skipped — nothing is assumed about the fonts in use.
   *
   * `role` is "code" for the part number row and "body" for everything else,
   * since those are drawn with different families.
   */
  isDrawable?: (char: string, role: "code" | "body") => boolean;
}

/**
 * What to call an item in a message.
 *
 * Its heading, once it has one. Until then the characters it covers — which is
 * what the card beside it shows, and what the reader can actually find on
 * screen. The id is the last resort and should never be reached: it identifies
 * the item to the program, not to anyone reading.
 */
function nameOf(item: PartNumberItem, graphemes: string[]): string {
  const heading = item.heading.trim();
  if (heading) return heading;
  const covered = graphemes.slice(item.range.start, item.range.end).join("");
  return covered || item.id;
}

export function checkWarnings(
  code: string,
  items: PartNumberItem[],
  layout: DiagramLayout,
  notes: PartNumberNote[] = [],
  options: WarningOptions = {},
): Warning[] {
  const warnings: Warning[] = [];
  const graphemes = toGraphemes(code);

  const { isDrawable } = options;
  if (isDrawable) {
    // Characters the font lacks vanish from the subset embedded on export, and
    // the text around them lands wrong. The author's own machine hides this.
    const undrawable = (text: string, role: "code" | "body") => {
      const missing: string[] = [];
      for (const char of text) {
        if (/\s/.test(char) || missing.includes(char)) continue;
        if (!isDrawable(char, role)) missing.push(char);
      }
      return missing;
    };
    const bodyText = items
      .flatMap((item) => [item.heading, ...item.options.map((o) => `${o.code}${plainDescription(o.description)}`)])
      .concat(notes.map((note) => note.text))
      .join("");
    const missing = [...new Set([...undrawable(code, "code"), ...undrawable(bodyText, "body")])];
    if (missing.length > 0) {
      warnings.push({ code: "undrawable-characters", kind: "notice", missing });
    }
  }

  for (const item of items) {
    const label = nameOf(item, graphemes);
    if (!item.heading.trim()) {
      warnings.push({ code: "empty-heading", kind: "todo", itemId: item.id, label });
    }
    for (const option of item.options) {
      if (!option.code.trim()) {
        warnings.push({ code: "empty-option-code", kind: "todo", itemId: item.id, label });
      }
      // a description holding only note references still has nothing written in it
      if (!plainDescription(option.description).trim()) {
        warnings.push({ code: "empty-option-description", kind: "todo", itemId: item.id, label });
      }
    }
  }

  const headingGroups = new Map<string, string[]>();
  for (const item of items) {
    const heading = item.heading.trim();
    if (!heading) continue;
    const ids = headingGroups.get(heading) ?? [];
    ids.push(item.id);
    headingGroups.set(heading, ids);
  }
  for (const [heading, ids] of headingGroups) {
    if (ids.length > 1) {
      warnings.push({ code: "duplicate-heading", kind: "notice", heading, count: ids.length });
    }
  }

  if (FULLWIDTH_ALNUM.test(code)) {
    warnings.push({ code: "fullwidth-alnum", kind: "notice" });
  }
  // A guess at the same problem `undrawable-characters` reports exactly: the
  // part-number faces are Latin-only, so anything else likely has no glyph.
  // When the caller knows the real coverage, that check has already said so and
  // saying it twice is noise.
  if (!isDrawable && NON_ASCII_OTHER.test(code)) {
    warnings.push({ code: "non-ascii-code", kind: "notice" });
  }

  for (const placed of layout.placed) {
    const label = nameOf(placed.item, graphemes);
    if (placed.label.options.some((o) => o.descLines.length > LAYOUT.maxWrapLines)) {
      warnings.push({
        code: "heavy-wrap",
        kind: "notice",
        itemId: placed.item.id,
        label,
        maxLines: LAYOUT.maxWrapLines,
      });
    }
  }

  for (const s of layout.shortfalls) {
    const item = items.find((i) => i.id === s.itemId);
    warnings.push({
      code: "width-shortfall",
      kind: "notice",
      itemId: s.itemId,
      label: item ? nameOf(item, graphemes) : s.itemId,
      available: s.available,
      required: s.required,
    });
  }

  const leftCount = layout.placed.filter((p) => p.band === "left").length;
  const rightCount = layout.placed.filter((p) => p.band === "right").length;
  if (leftCount + rightCount >= ONE_SIDED_MIN_ITEMS && (leftCount === 0 || rightCount === 0)) {
    warnings.push({ code: "one-sided", kind: "notice" });
  }

  notes.forEach((note) => {
    if (!note.text.trim()) {
      const number = layout.noteNumbers.get(note.id);
      warnings.push({ code: "empty-note-text", kind: "todo", number });
    }
  });

  const texts = [
    code,
    ...items.flatMap((item) => [item.heading, ...item.options.flatMap((o) => [o.code, o.description])]),
    ...notes.map((n) => n.text),
  ];
  if (texts.some(hasInvalidXmlChars)) {
    warnings.push({ code: "invalid-characters", kind: "notice" });
  }

  const referencedNoteIds = new Set(items.flatMap((item) => item.options.flatMap((opt) => [...opt.noteRefs, ...noteRefsIn(opt.description)])));
  for (const note of notes) {
    if (!referencedNoteIds.has(note.id)) {
      warnings.push({ code: "unreferenced-note", kind: "notice", label: note.text || note.id });
    }
  }

  return warnings;
}
