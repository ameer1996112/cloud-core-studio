import { strict as assert } from "node:assert";
const {
  DEFAULT_LOCALE,
  LANG_KEY,
  applyLang,
  getActiveLang,
  getBootLangScript,
  getDirection,
  getStoredLang,
  readLangCookieHeader,
  ensureI18nNamespaces,
  t,
} = await import("../../src/lib/i18n.ts?test-real-catalog=1");
await ensureI18nNamespaces(["member", "instructor", "admin"]);
assert.equal(DEFAULT_LOCALE, "he");
assert.equal(getDirection("he"), "rtl");
assert.equal(getDirection("ar"), "rtl");
assert.equal(getDirection("en"), "ltr");
assert.equal(getDirection(undefined), "rtl");
assert.equal(getStoredLang(), "he");

const previousDocument = globalThis.document;
const previousWindow = globalThis.window;

try {
  globalThis.document = { documentElement: { lang: "", dir: "" } };
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
  };

  store.delete(LANG_KEY);
  assert.equal(getStoredLang(), "he");
  applyLang("he");
  assert.equal(getActiveLang(), "he");
  assert.equal(document.documentElement.lang, "he");
  assert.equal(document.documentElement.dir, "rtl");
  assert.equal(window.localStorage.getItem(LANG_KEY), "he");
  assert.equal(t("nav.home"), "בית");
  assert.equal(t("nav.schedule"), "לוח שיעורים");
  assert.equal(t("nav.myBookings"), "ההזמנות שלי");
  assert.equal(t("nav.plans"), "חבילות");
  assert.equal(t("pulse.heading"), "מצב הסטודיו");
  assert.equal(t("attendance.empty.title"), "אין שיעורים היום");
  assert.equal(
    t("attendance.empty.body"),
    "היום אין שיעורים מתוכננים. אפשר לעבור ללוח השיעורים או ליצור שיעור חדש.",
  );
  assert.equal(t("attendance.empty.primary"), "יצירת שיעור");
  assert.equal(t("attendance.empty.secondary"), "מעבר ללוח השיעורים");
  assert.equal(t("admin.classDetail.cancelClass"), "ביטול שיעור");
  assert.equal(
    t("admin.classDetail.cancelClassConfirmCheckbox"),
    "אני מבין/ה שהשיעור יבוטל והמשתתפות יקבלו עדכון.",
  );
  assert.equal(t("admin.classDetail.deleteClass"), "מחיקת שיעור");
  assert.equal(t("auth.guestTitle"), "לפני שמתחברים");
  assert.equal(t("auth.guestBody"), "אפשר לעיין בלוח השיעורים ולפתוח פרטי שיעור לפני התחברות.");
  assert.equal(t("auth.browseSchedule"), "עיון בלוח השיעורים");
  assert.equal(t("auth.guestSupport"), "תמיכה");

  applyLang("en");
  assert.equal(document.documentElement.lang, "en");
  assert.equal(document.documentElement.dir, "ltr");
  assert.equal(window.localStorage.getItem(LANG_KEY), "en");
  assert.equal(t("nav.home"), "Home");
  assert.equal(t("nav.schedule"), "Schedule");
  assert.equal(t("attendance.empty.title"), "No classes today");
  assert.equal(
    t("attendance.empty.body"),
    "There are no classes scheduled for today. You can open the schedule or create a new class.",
  );
  assert.equal(t("attendance.empty.primary"), "Create class");
  assert.equal(t("attendance.empty.secondary"), "Open schedule");
  assert.equal(t("admin.classDetail.cancelClass"), "Cancel class");
  assert.equal(
    t("admin.classDetail.deleteBlocked"),
    "You can’t delete a class with active bookings. Cancel it instead.",
  );
  assert.equal(t("auth.guestTitle"), "Before you sign in");
  assert.equal(
    t("auth.guestBody"),
    "Browse the schedule and open class details before signing in.",
  );
  assert.equal(t("auth.browseSchedule"), "Browse Schedule");
  assert.equal(t("auth.guestSupport"), "Support");

  applyLang("ar");
  assert.equal(document.documentElement.lang, "ar");
  assert.equal(document.documentElement.dir, "rtl");
  assert.equal(window.localStorage.getItem(LANG_KEY), "ar");
  assert.equal(t("nav.home"), "الرئيسية");
  assert.equal(t("nav.schedule"), "جدول الحصص");
  assert.equal(t("attendance.empty.title"), "لا توجد حصص اليوم");
  assert.equal(
    t("attendance.empty.body"),
    "لا توجد حصص مجدولة اليوم. يمكنك الانتقال إلى جدول الحصص أو إنشاء حصة جديدة.",
  );
  assert.equal(t("attendance.empty.primary"), "إنشاء حصة");
  assert.equal(t("attendance.empty.secondary"), "الانتقال للجدول");
  assert.equal(t("admin.classDetail.cancelClass"), "إلغاء الحصة");
  assert.equal(t("admin.classDetail.deleteClass"), "حذف الحصة");
  assert.equal(t("auth.guestTitle"), "قبل تسجيل الدخول");
  assert.equal(t("auth.guestBody"), "يمكنك تصفح الجدول وفتح تفاصيل الحصص قبل تسجيل الدخول.");
  assert.equal(t("auth.browseSchedule"), "تصفح الجدول");
  assert.equal(t("auth.guestSupport"), "الدعم");

  const bootSource = getBootLangScript();
  assert.match(bootSource, /window\.location\.pathname === "\/app"/);
  assert.match(bootSource, /searchParams\.get\("lang"\)/);

  document.cookie = "cc_lang=ar";
  document.documentElement.lang = "he";
  document.documentElement.dir = "rtl";
  window.location = {
    href: "https://cloudandcorestudio.com/auth",
    pathname: "/auth",
    protocol: "https:",
  };
  Function(bootSource)();
  assert.equal(window.__ccBootLang, "he");
  assert.equal(document.documentElement.lang, "he");

  document.documentElement.lang = "he";
  window.location = {
    href: "https://cloudandcorestudio.com/app?lang=ar",
    pathname: "/app",
    protocol: "https:",
  };
  Function(bootSource)();
  assert.equal(window.__ccBootLang, "ar");
  assert.equal(document.documentElement.lang, "ar");
  assert.equal(readLangCookieHeader("other=1; cc_lang=ar"), "ar");
  assert.equal(readLangCookieHeader("cc_lang=fr"), null);
  assert.equal(readLangCookieHeader(null), null);

  console.log("i18n defaults and catalogs OK");
} finally {
  if (previousDocument === undefined) {
    Reflect.deleteProperty(globalThis, "document");
  } else {
    globalThis.document = previousDocument;
  }

  if (previousWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    globalThis.window = previousWindow;
  }
}
