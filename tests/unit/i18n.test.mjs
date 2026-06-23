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

applyLang("en");
assert.equal(document.documentElement.lang, "en");
assert.equal(document.documentElement.dir, "ltr");
assert.equal(window.localStorage.getItem(LANG_KEY), "en");
assert.equal(t("nav.home"), "Home");
assert.equal(t("nav.schedule"), "Schedule");

applyLang("ar");
assert.equal(document.documentElement.lang, "ar");
assert.equal(document.documentElement.dir, "rtl");
assert.equal(window.localStorage.getItem(LANG_KEY), "ar");
assert.equal(t("nav.home"), "الرئيسية");
assert.equal(t("nav.schedule"), "جدول الحصص");

console.log("i18n defaults and catalogs OK");
