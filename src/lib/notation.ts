import type { PartNumberItem, PartNumberNote } from "./schema/types";
import { plainDescription } from "./noteTokens";

/**
 * The punctuation the tool adds around what the user wrote.
 *
 * A diagram is not only the words someone typed: the tool supplies the note
 * marks, the placeholder for a heading left empty, and the separators in the
 * copied text summary. Those were Japanese conventions written as constants,
 * so an English diagram exported a Japanese 「※1」 and a summary punctuated
 * with 「、：｜」 — into a file the user then sends to someone else.
 *
 * `※` is a CJK convention; the rest of the world writes `*`. The original
 * tool this one grew from made the same split, per language.
 */
export interface Notation {
  /**
   * The BCP 47 tag for the document's own text. Also what the exported file is
   * named after: `meta.locale` is stamped "ja" when a document is created and
   * never revisited, so a document rewritten in English still saved as
   * `..._ja_part-number.svg`.
   */
  language: "ja" | "en";
  /** the reference mark, before the note number */
  noteMark: string;
  /** stands in for a heading the user has not written yet */
  missingHeading: string;
  /** between the options of one item, in the text summary */
  optionSeparator: string;
  /** between a heading and its options, in the text summary */
  headingSeparator: string;
  /** between the parts of the text summary */
  fieldSeparator: string;
}

export const JAPANESE_NOTATION: Notation = {
  language: "ja",
  noteMark: "※",
  missingHeading: "(見出し未設定)",
  optionSeparator: "、",
  headingSeparator: "：",
  fieldSeparator: "｜",
};

export const LATIN_NOTATION: Notation = {
  language: "en",
  noteMark: "*",
  missingHeading: "(no heading)",
  optionSeparator: ", ",
  headingSeparator: ": ",
  fieldSeparator: " | ",
};

/**
 * Hiragana, katakana, CJK ideographs and half-width katakana, plus the
 * ideographs above the BMP — which need the `u` flag to match at all, since
 * without it the pattern sees two surrogate halves rather than one character.
 */
const CJK = /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ\u{20000}-\u{2ebef}]/u;

/**
 * Which conventions this document is written in, judged by the document itself.
 *
 * Deliberately not the interface language: someone using the Japanese editor
 * can write an English diagram for an English catalog, and it is the diagram
 * that gets exported and sent on. Nor a setting — a new control would have to
 * be explained, and would be one more thing to get wrong for no gain over
 * simply looking at the text.
 *
 * A document with no Japanese in it anywhere is not a Japanese document, and
 * `※` in front of its notes is a character its reader has no use for. Any
 * Japanese at all and the Japanese conventions stay, which keeps every
 * document written so far exactly as it was.
 */
export function notationFor(
  code: string,
  items: readonly PartNumberItem[],
  notes: readonly PartNumberNote[] = [],
): Notation {
  const written = [
    code,
    ...items.flatMap((item) => [
      item.heading,
      ...item.options.flatMap((option) => [option.code, plainDescription(option.description)]),
    ]),
    ...notes.map((note) => note.text),
  ];
  return written.some((text) => CJK.test(text ?? "")) ? JAPANESE_NOTATION : LATIN_NOTATION;
}
