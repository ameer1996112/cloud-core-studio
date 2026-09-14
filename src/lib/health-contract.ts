export const HEALTH_CODES = [
  "HEALTH_DECLARATION_REQUIRED",
  "HEALTH_REVIEW_PENDING",
  "HEALTH_UNAVAILABLE",
  "HEALTH_TEMPLATE_UNAVAILABLE",
  "HEALTH_FORBIDDEN",
  "HEALTH_INVALID_REQUEST",
  "HEALTH_IDEMPOTENCY_CONFLICT",
  "HEALTH_INVALID_DOCUMENT",
  "HEALTH_DOCUMENT_MISSING",
] as const;
export function healthErrorCode(value: unknown) {
  return typeof value === "string" ? HEALTH_CODES.find((code) => value === code) : undefined;
}
export const SYNTHETIC_DOCUMENT = "TEST ONLY - SYNTHETIC DOCUMENT - NO MEDICAL INFORMATION";
export type HealthParticipant = { id: string; kind: "member" | "child"; name: string };
export type HealthStatus = {
  id?: string;
  status: string;
  submittedAt?: string;
  expiresAt?: string;
};
export type HealthWording = {
  title: string;
  notice: string;
  question: string;
  clear: string;
  document: string;
  consent: string;
};
export type HealthTemplate = {
  version: string;
  wording: Record<"he" | "en" | "ar", HealthWording>;
};
export type HealthReceipt = {
  locale: "he" | "en" | "ar";
  template_version: string;
  answer: "clear" | "document";
  snapshot: { wording: HealthWording; policyVersion: string };
};
export type HealthJson =
  | null
  | boolean
  | number
  | string
  | HealthJson[]
  | { [key: string]: HealthJson };
export type HealthResponse = HealthStatus & {
  error?: string;
  participants?: HealthParticipant[];
  template?: HealthTemplate;
  declaration?: HealthReceipt;
  content?: string;
  items?: {
    id: string;
    participant_name: string;
    member_id: string | null;
    child_id: string | null;
    status: string;
    submitted_at: string;
    expires_at: string;
  }[];
};
export function healthReturnPath(classId?: string) {
  return classId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)
    ? `/member?healthReturnClass=${classId}`
    : "/member";
}
