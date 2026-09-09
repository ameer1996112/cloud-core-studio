import { Link, createFileRoute } from "@tanstack/react-router";
import { useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { EmbeddedContactText } from "@/components/ui/bidi";
import { PublicShell } from "@/components/public/PublicShell";
import { Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support | Cloud & Core Studio" },
      { name: "description", content: "Cloud & Core Studio support and account help." },
      { name: "robots", content: "index, follow" },
      { property: "og:url", content: "https://cloudandcorestudio.com/support" },
    ],
    links: [{ rel: "canonical", href: "https://cloudandcorestudio.com/support" }],
  }),
  component: SupportPage,
});

const copy: Record<
  Lang,
  {
    title: string;
    kicker: string;
    intro: string;
    channelsTitle: string;
    navigationTitle: string;
    emailTitle: string;
    emailBody: string;
    whatsappTitle: string;
    whatsappBody: string;
    quickLinks: { title: string; body: string; to: "/member/schedule" | "/auth" }[];
    items: { title: string; body: string }[];
  }
> = {
  en: {
    kicker: "Cloud & Core Studio",
    title: "Support",
    intro:
      "Need help with bookings, packages, payments, or your account? Cloud & Core Studio is at Main Road 89, Hurfeish, Israel. Contact us at 055-939-8438.",
    channelsTitle: "Direct support",
    navigationTitle: "Public navigation",
    emailTitle: "Email Support",
    emailBody: "cloudandcorestudio@gmail.com",
    whatsappTitle: "WhatsApp Support",
    whatsappBody: "055-939-8438 · Direct chat",
    quickLinks: [
      {
        title: "Browse schedule",
        body: "Return to the public class schedule and keep browsing as a guest.",
        to: "/member/schedule",
      },
      {
        title: "Sign in or get account help",
        body: "Use the account screen for bookings, packages, and profile support.",
        to: "/auth",
      },
    ],
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
    intro:
      "צריכים עזרה בהזמנות, חבילות, תשלומים או בחשבון? Cloud & Core Studio נמצא בחורפיש, כביש ראשי 89. טלפון: 055-939-8438.",
    channelsTitle: "יצירת קשר ישירה",
    navigationTitle: "ניווט ציבורי",
    emailTitle: "אימייל תמיכה",
    emailBody: "cloudandcorestudio@gmail.com",
    whatsappTitle: "תמיכה בוואטסאפ",
    whatsappBody: "055-939-8438 · צ'אט ישיר",
    quickLinks: [
      {
        title: "עיון בלוח השיעורים",
        body: "חזרו ללוח השיעורים הציבורי והמשיכו לעיין כאורחים.",
        to: "/member/schedule",
      },
      {
        title: "כניסה או עזרה בחשבון",
        body: "מסך הכניסה מוביל להזמנות, חבילות ועזרה בפרופיל.",
        to: "/auth",
      },
    ],
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
    intro:
      "هل تحتاجون مساعدة في الحجوزات أو الباقات أو الدفعات أو الحساب؟ Cloud & Core Studio في حرفيش، الشارع الرئيسي 89. هاتف: 055-939-8438.",
    channelsTitle: "دعم مباشر",
    navigationTitle: "تنقل عام",
    emailTitle: "البريد الإلكتروني للدعم",
    emailBody: "cloudandcorestudio@gmail.com",
    whatsappTitle: "الدعم عبر الواتساب",
    whatsappBody: "055-939-8438 · دردشة مباشرة",
    quickLinks: [
      {
        title: "تصفحوا الجدول",
        body: "عودوا إلى جدول الحصص العام واستمروا بالتصفح كضيوف.",
        to: "/member/schedule",
      },
      {
        title: "تسجيل الدخول أو المساعدة بالحساب",
        body: "استخدموا شاشة الحساب للوصول إلى الحجوزات والباقات ودعم الملف الشخصي.",
        to: "/auth",
      },
    ],
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
  return (
    <PublicShell mainClassName="public-safe-page bg-ivory px-5 py-8 text-navy sm:px-8">
      <SupportPresentation
        lang={lang}
        legalLabels={{
          privacy: t("legal.privacy"),
          terms: t("legal.terms"),
          checkout: t("legal.checkout"),
        }}
      />
    </PublicShell>
  );
}

export function SupportPresentation({
  lang,
  legalLabels,
}: {
  lang: Lang;
  legalLabels: { privacy: string; terms: string; checkout: string };
}) {
  const data = copy[lang];

  return (
    <div className="mx-auto max-w-3xl" data-product-view="support-default">
      <article className="member-card p-6 sm:p-8">
        <p className="member-eyebrow">{data.kicker}</p>
        <h1 className="member-page-title mt-3">{data.title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate">
          <EmbeddedContactText text={data.intro} />
        </p>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate">
            {data.channelsTitle}
          </h2>
          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
            <a
              href="mailto:cloudandcorestudio@gmail.com"
              className="group flex min-w-0 items-center gap-4 rounded-xl border border-gold/30 bg-card/70 p-5 transition-all hover:bg-gold/5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold transition-transform group-hover:scale-110">
                <Mail className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-navy">{data.emailTitle}</h3>
                <p className="mt-1 break-all font-mono text-sm text-slate">
                  <EmbeddedContactText text={data.emailBody} />
                </p>
              </div>
            </a>

            <a
              href="https://wa.me/message/S5HBZNKUMX45O1"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-w-0 items-center gap-4 rounded-xl border border-gold/30 bg-card/70 p-5 transition-all hover:bg-gold/5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold transition-transform group-hover:scale-110">
                <Phone className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-navy">{data.whatsappTitle}</h3>
                <p className="mt-1 text-sm text-slate">
                  <EmbeddedContactText text={data.whatsappBody} />
                </p>
              </div>
            </a>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate">
            {data.navigationTitle}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.quickLinks.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="rounded-xl border border-gold/20 bg-card/75 p-4 transition-colors hover:border-gold/40 hover:bg-gold/5"
              >
                <h3 className="text-base font-semibold text-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate">{item.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {data.items.map((item) => (
            <section key={item.title} className="border hairline bg-card/70 p-4">
              <h2 className="text-base font-semibold text-navy">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate">{item.body}</p>
            </section>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3 border-t hairline pt-5 text-xs uppercase tracking-[0.18em]">
          <Link
            to="/privacy"
            className="inline-flex min-h-12 items-center px-2 text-slate transition-colors hover:text-gold"
          >
            {legalLabels.privacy}
          </Link>
          <Link
            to="/terms"
            className="inline-flex min-h-12 items-center px-2 text-slate transition-colors hover:text-gold"
          >
            {legalLabels.terms}
          </Link>
          <Link
            to="/checkout"
            className="inline-flex min-h-12 items-center px-2 text-slate transition-colors hover:text-gold"
          >
            {legalLabels.checkout}
          </Link>
        </div>
      </article>
    </div>
  );
}
