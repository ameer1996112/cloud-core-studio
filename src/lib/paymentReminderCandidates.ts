export type PendingPaymentReminderCandidate = {
  id: string;
  member_id: string;
  created_at: string;
};

export const LEGACY_PAYMENT_AUTOMATION_STATUSES = ["failed", "paid"] as const;

function timestamp(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("invalid_pending_payment_created_at");
  }
  return parsed;
}

export function selectDuePendingPaymentReminders<Candidate extends PendingPaymentReminderCandidate>(
  payments: readonly Candidate[],
  input: {
    dueBefore: Date;
    limit: number;
  },
) {
  const dueBefore = input.dueBefore.getTime();
  if (!Number.isFinite(dueBefore)) {
    throw new Error("invalid_payment_reminder_due_before");
  }

  const latestByMember = new Map<string, Candidate>();
  for (const payment of payments) {
    const existing = latestByMember.get(payment.member_id);
    if (
      !existing ||
      timestamp(payment.created_at) > timestamp(existing.created_at) ||
      (payment.created_at === existing.created_at && payment.id > existing.id)
    ) {
      latestByMember.set(payment.member_id, payment);
    }
  }

  return [...latestByMember.values()]
    .filter((payment) => timestamp(payment.created_at) <= dueBefore)
    .sort(
      (left, right) =>
        timestamp(left.created_at) - timestamp(right.created_at) ||
        left.member_id.localeCompare(right.member_id) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, Math.max(0, Math.trunc(input.limit)));
}

export function isSupersededPendingPaymentReminder(
  paymentId: string,
  latestPendingPaymentId: string | null,
) {
  return latestPendingPaymentId !== null && paymentId !== latestPendingPaymentId;
}
