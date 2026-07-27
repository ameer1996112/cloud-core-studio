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
      state: "first_visit_preparation" | "first_visit_reflection" | "next_class";
      priority: 3 | 4 | 5;
      eyebrow: string;
      title: string;
      note: string;
      primaryAction: PersonalConciergeAction;
      booking?: PersonalConciergeBooking;
      reason:
        | "first_booking_before_first_attendance"
        | "verified_first_attendance"
        | "personalization_paused";
    };

const COPY = {
  he: {
    betweenUs: "בינינו",
    expecting: "מחכה לך בסטודיו",
    preparation: (name: string) => `${name}, הכנתי לך את כל מה שכדאי לדעת לפני השיעור הראשון.`,
    prepare: "להכנה לשיעור",
    reflectionTitle: "שמחתי שהגעת",
    reflection: (name: string) =>
      `${name}, אין צורך לענות עכשיו. כשתרצי, אשמח ללמוד מה הכי מתאים לך.`,
    preferences: "לספר לי מה מתאים לך",
    nextClass: "השיעור הבא שלך",
    viewBooking: "צפייה בהזמנה",
  },
  ar: {
    betweenUs: "بيننا",
    expecting: "بانتظارك في الاستوديو",
    preparation: (name: string) => `${name}، جهّزت لك كل ما يفيدك قبل حصتك الأولى.`,
    prepare: "التحضير للحصة",
    reflectionTitle: "سعدت بحضورك",
    reflection: (name: string) =>
      `${name}، لا حاجة للرد الآن. عندما ترغبين، يسعدني أن أعرف ما يناسبك.`,
    preferences: "إخباري بما يناسبك",
    nextClass: "حصتك القادمة",
    viewBooking: "عرض الحجز",
  },
  en: {
    betweenUs: "Between us",
    expecting: "I am looking forward to welcoming you",
    preparation: (name: string) =>
      `${name}, I prepared everything worth knowing before your first class.`,
    prepare: "Prepare for class",
    reflectionTitle: "It was lovely having you",
    reflection: (name: string) =>
      `${name}, there is no need to reply now. When you are ready, I would love to learn what suits you.`,
    preferences: "Tell me what suits you",
    nextClass: "Your next class",
    viewBooking: "View booking",
  },
} satisfies Record<PersonalConciergeLocale, Record<string, unknown>>;

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

  if (
    !input.member.personalizationPaused &&
    input.member.attendanceCount === 1 &&
    input.latestAttendance?.status === "attended"
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

  return {
    state: "quiet",
    priority: 9,
    reason: "no_meaningful_moment",
  };
}
