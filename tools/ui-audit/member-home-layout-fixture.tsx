import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import "../../src/styles/member.css";

export function MemberHomeLayoutFixture() {
  return (
    <main className="member-page member-home-page member-home-primary" dir="rtl">
      <header className="member-page-intro" data-member-home-layout-fixture>
        <div className="member-page-intro__copy">
          <p className="member-eyebrow">צהריים טובים</p>
          <h1 className="member-page-intro__title">שלום, Test</h1>
          <div className="member-page-intro__body">
            שמחות לראות אותך שוב בבית של תנועה ונשימה. תבחרי את השיעור הבא שלך, תתחברי לגוף, ונעוף
            ביחד.
          </div>
          <a href="#schedule" className="btn-navy member-page-intro__action">
            מצאי שיעור
          </a>
        </div>
        <div className="member-page-intro__aside">
          <a
            href="#packages"
            className="member-home-package-mini member-home-package-mini--empty member-card relative overflow-hidden"
          >
            <span aria-hidden className="absolute inset-y-0 start-0 w-[3px] bg-gold/80" />
            <span className="min-w-0">
              <span className="member-eyebrow block">חבילה פעילה</span>
              <span className="member-home-package-mini__empty-title block truncate">
                אין חבילה פעילה
              </span>
            </span>
            <span className="member-home-package-mini__empty-action">
              רכישת חבילה
              <span aria-hidden>←</span>
            </span>
          </a>
        </div>
      </header>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Member home layout fixture root is missing");
createRoot(root).render(<MemberHomeLayoutFixture />);
