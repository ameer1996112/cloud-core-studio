import { useMemo, useState, type CSSProperties } from "react";

import { AdminDestructiveAction } from "../../src/components/admin/AdminDestructiveAction";
import { AttendanceRosterList } from "../../src/components/admin/AttendanceRosterList";
import { BookingActionPanel } from "../../src/components/member/BookingActionPanel";
import { MemberCancellationDialog } from "../../src/components/member/MemberCancellationDialog";
import {
  MemberScheduleFilterPanel,
  type DateScope,
} from "../../src/components/member/MemberScheduleFilterPanel";
import { filterScheduleClasses } from "../../src/components/member/schedule-filtering";
import { Button } from "../../src/components/ui/button";
import { Input } from "../../src/components/ui/input";
import { PremiumLessonReservationCard } from "../../src/components/visual/VisualClassCard";
import {
  cancellationOutcomePresentation,
  deriveBookingViewState,
} from "../../src/lib/booking-view-state";
import type { ResponsiveDataListColumn } from "../../src/components/ui/responsive-data-list";
import type { AuditLanguage } from "./types";

type RosterEntry = {
  id: string;
  member: { name: string; phone: string };
  status: "booked" | "attended";
};

const roster: readonly RosterEntry[] = [
  { id: "member-maya", member: { name: "Maya Cohen", phone: "050-111-1111" }, status: "booked" },
  { id: "member-lina", member: { name: "Lina Haddad", phone: "050-222-2222" }, status: "attended" },
  { id: "member-noor", member: { name: "Noor Saleh", phone: "050-333-3333" }, status: "booked" },
] as const;

type InteractionCopy = {
  title: string;
  program: string;
  destructive: {
    journeyTitle: string;
    objectName: string;
    consequence: string;
    title: string;
    trigger: string;
    cancel: string;
    confirm: string;
    pending: string;
  };
  attendance: {
    title: string;
    filter: string;
    caption: string;
    member: string;
    phone: string;
    status: string;
    booked: string;
    attended: string;
    empty: string;
  };
  focus: {
    title: string;
    white: string;
    ivory: string;
    sand: string;
    navy: string;
  };
  booking: {
    title: string;
    opened: string;
    success: string;
    context: string;
  };
  cancellation: {
    title: string;
    trigger: string;
    dialogTitle: string;
    description: string;
    keep: string;
    confirm: string;
    pending: string;
    deadline: string;
    success: string;
    context: string;
  };
};

export const interactionCopy = {
  he: {
    title: "בדיקות אינטראקציה של המוצר",
    program: "תוכנית",
    destructive: {
      journeyTitle: "מסלול אישור ניהולי",
      objectName: "שבת 09:00 יוגה אווירית Flow",
      consequence: "התרחיש בודק רק מקלדת ומיקוד. לא משתנים נתונים.",
      title: "לבטל את שיעור הבדיקה?",
      trigger: "פתיחת אישור ביטול",
      cancel: "ביטול",
      confirm: "אישור ביטול",
      pending: "מבטלים",
    },
    attendance: {
      title: "רשימת נוכחות",
      filter: "סינון רשימת נוכחות",
      caption: "רשימת נוכחות",
      member: "חבר/ה",
      phone: "טלפון",
      status: "סטטוס",
      booked: "מוזמן/ת",
      attended: "נכח/ה",
      empty: "לא נמצאו חברים",
    },
    focus: {
      title: "בדיקת נראות מיקוד",
      white: "משטח לבן",
      ivory: "משטח שנהב",
      sand: "משטח חול",
      navy: "משטח כחול כהה",
    },
    booking: {
      title: "מסלול הזמנה",
      opened: "פרטי השיעור פתוחים. אפשר לעבור לפעולת ההזמנה.",
      success: "ההזמנה נקלטה",
      context: "יוגה אווירית Flow · שבת 09:00",
    },
    cancellation: {
      title: "מסלול ביטול",
      trigger: "פתיחת ביטול הזמנה",
      dialogTitle: "לבטל את ההזמנה?",
      description: "קרדיט אחד יחזור ליתרה שלך.",
      keep: "להשאיר הזמנה",
      confirm: "ביטול הזמנה",
      pending: "שומרים",
      deadline: "אפשר לבטל עד שבת בשעה 05:00.",
      success: "ההזמנה בוטלה",
      context: "יוגה אווירית Flow · שבת 09:00",
    },
  },
  ar: {
    title: "فحوصات تفاعل المنتج",
    program: "البرنامج",
    destructive: {
      journeyTitle: "مسار التأكيد الإداري",
      objectName: "السبت 09:00 يوغا هوائية Flow",
      consequence: "يفحص هذا المسار لوحة المفاتيح والتركيز فقط. لا تتغير أي بيانات.",
      title: "إلغاء حصة الاختبار؟",
      trigger: "فتح تأكيد الإلغاء",
      cancel: "إلغاء",
      confirm: "تأكيد الإلغاء",
      pending: "جارٍ الإلغاء",
    },
    attendance: {
      title: "قائمة الحضور",
      filter: "تصفية قائمة الحضور",
      caption: "قائمة الحضور",
      member: "العضو/ة",
      phone: "الهاتف",
      status: "الحالة",
      booked: "محجوز",
      attended: "حضر",
      empty: "لا يوجد أعضاء مطابقون",
    },
    focus: {
      title: "فحص ظهور التركيز",
      white: "سطح أبيض",
      ivory: "سطح عاجي",
      sand: "سطح رملي",
      navy: "سطح كحلي",
    },
    booking: {
      title: "مسار الحجز",
      opened: "تم فتح تفاصيل الحصة. يمكنك الانتقال إلى إجراء الحجز.",
      success: "تم استلام الحجز",
      context: "يوغا هوائية Flow · السبت 09:00",
    },
    cancellation: {
      title: "مسار الإلغاء",
      trigger: "فتح إلغاء الحجز",
      dialogTitle: "إلغاء هذا الحجز؟",
      description: "سيعود رصيد واحد إلى رصيدك.",
      keep: "الإبقاء على الحجز",
      confirm: "إلغاء الحجز",
      pending: "جارٍ الحفظ",
      deadline: "يمكن الإلغاء حتى السبت الساعة 05:00.",
      success: "تم إلغاء الحجز",
      context: "يوغا هوائية Flow · السبت 09:00",
    },
  },
  en: {
    title: "Production interaction checks",
    program: "Program",
    destructive: {
      journeyTitle: "Admin confirmation journey",
      objectName: "Saturday 09:00 Aerial Yoga Flow",
      consequence: "This flow checks keyboard and focus behavior only. No data is changed.",
      title: "Cancel the test class?",
      trigger: "Open cancellation confirmation",
      cancel: "Cancel",
      confirm: "Confirm cancellation",
      pending: "Cancelling",
    },
    attendance: {
      title: "Attendance roster",
      filter: "Filter attendance roster",
      caption: "Attendance roster",
      member: "Member",
      phone: "Phone",
      status: "Status",
      booked: "Booked",
      attended: "Attended",
      empty: "No matching members",
    },
    focus: {
      title: "Focus visibility check",
      white: "White surface",
      ivory: "Ivory surface",
      sand: "Sand surface",
      navy: "Navy surface",
    },
    booking: {
      title: "Booking journey",
      opened: "Class details are open. Continue to the booking action.",
      success: "Booking received",
      context: "Aerial Yoga Flow · Saturday 09:00",
    },
    cancellation: {
      title: "Cancellation journey",
      trigger: "Open booking cancellation",
      dialogTitle: "Cancel this booking?",
      description: "One credit will be returned to your balance.",
      keep: "Keep booking",
      confirm: "Cancel booking",
      pending: "Saving",
      deadline: "Cancellation is available until Saturday at 05:00.",
      success: "Booking cancelled",
      context: "Aerial Yoga Flow · Saturday 09:00",
    },
  },
} satisfies Record<AuditLanguage, InteractionCopy>;

const scheduleClasses = [
  {
    id: "class-aerial",
    title: "Aerial Yoga Flow",
    title_he: "יוגה אווירית Flow",
    title_ar: "يوغا هوائية Flow",
    starts_at: "2026-08-30T09:00:00.000Z",
    program_type: { level: "Aerial" },
    instructor: { name: "Maya Cohen" },
    room_ref: { name: "Cloud Room" },
    energy: "Flow",
  },
  {
    id: "class-pilates",
    title: "Pilates Sculpt",
    title_he: "פילאטיס Sculpt",
    title_ar: "بيلاتيس Sculpt",
    starts_at: "2026-08-30T11:00:00.000Z",
    program_type: { level: "Pilates" },
    instructor: { name: "Lina Haddad" },
    room_ref: { name: "Core Room" },
    energy: "Strong",
  },
  {
    id: "class-balance",
    title: "Core Balance",
    title_he: "Core Balance",
    title_ar: "Core Balance",
    starts_at: "2026-08-31T15:00:00.000Z",
    program_type: { level: "Pilates" },
    instructor: { name: "Noor Saleh" },
    room_ref: { name: "Core Room" },
    energy: "Calm",
  },
] as const;

const bookingClass = {
  id: "class-aerial-booking",
  title: "Aerial Yoga Flow",
  title_en: "Aerial Yoga Flow",
  title_he: "יוגה אווירית Flow",
  title_ar: "يوغا هوائية Flow",
  starts_at: "2026-08-30T09:00:00.000Z",
  duration_minutes: 50,
  capacity: 8,
  booked_count: 4,
  credit_cost: 1,
  cancellation_window_hours: 4,
  status: "scheduled",
  energy: "Flow",
  instructor: { name: "Maya Cohen" },
  program_type: {
    name: "Aerial Yoga",
    name_en: "Aerial Yoga",
    name_he: "יוגה אווירית",
    name_ar: "يوغا هوائية",
    level: "Aerial",
  },
} as const;

export type InteractionJourney =
  | "all"
  | "booking"
  | "cancellation"
  | "instructor-attendance"
  | "admin-destructive-confirmation";

function BookingJourney({ language, copy }: { language: AuditLanguage; copy: InteractionCopy }) {
  const [opened, setOpened] = useState(false);
  const [booked, setBooked] = useState(false);
  const state = deriveBookingViewState({
    availability: "available",
    lang: language,
    seats: { remaining: 4, capacity: 8 },
    cost: { kind: "credits", count: 1 },
    outcome: booked
      ? { kind: "success", message: copy.booking.success, context: copy.booking.context }
      : undefined,
  });
  return (
    <section data-interaction-flow="booking" aria-labelledby="booking-journey-title">
      <h2 id="booking-journey-title">{copy.booking.title}</h2>
      <PremiumLessonReservationCard
        cls={bookingClass}
        state={{ kind: "available", spotsLeft: 4 }}
        bookingPresentationAudience="member"
        onOpen={() => setOpened(true)}
        eager
      />
      <p role="status" aria-live="polite" aria-atomic="true">
        {opened ? copy.booking.opened : ""}
      </p>
      <BookingActionPanel state={state} onAction={() => setBooked(true)} />
    </section>
  );
}

function CancellationJourney({
  language,
  dir,
  copy,
}: {
  language: AuditLanguage;
  dir: "ltr" | "rtl";
  copy: InteractionCopy;
}) {
  const [open, setOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const state = deriveBookingViewState({
    availability: "booked",
    lang: language,
    manageLabel: copy.cancellation.confirm,
    cancellationDeadline: copy.cancellation.deadline,
  });
  const outcomeState = deriveBookingViewState({
    availability: "booked",
    lang: language,
    outcome: cancelled
      ? cancellationOutcomePresentation({
          kind: "success",
          message: copy.cancellation.success,
          context: copy.cancellation.context,
          refundedCredits: copy.cancellation.description,
          cancellationDeadline: copy.cancellation.deadline,
        })
      : undefined,
  });
  return (
    <section data-interaction-flow="cancellation" aria-labelledby="cancellation-journey-title">
      <h2 id="cancellation-journey-title">{copy.cancellation.title}</h2>
      <BookingActionPanel state={cancelled ? outcomeState : state} showAction={false} />
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        {copy.cancellation.trigger}
      </button>
      <MemberCancellationDialog
        open={open}
        onOpenChange={setOpen}
        dir={dir}
        title={copy.cancellation.dialogTitle}
        description={copy.cancellation.description}
        classTitle={copy.booking.context.split(" · ")[0]}
        formattedDate={copy.cancellation.context.split(" · ")[1] ?? ""}
        formattedTime="09:00"
        state={state}
        keepLabel={copy.cancellation.keep}
        confirmLabel={copy.cancellation.confirm}
        pending={false}
        onConfirm={() => {
          setCancelled(true);
          setOpen(false);
        }}
      />
    </section>
  );
}

export function InteractionFixture({
  language,
  journey = "all",
}: {
  language: AuditLanguage;
  journey?: InteractionJourney;
}) {
  const dir = language === "en" ? "ltr" : "rtl";
  const copy = interactionCopy[language];
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [dateScope, setDateScope] = useState<DateScope>("all");
  const [program, setProgram] = useState<string | undefined>();
  const [rosterQuery, setRosterQuery] = useState("");
  const visibleScheduleClasses = useMemo(
    () =>
      filterScheduleClasses(scheduleClasses, {
        search: scheduleSearch,
        dateScope,
        filter: { level: program },
        now: new Date("2026-08-29T00:00:00.000Z"),
      }),
    [dateScope, program, scheduleSearch],
  );
  const localizedRoster = useMemo(
    () =>
      roster.map((entry) => ({
        ...entry,
        status: entry.status === "booked" ? copy.attendance.booked : copy.attendance.attended,
      })),
    [copy],
  );
  const rosterColumns: readonly ResponsiveDataListColumn<(typeof localizedRoster)[number]>[] = [
    { id: "member", label: copy.attendance.member, cell: (entry) => entry.member.name },
    { id: "phone", label: copy.attendance.phone, cell: (entry) => entry.member.phone },
    { id: "status", label: copy.attendance.status, cell: (entry) => entry.status },
  ];
  const show = (target: Exclude<InteractionJourney, "all">) =>
    journey === "all" || journey === target;
  const title =
    journey === "booking"
      ? copy.booking.title
      : journey === "cancellation"
        ? copy.cancellation.title
        : journey === "instructor-attendance"
          ? copy.attendance.title
          : journey === "admin-destructive-confirmation"
            ? copy.destructive.journeyTitle
            : copy.title;

  return (
    <section
      data-product-view="task-15-interaction-fixture"
      className="mx-auto grid w-full max-w-5xl gap-8 bg-[var(--color-surface-warm)] p-6"
      dir={dir}
      lang={language}
      data-voiceover-journey={journey}
      aria-labelledby="interaction-fixture-title"
    >
      <h1 id="interaction-fixture-title">{title}</h1>

      {journey === "all" ? (
        <div data-interaction-flow="schedule-filter">
          <MemberScheduleFilterPanel
            dir={dir}
            lang={language}
            search={scheduleSearch}
            onSearchChange={setScheduleSearch}
            dateScope={dateScope}
            onDateScopeChange={setDateScope}
            filters={[
              {
                key: "level",
                label: copy.program,
                options: ["Aerial", "Pilates"],
                value: program,
              },
            ]}
            onFilterChange={(_key, value) => setProgram(value)}
          />
          <ul data-testid="schedule-results" aria-live="polite">
            {visibleScheduleClasses.map((entry) => (
              <li key={entry.id} data-class-id={entry.id}>
                {language === "he"
                  ? entry.title_he
                  : language === "ar"
                    ? entry.title_ar
                    : entry.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {show("admin-destructive-confirmation") ? (
        <section data-interaction-flow="dialog" aria-labelledby="admin-confirmation-title">
          <h2 id="admin-confirmation-title">{copy.destructive.journeyTitle}</h2>
          <AdminDestructiveAction
            objectName={copy.destructive.objectName}
            consequence={copy.destructive.consequence}
            title={copy.destructive.title}
            triggerLabel={copy.destructive.trigger}
            cancelLabel={copy.destructive.cancel}
            confirmLabel={copy.destructive.confirm}
            pendingLabel={copy.destructive.pending}
            onConfirm={async () => undefined}
          />
        </section>
      ) : null}

      {show("instructor-attendance") ? (
        <section data-interaction-flow="table-filter" aria-labelledby="table-filter-title">
          <h2 id="table-filter-title">{copy.attendance.title}</h2>
          <label htmlFor="task-15-roster-filter">{copy.attendance.filter}</label>
          <Input
            id="task-15-roster-filter"
            value={rosterQuery}
            onChange={(event) => setRosterQuery(event.target.value)}
            autoComplete="off"
          />
          <div data-testid="attendance-results" aria-live="polite" aria-atomic="true">
            <AttendanceRosterList
              roster={localizedRoster}
              query={rosterQuery}
              lang={language}
              caption={copy.attendance.caption}
              columns={rosterColumns}
              getRowKey={(entry) => entry.id}
              empty={<p>{copy.attendance.empty}</p>}
            />
          </div>
        </section>
      ) : null}

      {show("booking") ? <BookingJourney language={language} copy={copy} /> : null}

      {show("cancellation") ? (
        <CancellationJourney language={language} dir={dir} copy={copy} />
      ) : null}

      {journey === "all" ? (
        <section data-interaction-flow="focus-surfaces" aria-labelledby="focus-surfaces-title">
          <h2 id="focus-surfaces-title">{copy.focus.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div data-focus-surface="white" className="bg-white p-4">
              <Button variant="outline">{copy.focus.white}</Button>
            </div>
            <div
              data-focus-surface="ivory"
              className="surface-ivory p-4"
              style={{ backgroundColor: "var(--cc-surface-canvas)" }}
            >
              <Button variant="outline">{copy.focus.ivory}</Button>
            </div>
            <div
              data-focus-surface="sand"
              className="surface-sand p-4"
              style={{ backgroundColor: "var(--color-sand)" }}
            >
              <Button variant="outline">{copy.focus.sand}</Button>
            </div>
            <div
              data-focus-surface="navy"
              className="surface-navy p-4"
              style={
                {
                  backgroundColor: "var(--color-navy)",
                  "--cc-focus-color": "var(--cc-focus-color-dark)",
                  "--cc-focus-outline": "3px solid var(--cc-focus-color-dark)",
                } as CSSProperties
              }
            >
              <Button variant="outline">{copy.focus.navy}</Button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
