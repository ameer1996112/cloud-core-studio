# Task 15 VoiceOver transcript

**Observed:** 2026-08-30

**Environment:** Brave on macOS with VoiceOver enabled, using the documented localhost production-backed fixture targets.

**Operator attribution:** These observations were supplied by the parent operator after a live manual session. The implementer recorded the transcript but did not independently operate VoiceOver.

**Safety:** All journeys used deterministic local fixture state. No external service or mutation was invoked.

Each row below is a structured transcription of the parent operator’s reported observation. It establishes tracked evidence completeness and identity; it is not cryptographic proof of human operation.

## auth-he

- Status: PASS
- Target: `/?scenario=guest-auth-default&language=he&evidence=1`
- Observations:
  - `document:he/rtl`
  - `heading:כניסה לסטודיו`
  - `textbox:אימייל`
  - `field:סיסמה`
  - `button:כניסה לסטודיו`
  - `initial-focus:אימייל`

## auth-ar

- Status: PASS
- Target: `/?scenario=guest-auth-default&language=ar&evidence=1`
- Observations:
  - `document:ar/rtl`
  - `heading:دخول الاستوديو`
  - `textbox:البريد الإلكتروني`
  - `field:كلمة المرور`
  - `button:دخول الاستوديو`
  - `initial-focus:البريد الإلكتروني`

## auth-en

- Status: PASS
- Target: `/?scenario=guest-auth-default&language=en&evidence=1`
- Observations:
  - `document:en/ltr`
  - `heading:Enter the studio`
  - `textbox:Email`
  - `field:Password`
  - `button:Enter the studio`
  - `initial-focus:Email`

## booking-he

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=he&evidence=1&interaction=1&journey=booking`
- Observations:
  - `document:he/rtl`
  - `heading:מסלול הזמנה`
  - `focus:יוגה אווירית, 12:00, פרטים והרשמה`
  - `live-status:4 מתוך 8 מקומות זמינים.`
  - `button:הזמנת שיעור`

## booking-ar

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=ar&evidence=1&interaction=1&journey=booking`
- Observations:
  - `document:ar/rtl`
  - `heading:مسار الحجز`
  - `focus:يوغا هوائية, 12:00, التفاصيل والتسجيل`
  - `live-status:4 من أصل 8 أماكن متاحة.`
  - `button:حجز الحصة`

## booking-en

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=en&evidence=1&interaction=1&journey=booking`
- Observations:
  - `document:en/ltr`
  - `heading:Booking journey`
  - `focus:Aerial Yoga, 12:00, Details & booking`
  - `live-status:4 of 8 spots available.`
  - `button:Book class`

## cancellation-he

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=he&evidence=1&interaction=1&journey=cancellation`
- Observations:
  - `document:he/rtl`
  - `heading:מסלול ביטול`
  - `live-status:אפשר לבטל עד שבת בשעה 05:00.`
  - `dialog:לבטל את ההזמנה?`
  - `dialog-description:קרדיט אחד יחזור ליתרה שלך.`
  - `dialog-control:להשאיר הזמנה`
  - `dialog-control:ביטול הזמנה`
  - `dialog-initial-focus:להשאיר הזמנה`

## cancellation-ar

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=ar&evidence=1&interaction=1&journey=cancellation`
- Observations:
  - `document:ar/rtl`
  - `heading:مسار الإلغاء`
  - `live-status:يمكن الإلغاء حتى السبت الساعة 05:00.`
  - `dialog:إلغاء هذا الحجز؟`
  - `dialog-description:سيعود رصيد واحد إلى رصيدك.`
  - `dialog-control:الإبقاء على الحجز`
  - `dialog-control:إلغاء الحجز`
  - `dialog-initial-focus:الإبقاء على الحجز`

## cancellation-en

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=en&evidence=1&interaction=1&journey=cancellation`
- Observations:
  - `document:en/ltr`
  - `heading:Cancellation journey`
  - `live-status:Cancellation is available until Saturday at 05:00.`
  - `dialog:Cancel this booking?`
  - `dialog-description:One credit will be returned to your balance.`
  - `dialog-control:Keep booking`
  - `dialog-control:Cancel booking`
  - `dialog-initial-focus:Keep booking`

## payment-result-he

- Status: PASS
- Target: `/?scenario=guest-payment-result-status-success-success&language=he&evidence=1`
- Observations:
  - `document:he/rtl`
  - `heading:התשלום התקבל`
  - `live-status:סטטוס התשלום מאושר.`

## payment-result-ar

- Status: PASS
- Target: `/?scenario=guest-payment-result-status-success-success&language=ar&evidence=1`
- Observations:
  - `document:ar/rtl`
  - `heading:تم استلام الدفع`
  - `live-status:حالة الدفع مؤكدة.`

## payment-result-en

- Status: PASS
- Target: `/?scenario=guest-payment-result-status-success-success&language=en&evidence=1`
- Observations:
  - `document:en/ltr`
  - `heading:Payment received`
  - `live-status:The payment status is confirmed.`

## instructor-attendance-he

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=he&evidence=1&interaction=1&journey=instructor-attendance`
- Observations:
  - `document:he/rtl`
  - `heading:רשימת נוכחות`
  - `textbox:סינון רשימת נוכחות`
  - `table:רשימת נוכחות`
  - `columnheader:חבר/ה`
  - `columnheader:טלפון`
  - `columnheader:סטטוס`
  - `status:מוזמן/ת`

## instructor-attendance-ar

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=ar&evidence=1&interaction=1&journey=instructor-attendance`
- Observations:
  - `document:ar/rtl`
  - `heading:قائمة الحضور`
  - `textbox:تصفية قائمة الحضور`
  - `table:قائمة الحضور`
  - `columnheader:العضو/ة`
  - `columnheader:الهاتف`
  - `columnheader:الحالة`
  - `status:محجوز`

## instructor-attendance-en

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=en&evidence=1&interaction=1&journey=instructor-attendance`
- Observations:
  - `document:en/ltr`
  - `heading:Attendance roster`
  - `textbox:Filter attendance roster`
  - `table:Attendance roster`
  - `columnheader:Member`
  - `columnheader:Phone`
  - `columnheader:Status`
  - `status:Booked`

## admin-destructive-confirmation-he

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=he&evidence=1&interaction=1&journey=admin-destructive-confirmation`
- Observations:
  - `document:he/rtl`
  - `heading:מסלול אישור ניהולי`
  - `alertdialog:לבטל את שיעור הבדיקה?`
  - `dialog-description:התרחיש בודק רק מקלדת ומיקוד. לא משתנים נתונים.`
  - `dialog-control:ביטול`
  - `dialog-control:אישור ביטול`
  - `dialog-initial-focus:ביטול`

## admin-destructive-confirmation-ar

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=ar&evidence=1&interaction=1&journey=admin-destructive-confirmation`
- Observations:
  - `document:ar/rtl`
  - `heading:مسار التأكيد الإداري`
  - `alertdialog:إلغاء حصة الاختبار؟`
  - `dialog-description:يفحص هذا المسار لوحة المفاتيح والتركيز فقط. لا تتغير أي بيانات.`
  - `dialog-control:إلغاء`
  - `dialog-control:تأكيد الإلغاء`
  - `dialog-initial-focus:إلغاء`

## admin-destructive-confirmation-en

- Status: PASS
- Target: `/?scenario=guest-member-schedule-default&language=en&evidence=1&interaction=1&journey=admin-destructive-confirmation`
- Observations:
  - `document:en/ltr`
  - `heading:Admin confirmation journey`
  - `alertdialog:Cancel the test class?`
  - `dialog-description:This flow checks keyboard and focus behavior only. No data is changed.`
  - `dialog-control:Cancel`
  - `dialog-control:Confirm cancellation`
  - `dialog-initial-focus:Cancel`

## global-navigation-he

- Status: PASS
- Target: `/?scenario=guest-app-default&language=he&evidence=1`
- Observations:
  - `document:he/rtl`
  - `heading:כל השיעורים, ההזמנות והמנוי שלך במקום אחד.`
  - `group:בחירת שפה`
  - `link:פתיחת האפליקציה`
  - `link:הורדה מ־App Store`
  - `image:סטודיו Cloud & Core עם ערסלי יוגה אווירית`

## global-navigation-ar

- Status: PASS
- Target: `/?scenario=guest-app-default&language=ar&evidence=1`
- Observations:
  - `document:ar/rtl`
  - `heading:كل الحصص، الحجوزات والاشتراك بمكان واحد.`
  - `group:اختيار اللغة`
  - `link:افتحي التطبيق`
  - `link:حمّلي من App Store`
  - `image:استوديو Cloud & Core لليوغا الهوائية`

## global-navigation-en

- Status: PASS
- Target: `/?scenario=guest-app-default&language=en&evidence=1`
- Observations:
  - `document:en/ltr`
  - `heading:Classes, bookings and membership in one place.`
  - `group:Choose language`
  - `link:Open the app`
  - `link:Download on the App Store`
  - `image:Cloud & Core aerial yoga studio`
