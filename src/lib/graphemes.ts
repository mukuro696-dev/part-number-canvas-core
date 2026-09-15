/**
 * Grapheme-cluster helpers. Part numbers are indexed by grapheme cluster
 * (per schema: range.unit === "grapheme"), not UTF-16 code unit, so a
 * range survives combining marks / surrogate pairs consistently.
 */

let segmenter: Intl.Segmenter | null | undefined;

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter !== undefined) return segmenter;
  segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;
  return segmenter;
}

export function toGraphemes(text: string): string[] {
  const seg = getSegmenter();
  if (seg) {
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  // Fallback for environments without Intl.Segmenter: code-point split.
  // Not fully correct for combining marks, but never crashes.
  return Array.from(text);
}

export function graphemeLength(text: string): number {
  return toGraphemes(text).length;
}
