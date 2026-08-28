import { Link, createFileRoute } from "@tanstack/react-router";
import { LANG_META, useI18n, type Lang } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { LegalLanguageSwitcher } from "@/components/legal/LegalLanguageSwitcher";
import { buildPublicPageHead } from "@/lib/public-metadata";

export const Route = createFileRoute("/terms")({
  head: () =>
    buildPublicPageHead({
      title: "Terms of Use | Cloud & Core Studio",
      description: "Cloud & Core Studio member app terms.",
      path: "/terms",
    }),
  component: TermsPage,
});

const copy: Record<Lang, { title: string; kicker: string; updated: string; sections: string[] }> = {
  en: {
    kicker: "Cloud & Core Studio",
    title: "Terms of Use",
    updated: "Last updated: July 27, 2026",
    sections: [
      "Cloud & Core Studio, Main Road 89, Hurfeish, Israel. Customer service: 055-939-8438; cloudandcorestudio@gmail.com.",
      "Purchases may be made only by a person aged 18 or older. A minor may use or purchase through the service only with the approval and supervision of a parent or legal guardian.",
      "The app is used to purchase and manage studio memberships, class packages, bookings, payments, attendance, and studio communication. Members must provide complete and accurate contact and billing details.",
      "Service supply policy: A package is supplied digitally to the member account after payment approval, normally immediately. If provider review is required, activation may take up to one business day. No physical product is shipped and no shipping fee applies.",
      "A distance-sale service purchase may be cancelled within 14 days of the transaction date or receipt of the disclosure document, whichever is later, provided the cancellation is made at least two non-rest days before the service date. If service has begun, the customer pays the proportional value already supplied. Where permitted by law, the cancellation fee is the lower of 5% of the transaction or ₪100; no fee is charged for defect, mismatch, or failure to supply on time. An approved refund is returned within 14 days. Send the request to cloudandcorestudio@gmail.com or WhatsApp/phone 055-939-8438 with the purchaser's name and transaction details. Mandatory consumer rights and statutory exceptions prevail.",
      "Class cancellations and credit returns are governed by the cancellation window displayed for the class in the app. Package validity, included credits, renewal terms, and price are displayed before purchase.",
      "Monthly subscriptions renew each month until cancelled. A cancellation request stops future renewals after it is processed and does not retroactively cancel services already supplied, subject to mandatory law.",
      "Online payments, including card and Bit where available, are processed by HYP/Grow. The studio does not store full card details. A purchase is completed only after payment-provider approval and an on-screen confirmation.",
      "Service warranty and liability: Participation in physical activity is at the participant's responsibility and must be appropriate to their health and ability. The studio is responsible for supplying the purchased package as described. The studio is not liable for indirect loss, provider outages, or misuse of the service, except where liability cannot legally be excluded.",
      "The studio may restrict access when an account is misused, unpaid, unsafe, or violates studio policies. Service may be interrupted for maintenance, network issues, force majeure, or provider outages.",
    ],
  },
  he: {
    kicker: "Cloud & Core Studio",
    title: "תנאי שימוש",
    updated: "עודכן לאחרונה: 27 ביולי 2026",
    sections: [
      "Cloud & Core Studio, חורפיש, כביש ראשי 89, ישראל. שירות לקוחות: 055-939-8438; cloudandcorestudio@gmail.com.",
      "רכישה באתר מותרת לבני ובנות 18 ומעלה בלבד. קטין או קטינה רשאים להשתמש בשירות או לרכוש בו רק באישור ובהשגחת הורה או אפוטרופוס חוקי.",
      "האפליקציה משמשת לרכישה ולניהול של חברות בסטודיו, חבילות שיעורים, הזמנות, תשלומים, נוכחות ותקשורת. על הלקוח למסור פרטי קשר וחיוב מלאים ונכונים.",
      "מדיניות אספקת השירות: החבילה מסופקת באופן דיגיטלי לחשבון הלקוח לאחר אישור התשלום, בדרך כלל באופן מיידי. אם נדרשת בדיקת ספק, ההפעלה עשויה להימשך עד יום עסקים אחד. לא נשלח מוצר פיזי ולא נגבים דמי משלוח.",
      "עסקת מכר מרחוק למתן שירות ניתנת לביטול בתוך 14 ימים ממועד העסקה או ממועד קבלת מסמך הגילוי, לפי המאוחר, ובתנאי שהביטול נעשה לפחות שני ימים שאינם ימי מנוחה לפני מועד השירות. אם הוחל במתן השירות, הלקוח ישלם את התמורה היחסית עבור השירות שכבר ניתן. ככל שהחוק מתיר, דמי הביטול יהיו הנמוך מבין 5% מסכום העסקה או 100 ₪; לא ייגבו דמי ביטול במקרה של פגם, אי-התאמה או אי-אספקה במועד. החזר שאושר יבוצע בתוך 14 ימים. את הבקשה יש לשלוח ל-cloudandcorestudio@gmail.com או בוואטסאפ/טלפון 055-939-8438, בצירוף שם הרוכש ופרטי העסקה. הוראות הדין הקוגנטיות והחריגים הקבועים בחוק גוברים.",
      "ביטול הרשמה לשיעור והחזרת קרדיט כפופים לחלון הביטול שמוצג באפליקציה עבור אותו שיעור. תוקף החבילה, מספר הקרדיטים, תנאי החידוש והמחיר מוצגים לפני הרכישה.",
      "מנוי חודשי מתחדש מדי חודש עד לביטולו. בקשת ביטול תפסיק חיובים עתידיים לאחר הטיפול בה ואינה מבטלת למפרע שירות שכבר סופק, בכפוף להוראות הדין.",
      "תשלומים מקוונים, לרבות כרטיס אשראי ו-Bit כאשר הם זמינים, מעובדים על ידי HYP/Grow. הסטודיו אינו שומר פרטי כרטיס מלאים. העסקה מושלמת רק לאחר אישור ספק התשלום והצגת אישור על המסך.",
      "אחריות השירות והמוצר: הסטודיו אחראי לספק את החבילה שנרכשה בהתאם לתיאור שהוצג בעת הרכישה. ההשתתפות בפעילות גופנית היא באחריות המשתתף ובהתאם למצבו הבריאותי וליכולתו. הסטודיו לא יישא באחריות לנזק ישיר או עקיף שנגרם עקב שימוש שאינו בהתאם להנחיות, תקלת ספק או כוח עליון, למעט אחריות שלא ניתן להגביל לפי דין.",
      "הסטודיו רשאי להגביל גישה במקרה של שימוש לא תקין, חוב, סיכון בטיחותי או הפרת מדיניות. השירות עשוי להיפגע עקב תחזוקה, תקלות רשת, כוח עליון או תקלות ספקים.",
    ],
  },
  ar: {
    kicker: "Cloud & Core Studio",
    title: "شروط الاستخدام",
    updated: "آخر تحديث: 27 يوليو 2026",
    sections: [
      "Cloud & Core Studio، الشارع الرئيسي 89، حرفيش، إسرائيل. خدمة الزبائن: 055-939-8438؛ cloudandcorestudio@gmail.com.",
      "الشراء متاح لمن بلغ 18 عامًا فقط. يجوز للقاصر استخدام الخدمة أو الشراء فقط بموافقة وإشراف أحد الوالدين أو الوصي القانوني.",
      "يُستخدم التطبيق لشراء وإدارة العضوية، باقات الحصص، الحجوزات، الدفعات، الحضور والتواصل. يجب تقديم بيانات تواصل وفوترة كاملة وصحيحة.",
      "سياسة تزويد الخدمة: تُفعّل الباقة رقميًا في حساب العضو بعد اعتماد الدفع، وعادةً فورًا. إذا احتاج مزود الدفع إلى مراجعة فقد يستغرق التفعيل حتى يوم عمل واحد. لا يتم شحن منتج مادي ولا تُجبى رسوم شحن.",
      "يمكن إلغاء صفقة خدمة عن بُعد خلال 14 يومًا من تاريخ الصفقة أو استلام مستند الإفصاح، أيهما لاحق، بشرط الإلغاء قبل موعد الخدمة بيومين على الأقل من غير أيام الراحة. إذا بدأ تقديم الخدمة يدفع الزبون القيمة النسبية للخدمة المقدمة. حيث يسمح القانون، تكون رسوم الإلغاء الأقل من 5% من قيمة الصفقة أو 100 ₪، ولا تُجبى عند وجود عيب أو عدم مطابقة أو عدم توريد في الموعد. يُعاد المبلغ الموافق عليه خلال 14 يومًا. يُرسل الطلب إلى cloudandcorestudio@gmail.com أو واتساب/هاتف 055-939-8438 مع اسم المشتري وتفاصيل الصفقة. تسود الحقوق الإلزامية والاستثناءات القانونية.",
      "إلغاء حجز الحصة وإرجاع الرصيد يخضعان لنافذة الإلغاء المعروضة للحصة في التطبيق. تظهر صلاحية الباقة، الأرصدة، التجديد والسعر قبل الشراء.",
      "تتجدد العضوية الشهرية كل شهر حتى إلغائها. يوقف طلب الإلغاء التجديدات المستقبلية بعد معالجته ولا يلغي بأثر رجعي خدمة تم تقديمها، مع مراعاة القانون.",
      "تُعالج الدفعات الإلكترونية، بما فيها البطاقة وBit عند توفرهما، بواسطة HYP/Grow. لا يحتفظ الاستوديو ببيانات البطاقة الكاملة، ولا تكتمل الصفقة إلا بعد موافقة مزود الدفع وظهور التأكيد.",
      "ضمان ومسؤولية الخدمة: الاستوديو مسؤول عن تزويد الباقة المشتراة كما وُصفت وقت الشراء. المشاركة في النشاط البدني مسؤولية المشارك ووفق حالته الصحية وقدرته. لا يتحمل الاستوديو ضررًا مباشرًا أو غير مباشر ناتجًا عن استخدام مخالف للتعليمات أو تعطل مزود أو قوة قاهرة، باستثناء المسؤولية التي لا يجوز تقييدها قانونًا.",
      "يمكن للاستوديو تقييد الوصول عند سوء الاستخدام أو عدم الدفع أو وجود خطر على السلامة أو مخالفة السياسات. قد تنقطع الخدمة للصيانة أو مشاكل الشبكة أو القوة القاهرة أو أعطال المزودين.",
    ],
  },
};

function TermsPage() {
  const { lang, t } = useI18n();
  useDocumentTitle("page.terms.title");
  const data = copy[lang];
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
              to="/privacy"
              className="inline-flex min-h-12 items-center px-2 text-slate transition-colors hover:text-gold"
            >
              {t("legal.privacy")}
            </Link>
            <Link
              to="/support"
              className="inline-flex min-h-12 items-center px-2 text-slate transition-colors hover:text-gold"
            >
              {t("legal.support")}
            </Link>
            <Link
              to="/checkout"
              className="inline-flex min-h-12 items-center px-2 text-slate transition-colors hover:text-gold"
            >
              {t("legal.checkout")}
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}
