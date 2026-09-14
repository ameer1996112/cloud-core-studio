export type HealthOnboarding = {
  renewalDue?: boolean;
  parentRenewalDue?: boolean;
  renewalExpiresAt?: string;
  enabled?: boolean;
  testOnly?: boolean;
  collectionEnabled?: boolean;
  collectionKind?: "synthetic" | "clinical";
  route?: "adult" | "parent" | "birth_date";
  status?: string;
  guardianState?: string;
  graceEndsAt?: string;
  needsNotice?: boolean;
  required?: boolean;
  error?: string;
  token?: string;
  expiresAt?: string;
  state?: string;
  ok?: boolean;
  children?: { id: string; name: string; state: string }[];
  items?: { id: string; member: string; guardian: string; relationship: string; state: string }[];
};

export function validBirthDate(
  value: string,
  today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > today) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const PARENT_INVITE_KEY = "cloud-core-parent-invitation";
export function parentInvitation(value: string | null): string | null {
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
