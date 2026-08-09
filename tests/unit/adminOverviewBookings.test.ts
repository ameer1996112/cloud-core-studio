import { describe, expect, it } from "bun:test";
import { projectAdminOverviewBookings } from "@/lib/adminOverviewBookings";

const now = new Date("2026-08-09T07:00:00.000Z");

const member = { id: "member-1", name: "Noa" };
const upcomingClass = {
  id: "class-upcoming",
  title: "Core Balance",
  starts_at: "2026-08-10T16:00:00.000Z",
  status: "scheduled",
  room: "Main Studio",
  instructor: { id: "instructor-1", name: "Yareen" },
  room_ref: { id: "room-1", name: "Main Studio" },
  program_type: {
    id: "program-1",
    name_en: "Core Balance",
    name_he: "איזון ליבה",
    name_ar: "توازن مركزي",
    level: "all levels",
  },
};

describe("projectAdminOverviewBookings", () => {
  it("does not count historical or otherwise inactive booking rows as active", () => {
    const result = projectAdminOverviewBookings(
      [
        {
          id: "upcoming",
          status: "booked",
          created_at: "2026-08-09T05:24:49.000Z",
          member,
          class: upcomingClass,
        },
        {
          id: "past-class",
          status: "booked",
          created_at: "2026-08-03T10:39:27.000Z",
          member,
          class: { ...upcomingClass, id: "class-past", starts_at: "2026-08-05T15:00:00Z" },
        },
        {
          id: "cancelled-booking",
          status: "cancelled",
          created_at: "2026-08-09T05:00:00.000Z",
          member,
          class: upcomingClass,
        },
        {
          id: "cancelled-class",
          status: "booked",
          created_at: "2026-08-09T04:00:00.000Z",
          member,
          class: { ...upcomingClass, id: "class-cancelled", status: "cancelled" },
        },
        {
          id: "missing-class",
          status: "booked",
          created_at: "2026-08-09T03:00:00.000Z",
          member,
          class: null,
        },
        {
          id: "qa-class",
          status: "booked",
          created_at: "2026-08-09T02:00:00.000Z",
          member,
          class: { ...upcomingClass, id: "class-qa", title: "QA_TEST booking" },
        },
      ],
      now,
    );

    expect(result.activeBookings).toBe(1);
    expect(result.recentBookings.map((booking) => booking.id)).toEqual(["upcoming"]);
  });

  it("sorts visible recent bookings newest-first, skips missing members, and caps at six", () => {
    const result = projectAdminOverviewBookings(
      [
        {
          id: "missing-member",
          status: "booked",
          created_at: "2026-08-09T09:00:00.000Z",
          member: null,
          class: upcomingClass,
        },
        {
          id: "booking-3",
          status: "booked",
          created_at: "2026-08-09T03:00:00.000Z",
          member,
          class: upcomingClass,
        },
        {
          id: "booking-8",
          status: "booked",
          created_at: "2026-08-09T08:00:00.000Z",
          member: [member],
          class: [upcomingClass],
        },
        {
          id: "booking-1",
          status: "booked",
          created_at: "2026-08-09T01:00:00.000Z",
          member,
          class: upcomingClass,
        },
        {
          id: "booking-6",
          status: "booked",
          created_at: "2026-08-09T06:00:00.000Z",
          member,
          class: upcomingClass,
        },
        {
          id: "booking-4",
          status: "booked",
          created_at: "2026-08-09T04:00:00.000Z",
          member,
          class: upcomingClass,
        },
        {
          id: "booking-7",
          status: "booked",
          created_at: "2026-08-09T07:00:00.000Z",
          member,
          class: upcomingClass,
        },
        {
          id: "booking-2",
          status: "booked",
          created_at: "2026-08-09T02:00:00.000Z",
          member,
          class: upcomingClass,
        },
        {
          id: "booking-5",
          status: "booked",
          created_at: "2026-08-09T05:00:00.000Z",
          member,
          class: upcomingClass,
        },
      ],
      now,
    );

    expect(result.activeBookings).toBe(9);
    expect(result.recentBookings.map((booking) => booking.id)).toEqual([
      "booking-8",
      "booking-7",
      "booking-6",
      "booking-5",
      "booking-4",
      "booking-3",
    ]);
    expect(result.recentBookings[0]).toMatchObject({
      member: { id: "member-1", name: "Noa" },
      class: { id: "class-upcoming", title: "Core Balance" },
    });
  });
});
