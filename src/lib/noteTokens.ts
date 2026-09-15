import type { PartNumberItem, PartNumberOption } from "./schema/types";

/**
 * Notes are referenced inline: an option's description holds `{{note:ID}}`
 * where the superscript number should appear.
 * The description is the source of truth; `noteRefs` is derived from it on
 * every edit so older readers of the JSON still see which notes are used.
 * The `note:` prefix keeps ordinary text such as "{{2}}倍" from being taken
 * for a reference.
 */
const TOKEN = /\{\{note:([^{}]{1,200})\}\}/g;

export type DescriptionSegment = { kind: "text"; text: string } | { kind: "note"; id: string };

export function noteToken(id: string): string {
  return `{{note:${id}}}`;
}

export function parseDescription(description: string): DescriptionSegment[] {
  const segments: DescriptionSegment[] = [];
  let at = 0;
  for (const m of description.matchAll(TOKEN)) {
    if (m.index > at) segments.push({ kind: "text", text: description.slice(at, m.index) });
    segments.push({ kind: "note", id: m[1] });
    at = m.index + m[0].length;
  }
  if (at < description.length) segments.push({ kind: "text", text: description.slice(at) });
  return segments;
}

/** The description as a reader sees it, without any note references. */
export function plainDescription(description: string): string {
  return description.replace(TOKEN, "");
}

/** Note ids referenced in the description, first appearance first, no repeats. */
export function noteRefsIn(description: string): string[] {
  return [...new Set(Array.from(description.matchAll(TOKEN), (m) => m[1]))];
}

/**
 * Brings an option written before inline references existed (noteRefs only)
 * into the inline form: references missing from the text are appended at
 * the end, which is exactly where they used to be drawn. Returns the same
 * object when nothing changes.
 */
export function withInlineNotes(option: PartNumberOption): PartNumberOption {
  const inline = noteRefsIn(option.description);
  const missing = option.noteRefs.filter((id) => !inline.includes(id));
  const description = missing.length > 0 ? option.description + missing.map(noteToken).join("") : option.description;
  const noteRefs = noteRefsIn(description);
  const same = description === option.description && noteRefs.length === option.noteRefs.length && noteRefs.every((id, i) => id === option.noteRefs[i]);
  return same ? option : { ...option, description, noteRefs };
}

export function itemsWithInlineNotes(items: PartNumberItem[]): PartNumberItem[] {
  let changed = false;
  const next = items.map((item) => {
    const options = item.options.map(withInlineNotes);
    if (options.every((o, i) => o === item.options[i])) return item;
    changed = true;
    return { ...item, options };
  });
  return changed ? next : items;
}

/** Removes every reference to a deleted note, so no invisible reference is left blocking the save. */
export function itemsWithoutNote(items: PartNumberItem[], noteId: string): PartNumberItem[] {
  // older data keeps references only in noteRefs; bring them into the text first so the others survive
  items = itemsWithInlineNotes(items);
  const token = noteToken(noteId);
  let changed = false;
  const next = items.map((item) => {
    if (!item.options.some((o) => o.description.includes(token) || o.noteRefs.includes(noteId))) return item;
    changed = true;
    return {
      ...item,
      options: item.options.map((o) => {
        if (!o.description.includes(token) && !o.noteRefs.includes(noteId)) return o;
        const description = o.description.split(token).join("");
        return { ...o, description, noteRefs: noteRefsIn(description) };
      }),
    };
  });
  return changed ? next : items;
}
