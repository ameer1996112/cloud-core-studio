import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { LegalLanguageSwitcher } from "@/components/legal/LegalLanguageSwitcher";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { getCheckoutPlanDisplay } from "@/lib/checkoutPlanDisplay";
import { getInstagramLandingData, type InstagramAdultPlan } from "@/lib/instagramLanding.functions";
import { LANG_META, useI18n, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | Cloud & Core Studio" },
      {
        name: "description",
        content: "Cloud & Core Studio secure checkout before payment through HYP/Grow.",
      },
    ],
  }),
  loader: async (): Promise<{ plans: InstagramAdultPlan[] }> => {
    try {
      const result = await getInstagramLandingData();
      return { plans: result.adultPlans };
    } catch {
      return { plans: [] };
    }
  },
  component: PublicCheckoutPage,
});

const copy: Record<
  Lang,
  {
    kicker: string;
    title: string;
    intro: string;
    summary: string;
    choosePackage: string;
    firstName: string;
    lastName: string;
    phone: string;
    country: string;
    address: string;
    email: string;
    consent: string;
    terms: string;
    continue: string;
    secure: string;
    note: string;
  }
> = {
  he: {
    kicker: "רכישה מאובטחת",
    title: "עמוד תשלום",
    intro: "מלאו את הפרטים לפני בחירת חבילה ומעבר לתשלום מאובטח באמצעות HYP/Grow.",
    summary: "חבילת שיעורים ב-Cloud & Core Studio",
    choosePackage: "בחירת חבילה",
    firstName: "שם פרטי",
    lastName: "שם משפחה",
    phone: "טלפון ללא קידומת בינלאומית",
    country: "מדינה",
    address: "כתובת מלאה",
    email: "כתובת אימייל",
    consent: "קראתי ואני מאשר/ת את",
    terms: "התקנון ותנאי הרכישה",
    continue: "המשך לבחירת חבילה ולתשלום",
    secure: "התשלום מתבצע באופן מאובטח באמצעות HYP/Grow וכולל אפשרות תשלום ב-Bit.",
    note: "לא יתבצע חיוב בעמוד זה. לאחר התחברות ובחירת חבילה יוצג המחיר המלא לפני התשלום.",
  },
  ar: {
    kicker: "شراء آمن",
    title: "صفحة الدفع",
    intro: "املؤوا التفاصيل قبل اختيار الباقة والانتقال للدفع الآمن بواسطة HYP/Grow.",
    summary: "باقة حصص في Cloud & Core Studio",
    choosePackage: "اختيار الباقة",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    phone: "الهاتف بدون المقدمة الدولية",
    country: "الدولة",
    address: "العنوان الكامل",
    email: "البريد الإلكتروني",
    consent: "قرأت وأوافق على",
    terms: "الشروط وأحكام الشراء",
    continue: "المتابعة لاختيار الباقة والدفع",
    secure: "تتم معالجة الدفع بأمان بواسطة HYP/Grow، مع إمكانية الدفع عبر Bit.",
    note: "لن يتم الخصم في هذه الصفحة. يظهر السعر الكامل بعد تسجيل الدخول واختيار الباقة.",
  },
  en: {
    kicker: "Secure purchase",
    title: "Checkout",
    intro: "Complete your details before choosing a package and continuing to HYP/Grow payment.",
    summary: "Cloud & Core Studio class package",
    choosePackage: "Choose a package",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone without international prefix",
    country: "Country",
    address: "Full address",
    email: "Email address",
    consent: "I have read and agree to the",
    terms: "terms and purchase conditions",
    continue: "Continue to package selection and payment",
    secure: "Payment is processed securely by HYP/Grow and supports Bit where available.",
    note: "No charge is made on this page. The full price is shown after sign-in and package selection.",
  },
};

function PublicCheckoutPage() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { plans } = Route.useLoaderData();
  const checkoutCopy = copy[lang];
  const dir = LANG_META[lang].dir;
  const [accepted, setAccepted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");

  useDocumentTitle("page.packages.title");

  return (
    <main
      id="main-content"
      dir={dir}
      className="public-safe-page min-h-screen bg-ivory px-5 py-8 text-navy sm:px-8"
    >
      <div className="mx-auto max-w-3xl">
        <header className="public-legal-header mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link to="/auth" className="brand-wordmark text-2xl text-navy" dir="ltr">
            Cloud &amp; Core
          </Link>
          <LegalLanguageSwitcher lang={lang} />
        </header>

        <article className="member-card overflow-hidden">
          <div className="border-b hairline bg-sand/20 p-6 sm:p-8">
            <p className="member-eyebrow">{checkoutCopy.kicker}</p>
            <h1 className="member-page-title mt-3">{checkoutCopy.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate">{checkoutCopy.intro}</p>
          </div>

          <form
            className="space-y-6 p-6 sm:p-8"
            onSubmit={(event) => {
              event.preventDefault();
              if (!accepted || !selectedPlan) return;
              const formData = new FormData(event.currentTarget);
              sessionStorage.setItem(
                "cloud-core-checkout-draft",
                JSON.stringify({
                  firstName: formData.get("first-name"),
                  lastName: formData.get("last-name"),
                  phone: formData.get("phone"),
                  country: formData.get("country"),
                  address: formData.get("address"),
                  email: formData.get("email"),
                  planCode: selectedPlan,
                  termsAccepted: true,
                  termsVersion: "2026-07-27",
                }),
              );
              void navigate({ to: "/auth" });
            }}
          >
            <section className="rounded-xl border border-gold/25 bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">
                {checkoutCopy.summary}
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate">
                <ShieldCheck className="h-4 w-4 text-gold" aria-hidden="true" />
                <span>{checkoutCopy.secure}</span>
              </div>
            </section>

            <fieldset className="grid gap-3">
              <legend className="font-display text-xl text-navy">
                {checkoutCopy.choosePackage}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((plan) => {
                  const planDisplay = getCheckoutPlanDisplay(plan, lang);

                  return (
                    <label
                      key={plan.code}
                      className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gold/25 bg-white/75 p-4 text-sm text-slate has-[:checked]:border-gold has-[:checked]:bg-gold/10"
                    >
                      <span>
                        <span className="block font-semibold text-navy">{planDisplay.name}</span>
                        <span className="mt-1 block">{planDisplay.memberLine}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <strong className="numeric-display text-lg text-navy">
                          ₪{plan.priceIls}
                        </strong>
                        <input
                          required
                          type="radio"
                          name="plan"
                          value={plan.code}
                          checked={selectedPlan === plan.code}
                          onChange={(event) => setSelectedPlan(event.target.value)}
                          className="h-4 w-4 accent-navy"
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["first-name", checkoutCopy.firstName, "given-name", "text"],
                  ["last-name", checkoutCopy.lastName, "family-name", "text"],
                  ["phone", checkoutCopy.phone, "tel", "tel"],
                  ["country", checkoutCopy.country, "country-name", "text"],
                  ["address", checkoutCopy.address, "street-address", "text"],
                  ["email", checkoutCopy.email, "email", "email"],
                ] as const
              ).map(([id, label, autoComplete, type]) => (
                <label key={id} htmlFor={id} className="grid gap-1.5 text-sm text-slate">
                  <span>{label}</span>
                  <input
                    id={id}
                    name={id}
                    required
                    type={type}
                    inputMode={id === "phone" ? "tel" : undefined}
                    pattern={id === "phone" ? "0[0-9]{8,9}" : undefined}
                    autoComplete={autoComplete}
                    className="editorial-input"
                  />
                </label>
              ))}
            </fieldset>

            <label className="flex items-start gap-3 rounded-xl border border-gold/25 bg-sand/15 p-4 text-sm leading-6 text-slate">
              <input
                required
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 accent-navy"
              />
              <span>
                {checkoutCopy.consent}{" "}
                <Link
                  to="/terms"
                  target="_blank"
                  className="font-semibold text-navy underline underline-offset-2"
                >
                  {checkoutCopy.terms}
                </Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={!accepted || !selectedPlan}
              className="btn-navy w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              {checkoutCopy.continue}
            </button>
            <p className="text-center text-xs leading-5 text-slate">{checkoutCopy.note}</p>
          </form>
        </article>
      </div>
    </main>
  );
}
