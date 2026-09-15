import type { ConsentCategory, ConsentRecord } from "./types";

const STORAGE_KEY = "pnc.consent.v1";
/** bump when the set/meaning of categories changes so existing users are asked again */
export const CONSENT_POLICY_VERSION = 1;

/**
 * Consent state lives only in localStorage, on this origin, and is
 * never sent anywhere — there is no server to send it to (Phase 1:
 * サーバへ送信しない, extended here to consent state itself). This also
 * means it is naturally outside anything the Service Worker's fetch
 * handler could ever cache (localStorage isn't fetched over the
 * network at all).
 */
export function readConsent(): ConsentRecord | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (parsed.policyVersion !== CONSENT_POLICY_VERSION) return null;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") return null;
    return {
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      policyVersion: parsed.policyVersion,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      fromGpc: parsed.fromGpc === true,
    };
  } catch {
    return null;
  }
}

export function writeConsent(choice: { analytics: boolean; marketing: boolean; fromGpc?: boolean }): ConsentRecord {
  const record: ConsentRecord = {
    analytics: choice.analytics,
    marketing: choice.marketing,
    policyVersion: CONSENT_POLICY_VERSION,
    updatedAt: new Date().toISOString(),
    fromGpc: choice.fromGpc ?? false,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  return record;
}

/** Withdrawal must be at least as easy as giving consent (GDPR/CCPA): this is the same one-call reset the banner's own "設定を初期化" action uses. */
export function clearConsent(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** CCPA/CPRA: a Global Privacy Control signal is a valid opt-out and must be honored automatically. */
export function detectGlobalPrivacyControl(): boolean {
  return typeof navigator !== "undefined" && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function isGranted(record: ConsentRecord | null, category: ConsentCategory): boolean {
  return record?.[category] === true;
}
