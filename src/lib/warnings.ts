import type { PartNumberItem, PartNumberNote } from "./schema/types";
import { LAYOUT, type DiagramLayout } from "./layout/computeLayout";
import { noteRefsIn, plainDescription } from "./noteTokens";
import { hasInvalidXmlChars } from "./xmlText";

export interface Warning {
  code:
    | "empty-heading"
    | "empty-option-code"
    | "empty-option-description"
    | "empty-note-text"
    | "duplicate-heading"
    | "fullwidth-alnum"
    | "non-ascii-code"
    | "invalid-characters"
    | "heavy-wrap"
    | "one-sided"
    | "unreferenced-note"
    | "undrawable-characters"
    | "width-shortfall";
  /** todo = not written yet (expected while drafting); notice = written but worth a look */
  kind: "todo" | "notice";
  itemId?: string;
  message: string;
}

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

export function checkWarnings(
  code: string,
  items: PartNumberItem[],
  layout: DiagramLayout,
  notes: PartNumberNote[] = [],
  options: WarningOptions = {},
): Warning[] {
  const warnings: Warning[] = [];

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
      warnings.push({
        code: "undrawable-characters",
        kind: "notice",
        message: `図版の書体に無い文字が含まれています（${missing.slice(0, 10).join(" ")}${missing.length > 10 ? " ほか" : ""}）。書き出したファイルでは、その文字が出ないか字間が崩れます。`,
      });
    }
  }

  for (const item of items) {
    const label = item.heading || item.id;
    if (!item.heading.trim()) {
      warnings.push({ code: "empty-heading", kind: "todo", itemId: item.id, message: `項目「${label}」の見出しが空です` });
    }
    for (const option of item.options) {
      if (!option.code.trim()) {
        warnings.push({ code: "empty-option-code", kind: "todo", itemId: item.id, message: `項目「${label}」に型番中の表記が未入力の選択肢があります` });
      }
      // a description holding only note references still has nothing written in it
      if (!plainDescription(option.description).trim()) {
        warnings.push({ code: "empty-option-description", kind: "todo", itemId: item.id, message: `項目「${label}」に説明が未入力の選択肢があります` });
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
      warnings.push({ code: "duplicate-heading", kind: "notice", message: `見出し「${heading}」が${ids.length}件の項目で重複しています` });
    }
  }

  if (FULLWIDTH_ALNUM.test(code)) {
    warnings.push({ code: "fullwidth-alnum", kind: "notice", message: "型番に全角英数字が含まれています" });
  }
  // A guess at the same problem `undrawable-characters` reports exactly: the
  // part-number faces are Latin-only, so anything else likely has no glyph.
  // When the caller knows the real coverage, that check has already said so and
  // saying it twice is noise.
  if (!isDrawable && NON_ASCII_OTHER.test(code)) {
    warnings.push({
      code: "non-ascii-code",
      kind: "notice",
      message: "型番に英数字・記号以外の文字が含まれています。型番行の書体に字が無く、別の書体で表示される可能性があります",
    });
  }

  for (const placed of layout.placed) {
    const label = placed.item.heading || placed.item.id;
    if (placed.label.options.some((o) => o.descLines.length > LAYOUT.maxWrapLines)) {
      warnings.push({
        code: "heavy-wrap",
        kind: "notice",
        itemId: placed.item.id,
        message: `項目「${label}」の説明が${LAYOUT.maxWrapLines}行を超えて折り返しています`,
      });
    }
  }

  for (const s of layout.shortfalls) {
    const item = items.find((i) => i.id === s.itemId);
    warnings.push({
      code: "width-shortfall",
      kind: "notice",
      itemId: s.itemId,
      message: `項目「${item?.heading || s.itemId}」の幅が足りません（使える幅 ${s.available} に対し ${s.required} 必要）。説明を短くするか、左右の配置を変えてください`,
    });
  }

  const leftCount = layout.placed.filter((p) => p.band === "left").length;
  const rightCount = layout.placed.filter((p) => p.band === "right").length;
  if (leftCount + rightCount >= ONE_SIDED_MIN_ITEMS && (leftCount === 0 || rightCount === 0)) {
    warnings.push({ code: "one-sided", kind: "notice", message: "項目が片側に偏っています" });
  }

  notes.forEach((note) => {
    if (!note.text.trim()) {
      const number = layout.noteNumbers.get(note.id);
      warnings.push({ code: "empty-note-text", kind: "todo", message: `注記${number ?? ""}の本文が空です` });
    }
  });

  const texts = [
    code,
    ...items.flatMap((item) => [item.heading, ...item.options.flatMap((o) => [o.code, o.description])]),
    ...notes.map((n) => n.text),
  ];
  if (texts.some(hasInvalidXmlChars)) {
    warnings.push({
      code: "invalid-characters",
      kind: "notice",
      message: "図版に使えない文字（制御文字など）が含まれています。描画と書き出しでは取り除きます。貼り付けた文字を確認してください",
    });
  }

  const referencedNoteIds = new Set(items.flatMap((item) => item.options.flatMap((opt) => [...opt.noteRefs, ...noteRefsIn(opt.description)])));
  for (const note of notes) {
    if (!referencedNoteIds.has(note.id)) {
      warnings.push({ code: "unreferenced-note", kind: "notice", message: `注記「${note.text || note.id}」がどの項目からも参照されていません` });
    }
  }

  return warnings;
}
