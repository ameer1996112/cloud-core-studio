import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

type PaymentResultStatus = "success" | "failed" | "cancelled" | "pending" | "missing";

type PaymentResultSearch = {
  status: PaymentResultStatus;
  paymentId?: string;
};

const RESULT_COPY: Record<
  PaymentResultStatus,
  {
    title: string;
    body: string;
    detail: string;
    tone: "success" | "warning" | "error";
  }
> = {
  success: {
    title: "התשלום התקבל",
    body: "החבילה הופעלה והקרדיטים נוספו לחשבון שלך.",
    detail: "אם הועברת למסך התחברות, אפשר להתחבר שוב ולראות את החבילה בעמוד החבילות.",
    tone: "success",
  },
  pending: {
    title: "התשלום בבדיקה",
    body: "קיבלנו חזרה מ-HYP, אבל האישור הסופי עדיין לא הושלם.",
    detail: "אין צורך לשלם שוב כרגע. אם הסטטוס לא מתעדכן, פני לסטודיו.",
    tone: "warning",
  },
  cancelled: {
    title: "התשלום בוטל",
    body: "העסקה לא הושלמה ולא הופעלה חבילה.",
    detail: "אפשר לחזור לעמוד החבילות ולנסות שוב בהמשך.",
    tone: "error",
  },
  failed: {
    title: "התשלום לא הושלם",
    body: "HYP לא אישר את העסקה ולכן לא הופעלה חבילה.",
    detail: "אם חויבת בפועל, שמרי את פרטי העסקה ופני לסטודיו לבדיקה.",
    tone: "error",
  },
  missing: {
    title: "לא מצאנו פרטי תשלום",
    body: "חזרנו מ-HYP בלי מזהה עסקה תקין.",
    detail: "אין צורך לשלם שוב לפני בדיקה מול הסטודיו.",
    tone: "warning",
  },
};

export const Route = createFileRoute("/payment-result")({
  validateSearch: (search): PaymentResultSearch => {
    const status = typeof search.status === "string" ? search.status : "pending";
    const safeStatus: PaymentResultStatus = [
      "success",
      "failed",
      "cancelled",
      "pending",
      "missing",
    ].includes(status)
      ? (status as PaymentResultStatus)
      : "pending";
    return {
      status: safeStatus,
      paymentId: typeof search.paymentId === "string" ? search.paymentId : undefined,
    };
  },
  component: PaymentResultPage,
});

function PaymentResultPage() {
  const { status, paymentId } = Route.useSearch();
  const copy = RESULT_COPY[status];
  const Icon = copy.tone === "success" ? CheckCircle2 : copy.tone === "warning" ? Clock : XCircle;

  return (
    <main dir="rtl" className="min-h-screen bg-background px-5 py-10 text-navy">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center">
        <div className="member-card w-full p-7 text-center shadow-[0_24px_70px_rgba(11,29,58,0.14)]">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${
              copy.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : copy.tone === "warning"
                  ? "border-gold/35 bg-gold/10 text-gold"
                  : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            <Icon className="h-8 w-8" aria-hidden="true" />
          </div>

          <p className="member-eyebrow mt-6">Cloud &amp; Core Studio</p>
          <h1 className="font-display mt-3 text-4xl leading-tight text-navy">{copy.title}</h1>
          <p className="mt-4 text-base leading-7 text-slate">{copy.body}</p>
          <p className="mt-3 text-sm leading-6 text-slate/85">{copy.detail}</p>

          {paymentId && (
            <p className="mt-5 rounded-full border border-gold/20 bg-ivory px-4 py-2 text-xs font-medium text-slate">
              אסמכתא פנימית: <span dir="ltr">{paymentId.slice(0, 8)}</span>
            </p>
          )}

          <div className="mt-7 grid gap-3">
            <Link
              to="/member/packages"
              className="inline-flex items-center justify-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-ivory shadow-sm"
            >
              מעבר לחבילות
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-full border border-gold/35 bg-white px-5 py-3 text-sm font-semibold text-navy"
            >
              התחברות מחדש
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
