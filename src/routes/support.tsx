import { Link, createFileRoute } from "@tanstack/react-router";
import { LANG_META, useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { LegalLanguageSwitcher } from "@/components/legal/LegalLanguageSwitcher";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [{ name: "description", content: "Cloud & Core Studio support and account help." }],
  }),
  component: SupportPage,
});

const copy: Record<
  Lang,
  { title: string; kicker: string; intro: string; items: { title: string; body: string }[] }
> = {
  en: {
    kicker: "Cloud & Core Studio",
    title: "Support",
    intro: "For booking, package, payment, or account help, contact the studio team.",
    items: [
      {
        title: "Bookings",
        body: "Use My Bookings to review upcoming, waitlist, past, and cancelled classes.",
      },
      {
        title: "Packages",
        body: "Use Packages to request a plan or review credits and payment history.",
      },
      {
        title: "Account deletion",
        body: "Open Profile and submit an account deletion request. The studio will review and confirm the request.",
      },
      {
        title: "Response time",
        body: "Support is handled by the studio team during studio operating hours.",
      },
    ],
  },
  he: {
    kicker: "Cloud & Core Studio",
    title: "תמיכה",
    intro: "לעזרה בהזמנות, חבילות, תשלומים או חשבון, צרו קשר עם צוות הסטודיו.",
    items: [
      {
        title: "הזמנות",
        body: "בעמוד ההזמנות שלי אפשר לראות שיעורים קרובים, רשימת המתנה, עבר וביטולים.",
      },
      { title: "חבילות", body: "בעמוד חבילות אפשר לבקש חבילה ולעקוב אחרי קרדיטים ותשלומים." },
      {
        title: "מחיקת חשבון",
        body: "פתחו את הפרופיל ושלחו בקשת מחיקת חשבון. הסטודיו יבדוק ויאשר את הבקשה.",
      },
      { title: "זמן מענה", body: "התמיכה מטופלת על ידי צוות הסטודיו בשעות הפעילות." },
    ],
  },
  ar: {
    kicker: "Cloud & Core Studio",
    title: "الدعم",
    intro: "للمساعدة في الحجوزات، الباقات، الدفعات أو الحساب، تواصلوا مع فريق الاستوديو.",
    items: [
      {
        title: "الحجوزات",
        body: "من صفحة حجوزاتي يمكن مراجعة الحصص القادمة، الانتظار، السابقة والملغاة.",
      },
      { title: "الباقات", body: "من صفحة الباقات يمكن طلب باقة ومراجعة الأرصدة وسجل الدفعات." },
      {
        title: "حذف الحساب",
        body: "افتحوا الملف الشخصي وأرسلوا طلب حذف الحساب. سيقوم الاستوديو بمراجعة الطلب وتأكيده.",
      },
      { title: "وقت الرد", body: "يتم التعامل مع الدعم من قبل فريق الاستوديو خلال ساعات العمل." },
    ],
  },
};

function SupportPage() {
  const { lang, t } = useI18n();
  useDocumentTitle("page.support.title");
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
          <p className="mt-4 text-sm leading-7 text-slate">{data.intro}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {data.items.map((item) => (
              <section key={item.title} className="border hairline bg-white/70 p-4">
                <h2 className="text-base font-semibold text-navy">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate">{item.body}</p>
              </section>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3 border-t hairline pt-5 text-xs uppercase tracking-[0.18em]">
            <Link to="/privacy" className="text-slate hover:text-gold transition-colors">
              {t("legal.privacy")}
            </Link>
            <Link to="/terms" className="text-slate hover:text-gold transition-colors">
              {t("legal.terms")}
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
