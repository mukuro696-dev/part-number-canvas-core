/**
 * Characters XML 1.0 does not allow anywhere in a document: C0 controls other
 * than tab/newline/carriage return, lone surrogates, and U+FFFE/U+FFFF. Escaping
 * doesn't help — a single one makes the whole SVG unparseable, so the browser
 * refuses to load it as an image and PNG export fails. They can arrive by
 * paste or JSON import but never mean anything in a diagram.
 */
const INVALID_XML_CHARS = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

export function stripInvalidXmlChars(text: string): string {
  return text.replace(INVALID_XML_CHARS, "");
}

export function hasInvalidXmlChars(text: string): boolean {
  INVALID_XML_CHARS.lastIndex = 0;
  const found = INVALID_XML_CHARS.test(text);
  INVALID_XML_CHARS.lastIndex = 0;
  return found;
}
