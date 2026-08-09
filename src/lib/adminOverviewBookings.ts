export type AdminOverviewBookingMember = {
  id: string;
  name: string;
};

export type AdminOverviewBookingClass = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
  [key: string]: unknown;
};

type SupabaseRelation<T> = T | T[] | null;

export type AdminOverviewBookingRow = {
  id: string;
  status: string;
  created_at: string;
  member: SupabaseRelation<AdminOverviewBookingMember>;
  class: SupabaseRelation<AdminOverviewBookingClass>;
};

export type AdminOverviewRecentBooking = {
  id: string;
  created_at: string;
  member: AdminOverviewBookingMember;
  class: AdminOverviewBookingClass;
};

function toOne<T>(relation: SupabaseRelation<T>): T | null {
  return Array.isArray(relation) ? (relation[0] ?? null) : relation;
}

export function projectAdminOverviewBookings(
  rows: AdminOverviewBookingRow[],
  now: Date,
  recentLimit = 6,
): { activeBookings: number; recentBookings: AdminOverviewRecentBooking[] } {
  const active = rows.flatMap((row) => {
    const bookingClass = toOne(row.class);
    const startsAt = Date.parse(bookingClass?.starts_at ?? "");
    if (
      row.status !== "booked" ||
      !bookingClass ||
      bookingClass.status !== "scheduled" ||
      !Number.isFinite(startsAt) ||
      startsAt < now.getTime() ||
      hasTestClassRecord({ ...row, class: bookingClass })
    ) {
      return [];
    }
    return [{ ...row, class: bookingClass }];
  });

  const recentBookings = active
    .flatMap((row) => {
      const bookingMember = toOne(row.member);
      return bookingMember
        ? [
            {
              id: row.id,
              created_at: row.created_at,
              member: bookingMember,
              class: row.class,
            },
          ]
        : [];
    })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, Math.max(0, recentLimit));

  return { activeBookings: active.length, recentBookings };
}
import { hasTestClassRecord } from "@/lib/test-records";
