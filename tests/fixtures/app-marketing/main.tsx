import { createRoot } from "react-dom/client";
import { CalendarDays, CheckCircle2, Clock3, MapPin, Sparkles, UserRound } from "lucide-react";
import { applyLang, getDirection, type Lang } from "@/lib/i18n";
import {
  ClassArtTile,
  LessonAvailabilityMeter,
  ScheduleDaySection,
  VisualClassCard,
} from "@/components/visual/VisualClassCard";
import "./fixture.css";

declare global {
  interface Window {
    MARKETING_CAPTURE_FIXTURE?: string;
  }
}

if (import.meta.env.PROD || window.MARKETING_CAPTURE_FIXTURE !== "1") {
  throw new Error("MARKETING_CAPTURE_FIXTURE may only run in a local development capture session.");
}

type Screen = "schedule" | "booking" | "bookings" | "membership" | "account" | "social";
const STUDIO_TIME_ZONE = "Asia/Jerusalem";
const SESSION_STARTS_AT = "2031-09-10T17:30:00.000Z";
const SESSION_DURATION_MINUTES = 55;
const SESSION_CANCELLATION_WINDOW_HOURS = 4;
const SCHEDULE_OPEN_SPOTS = [5, 3, 6] as const;
const MEMBERSHIP_CREDITS = 8;

const copy = {
  en: {
    member: "Demo Member",
    schedule: "Schedule",
    booking: "Class details",
    bookings: "My bookings",
    membership: "Membership",
    account: "Profile",
    today: "This week",
    detailTitle: "Aerial Yoga",
    details: "Class details",
    confirmed: "Confirmed",
    upcoming: "Upcoming booking",
    membershipTitle: "Your membership",
    accountTitle: "Demo Member",
    socialKicker: "Cloud & Core app",
    socialTitle: "Your practice, in one calm place.",
    socialBody: "View the schedule, reserve your space, and keep your membership close.",
  },
  he: {
    member: "חברת סטודיו",
    schedule: "לוח שיעורים",
    booking: "פרטי שיעור",
    bookings: "ההזמנות שלי",
    membership: "מנוי",
    account: "פרופיל",
    today: "השבוע שלך",
    detailTitle: "יוגה אווירית",
    details: "פרטי השיעור",
    confirmed: "מאושר",
    upcoming: "הזמנה קרובה",
    membershipTitle: "המנוי שלך",
    accountTitle: "חברת סטודיו",
    socialKicker: "אפליקציית Cloud & Core",
    socialTitle: "התרגול שלך, במקום רגוע אחד.",
    socialBody: "צפייה בלוח, שמירת מקום ומעקב נעים אחרי המנוי שלך.",
  },
  ar: {
    member: "عضوة تجريبية",
    schedule: "جدول الحصص",
    booking: "تفاصيل الحصة",
    bookings: "حجوزاتي",
    membership: "الاشتراك",
    account: "الملف الشخصي",
    today: "أسبوعك",
    detailTitle: "يوغا هوائية",
    details: "تفاصيل الحصة",
    confirmed: "تم التأكيد",
    upcoming: "حجز قريب",
    membershipTitle: "اشتراكك",
    accountTitle: "عضوة تجريبية",
    socialKicker: "تطبيق Cloud & Core",
    socialTitle: "تمرينك، في مكان هادئ واحد.",
    socialBody: "شاهدي الجدول، احجزي مكانك، وتابعي اشتراكك بسهولة.",
  },
} as const;

function instructorRole(lang: Lang) {
  if (lang === "he") return "מדריכת סטודיו";
  if (lang === "ar") return "مدرّبة الاستوديو";
  return "Studio Instructor";
}

function sessionAtOffset(minutes: number) {
  return new Date(new Date(SESSION_STARTS_AT).getTime() + minutes * 60_000).toISOString();
}

function sessionLabels(lang: Lang) {
  const locale = lang === "he" ? "he-IL" : lang === "ar" ? "ar-IL" : "en-GB";
  const startsAt = new Date(SESSION_STARTS_AT);
  const cancellationDeadline = new Date(
    startsAt.getTime() - SESSION_CANCELLATION_WINDOW_HOURS * 60 * 60_000,
  );
  const date = new Intl.DateTimeFormat(locale, {
    timeZone: STUDIO_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(startsAt);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: STUDIO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startsAt);
  const cancellationTime = new Intl.DateTimeFormat(locale, {
    timeZone: STUDIO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(cancellationDeadline);
  return { date, time, dateTime: `${date} · ${time}`, cancellationTime };
}

function classesFor(lang: Lang) {
  const instructor = { name: instructorRole(lang) };
  const classModel = {
    title: "Cloud & Core — Aerial Yoga",
    starts_at: SESSION_STARTS_AT,
    duration_minutes: SESSION_DURATION_MINUTES,
    capacity: 12,
    booked_count: 7,
    credit_cost: 1,
    cancellation_window_hours: SESSION_CANCELLATION_WINDOW_HOURS,
    energy: "flow",
    room: "Main Studio",
    instructor,
    program_type: {
      name: "Aerial Yoga",
      name_en: "Aerial Yoga",
      name_he: "יוגה אווירית",
      name_ar: "يوغا هوائية",
      level: "Beginner to intermediate",
    },
  };
  const secondClassModel = {
    ...classModel,
    title: "Cloud & Core — Mat Pilates",
    starts_at: sessionAtOffset(90),
    booked_count: 9,
    program_type: {
      name: "Mat Pilates",
      name_en: "Mat Pilates",
      name_he: "פילאטיס מזרן",
      name_ar: "بيلاتيس فرشة",
      level: "All levels",
    },
  };
  const thirdClassModel = {
    ...classModel,
    title: "Cloud & Core — Hot Pilates",
    starts_at: sessionAtOffset(165),
    booked_count: 6,
    program_type: {
      name: "Hot Pilates",
      name_en: "Hot Pilates",
      name_he: "הוט פילאטיס",
      name_ar: "هوت بيلاتيس",
      level: "Intermediate to advanced",
    },
  };
  return [classModel, secondClassModel, thirdClassModel] as const;
}

function labels(lang: Lang) {
  const session = sessionLabels(lang);
  if (lang === "he") {
    return {
      book: "הזמנת מקום",
      with: `עם ${instructorRole(lang)}`,
      studio: "סטודיו Cloud & Core",
      spots: "5 מקומות פנויים",
      duration: `${SESSION_DURATION_MINUTES} דק׳`,
      when: session.dateTime,
      cancellationTime: session.cancellationTime,
      notes: "אפשר לבטל עד 4 שעות לפני השיעור. הביאי מים ובגדים נוחים.",
      credits: "1 קרדיט",
      addCalendar: "להוסיף ליומן",
      viewBooking: "לצפייה בהזמנה",
      remaining: "8 קרדיטים זמינים",
      active: "מנוי פעיל",
      nextRenewal: "בתוקף עד 30 בספטמבר",
      classes: "שיעורים החודש",
      usage: "4 מתוך 6 שיעורים נוצלו",
      personal: "פרטים אישיים",
      language: "שפת האפליקציה",
      preference: "תרגול מועדף",
      contact: "עדכונים מהסטודיו",
      langValue: "עברית",
      preferenceValue: "יוגה אווירית",
      contactValue: "הודעות באפליקציה",
      memberSince: "חברה מאז 2026",
    };
  }
  if (lang === "ar") {
    return {
      book: "احجزي مكانك",
      with: `مع ${instructorRole(lang)}`,
      studio: "استوديو Cloud & Core",
      spots: "5 أماكن متاحة",
      duration: `${SESSION_DURATION_MINUTES} دقيقة`,
      when: session.dateTime,
      cancellationTime: session.cancellationTime,
      notes: "يمكنك الإلغاء حتى 4 ساعات قبل الحصة. أحضري الماء وملابس مريحة.",
      credits: "رصيد واحد",
      addCalendar: "أضيفي إلى التقويم",
      viewBooking: "عرض الحجز",
      remaining: "8 أرصدة متاحة",
      active: "اشتراك نشط",
      nextRenewal: "ساري حتى 30 أيلول",
      classes: "حصص هذا الشهر",
      usage: "استخدمتِ 4 من 6 حصص",
      personal: "تفاصيلك",
      language: "لغة التطبيق",
      preference: "التمرين المفضل",
      contact: "تحديثات الاستوديو",
      langValue: "العربية",
      preferenceValue: "يوغا هوائية",
      contactValue: "رسائل داخل التطبيق",
      memberSince: "عضوة منذ 2026",
    };
  }
  return {
    book: "Book your spot",
    with: `With ${instructorRole(lang)}`,
    studio: "Cloud & Core Studio",
    spots: "5 spots open",
    duration: `${SESSION_DURATION_MINUTES} min`,
    when: session.dateTime,
    cancellationTime: session.cancellationTime,
    notes: "Cancel up to 4 hours before class. Bring water and comfortable movement clothes.",
    credits: "1 credit",
    addCalendar: "Add to calendar",
    viewBooking: "View booking",
    remaining: "8 credits available",
    active: "Active membership",
    nextRenewal: "Active through 30 September",
    classes: "Classes this month",
    usage: "4 of 6 classes used",
    personal: "Personal details",
    language: "App language",
    preference: "Preferred practice",
    contact: "Studio updates",
    langValue: "English",
    preferenceValue: "Aerial Yoga",
    contactValue: "In-app messages",
    memberSince: "Member since 2026",
  };
}

function PhoneHeader({ lang, current }: { lang: Lang; current: Screen }) {
  const text = copy[lang];
  return (
    <>
      <header className="capture-phone__header">
        <img src="/brand/cloud-core-logo-full.svg" alt="Cloud & Core" />
        <span className="capture-phone__member" aria-label={text.member}>
          <UserRound size={16} />
        </span>
      </header>
      <nav className="capture-phone__nav" aria-label="Member navigation">
        {(["schedule", "bookings", "membership", "account"] as const).map((item) => (
          <span key={item} className={current === item ? "is-active" : ""}>
            {text[item]}
          </span>
        ))}
      </nav>
    </>
  );
}

function PhoneFrame({
  lang,
  screen,
  captureState,
  children,
}: {
  lang: Lang;
  screen: Screen;
  captureState: Record<string, boolean | number | readonly number[]>;
  children: React.ReactNode;
}) {
  return (
    <main
      className="capture-phone"
      dir={getDirection(lang)}
      lang={lang}
      data-capture-ready="true"
      data-capture-kind={screen}
      data-capture-state={JSON.stringify(captureState)}
    >
      <PhoneHeader lang={lang} current={screen} />
      <div className="capture-phone__body">{children}</div>
    </main>
  );
}

function ScheduleScreen({ lang }: { lang: Lang }) {
  const text = copy[lang];
  const [classModel, secondClassModel, thirdClassModel] = classesFor(lang);
  return (
    <PhoneFrame
      lang={lang}
      screen="schedule"
      captureState={{
        availableClassCount: [classModel, secondClassModel, thirdClassModel].length,
        bookingAction: true,
        openSpots: SCHEDULE_OPEN_SPOTS,
      }}
    >
      <div className="capture-phone__title-row">
        <div>
          <p>{text.today}</p>
          <h1>{text.schedule}</h1>
        </div>
        <CalendarDays size={20} color="#D4AF6A" />
      </div>
      <ScheduleDaySection date={new Date(SESSION_STARTS_AT)} count={3}>
        <VisualClassCard
          cls={classModel}
          state={{ kind: "available", spotsLeft: SCHEDULE_OPEN_SPOTS[0] }}
          onOpen={() => {}}
          eager
        />
        <VisualClassCard
          cls={secondClassModel}
          state={{ kind: "available", spotsLeft: SCHEDULE_OPEN_SPOTS[1] }}
          onOpen={() => {}}
          eager
        />
        <VisualClassCard
          cls={thirdClassModel}
          state={{ kind: "available", spotsLeft: SCHEDULE_OPEN_SPOTS[2] }}
          onOpen={() => {}}
          eager
        />
      </ScheduleDaySection>
    </PhoneFrame>
  );
}

function BookingScreen({ lang }: { lang: Lang }) {
  const text = copy[lang];
  const label = labels(lang);
  const [classModel] = classesFor(lang);
  return (
    <PhoneFrame lang={lang} screen="booking" captureState={{ bookingAction: true, openSpots: 5 }}>
      <div className="capture-phone__title-row">
        <div>
          <p>{sessionLabels(lang).date}</p>
          <h1>{text.details}</h1>
        </div>
        <Sparkles size={20} color="#D4AF6A" />
      </div>
      <section className="capture-detail" aria-label={text.details}>
        <div className="capture-detail__summary">
          <p className="member-eyebrow">Cloud &amp; Core</p>
          <h1>{text.detailTitle}</h1>
          <div className="capture-detail__meta">
            <span>{label.when}</span>
            <span>·</span>
            <span>{label.duration}</span>
            <span>·</span>
            <span>{label.spots}</span>
          </div>
          <div className="capture-detail__descriptor">
            <span>{label.with}</span>
            <span>·</span>
            <span>{label.studio}</span>
          </div>
          <LessonAvailabilityMeter
            capacity={12}
            bookedCount={7}
            lang={lang}
            dir={getDirection(lang)}
          />
        </div>
        <div className="capture-detail__grid">
          <div className="capture-detail__visual">
            <ClassArtTile programType={classModel.program_type} tone="flow" lang={lang} />
          </div>
          <div className="capture-detail__facts">
            <div className="capture-detail__fact">
              <small>{lang === "he" ? "מתי" : lang === "ar" ? "متى" : "When"}</small>
              <strong>{label.when}</strong>
            </div>
            <div className="capture-detail__fact">
              <small>{lang === "he" ? "איפה" : lang === "ar" ? "أين" : "Where"}</small>
              <strong>{label.studio}</strong>
            </div>
            <div className="capture-detail__fact">
              <small>{lang === "he" ? "קרדיטים" : lang === "ar" ? "الأرصدة" : "Credits"}</small>
              <strong>{label.credits}</strong>
            </div>
          </div>
        </div>
        <p className="capture-detail__note">
          <Clock3 size={14} /> {label.notes}
        </p>
        <button className="capture-detail__action" type="button">
          {label.book}
        </button>
      </section>
    </PhoneFrame>
  );
}

function BookingsScreen({ lang }: { lang: Lang }) {
  const text = copy[lang];
  const label = labels(lang);
  const [classModel] = classesFor(lang);
  return (
    <PhoneFrame lang={lang} screen="bookings" captureState={{ confirmed: Boolean(text.confirmed) }}>
      <div className="capture-phone__title-row">
        <div>
          <p>{text.upcoming}</p>
          <h1>{text.bookings}</h1>
        </div>
        <CheckCircle2 size={20} color="#D4AF6A" />
      </div>
      <section className="capture-booking-card" aria-label={text.confirmed}>
        <div className="capture-booking-card__art">
          <ClassArtTile programType={classModel.program_type} tone="flow" lang={lang} />
        </div>
        <div className="capture-booking-card__content">
          <span className="capture-booking-card__status">{text.confirmed}</span>
          <h2>{text.detailTitle}</h2>
          <p>{label.when}</p>
          <p>
            {label.duration} · {label.with}
          </p>
          <p>{label.studio}</p>
          <div className="capture-booking-card__footer">
            {label.viewBooking} · {label.addCalendar}
          </div>
        </div>
      </section>
      <div className="capture-list">
        <div className="capture-list__row">
          <span>
            {lang === "he" ? "חלון ביטול" : lang === "ar" ? "مهلة الإلغاء" : "Cancellation window"}
          </span>
          <span>
            {lang === "he"
              ? `עד ${label.cancellationTime}`
              : lang === "ar"
                ? `حتى ${label.cancellationTime}`
                : `Until ${label.cancellationTime}`}
          </span>
        </div>
        <div className="capture-list__row">
          <span>
            {lang === "he"
              ? "הקרדיט נשמר"
              : lang === "ar"
                ? "الرصيد محفوظ"
                : "Your credit is reserved"}
          </span>
          <span>{label.credits}</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MembershipScreen({
  lang,
  credits = MEMBERSHIP_CREDITS,
}: {
  lang: Lang;
  credits?: number;
}) {
  const text = copy[lang];
  const label = labels(lang);
  return (
    <PhoneFrame
      lang={lang}
      screen="membership"
      captureState={{ active: Boolean(label.active), credits }}
    >
      <div className="capture-phone__title-row">
        <div>
          <p>{text.member}</p>
          <h1>{text.membershipTitle}</h1>
        </div>
        <Sparkles size={20} color="#D4AF6A" />
      </div>
      <section className="capture-stat-grid">
        <div className="capture-stat">
          <span>
            {lang === "he"
              ? "קרדיטים זמינים"
              : lang === "ar"
                ? "الأرصدة المتاحة"
                : "Available credits"}
          </span>
          <strong>{credits}</strong>
        </div>
        <div className="capture-stat">
          <span>{label.classes}</span>
          <strong>4</strong>
        </div>
      </section>
      <section className="capture-plan">
        <span className="capture-booking-card__status">{label.active}</span>
        <h2>{lang === "he" ? "מסלול תנועה" : lang === "ar" ? "مسار الحركة" : "Movement plan"}</h2>
        <p>{label.nextRenewal}</p>
        <div className="capture-progress">
          <span />
        </div>
        <p>{label.usage}</p>
      </section>
      <div className="capture-list">
        <div className="capture-list__row">
          <span>
            {lang === "he" ? "יוגה אווירית" : lang === "ar" ? "يوغا هوائية" : "Aerial Yoga"}
          </span>
          <span>{lang === "he" ? "הוזמן" : lang === "ar" ? "محجوز" : "Booked"}</span>
        </div>
        <div className="capture-list__row">
          <span>
            {lang === "he" ? "פילאטיס מזרן" : lang === "ar" ? "بيلاتيس فرشة" : "Mat Pilates"}
          </span>
          <span>{label.remaining}</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

function AccountScreen({ lang }: { lang: Lang }) {
  const text = copy[lang];
  const label = labels(lang);
  return (
    <PhoneFrame
      lang={lang}
      screen="account"
      captureState={{ completeFictionalProfile: Boolean(text.accountTitle && label.memberSince) }}
    >
      <section className="capture-profile-hero">
        <div className="capture-profile-hero__photo" />
        <div className="capture-profile-hero__copy">
          <p className="member-eyebrow">Cloud &amp; Core</p>
          <h1>{text.accountTitle}</h1>
          <p>{label.memberSince}</p>
          <div className="capture-profile-chip-row">
            <span className="capture-profile-chip">{label.active}</span>
            <span className="capture-profile-chip">{label.langValue}</span>
          </div>
        </div>
      </section>
      <section className="capture-account-card">
        <h2>{label.personal}</h2>
        <div className="capture-account-grid">
          <div>
            <span className="capture-label">{label.language}</span>
            <strong>{label.langValue}</strong>
          </div>
          <div>
            <span className="capture-label">{label.preference}</span>
            <strong>{label.preferenceValue}</strong>
          </div>
          <div>
            <span className="capture-label">{label.contact}</span>
            <strong>{label.contactValue}</strong>
          </div>
          <div>
            <span className="capture-label">
              {lang === "he" ? "סטטוס" : lang === "ar" ? "الحالة" : "Status"}
            </span>
            <strong>{label.active}</strong>
          </div>
        </div>
      </section>
      <section className="capture-account-card">
        <h2>{lang === "he" ? "הפרטיות שלך" : lang === "ar" ? "خصوصيتك" : "Your privacy"}</h2>
        <p className="capture-detail__note">
          <MapPin size={14} />{" "}
          {lang === "he"
            ? "ההעדפות נשמרות רק כדי להתאים את חוויית הסטודיו שלך."
            : lang === "ar"
              ? "يتم حفظ تفضيلاتك فقط لتخصيص تجربة الاستوديو الخاصة بك."
              : "Preferences are saved only to tailor your studio experience."}
        </p>
      </section>
    </PhoneFrame>
  );
}

function SocialCard({ lang }: { lang: Lang }) {
  const text = copy[lang];
  return (
    <main
      className="capture-social"
      lang={lang}
      dir={getDirection(lang)}
      data-capture-ready="true"
      data-capture-kind="social"
      data-capture-state={JSON.stringify({ socialCard: true })}
    >
      <div className="capture-social__photo" />
      <div className="capture-social__copy">
        <img
          className="capture-social__logo"
          src="/brand/cloud-core-logo-full.svg"
          alt="Cloud & Core"
        />
        <p className="capture-social__eyebrow">{text.socialKicker}</p>
        <h1>{text.socialTitle}</h1>
        <p>{text.socialBody}</p>
      </div>
    </main>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get("lang");
  const lang: Lang =
    candidate === "he" || candidate === "ar" || candidate === "en" ? candidate : "en";
  const candidateScreen = params.get("screen");
  const isIntentionalStateRegression = params.get("fixture-state") === "invalid";
  const screen: Screen = [
    "schedule",
    "booking",
    "bookings",
    "membership",
    "account",
    "social",
  ].includes(candidateScreen ?? "")
    ? (candidateScreen as Screen)
    : "schedule";
  applyLang(lang);
  if (screen === "social") return <SocialCard lang={lang} />;
  if (screen === "booking") return <BookingScreen lang={lang} />;
  if (screen === "bookings") return <BookingsScreen lang={lang} />;
  if (screen === "membership") {
    return (
      <MembershipScreen
        lang={lang}
        credits={isIntentionalStateRegression ? 0 : MEMBERSHIP_CREDITS}
      />
    );
  }
  if (screen === "account") return <AccountScreen lang={lang} />;
  return <ScheduleScreen lang={lang} />;
}

createRoot(document.getElementById("root")!).render(<App />);
