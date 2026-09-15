/** "necessary" is not a stored field — it is implicitly always granted and never asked for. */
export type ConsentCategory = "analytics" | "marketing";

export interface ConsentRecord {
  analytics: boolean;
  marketing: boolean;
  /** bumped whenever the categories or their meaning change; a stored record from an older version is treated as "no decision yet" so the user is asked again */
  policyVersion: number;
  updatedAt: string;
  /** true when this record was derived from a Global Privacy Control signal rather than a direct user choice (still shown as withdrawable) */
  fromGpc: boolean;
}
