import { Link, createFileRoute } from "@tanstack/react-router";
import { LANG_META, useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { LegalLanguageSwitcher } from "@/components/legal/LegalLanguageSwitcher";
import { buildPublicPageHead } from "@/lib/public-metadata";

export const Route = createFileRoute("/privacy")({
  head: () =>
    buildPublicPageHead({
      title: "Privacy Policy | Cloud & Core Studio",
      description: "Cloud & Core Studio privacy policy for members and app users.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

const copy: Record<Lang, { title: string; kicker: string; updated: string; sections: string[] }> = {
  en: {
    kicker: "Cloud & Core Studio",
    title: "Privacy Policy",
    updated: "Last updated: July 27, 2026",
    sections: [
      "We collect account details, contact details, bookings, packages, payments, attendance, and studio preferences so we can operate the studio and provide member services.",
      "We use this information to manage classes, bookings, credits, package requests, receipts, reminders, support, and studio safety.",
      "We do not sell member information. We share data only with service providers needed to run the app, such as Supabase, payment or receipt providers, messaging tools, and hosting infrastructure.",
      "We use access controls, encrypted connections, restricted administrative access, and reputable infrastructure providers to protect information. No system is completely immune from unauthorized access.",
      "Information is stored electronically in our managed database and hosting systems and, where needed, in payment, receipt, and messaging providers' systems. Access is limited to authorized studio staff and providers. We keep information only as long as needed to provide the service and meet accounting, dispute, safety, and legal duties, then delete or anonymize it where reasonably possible.",
      "Members can request correction or deletion of their account from the Profile page or by contacting the studio.",
      "Some records may be retained where required for accounting, fraud prevention, safety, dispute handling, or legal obligations.",
      "Questions can be sent through the studio support channels shown in the app.",
    ],
  },
  he: {
    kicker: "Cloud & Core Studio",
    title: "מדיניות פרטיות",
    updated: "עודכן לאחרונה: 27 ביולי 2026",
    sections: [
      "אנחנו אוספים פרטי חשבון, פרטי קשר, הזמנות, חבילות, תשלומים, נוכחות והעדפות סטודיו כדי להפעיל את הסטודיו ולתת שירות לחברי הסטודיו.",
      "המידע משמש לניהול שיעורים, הרשמות, קרדיטים, בקשות חבילה, קבלות, תזכורות, תמיכה ובטיחות בסטודיו.",
      "אנחנו לא מוכרים מידע של חברים. מידע משותף רק עם ספקים הנדרשים להפעלת האפליקציה, כגון Supabase, ספקי תשלום או קבלות, כלי הודעות ותשתיות אירוח.",
      "לשמירת המידע אנו משתמשים בבקרות גישה, תקשורת מוצפנת, הרשאות ניהול מוגבלות וספקי תשתית מקובלים. אין מערכת החסינה לחלוטין מפני גישה בלתי מורשית.",
      "המידע נשמר באופן אלקטרוני במאגר הנתונים ובמערכות האחסון המנוהלות שלנו, ובמידת הצורך גם במערכות ספקי התשלום, הקבלות וההודעות. הגישה מוגבלת לצוות מורשה ולספקים הנדרשים. המידע נשמר רק כל עוד הוא נחוץ למתן השירות ולעמידה בחובות חשבונאיות, בטיחותיות, משפטיות ולטיפול במחלוקות, ולאחר מכן נמחק או עובר אנונימיזציה ככל שניתן.",
      "חברים יכולים לבקש תיקון או מחיקה של החשבון דרך עמוד הפרופיל או דרך ערוצי התמיכה של הסטודיו.",
      "חלק מהרשומות עשויות להישמר כאשר הדבר נדרש לצורכי הנהלת חשבונות, מניעת הונאה, בטיחות, טיפול במחלוקות או חובה חוקית.",
      "שאלות אפשר לשלוח דרך ערוצי התמיכה שמופיעים באפליקציה.",
    ],
  },
  ar: {
    kicker: "Cloud & Core Studio",
    title: "سياسة الخصوصية",
    updated: "آخر تحديث: 27 يوليو 2026",
    sections: [
      "نجمع بيانات الحساب، بيانات التواصل، الحجوزات، الباقات، الدفعات، الحضور وتفضيلات الاستوديو لكي نشغّل الاستوديو ونقدم خدمة للأعضاء.",
      "نستخدم هذه البيانات لإدارة الحصص، الحجوزات، الأرصدة، طلبات الباقات، الإيصالات، التذكيرات، الدعم وسلامة الاستوديو.",
      "لا نبيع بيانات الأعضاء. نشارك البيانات فقط مع مزودي الخدمات الضروريين لتشغيل التطبيق مثل Supabase، مزودي الدفع أو الإيصالات، أدوات الرسائل والاستضافة.",
      "نستخدم ضوابط وصول واتصالات مشفرة وصلاحيات إدارية محدودة ومزودي بنية تحتية موثوقين لحماية المعلومات. لا يوجد نظام محصّن بالكامل من الوصول غير المصرح.",
      "تُخزّن المعلومات إلكترونيًا في قاعدة البيانات وأنظمة الاستضافة المُدارة لدينا، وعند الحاجة في أنظمة مزودي الدفع والإيصالات والرسائل. يقتصر الوصول على طاقم الاستوديو والمزودين المخولين. نحتفظ بالمعلومات فقط للمدة اللازمة لتقديم الخدمة والوفاء بواجبات المحاسبة والسلامة والنزاعات والقانون، ثم نحذفها أو نخفي هويتها حيث يمكن.",
      "يمكن للأعضاء طلب تصحيح أو حذف الحساب من صفحة الملف الشخصي أو عبر قنوات دعم الاستوديو.",
      "قد نحتفظ ببعض السجلات عند الحاجة للمحاسبة، منع الاحتيال، السلامة، معالجة النزاعات أو الالتزامات القانونية.",
      "يمكن إرسال الأسئلة عبر قنوات الدعم الظاهرة داخل التطبيق.",
    ],
  },
};

function PrivacyPage() {
  const { lang } = useI18n();
  useDocumentTitle("page.privacy.title");
  return <LegalPage kind="privacy" lang={lang} data={copy[lang]} />;
}

function LegalPage({ kind, lang, data }: { kind: string; lang: Lang; data: (typeof copy)[Lang] }) {
  const { t } = useI18n();
  const dir = LANG_META[lang].dir;

  return (
    <main
      id="main-content"
      dir={dir}
      className="public-safe-page bg-ivory px-5 py-8 text-navy sm:px-8"
    >
      <div className="mx-auto max-w-3xl">
        <header className="public-legal-header mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/auth"
            className="brand-wordmark inline-flex min-h-12 items-center text-2xl text-navy"
            dir="ltr"
          >
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
            <Link
              to="/terms"
              className={
                kind === "terms"
                  ? "inline-flex min-h-12 items-center px-2 text-navy"
                  : "inline-flex min-h-12 items-center px-2 text-slate transition-colors hover:text-gold"
              }
            >
              {t("legal.terms")}
            </Link>
            <Link
              to="/support"
              className={
                kind === "support"
                  ? "inline-flex min-h-12 items-center px-2 text-navy"
                  : "inline-flex min-h-12 items-center px-2 text-slate transition-colors hover:text-gold"
              }
            >
              {t("legal.support")}
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
