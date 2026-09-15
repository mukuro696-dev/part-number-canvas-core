import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory localStorage stub — enough for consentStore.ts,
// without pulling in a full DOM environment just for this.
function installFakeLocalStorage() {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", fakeLocalStorage);
  return fakeLocalStorage;
}

beforeEach(() => {
  installFakeLocalStorage();
  vi.stubGlobal("navigator", {});
});

describe("consentStore", () => {
  it("returns null when nothing has been decided yet", async () => {
    const { readConsent } = await import("../src/lib/consent/consentStore");
    expect(readConsent()).toBeNull();
  });

  it("round-trips a written consent decision", async () => {
    const { readConsent, writeConsent } = await import("../src/lib/consent/consentStore");
    writeConsent({ analytics: true, marketing: false });
    const record = readConsent();
    expect(record).toMatchObject({ analytics: true, marketing: false, fromGpc: false });
  });

  it("treats a record from an older policy version as no decision (asks again)", async () => {
    const { readConsent } = await import("../src/lib/consent/consentStore");
    localStorage.setItem(
      "pnc.consent.v1",
      JSON.stringify({ analytics: true, marketing: true, policyVersion: 0, updatedAt: "2020-01-01T00:00:00Z", fromGpc: false }),
    );
    expect(readConsent()).toBeNull();
  });

  it("treats a corrupted stored record as no decision rather than throwing", async () => {
    const { readConsent } = await import("../src/lib/consent/consentStore");
    localStorage.setItem("pnc.consent.v1", "{not json");
    expect(readConsent()).toBeNull();
  });

  it("clearConsent removes the stored decision (withdrawal)", async () => {
    const { clearConsent, readConsent, writeConsent } = await import("../src/lib/consent/consentStore");
    writeConsent({ analytics: true, marketing: true });
    expect(readConsent()).not.toBeNull();
    clearConsent();
    expect(readConsent()).toBeNull();
  });

  it("detects a Global Privacy Control signal", async () => {
    const { detectGlobalPrivacyControl } = await import("../src/lib/consent/consentStore");
    expect(detectGlobalPrivacyControl()).toBe(false);
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    expect(detectGlobalPrivacyControl()).toBe(true);
  });

  it("isGranted reads a specific category safely from a null record", async () => {
    const { isGranted } = await import("../src/lib/consent/consentStore");
    expect(isGranted(null, "analytics")).toBe(false);
  });
});

describe("gate (whenConsented / notifyConsentGranted)", () => {
  it("runs the callback immediately when the category is already granted", async () => {
    const { writeConsent } = await import("../src/lib/consent/consentStore");
    const { whenConsented } = await import("../src/lib/consent/gate");
    writeConsent({ analytics: true, marketing: false });

    const cb = vi.fn();
    whenConsented("analytics", cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("defers the callback until notifyConsentGranted fires for that category", async () => {
    const { whenConsented, notifyConsentGranted } = await import("../src/lib/consent/gate");

    const cb = vi.fn();
    whenConsented("marketing", cb);
    expect(cb).not.toHaveBeenCalled();

    notifyConsentGranted("marketing");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("does not run a pending callback for a different category", async () => {
    const { whenConsented, notifyConsentGranted } = await import("../src/lib/consent/gate");

    const cb = vi.fn();
    whenConsented("analytics", cb);
    notifyConsentGranted("marketing");
    expect(cb).not.toHaveBeenCalled();
  });
});
