import { Link, createFileRoute } from "@tanstack/react-router";
import { LANG_META, useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { LegalLanguageSwitcher } from "@/components/legal/LegalLanguageSwitcher";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ name: "description", content: "Cloud & Core Studio member app terms." }],
  }),
  component: TermsPage,
});

const copy: Record<Lang, { title: string; kicker: string; updated: string; sections: string[] }> = {
  en: {
    kicker: "Cloud & Core Studio",
    title: "Terms of Use",
    updated: "Last updated: June 23, 2026",
    sections: [
      "The app is used to manage studio membership, bookings, packages, payments, attendance, and studio communication.",
      "Members are responsible for keeping contact details accurate and for booking only classes they intend to attend.",
      "Class cancellation windows, package validity, credits, and attendance rules are shown in the app and may be updated by the studio.",
      "Payments and package requests are subject to studio approval, provider availability, and local law.",
      "The studio may restrict access when an account is misused, unpaid, unsafe, or violates studio policies.",
      "The app is provided as-is for studio operations. Service may be interrupted for maintenance, network issues, or provider outages.",
    ],
  },
  he: {
    kicker: "Cloud & Core Studio",
    title: "תנאי שימוש",
    updated: "עודכן לאחרונה: 23 ביוני 2026",
    sections: [
      "האפליקציה משמשת לניהול חברות בסטודיו, הזמנות, חבילות, תשלומים, נוכחות ותקשורת עם הסטודיו.",
      "החברים אחראים לשמור על פרטי קשר מדויקים ולהירשם רק לשיעורים שהם מתכוונים להגיע אליהם.",
      "חלון ביטול, תוקף חבילות, קרדיטים וכללי נוכחות מוצגים באפליקציה ועשויים להתעדכן על ידי הסטודיו.",
      "תשלומים ובקשות חבילה כפופים לאישור הסטודיו, זמינות ספקים והדין המקומי.",
      "הסטודיו רשאי להגביל גישה במקרה של שימוש לא תקין, חוב, סיכון בטיחותי או הפרת מדיניות הסטודיו.",
      "האפליקציה מסופקת כפי שהיא לצורכי תפעול הסטודיו. השירות עשוי להיפגע עקב תחזוקה, תקלות רשת או תקלות ספקים.",
    ],
  },
  ar: {
    kicker: "Cloud & Core Studio",
    title: "شروط الاستخدام",
    updated: "آخر تحديث: 23 يونيو 2026",
    sections: [
      "يُستخدم التطبيق لإدارة عضوية الاستوديو، الحجوزات، الباقات، الدفعات، الحضور والتواصل مع الاستوديو.",
      "الأعضاء مسؤولون عن إبقاء بيانات التواصل دقيقة وعن حجز الحصص التي ينوون حضورها فقط.",
      "نوافذ الإلغاء، صلاحية الباقات، الأرصدة وقواعد الحضور تظهر في التطبيق وقد يتم تحديثها من قبل الاستوديو.",
      "الدفعات وطلبات الباقات تخضع لموافقة الاستوديو، توفر المزودين والقانون المحلي.",
      "يمكن للاستوديو تقييد الوصول عند سوء الاستخدام، وجود مبالغ غير مدفوعة، خطر على السلامة أو مخالفة سياسات الاستوديو.",
      "يتم توفير التطبيق كما هو لتشغيل الاستوديو. قد ينقطع الخدمة بسبب الصيانة، مشاكل الشبكة أو أعطال المزودين.",
    ],
  },
};

function TermsPage() {
  const { lang, t } = useI18n();
  useDocumentTitle("page.terms.title");
  const data = copy[lang];
  const dir = LANG_META[lang].dir;

  return (
    <main dir={dir} className="min-h-screen bg-ivory px-5 py-8 text-navy sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/auth" className="brand-wordmark text-2xl text-navy" dir="ltr">
            Cloud &amp; Core
          </Link>
          <LegalLanguageSwitcher lang={lang} />
        </header>
        <article className="member-card p-6 sm:p-8" dir={dir}>
          <p className="member-eyebrow">{data.kicker}</p>
          <h1 className="member-page-title mt-3">{data.title}</h1>
          <p className="mt-3 text-sm text-slate">{data.updated}</p>
          <div className="mt-8 space-y-5 text-sm leading-7 text-slate">
            {data.sections.map((section) => (
              <p key={section}>{section}</p>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3 border-t hairline pt-5 text-xs uppercase tracking-[0.18em]">
            <Link to="/privacy" className="text-slate hover:text-gold transition-colors">
              {t("legal.privacy")}
            </Link>
            <Link to="/support" className="text-slate hover:text-gold transition-colors">
              {t("legal.support")}
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
