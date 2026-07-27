export type PersonalConciergeLocale = "he" | "ar" | "en";
export type PersonalConciergeCommunicationPace = "quiet" | "balanced" | "attentive";

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
    communicationPace?: PersonalConciergeCommunicationPace;
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

const PACED_NOTES = {
  he: {
    quiet: {
      preparation: (name: string) => `${name}, הפרטים החשובים לקראת השיעור הראשון מחכים לך כאן.`,
      reflection: (name: string) => `${name}, כשתרצי, אפשר לספר לי בקצרה מה התאים לך.`,
      missed: (name: string) => `${name}, אפשר לחזור כשתרצי. בלי לחץ.`,
    },
    attentive: {
      preparation: (name: string) =>
        `${name}, איזה כיף שאת בדרך אלינו. הכנו לך ליווי אישי לקראת השיעור הראשון.`,
      reflection: (name: string) =>
        `${name}, שמחתי שהגעת. כשתרצי, אשמח ללמוד מה יעזור לך להרגיש כאן הכי טוב.`,
      missed: (name: string) =>
        `${name}, אנחנו כאן בשבילך. כשתרגישי מוכנה, נעזור לך לבחור התחלה חדשה ונעימה.`,
    },
  },
  ar: {
    quiet: {
      preparation: (name: string) => `${name}، التفاصيل المهمة قبل حصتك الأولى جاهزة هنا.`,
      reflection: (name: string) => `${name}، عندما ترغبين، أخبريني باختصار ما الذي ناسبك.`,
      missed: (name: string) => `${name}، يمكنك العودة عندما ترغبين. من دون ضغط.`,
    },
    attentive: {
      preparation: (name: string) =>
        `${name}، يسعدنا أنك في طريقك إلينا. أعددنا لك مرافقة شخصية قبل حصتك الأولى.`,
      reflection: (name: string) =>
        `${name}، سعدت بحضورك. عندما ترغبين، يسعدني أن أعرف ما يساعدك على الشعور بأفضل حال هنا.`,
      missed: (name: string) =>
        `${name}، نحن هنا من أجلك. عندما تكونين مستعدة، سنساعدك على اختيار بداية جديدة ومريحة.`,
    },
  },
  en: {
    quiet: {
      preparation: (name: string) =>
        `${name}, the essential details for your first class are ready here.`,
      reflection: (name: string) =>
        `${name}, when you are ready, you can briefly tell me what suited you.`,
      missed: (name: string) => `${name}, return whenever you are ready. No pressure.`,
    },
    attentive: {
      preparation: (name: string) =>
        `${name}, we are so glad you are on your way. Your personal first-class guidance is ready.`,
      reflection: (name: string) =>
        `${name}, it was lovely having you. When you are ready, I would love to learn what helps you feel your best here.`,
      missed: (name: string) =>
        `${name}, we are here for you. When you feel ready, we will help you choose a fresh, comfortable start.`,
    },
  },
} satisfies Record<
  PersonalConciergeLocale,
  Record<
    Exclude<PersonalConciergeCommunicationPace, "balanced">,
    Record<"preparation" | "reflection" | "missed", (name: string) => string>
  >
>;

function pacedNote(
  locale: PersonalConciergeLocale,
  pace: PersonalConciergeCommunicationPace | undefined,
  moment: "preparation" | "reflection" | "missed",
  balanced: (name: string) => string,
  name: string,
) {
  if (!pace || pace === "balanced") return balanced(name);
  return PACED_NOTES[locale][pace][moment](name);
}

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
      note: pacedNote(
        input.member.locale,
        input.member.communicationPace,
        "missed",
        copy.missed,
        input.member.firstName,
      ),
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
      note: pacedNote(
        input.member.locale,
        input.member.communicationPace,
        "reflection",
        copy.reflection,
        input.member.firstName,
      ),
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
      note: pacedNote(
        input.member.locale,
        input.member.communicationPace,
        "preparation",
        copy.preparation,
        input.member.firstName,
      ),
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
