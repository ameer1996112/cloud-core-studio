import { StudioBanner } from "@/components/member/StudioBanner";
import { BookingConfirmationContent } from "@/components/member/BookingConfirmationContent";
import { ClassDetailContent } from "@/components/member/ClassDetailContent";
import { StudioClassItem } from "@/components/member/StudioClassItem";
import hero from "@/assets/classes/pilates-sculpt-hero.webp";
import { useState } from "react";
import { ArrowRight, Calendar, Heart } from "lucide-react";
import {
  ReviewTabs,
  ReviewButton,
  ReviewBadge,
  ReviewField,
  ReviewSelect,
  ReviewCheckbox,
  ReviewFilters,
  ReviewPlanCard,
  ReviewPrice,
  ReviewMembership,
  ReviewFeedback,
  ReviewClassRow,
  ReviewAvatar,
} from "./VisualSystem";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MemberHeader, MemberBottomNavigation } from "@/components/app-shell/MemberNavigation.tsx";
import { bottomTabsForRole } from "@/components/app-shell/useRoleNav";
import { useI18n } from "@/lib/i18n";
import mat from "@/assets/mat-detail.webp";
import classPhoto from "@/assets/classes/pilates-sculpt-thumb.webp";

export default function ComponentGallery() {
  const { dir } = useI18n();
  const [filter, setFilter] = useState("all");
  const [clicks, setClicks] = useState(0);
  const tabs = bottomTabsForRole("member");
  return (
    <div
      className="member-app member-design-shell cc-review cc-reference"
      style={{ minHeight: "100vh" }}
    >
      <div className="member-shell-main">
        <MemberHeader
          pathname="/member/packages"
          notifications={null}
          language={null}
          signOut={<ReviewButton disabled>יציאה</ReviewButton>}
        />
        <main className="cc-review cc-gallery" dir="rtl" lang="he">
          <h1>Cloud &amp; Core · סקירת רכיבים</h1>
          <p>Development only · Local fixtures · Interaction proposals pending owner review</p>
          <section>
            <h2>חבילות · אותם רכיבים באפליקציה</h2>
            <div className="cc-gallery-grid">
              {[
                {
                  id: "single",
                  title: "כניסה בודדת",
                  price: 80,
                  features: ["שיעור אחד", "בתוקף ל־14 ימים"],
                },
                {
                  id: "five",
                  title: "מנוי חודשי · 5 כניסות",
                  price: 280,
                  features: ["5 שיעורים", "בתוקף ל־30 ימים"],
                },
                {
                  id: "ten",
                  title: "מנוי חודשי · 10 כניסות",
                  price: 350,
                  features: ["10 שיעורים", "בתוקף ל־30 ימים"],
                },
              ].map((p, i) => (
                <ReviewPlanCard
                  key={p.id}
                  id={`gallery-${p.id}`}
                  title={p.title}
                  price={<ReviewPrice value={`₪${p.price}`} />}
                  features={p.features}
                  image={
                    [
                      "/images/editorial/welcome-960.webp",
                      "/images/editorial/studio-ritual-v1.png",
                      "/images/editorial/fabric-960.webp",
                    ][i]
                  }
                  highlighted={i === 1}
                  badge={i === 1 ? "דוגמת תג" : undefined}
                  disclosure={i ? "דוגמה בלבד · חידוש חודשי בכרטיס אשראי" : undefined}
                  action={
                    <ReviewButton onClick={() => setClicks((n) => n + 1)}>
                      <ArrowRight size={17} />
                      בחירת חבילה
                    </ReviewButton>
                  }
                />
              ))}
            </div>
          </section>
          <section>
            <h2>כפתורים ומצבים</h2>
            <div className="cc-gallery-controls">
              <ReviewButton onClick={() => setClicks((n) => n + 1)}>
                <ArrowRight size={17} />
                כניסה למערכת
              </ReviewButton>
              <ReviewButton variant="secondary">צור חשבון חדש</ReviewButton>
              <ReviewButton variant="ghost">
                צפייה בלוח שיעורים <ArrowRight size={17} />
              </ReviewButton>
              <ReviewButton variant="destructive">יציאה מהחשבון</ReviewButton>
              <ReviewButton variant="icon" aria-label="פתיחת לוח שנה">
                <Calendar size={20} />
              </ReviewButton>
              <ReviewButton disabled>לא זמין</ReviewButton>
              <ReviewButton loading onClick={() => setClicks((n) => n + 1)}>
                בתהליך…
              </ReviewButton>
            </div>
            <p role="status">
              Local actions: {clicks}. Hover, press, or Tab to inspect actual states.
            </p>
          </section>
          <section>
            <h2>שדות ובחירה</h2>
            <ReviewTabs
              label="דוגמאות שפה"
              items={[
                { value: "he", label: "עברית", content: "טקסט ארוך לבדיקת קריאות, כיוון ומרווחים" },
                {
                  value: "ar",
                  label: "العربية",
                  content: <span lang="ar">نص تجريبي طويل لاختبار وضوح القراءة واتجاه النص</span>,
                },
                {
                  value: "en",
                  label: "English",
                  content: (
                    <span lang="en" dir="ltr">
                      A longer English label for readable wrapping and keyboard review
                    </span>
                  ),
                },
              ]}
            />
            <ReviewFilters
              label="סוג חבילה"
              options={[
                { value: "all", label: "כל החבילות" },
                { value: "monthly", label: "מנויים" },
                { value: "cards", label: "כרטיסיות" },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <p>Selected: {filter}</p>
            <div className="cc-gallery-fields">
              <ReviewField
                label="כתובת אימייל"
                type="email"
                placeholder="name@example.com"
                help="לשליחת פרטי החשבון"
              />
              <ReviewField label="שם מלא" defaultValue="" error="יש להזין שם מלא" />
              <ReviewSelect label="שפה">
                <option>עברית</option>
                <option>العربية</option>
                <option>English</option>
              </ReviewSelect>
              <ReviewField
                label="שם מלא · حقل تجريبي طويل باللغة العربية"
                lang="ar"
                placeholder="الاسم الكامل"
              />
            </div>
            <ReviewCheckbox defaultChecked>
              קראתי ואני מאשר/ת את התנאים · טקסט ארוך לבדיקה
            </ReviewCheckbox>
            <ReviewCheckbox disabled>אפשרות לא זמינה</ReviewCheckbox>
          </section>
          <section>
            <h2>משוב, מנוי וכרטיס שיעור</h2>
            <div className="cc-gallery-fields">
              <ReviewMembership title="המנוי שלי">
                <span>דוגמה · 5 כניסות זמינות</span>
                <ReviewBadge>פעיל</ReviewBadge>
              </ReviewMembership>
              <ReviewFeedback loading>טוען חבילות…</ReviewFeedback>
              <ReviewFeedback error>לא הצלחנו לטעון את הנתונים. נסו שוב.</ReviewFeedback>
              <ReviewFeedback>אין חבילות פעילות להצגה</ReviewFeedback>
            </div>
            <ReviewClassRow
              image={classPhoto}
              title="פילאטיס · שיעור לדוגמה"
              action={
                <ReviewButton variant="secondary">
                  <ArrowRight size={17} />
                  פרטי שיעור
                </ReviewButton>
              }
            >
              <span dir="ltr">09:00 – 10:00</span>
              <p>תמונת אווירה · ללא פרטי מדריכה</p>
            </ReviewClassRow>
          </section>
          <section className="cc-review">
            <h2>רכיבי הדפים · בית ופרטי שיעור</h2>
            <ReviewAvatar name="Member example" />
            <StudioBanner />
            <StudioClassItem
              thumbnail
              cls={{
                id: "gallery-class",
                starts_at: "2030-01-15T09:00:00+02:00",
                duration_minutes: 60,
                capacity: 12,
                booked_count: 4,
                title: "פילאטיס לדוגמה",
                image_url: classPhoto,
              }}
              state={{ kind: "available", spotsLeft: 8 }}
              action={
                <ReviewButton onClick={() => setClicks(clicks + 1)}>פרטי שיעור לדוגמה</ReviewButton>
              }
            />
          </section>
          <section>
            <h2>פרטי שיעור ואישור הזמנה · רכיבי האפליקציה</h2>
            <p>Local fixtures only — the controls below never create a booking.</p>
            <div className="cc-gallery-grid">
              <div className="ref-gallery-detail">
                <ClassDetailContent
                  cls={galleryClass}
                  state={{ kind: "available", spotsLeft: 8 }}
                  action={
                    <ReviewButton onClick={() => setClicks((n) => n + 1)}>הזמנת דוגמה</ReviewButton>
                  }
                />
              </div>
              <div className="ref-gallery-detail">
                <BookingConfirmationContent
                  cls={galleryClass}
                  confirmation={{ bookingId: "DEMO-ONLY", remaining: 4 }}
                  onAddCalendar={() => setClicks((n) => n + 1)}
                  onDone={() => setClicks((n) => n + 1)}
                />
              </div>
            </div>
          </section>
          <section>
            <h2>חלונית וניווט מקלדת</h2>
            <Dialog>
              <DialogTrigger asChild>
                <ReviewButton variant="secondary">
                  <Heart size={17} />
                  פתיחת חלונית לדוגמה
                </ReviewButton>
              </DialogTrigger>
              <DialogContent className="cc-dialog cc-review cc-reference" dir="rtl">
                <DialogHeader>
                  <DialogTitle>פרטי שיעור לדוגמה</DialogTitle>
                  <DialogDescription>
                    חלונית לסקירה חזותית בלבד. אין הזמנה או פעולה בחשבון.
                  </DialogDescription>
                </DialogHeader>
                <p>Escape closes this dialog and restores focus.</p>
              </DialogContent>
            </Dialog>
          </section>
        </main>
        <MemberBottomNavigation pathname="/member/packages" />
      </div>
    </div>
  );
}

const galleryClass = {
  id: "gallery-class-detail",
  starts_at: "2030-01-15T09:00:00+02:00",
  duration_minutes: 60,
  capacity: 12,
  booked_count: 4,
  credit_cost: 1,
  cancellation_window_hours: 24,
  title: "יוגה אווירית · דוגמה",
  image_url: classPhoto,
  instructor: { name: "מדריכת הדוגמה" },
};
