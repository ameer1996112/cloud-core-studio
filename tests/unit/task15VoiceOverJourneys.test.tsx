import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";

import { setActiveLang } from "../../src/lib/i18n";
import { auditScenarios } from "../../tools/ui-audit/fixtures";
import { interactionCopy } from "../../tools/ui-audit/InteractionFixture";
import {
  VOICEOVER_JOURNEYS,
  voiceOverJourneyCopy,
  voiceOverJourneyQuery,
  voiceOverJourneyTargets,
} from "../../tools/ui-audit/voiceover-journeys";

const router = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

const projectRoot = join(import.meta.dir, "../..");

describe("Task 15 VoiceOver journey surfaces", () => {
  test("the production-backed guest schedule exposes its H1 in the requested language", () => {
    const scenario = auditScenarios.find(
      (candidate) => candidate.id === "guest-member-schedule-default",
    );
    if (!scenario || scenario.kind !== "visual") throw new Error("schedule fixture missing");

    const expectedHeadings = {
      he: "לוח שיעורים",
      ar: "جدول الحصص",
      en: "Class schedule",
    } as const;

    for (const language of ["he", "ar", "en"] as const) {
      setActiveLang(language);
      const html = renderToStaticMarkup(scenario.render({ language }));
      expect(html, language).toContain(
        `<h1 id="guest-schedule-title">${expectedHeadings[language]}</h1>`,
      );
      if (language !== "en") expect(html, language).not.toContain(">Class schedule<");
    }
  });

  test("the shared interaction surface has locale-consistent headings, controls, and statuses", () => {
    const expected = {
      he: {
        dir: "rtl",
        own: [
          "בדיקות אינטראקציה של המוצר",
          "תוכנית",
          "פתיחת אישור ביטול",
          "רשימת נוכחות",
          "סינון רשימת נוכחות",
          "מוזמן/ת",
          "נכח/ה",
          "בדיקת נראות מיקוד",
        ],
        foreign: ["Production interaction checks", "Program", "Attendance roster", "Booked"],
      },
      ar: {
        dir: "rtl",
        own: [
          "فحوصات تفاعل المنتج",
          "البرنامج",
          "فتح تأكيد الإلغاء",
          "قائمة الحضور",
          "تصفية قائمة الحضور",
          "محجوز",
          "حضر",
          "فحص ظهور التركيز",
        ],
        foreign: ["Production interaction checks", "Program", "Attendance roster", "Booked"],
      },
      en: {
        dir: "ltr",
        own: [
          "Production interaction checks",
          "Program",
          "Open cancellation confirmation",
          "Attendance roster",
          "Filter attendance roster",
          "Booked",
          "Attended",
          "Focus visibility check",
        ],
        foreign: ["בדיקות אינטראקציה של המוצר", "فحوصات تفاعل المنتج"],
      },
    } as const;

    for (const language of ["he", "ar", "en"] as const) {
      const copy = JSON.stringify(interactionCopy[language]);
      expect(language === "en" ? "ltr" : "rtl").toBe(expected[language].dir);
      for (const phrase of expected[language].own)
        expect(copy, `${language}: ${phrase}`).toContain(phrase);
      for (const phrase of expected[language].foreign)
        expect(copy, `${language}: ${phrase}`).not.toContain(phrase);
    }
  });

  test("booking and cancellation are distinct production-backed assistive-technology journeys", () => {
    const expected = {
      he: {
        booking: ["מסלול הזמנה", "הזמנת שיעור", "4 מתוך 8 מקומות זמינים."],
        cancellation: ["מסלול ביטול", "פתיחת ביטול הזמנה", "אפשר לבטל עד שבת בשעה 05:00."],
      },
      ar: {
        booking: ["مسار الحجز", "حجز الحصة", "4 من أصل 8 أماكن متاحة."],
        cancellation: ["مسار الإلغاء", "فتح إلغاء الحجز", "يمكن الإلغاء حتى السبت الساعة 05:00."],
      },
      en: {
        booking: ["Booking journey", "Book class", "4 of 8 spots available."],
        cancellation: [
          "Cancellation journey",
          "Open booking cancellation",
          "Cancellation is available until Saturday at 05:00.",
        ],
      },
    } as const;

    for (const language of ["he", "ar", "en"] as const) {
      const booking = JSON.stringify(voiceOverJourneyCopy.booking[language]);
      const cancellation = JSON.stringify(voiceOverJourneyCopy.cancellation[language]);
      for (const phrase of expected[language].booking)
        expect(booking, `${language}: ${phrase}`).toContain(phrase);
      for (const phrase of expected[language].cancellation)
        expect(cancellation, `${language}: ${phrase}`).toContain(phrase);
    }

    expect(voiceOverJourneyTargets.booking.interactionJourney).toBe("booking");
    expect(voiceOverJourneyTargets.cancellation.interactionJourney).toBe("cancellation");
    const fixtureSource = readFileSync(
      join(projectRoot, "tools/ui-audit/InteractionFixture.tsx"),
      "utf8",
    );
    const routeSource = readFileSync(
      join(projectRoot, "src/routes/_authenticated/member/bookings.tsx"),
      "utf8",
    );
    expect(fixtureSource).toContain("<PremiumLessonReservationCard");
    expect(fixtureSource).toContain("<MemberCancellationDialog");
    expect(routeSource).toContain("<MemberCancellationDialog");
  });

  test("all seven manual journeys have direct targets and locale-specific accessible copy", () => {
    expect(VOICEOVER_JOURNEYS).toHaveLength(7);
    const copy = {
      auth: {
        he: ["כניסה לסטודיו", "אימייל"],
        ar: ["دخول الاستوديو", "البريد الإلكتروني"],
        en: ["Enter the studio", "Email"],
      },
      booking: {
        he: ["מסלול הזמנה", "הזמנת שיעור"],
        ar: ["مسار الحجز", "حجز الحصة"],
        en: ["Booking journey", "Book class"],
      },
      cancellation: {
        he: ["מסלול ביטול", "פתיחת ביטול הזמנה"],
        ar: ["مسار الإلغاء", "فتح إلغاء الحجز"],
        en: ["Cancellation journey", "Open booking cancellation"],
      },
      "payment-result": {
        he: ["התשלום התקבל", "סטטוס התשלום מאושר"],
        ar: ["تم استلام الدفع", "حالة الدفع مؤكدة"],
        en: ["Payment received", "The payment status is confirmed"],
      },
      "instructor-attendance": {
        he: ["רשימת נוכחות", "סינון רשימת נוכחות"],
        ar: ["قائمة الحضور", "تصفية قائمة الحضور"],
        en: ["Attendance roster", "Filter attendance roster"],
      },
      "admin-destructive-confirmation": {
        he: ["מסלול אישור ניהולי", "פתיחת אישור ביטול"],
        ar: ["مسار التأكيد الإداري", "فتح تأكيد الإلغاء"],
        en: ["Admin confirmation journey", "Open cancellation confirmation"],
      },
      "global-navigation": {
        he: ["כל השיעורים, ההזמנות והמנוי שלך במקום אחד", "בחירת שפה"],
        ar: ["كل الحصص، الحجوزات والاشتراك بمكان واحد", "اختيار اللغة"],
        en: ["Classes, bookings and membership in one place", "Choose language"],
      },
    } as const;
    for (const journey of VOICEOVER_JOURNEYS) {
      for (const language of ["he", "ar", "en"] as const) {
        const query = voiceOverJourneyQuery(journey, language);
        expect(query, `${journey}/${language}`).toContain(`language=${language}`);
        expect(query, `${journey}/${language}`).toContain(
          `scenario=${voiceOverJourneyTargets[journey].scenarioId}`,
        );
        const localizedCopy = JSON.stringify(voiceOverJourneyCopy[journey][language]);
        for (const phrase of copy[journey][language])
          expect(localizedCopy, `${journey}/${language}: ${phrase}`).toContain(phrase);
        for (const otherLanguage of ["he", "ar", "en"] as const) {
          if (otherLanguage === language) continue;
          for (const phrase of copy[journey][otherLanguage])
            expect(localizedCopy, `${journey}/${language} leaked ${phrase}`).not.toContain(phrase);
        }
      }
    }
  });
});
