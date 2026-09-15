import type { PartNumberItem, PartNumberNote } from "./schema/types";
import type { DiagramLayout } from "./layout/computeLayout";

export interface Warning {
  code:
    | "empty-heading"
    | "empty-option-code"
    | "empty-option-description"
    | "duplicate-heading"
    | "fullwidth-alnum"
    | "heavy-wrap"
    | "one-sided"
    | "unreferenced-note";
  itemId?: string;
  message: string;
}

const FULLWIDTH_ALNUM = /[０-９Ａ-Ｚａ-ｚ]/;
/** heading + body lines combined; above this a label is "wrapping a lot" */
const HEAVY_WRAP_LINE_THRESHOLD = 4;
/** only flag a one-sided layout once there are enough items for it to mean something */
const ONE_SIDED_MIN_ITEMS = 4;

/**
 * The Phase 1 requirements' "保存を止めない警告" (non-blocking warnings):
 * 見出し・説明・コード値が空／似た項目が重複する／型番に全角英数字が
 * 含まれる／折返しが多い／片側へ項目が偏っている。
 * ("未参照注記がある" is not included here — it needs the notes feature,
 * which doesn't exist yet.)
 */
export function checkWarnings(
  code: string,
  items: PartNumberItem[],
  layout: DiagramLayout,
  notes: PartNumberNote[] = [],
): Warning[] {
  const warnings: Warning[] = [];

  for (const item of items) {
    const label = item.heading || item.id;
    if (!item.heading.trim()) {
      warnings.push({ code: "empty-heading", itemId: item.id, message: `項目「${label}」の見出しが空です` });
    }
    for (const option of item.options) {
      if (!option.code.trim()) {
        warnings.push({ code: "empty-option-code", itemId: item.id, message: `項目「${label}」に型番中の表記が未入力の選択肢があります` });
      }
      if (!option.description.trim()) {
        warnings.push({ code: "empty-option-description", itemId: item.id, message: `項目「${label}」に説明が未入力の選択肢があります` });
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
      warnings.push({ code: "duplicate-heading", message: `見出し「${heading}」が${ids.length}件の項目で重複しています` });
    }
  }

  if (FULLWIDTH_ALNUM.test(code)) {
    warnings.push({ code: "fullwidth-alnum", message: "型番に全角英数字が含まれています" });
  }

  for (const placed of layout.placed) {
    const totalLines = placed.label.headingLines.length + placed.label.bodyLines.length;
    if (totalLines > HEAVY_WRAP_LINE_THRESHOLD) {
      const label = placed.item.heading || placed.item.id;
      warnings.push({ code: "heavy-wrap", itemId: placed.item.id, message: `項目「${label}」の折返しが多くなっています` });
    }
  }

  const leftCount = layout.placed.filter((p) => p.band === "left").length;
  const rightCount = layout.placed.filter((p) => p.band === "right").length;
  if (leftCount + rightCount >= ONE_SIDED_MIN_ITEMS && (leftCount === 0 || rightCount === 0)) {
    warnings.push({ code: "one-sided", message: "項目が片側に偏っています" });
  }

  const referencedNoteIds = new Set(items.flatMap((item) => item.options.flatMap((opt) => opt.noteRefs)));
  for (const note of notes) {
    if (!referencedNoteIds.has(note.id)) {
      warnings.push({ code: "unreferenced-note", message: `注記「${note.text || note.id}」がどの項目からも参照されていません` });
    }
  }

  return warnings;
}
