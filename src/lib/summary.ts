import { type DiagramLayout } from "./layout/computeLayout";
import type { PartNumberNote } from "./schema/types";
import { plainDescription } from "./noteTokens";

/**
 * Plain-text summary of the diagram for alt text, spec sheets, or a CMS
 * draft (Phase 1 §9 テキスト要約). Follows the drawing's reading order and
 * note numbering; the superscript markers are left out because read aloud
 * they are only noise, and the note texts come last in number order.
 */
export function buildTextSummary(code: string, layout: DiagramLayout, notes: PartNumberNote[]): string {
  const parts: string[] = [code.trim()];
  for (const { item } of layout.placed) {
    const options = item.options
      .map((o) => [o.code.trim(), plainDescription(o.description).trim()].filter(Boolean).join(" = "))
      .filter(Boolean)
      .join(layout.notation.optionSeparator);
    const heading = item.heading.trim();
    // an unwritten heading is left out rather than shown as a placeholder
    const line = heading && options ? `${heading}${layout.notation.headingSeparator}${options}` : heading || options;
    if (line) parts.push(line);
  }
  const numbered = notes
    .filter((n) => n.text.trim())
    .sort((a, b) => (layout.noteNumbers.get(a.id) ?? 0) - (layout.noteNumbers.get(b.id) ?? 0))
    .map((n) => `${layout.notation.noteMark}${layout.noteNumbers.get(n.id)} ${n.text.trim()}`);
  parts.push(...numbered);
  return parts.filter(Boolean).join(layout.notation.fieldSeparator);
}
