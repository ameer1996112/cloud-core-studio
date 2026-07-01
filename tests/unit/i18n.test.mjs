import { strict as assert } from "node:assert";
import {
  DEFAULT_LOCALE,
  LANG_KEY,
  applyLang,
  getActiveLang,
  getDirection,
  getStoredLang,
  t,
} from "../../src/lib/i18n.ts";
assert.equal(DEFAULT_LOCALE, "he");
assert.equal(getDirection("he"), "rtl");
assert.equal(getDirection("ar"), "rtl");
assert.equal(getDirection("en"), "ltr");
assert.equal(getDirection(undefined), "rtl");
assert.equal(getStoredLang(), "he");

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

console.log("i18n defaults and catalogs OK");
