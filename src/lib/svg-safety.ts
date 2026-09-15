/**
 * Regression guard for the "safe SVG DOM" requirement: the exported SVG
 * must never carry script, foreignObject, event-handler attributes, or
 * external references. The renderer itself never uses
 * dangerouslySetInnerHTML, so this scans the rendered markup as a
 * belt-and-suspenders check rather than a primary defense.
 */
export interface SvgSafetyIssue {
  code: "script" | "foreign-object" | "event-handler" | "external-reference" | "unresolved-token";
  message: string;
}

// Scoped to inside a tag: rendered text content is escaped (no raw "<"), so a
// description that merely reads "onclick=" is not an attribute.
const EVENT_HANDLER_ATTR = /<[^>]*\son[a-z]+\s*=/i;
const EXTERNAL_REF_ATTR = /<[^>]*\s(?:href|xlink:href|src)\s*=\s*["'](?!#)(https?:|\/\/|data:text\/html)/i;
const UNRESOLVED_TOKEN = /\{\{[^}]*\}\}|undefined|\[object Object\]/;

export function checkSvgSafety(markup: string): SvgSafetyIssue[] {
  const issues: SvgSafetyIssue[] = [];

  if (/<script[\s>]/i.test(markup)) {
    issues.push({ code: "script", message: "SVG markup contains a <script> element" });
  }
  if (/<foreignObject[\s>]/i.test(markup)) {
    issues.push({ code: "foreign-object", message: "SVG markup contains a <foreignObject> element" });
  }
  if (EVENT_HANDLER_ATTR.test(markup)) {
    issues.push({ code: "event-handler", message: "SVG markup contains an event-handler attribute (on*=)" });
  }
  if (EXTERNAL_REF_ATTR.test(markup)) {
    issues.push({ code: "external-reference", message: "SVG markup references an external URL" });
  }
  if (UNRESOLVED_TOKEN.test(markup)) {
    issues.push({ code: "unresolved-token", message: "SVG markup contains an unresolved template token" });
  }

  return issues;
}
