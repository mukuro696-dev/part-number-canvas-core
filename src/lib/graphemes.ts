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

/**
 * Converts full-width ASCII letters/digits (e.g. "ＡＢ１２") to their
 * half-width equivalents, one code point at a time — so the output has
 * the same length and doesn't shift a caller's cursor position. Only
 * touches the alphanumeric full-width block; punctuation like "、" "（"
 * and "〜" is left alone (those aren't "wrong", they're a different
 * script's own characters, and touching them would corrupt real text —
 * see warnings.ts's fullwidth-alnum check, which this is the live,
 * type-as-you-go counterpart to).
 */
export function toHalfWidthAlnum(text: string): string {
  return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
