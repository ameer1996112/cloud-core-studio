import type { Lang } from "@/lib/i18n";

export type AttendanceStatus = "unmarked" | "present" | "absent" | "late" | "excused";
export type AttendanceSourceStatus =
  | AttendanceStatus
  | "booked"
  | "checked_in"
  | "attended"
  | "no_show"
  | "cancelled";

export type AttendanceStatusPresentation = {
  status: AttendanceStatus;
  label: string;
  className: string;
};

export type AttendanceRosterState<T> =
  | { status: "loading"; label: string }
  | { status: "empty"; title: string; body: string }
  | { status: "ready"; data: readonly T[] };

export type AttendanceSaveStatus = "idle" | "pending" | "saved" | "save-failed" | "offline-retry";

export type AttendanceSaveOutcome = {
  tone: "success" | "error";
  title: string;
  body: string;
  persistent: true;
  retry?: boolean;
};

export type AttendanceSaveState = {
  status: AttendanceSaveStatus;
  label: string;
  actionLocked: boolean;
  outcome?: AttendanceSaveOutcome;
};

const COPY: Record<
  Lang,
  {
    loading: string;
    emptyTitle: string;
    emptyBody: string;
    status: Record<AttendanceStatus, string>;
    pending: (name?: string) => string;
    savedTitle: string;
    savedBody: (name?: string) => string;
    failedTitle: string;
    failedBody: (name?: string) => string;
    offlineTitle: string;
    offlineBody: string;
  }
> = {
  en: {
    loading: "Loading attendance roster…",
    emptyTitle: "No members in this roster",
    emptyBody: "There are no bookings to mark for this class.",
    status: {
      unmarked: "Not marked",
      present: "Present",
      absent: "Absent",
      late: "Late",
      excused: "Excused",
    },
    pending: (name) => (name ? `Saving attendance for ${name}…` : "Saving attendance…"),
    savedTitle: "Attendance saved",
    savedBody: (name) => (name ? `Attendance for ${name} was saved.` : "Attendance was saved."),
    failedTitle: "Attendance was not saved",
    failedBody: (name) =>
      name
        ? `Attendance for ${name} could not be saved. Try again.`
        : "Attendance could not be saved. Try again.",
    offlineTitle: "You appear to be offline",
    offlineBody: "Reconnect, then retry saving attendance.",
  },
  he: {
    loading: "רשימת הנוכחות נטענת…",
    emptyTitle: "אין חברים ברשימה",
    emptyBody: "אין הזמנות לסימון בשיעור הזה.",
    status: {
      unmarked: "טרם סומן",
      present: "נוכח/ת",
      absent: "נעדר/ת",
      late: "איחור",
      excused: "היעדרות מוצדקת",
    },
    pending: (name) => (name ? `שומר נוכחות עבור ${name}…` : "שומר נוכחות…"),
    savedTitle: "הנוכחות נשמרה",
    savedBody: (name) => (name ? `הנוכחות של ${name} נשמרה.` : "הנוכחות נשמרה."),
    failedTitle: "הנוכחות לא נשמרה",
    failedBody: (name) =>
      name
        ? `לא הצלחנו לשמור את הנוכחות של ${name}. נסו שוב.`
        : "לא הצלחנו לשמור את הנוכחות. נסו שוב.",
    offlineTitle: "נראה שאין חיבור לרשת",
    offlineBody: "התחברו מחדש ונסו שוב לשמור את הנוכחות.",
  },
  ar: {
    loading: "جارٍ تحميل قائمة الحضور…",
    emptyTitle: "لا يوجد أعضاء في القائمة",
    emptyBody: "لا توجد حجوزات لتسجيلها في هذه الحصة.",
    status: {
      unmarked: "لم يُسجل بعد",
      present: "حاضر",
      absent: "غائب",
      late: "متأخر",
      excused: "غياب بعذر",
    },
    pending: (name) => (name ? `جارٍ حفظ حضور ${name}…` : "جارٍ حفظ الحضور…"),
    savedTitle: "تم حفظ الحضور",
    savedBody: (name) => (name ? `تم حفظ حضور ${name}.` : "تم حفظ الحضور."),
    failedTitle: "لم يتم حفظ الحضور",
    failedBody: (name) =>
      name ? `تعذر حفظ حضور ${name}. حاولي مرة أخرى.` : "تعذر حفظ الحضور. حاولي مرة أخرى.",
    offlineTitle: "يبدو أنك غير متصلة بالإنترنت",
    offlineBody: "أعيدي الاتصال ثم حاولي حفظ الحضور مرة أخرى.",
  },
};

const STATUS_CLASSES: Record<AttendanceStatus, string> = {
  unmarked: "border-slate/30 bg-white text-slate",
  present: "border-emerald-600/30 bg-emerald-50 text-emerald-950",
  absent: "border-destructive/30 bg-destructive/5 text-destructive",
  late: "border-gold/45 bg-gold/10 text-navy",
  excused: "border-slate/30 bg-sand/60 text-slate",
};

function normalizeAttendanceStatus(status: AttendanceSourceStatus): AttendanceStatus {
  if (status === "checked_in" || status === "attended") return "present";
  if (status === "no_show") return "absent";
  if (status === "booked") return "unmarked";
  if (status === "cancelled") return "excused";
  return status;
}

export function getAttendanceStatusPresentation(
  sourceStatus: AttendanceSourceStatus,
  lang: Lang,
): AttendanceStatusPresentation {
  const status = normalizeAttendanceStatus(sourceStatus);
  return {
    status,
    label: COPY[lang].status[status],
    className: STATUS_CLASSES[status],
  };
}

export function deriveAttendanceRosterState<T>({
  isLoading,
  roster,
  lang = "en",
}: {
  isLoading: boolean;
  roster: readonly T[];
  lang?: Lang;
}): AttendanceRosterState<T> {
  if (isLoading) return { status: "loading", label: COPY[lang].loading };
  if (roster.length === 0) {
    return { status: "empty", title: COPY[lang].emptyTitle, body: COPY[lang].emptyBody };
  }
  return { status: "ready", data: roster };
}

export function deriveAttendanceSaveState({
  status,
  lang,
  memberName,
}: {
  status: AttendanceSaveStatus;
  lang: Lang;
  memberName?: string;
  /** Technical detail is accepted for compatibility but is never user-visible. */
  errorMessage?: string;
}): AttendanceSaveState {
  const copy = COPY[lang];
  if (status === "idle") return { status, label: "", actionLocked: false };
  if (status === "pending") {
    return { status, label: copy.pending(memberName), actionLocked: true };
  }
  if (status === "saved") {
    return {
      status,
      label: copy.savedTitle,
      actionLocked: false,
      outcome: {
        tone: "success",
        title: copy.savedTitle,
        body: copy.savedBody(memberName),
        persistent: true,
      },
    };
  }

  const offline = status === "offline-retry";
  return {
    status,
    label: offline ? copy.offlineTitle : copy.failedTitle,
    actionLocked: false,
    outcome: {
      tone: "error",
      title: offline ? copy.offlineTitle : copy.failedTitle,
      body: offline ? copy.offlineBody : copy.failedBody(memberName),
      persistent: true,
      retry: offline || undefined,
    },
  };
}
