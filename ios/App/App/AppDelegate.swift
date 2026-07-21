import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        registerNotificationCategories()
        return true
    }

    private func notificationActionTitle(_ key: String) -> String {
        let language = Locale.preferredLanguages.first?.lowercased() ?? "en"
        let titles: [String: [String: String]] = [
            "en": [
                "view_class": "View class", "cancel_booking": "Cancel booking",
                "claim_spot": "Claim spot", "view_schedule": "View schedule",
                "book_now": "Book now", "choose_package": "Choose package",
                "fix_payment": "Review payment", "contact_studio": "Contact studio",
                "reply": "Reply", "view_membership": "View membership",
                "view_receipt": "View receipt"
            ],
            "he": [
                "view_class": "לצפייה בשיעור", "cancel_booking": "ביטול הרשמה",
                "claim_spot": "שמירת המקום", "view_schedule": "לצפייה במערכת",
                "book_now": "להרשמה", "choose_package": "לבחירת חבילה",
                "fix_payment": "בדיקת התשלום", "contact_studio": "יצירת קשר",
                "reply": "מענה", "view_membership": "לצפייה במנוי",
                "view_receipt": "לצפייה בקבלה"
            ],
            "ar": [
                "view_class": "عرض الحصة", "cancel_booking": "إلغاء الحجز",
                "claim_spot": "حجز المكان", "view_schedule": "عرض الجدول",
                "book_now": "احجزي الآن", "choose_package": "اختيار باقة",
                "fix_payment": "مراجعة الدفع", "contact_studio": "تواصلي معنا",
                "reply": "رد", "view_membership": "عرض الاشتراك",
                "view_receipt": "عرض الإيصال"
            ]
        ]
        let localeKey = language.hasPrefix("he") ? "he" : language.hasPrefix("ar") ? "ar" : "en"
        return titles[localeKey]?[key] ?? titles["en"]?[key] ?? key
    }

    private func notificationAction(_ identifier: String, destructive: Bool = false) -> UNNotificationAction {
        var options: UNNotificationActionOptions = [.foreground]
        if destructive { options.insert(.destructive) }
        return UNNotificationAction(
            identifier: identifier,
            title: notificationActionTitle(identifier),
            options: options
        )
    }

    private func registerNotificationCategories() {
        func category(_ identifier: String, _ actionIds: [String]) -> UNNotificationCategory {
            return UNNotificationCategory(
                identifier: identifier,
                actions: actionIds.map { notificationAction($0, destructive: $0 == "cancel_booking") },
                intentIdentifiers: [],
                hiddenPreviewsBodyPlaceholder: "Cloud & Core notification",
                options: [.customDismissAction]
            )
        }
        let categories: Set<UNNotificationCategory> = [
            category("CC_BOOKING_ACTIONS", ["view_class", "cancel_booking"]),
            category("CC_SCHEDULE", ["view_schedule"]),
            category("CC_VIEW_CLASS", ["view_class"]),
            category("CC_SCHEDULE_CONTACT", ["view_schedule", "contact_studio"]),
            category("CC_CLASS_UPDATE", ["view_class", "contact_studio"]),
            category("CC_OPEN_CLASS", ["book_now", "view_schedule", "choose_package"]),
            category("CC_OPEN_CLASS_NO_CREDITS", ["view_schedule", "choose_package"]),
            category("CC_CLASS_RECOMMENDATION", ["book_now", "view_class", "choose_package"]),
            category("CC_CLASS_RECOMMENDATION_NO_CREDITS", ["view_class", "choose_package"]),
            category("CC_WAITLIST_OFFER", ["claim_spot", "view_class"]),
            category("CC_FIX_PAYMENT", ["fix_payment"]),
            category("CC_ACCOUNT_ACTION", ["fix_payment", "contact_studio"]),
            category("CC_VIEW_MEMBERSHIP", ["view_membership"]),
            category("CC_MEMBERSHIP_ACTIVE", ["view_membership", "view_schedule"]),
            category("CC_CHOOSE_PACKAGE", ["choose_package"]),
            category("CC_MEMBERSHIP_ACTION", ["view_membership", "choose_package"]),
            category("CC_RECEIPT", ["view_receipt"]),
            category("CC_STAFF_REPLY", ["reply"]),
            category("CC_CONTACT_STUDIO", ["contact_studio"]),
            category("CC_NOTIFICATION", [])
        ]
        UNUserNotificationCenter.current().setNotificationCategories(categories)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

}
