export type PersonalConciergeLocale = "he" | "ar" | "en";

export type PersonalConciergeBooking = {
  id: string;
  className: string;
  startsAt: string;
  instructorName: string | null;
  locationName: string | null;
};

type PersonalConciergeInput = {
  member: {
    firstName: string;
    locale: PersonalConciergeLocale;
    attendanceCount: number;
    personalizationPaused: boolean;
  };
  nextBooking: PersonalConciergeBooking | null;
  latestAttendance: {
    status: string;
    markedAt: string;
  } | null;
  now: string;
};

type PersonalConciergeAction = {
  label: string;
  to: string;
};

export type PersonalConciergeExperience =
  | {
      state: "quiet";
      priority: 9;
      reason: "no_meaningful_moment";
    }
  | {
      state:
        | "first_visit_preparation"
        | "first_visit_reflection"
        | "first_visit_missed"
        | "next_class";
      priority: 3 | 4 | 5;
      eyebrow: string;
      title: string;
      note: string;
      primaryAction: PersonalConciergeAction;
      booking?: PersonalConciergeBooking;
      reason:
        | "first_booking_before_first_attendance"
        | "verified_first_attendance"
        | "verified_first_no_show"
        | "personalization_paused";
    };

const COPY = {
  he: {
    betweenUs: "בינינו",
    expecting: "מחכה לך בסטודיו",
    preparation: (name: string) => `${name}, כל מה שכדאי לדעת לפני השיעור הראשון כבר מחכה לך.`,
    prepare: "להכנה לשיעור",
    reflectionTitle: "שמחתי שהגעת",
    reflection: (name: string) =>
      `${name}, אין צורך לענות עכשיו. כשתרצי, אשמח ללמוד מה הכי מתאים לך.`,
    preferences: "לספר לי מה מתאים לך",
    missedTitle: "לחזור בקצב שלך",
    missed: (name: string) => `${name}, המקום שלך כאן כשתרצי לנסות שוב. בלי לחץ.`,
    schedule: "למציאת שיעור מתאים",
    nextClass: "השיעור הבא שלך",
    viewBooking: "צפייה בהזמנה",
  },
  ar: {
    betweenUs: "بيننا",
    expecting: "بانتظارك في الاستوديو",
    preparation: (name: string) => `${name}، كل ما يفيدك قبل حصتك الأولى أصبح جاهزاً لك.`,
    prepare: "التحضير للحصة",
    reflectionTitle: "سعدت بحضورك",
    reflection: (name: string) =>
      `${name}، لا حاجة للرد الآن. عندما ترغبين، يسعدني أن أعرف ما يناسبك.`,
    preferences: "إخباري بما يناسبك",
    missedTitle: "عودي بالوتيرة التي تناسبك",
    missed: (name: string) => `${name}، مكانك هنا عندما ترغبين بالمحاولة مرة أخرى. بلا ضغط.`,
    schedule: "اختيار حصة مناسبة",
    nextClass: "حصتك القادمة",
    viewBooking: "عرض الحجز",
  },
  en: {
    betweenUs: "Between us",
    expecting: "I am looking forward to welcoming you",
    preparation: (name: string) =>
      `${name}, everything worth knowing before your first class is ready for you.`,
    prepare: "Prepare for class",
    reflectionTitle: "It was lovely having you",
    reflection: (name: string) =>
      `${name}, there is no need to reply now. When you are ready, I would love to learn what suits you.`,
    preferences: "Tell me what suits you",
    missedTitle: "Return at your own pace",
    missed: (name: string) =>
      `${name}, your place is here whenever you would like to try again. No pressure.`,
    schedule: "Find a suitable class",
    nextClass: "Your next class",
    viewBooking: "View booking",
  },
} satisfies Record<PersonalConciergeLocale, Record<string, unknown>>;

export function resolvePersonalConciergeVisibility(
  env: Record<string, string | undefined>,
  memberId: string,
) {
  if (env.PERSONAL_CONCIERGE_MODE === "live") return true;
  if (env.PERSONAL_CONCIERGE_MODE !== "test_only") return false;
  return (env.PERSONAL_CONCIERGE_TEST_MEMBER_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(memberId);
}

function isRecent(markedAt: string, now: string) {
  const elapsed = new Date(now).getTime() - new Date(markedAt).getTime();
  return elapsed >= 0 && elapsed <= 72 * 60 * 60 * 1000;
}

function bookingTime(startsAt: string, locale: PersonalConciergeLocale) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale === "ar" ? "ar-IL" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(startsAt));
}

export function resolvePersonalConciergeExperience(
  input: PersonalConciergeInput,
): PersonalConciergeExperience {
  const copy = COPY[input.member.locale];

  if (input.member.personalizationPaused && input.nextBooking) {
    return {
      state: "next_class",
      priority: 3,
      eyebrow: copy.nextClass,
      title: input.nextBooking.className,
      note: bookingTime(input.nextBooking.startsAt, input.member.locale),
      primaryAction: { label: copy.viewBooking, to: "/member/bookings" },
      booking: input.nextBooking,
      reason: "personalization_paused",
    };
  }

  if (
    !input.member.personalizationPaused &&
    input.member.attendanceCount === 0 &&
    input.latestAttendance?.status === "no_show" &&
    isRecent(input.latestAttendance.markedAt, input.now)
  ) {
    return {
      state: "first_visit_missed",
      priority: 5,
      eyebrow: copy.betweenUs,
      title: copy.missedTitle,
      note: copy.missed(input.member.firstName),
      primaryAction: { label: copy.schedule, to: "/member/schedule" },
      reason: "verified_first_no_show",
    };
  }

  if (
    !input.member.personalizationPaused &&
    input.member.attendanceCount === 1 &&
    input.latestAttendance?.status === "attended" &&
    isRecent(input.latestAttendance.markedAt, input.now)
  ) {
    return {
      state: "first_visit_reflection",
      priority: 5,
      eyebrow: copy.betweenUs,
      title: copy.reflectionTitle,
      note: copy.reflection(input.member.firstName),
      primaryAction: {
        label: copy.preferences,
        to: "/member/account#between-us",
      },
      reason: "verified_first_attendance",
    };
  }

  if (
    !input.member.personalizationPaused &&
    input.member.attendanceCount === 0 &&
    input.nextBooking
  ) {
    return {
      state: "first_visit_preparation",
      priority: 4,
      eyebrow: copy.betweenUs,
      title: copy.expecting,
      note: copy.preparation(input.member.firstName),
      primaryAction: {
        label: copy.prepare,
        to: "/member/bookings?concierge=first-visit",
      },
      booking: input.nextBooking,
      reason: "first_booking_before_first_attendance",
    };
  }

  return {
    state: "quiet",
    priority: 9,
    reason: "no_meaningful_moment",
  };
}
