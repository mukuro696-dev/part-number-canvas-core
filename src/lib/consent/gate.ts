import { readConsent } from "./consentStore";
import type { ConsentCategory } from "./types";

/**
 * Conditional loader for anything that must not initialize before
 * consent: analytics, ad scripts, etc. (Phase 2 §PWA spike requirement:
 * "同意状況に応じてサービスの初期化を制御できる"). Nothing in this app
 * currently calls this — there is no analytics or ad script yet — this
 * exists so that whichever is added later has a single, already-tested
 * gate to go through instead of an ad-hoc check at each call site.
 */
const pendingByCategory = new Map<ConsentCategory, Array<() => void>>();

export function whenConsented(category: ConsentCategory, callback: () => void): void {
  const record = readConsent();
  if (record?.[category]) {
    callback();
    return;
  }
  const pending = pendingByCategory.get(category) ?? [];
  pending.push(callback);
  pendingByCategory.set(category, pending);
}

/** Call after the user grants a category so anything already waiting on it runs immediately, without a page reload. */
export function notifyConsentGranted(category: ConsentCategory): void {
  const pending = pendingByCategory.get(category);
  if (!pending) return;
  pendingByCategory.delete(category);
  for (const cb of pending) cb();
}
