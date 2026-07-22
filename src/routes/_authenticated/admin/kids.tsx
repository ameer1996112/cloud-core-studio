import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  Baby,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  Link2,
  Plus,
  ReceiptText,
  RotateCcw,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  assignKidToClass,
  cancelKidSubscription,
  createKidCardPaymentLink,
  kidsDashboard,
  markKidAttendance,
  recordKidManualPayment,
  setupKidsWeeklyClasses,
  upsertKidChild,
} from "@/lib/kids.functions";
import {
  AdminMetricCard,
  AdminPageHeader,
  AdminPageShell,
  Empty,
  Field,
} from "@/components/admin-shared";
import { showApiError, showApiSuccess } from "@/lib/error-messages";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export const Route = createFileRoute("/_authenticated/admin/kids")({
  component: KidsAerialPage,
});

type ChildForm = {
  child_name: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  notes: string;
};

type PaymentForm = {
  childId: string;
  packageId: string;
  method: "cash" | "bit" | "card" | "other";
  amount: string;
  reference: string;
  notes: string;
};

function KidsAerialPage() {
  const { locale } = useI18n();
  useDocumentTitle("page.kids.title");
  const qc = useQueryClient();
  const dashboardFn = useServerFn(kidsDashboard);
  const saveChildFn = useServerFn(upsertKidChild);
  const manualPaymentFn = useServerFn(recordKidManualPayment);
  const cardLinkFn = useServerFn(createKidCardPaymentLink);
  const assignFn = useServerFn(assignKidToClass);
  const attendanceFn = useServerFn(markKidAttendance);
  const cancelSubscriptionFn = useServerFn(cancelKidSubscription);
  const setupWeeklyFn = useServerFn(setupKidsWeeklyClasses);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-kids-aerial"],
    queryFn: () => dashboardFn(),
  });

  const [childForm, setChildForm] = useState<ChildForm>({
    child_name: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_email: "",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    childId: "",
    packageId: "",
    method: "cash",
    amount: "",
    reference: "",
    notes: "",
  });
  const [assignment, setAssignment] = useState({ childId: "" });
  const [paymentLink, setPaymentLink] = useState<{ url: string; expiresAt: string } | null>(null);

  const ils = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(value);

  const activeEnrollmentByChild = useMemo(() => {
    const map = new Map<string, any>();
    for (const enrollment of data?.enrollments ?? []) map.set(enrollment.child_id, enrollment);
    return map;
  }, [data?.enrollments]);

  const subscriptionByChild = useMemo(() => {
    const map = new Map<string, any>();
    for (const subscription of data?.subscriptions ?? [])
      map.set(subscription.child_id, subscription);
    return map;
  }, [data?.subscriptions]);

  const assignmentByChild = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of data?.assignments ?? []) map.set(row.child_id, row);
    return map;
  }, [data?.assignments]);

  const attendanceByClassChild = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of data?.attendance ?? []) map.set(`${row.class_id}:${row.child_id}`, row);
    return map;
  }, [data?.attendance]);

  const saveChild = useMutation({
    mutationFn: () => saveChildFn({ data: childForm }),
    onSuccess: () => {
      showApiSuccess("הילד/ה נשמר/ה");
      qc.invalidateQueries({ queryKey: ["admin-kids-aerial"] });
      setChildForm({
        child_name: "",
        guardian_name: "",
        guardian_phone: "",
        guardian_email: "",
        notes: "",
      });
    },
    onError: (error) => showApiError(error, "לא הצלחנו לשמור את הילד/ה."),
  });

  const manualPayment = useMutation({
    mutationFn: () =>
      manualPaymentFn({
        data: {
          childId: paymentForm.childId,
          packageId: paymentForm.packageId,
          method: paymentForm.method === "card" ? "other" : paymentForm.method,
          amount: paymentForm.amount ? Number(paymentForm.amount) : null,
          reference: paymentForm.reference || null,
          notes: paymentForm.notes || null,
        },
      }),
    onSuccess: () => {
      showApiSuccess("התשלום נרשם והחבילה הופעלה");
      qc.invalidateQueries({ queryKey: ["admin-kids-aerial"] });
      setPaymentForm((current) => ({ ...current, amount: "", reference: "", notes: "" }));
    },
    onError: (error) => showApiError(error, "לא הצלחנו לרשום את התשלום."),
  });

  const cardLink = useMutation({
    mutationFn: () =>
      cardLinkFn({
        data: {
          childId: paymentForm.childId,
          packageId: paymentForm.packageId,
          amount: paymentForm.amount ? Number(paymentForm.amount) : null,
          notes: paymentForm.notes || null,
        },
      }),
    onSuccess: (result: any) => {
      setPaymentLink({ url: result.paymentUrl, expiresAt: result.expiresAt });
      showApiSuccess("קישור התשלום נוצר");
      qc.invalidateQueries({ queryKey: ["admin-kids-aerial"] });
    },
    onError: (error) => showApiError(error, "לא הצלחנו ליצור קישור HYP."),
  });

  const assign = useMutation({
    mutationFn: () => assignFn({ data: assignment }),
    onSuccess: () => {
      showApiSuccess("השיבוץ נשמר");
      qc.invalidateQueries({ queryKey: ["admin-kids-aerial"] });
      setAssignment({ childId: "" });
    },
    onError: (error) => showApiError(error, "לא הצלחנו לשבץ לשיעור."),
  });

  const setupWeekly = useMutation({
    mutationFn: () => setupWeeklyFn(),
    onSuccess: (result: any) => {
      showApiSuccess(
        `שיעורי יום שני הוכנו: ${result.created} חדשים, ${result.archived} שיעורים לא נכונים הועברו לארכיון.`,
      );
      qc.invalidateQueries({ queryKey: ["admin-kids-aerial"] });
    },
    onError: (error) => showApiError(error, "לא הצלחנו להכין את שיעורי יום שני."),
  });

  const mark = useMutation({
    mutationFn: (input: {
      childId: string;
      classId: string;
      status: "present" | "absent" | "excused";
    }) => attendanceFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-kids-aerial"] }),
    onError: (error) => showApiError(error, "לא הצלחנו לעדכן נוכחות."),
  });

  const cancelSub = useMutation({
    mutationFn: (subscriptionId: string) => cancelSubscriptionFn({ data: { subscriptionId } }),
    onSuccess: () => {
      showApiSuccess("החיוב החודשי בוטל. ההיסטוריה נשמרה.");
      qc.invalidateQueries({ queryKey: ["admin-kids-aerial"] });
    },
    onError: (error) => showApiError(error, "לא הצלחנו לבטל את החיוב החודשי."),
  });

  const canSaveChild = childForm.child_name.trim() && childForm.guardian_name.trim();
  const canPay = paymentForm.childId && paymentForm.packageId;
  const canAssign = assignment.childId;

  return (
    <AdminPageShell dir="rtl">
      <AdminPageHeader
        eyebrow="ניהול ילדים"
        title="יוגה אווירית לילדים"
        description="רישום ילדים, שיבוץ לשיעור שבועי, מעקב תשלומים ונוכחות במקום אחד."
        action={
          <button
            type="button"
            className="btn-outline hover:btn-outline-hover"
            disabled={setupWeekly.isPending}
            onClick={() => setupWeekly.mutate()}
          >
            <CalendarDays className="h-4 w-4" />
            הכנת ימי שני 18:00
          </button>
        }
      />

      {isLoading || !data ? (
        <div className="editorial-panel h-64 animate-pulse" />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <AdminMetricCard
              label="ילדים פעילים"
              value={data.report.activeChildren}
              helper="ברשימה"
            />
            <AdminMetricCard
              label="תשלומים החודש"
              value={ils(data.report.paidThisMonthIls)}
              helper={`${data.report.paidThisMonthCount} תשלומים`}
            />
            <AdminMetricCard
              label="באיחור תשלום"
              value={data.report.overdueCount}
              helper="דורש מעקב"
              accent={data.report.overdueCount > 0}
            />
            <AdminMetricCard
              label="נוכחות החודש"
              value={data.report.present}
              helper={`${data.report.absent} חיסורים · ${data.report.excused} מוצדק`}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="editorial-panel p-5">
              <div className="mb-4 flex items-center gap-2 text-navy">
                <UserRound className="h-4 w-4 text-gold" />
                <h3 className="cc-section-title">הוספת ילד/ה</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="שם הילד/ה">
                  <input
                    className="editorial-input"
                    value={childForm.child_name}
                    onChange={(event) =>
                      setChildForm((f) => ({ ...f, child_name: event.target.value }))
                    }
                  />
                </Field>
                <Field label="שם הורה">
                  <input
                    className="editorial-input"
                    value={childForm.guardian_name}
                    onChange={(event) =>
                      setChildForm((f) => ({ ...f, guardian_name: event.target.value }))
                    }
                  />
                </Field>
                <Field label="טלפון הורה">
                  <input
                    className="editorial-input"
                    value={childForm.guardian_phone}
                    onChange={(event) =>
                      setChildForm((f) => ({ ...f, guardian_phone: event.target.value }))
                    }
                  />
                </Field>
                <Field label="אימייל הורה">
                  <input
                    className="editorial-input"
                    value={childForm.guardian_email}
                    onChange={(event) =>
                      setChildForm((f) => ({ ...f, guardian_email: event.target.value }))
                    }
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="הערות">
                    <textarea
                      className="editorial-input min-h-24"
                      value={childForm.notes}
                      onChange={(event) =>
                        setChildForm((f) => ({ ...f, notes: event.target.value }))
                      }
                    />
                  </Field>
                </div>
              </div>
              <button
                type="button"
                disabled={!canSaveChild || saveChild.isPending}
                onClick={() => saveChild.mutate()}
                className="btn-navy mt-4 hover:btn-navy-hover disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                שמירת ילד/ה
              </button>
            </div>

            <div className="editorial-panel p-5">
              <div className="mb-4 flex items-center gap-2 text-navy">
                <Wallet className="h-4 w-4 text-gold" />
                <h3 className="cc-section-title">תשלום וחבילה</h3>
              </div>
              <div className="grid gap-3">
                <SelectField
                  label="ילד/ה"
                  value={paymentForm.childId}
                  onChange={(value) => setPaymentForm((f) => ({ ...f, childId: value }))}
                >
                  <option value="">בחירת ילד/ה</option>
                  {data.children.map((child: any) => (
                    <option key={child.id} value={child.id}>
                      {child.child_name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="חבילה"
                  value={paymentForm.packageId}
                  onChange={(value) => setPaymentForm((f) => ({ ...f, packageId: value }))}
                >
                  <option value="">בחירת חבילה</option>
                  {data.packages.map((pkg: any) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} · {ils(Number(pkg.price))}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="אמצעי תשלום"
                  value={paymentForm.method}
                  onChange={(value) =>
                    setPaymentForm((f) => ({ ...f, method: value as PaymentForm["method"] }))
                  }
                >
                  <option value="cash">מזומן</option>
                  <option value="bit">ביט</option>
                  <option value="card">אשראי HYP</option>
                  <option value="other">אחר</option>
                </SelectField>
                <Field label="סכום אחר (אופציונלי)">
                  <input
                    type="number"
                    min="1"
                    className="editorial-input"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((f) => ({ ...f, amount: event.target.value }))
                    }
                    placeholder="השאירו ריק למחיר החבילה"
                  />
                </Field>
                <Field label="אסמכתא / הערות">
                  <input
                    className="editorial-input"
                    value={paymentForm.reference}
                    onChange={(event) =>
                      setPaymentForm((f) => ({ ...f, reference: event.target.value }))
                    }
                    placeholder="ביט, מזומן, קבלה פנימית"
                  />
                </Field>
                <Field label="הערה נוספת">
                  <textarea
                    className="editorial-input min-h-20"
                    value={paymentForm.notes}
                    onChange={(event) =>
                      setPaymentForm((f) => ({ ...f, notes: event.target.value }))
                    }
                  />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canPay || paymentForm.method === "card" || manualPayment.isPending}
                  onClick={() => manualPayment.mutate()}
                  className="btn-navy hover:btn-navy-hover disabled:opacity-50"
                >
                  <ReceiptText className="h-4 w-4" />
                  רישום תשלום ידני
                </button>
                <button
                  type="button"
                  disabled={!canPay || paymentForm.method !== "card" || cardLink.isPending}
                  onClick={() => cardLink.mutate()}
                  className="btn-outline hover:btn-outline-hover disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  יצירת קישור אשראי
                </button>
              </div>
              {paymentLink && (
                <div className="mt-4 rounded-xl border border-gold/25 bg-ivory/70 p-3 text-sm">
                  <p className="font-semibold text-navy">קישור HYP מוכן</p>
                  <p className="mt-1 break-all text-slate" dir="ltr">
                    {paymentLink.url}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={paymentLink.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-navy hover:btn-navy-hover"
                    >
                      <Link2 className="h-4 w-4" />
                      פתיחה
                    </a>
                    <button
                      type="button"
                      className="btn-outline hover:btn-outline-hover"
                      onClick={() => {
                        navigator.clipboard?.writeText(paymentLink.url);
                        showApiSuccess("הקישור הועתק");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      העתקה
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="editorial-panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">שיבוץ שבועי</p>
                <h3 className="cc-section-title mt-1">קבוצה קבועה · יום שני 18:00</h3>
                <p className="mt-1 text-sm text-slate">
                  עד {data.weeklyGroup?.capacity ?? 7} ילדים. השיעורים מוסתרים מלקוחות ונפתחים
                  לנוכחות בלבד.
                </p>
              </div>
              <div className="grid min-w-[min(100%,28rem)] gap-2 md:grid-cols-[1fr_auto]">
                <select
                  className="editorial-input"
                  value={assignment.childId}
                  onChange={(e) => setAssignment((a) => ({ ...a, childId: e.target.value }))}
                >
                  <option value="">בחירת ילד/ה</option>
                  {data.children.map((child: any) => (
                    <option key={child.id} value={child.id}>
                      {child.child_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!canAssign || assign.isPending}
                  onClick={() => assign.mutate()}
                  className="btn-navy hover:btn-navy-hover disabled:opacity-50"
                >
                  שיבוץ
                </button>
              </div>
            </div>

            {data.classes.length === 0 ? (
              <Empty
                title="אין עדיין שיעורי יום שני"
                body="לחצו על הכנת ימי שני 18:00 כדי ליצור את השיעורים הקרובים. הם יהיו לצוות בלבד."
                primaryAction={
                  <button type="button" onClick={() => setupWeekly.mutate()} className="btn-navy">
                    הכנת שיעורים
                  </button>
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.classes.map((cls: any) => (
                  <KidsClassCard
                    key={cls.id}
                    cls={cls}
                    locale={locale}
                    assignments={data.assignments.filter((row: any) =>
                      assignmentMatchesClass(row, cls),
                    )}
                    attendanceByClassChild={attendanceByClassChild}
                    onMark={(childId, status) => mark.mutate({ childId, classId: cls.id, status })}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="text-start">ילד/ה</th>
                  <th className="text-start">הורה</th>
                  <th className="text-start">חבילה</th>
                  <th className="text-start">שיעור קבוע</th>
                  <th className="text-end">קרדיטים</th>
                  <th className="text-end">חיוב</th>
                </tr>
              </thead>
              <tbody>
                {data.children.map((child: any) => {
                  const enrollment = activeEnrollmentByChild.get(child.id);
                  const subscription = subscriptionByChild.get(child.id);
                  const fixedClass = assignmentByChild.get(child.id);
                  return (
                    <tr key={child.id}>
                      <td className="font-semibold">
                        <bdi>{child.child_name}</bdi>
                      </td>
                      <td className="text-slate">
                        <bdi>{child.guardian_name}</bdi>
                        {child.guardian_phone && (
                          <span className="block text-xs" dir="ltr">
                            {child.guardian_phone}
                          </span>
                        )}
                      </td>
                      <td>
                        {enrollment ? (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${enrollment.status === "past_due" ? "border-red-200 bg-red-50 text-red-700" : "border-gold/40 bg-gold/10 text-navy"}`}
                          >
                            {enrollment.package?.name ?? "חבילה פעילה"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate">אין חבילה פעילה</span>
                        )}
                      </td>
                      <td className="text-slate">{fixedClass ? "יום שני · 18:00" : "לא שובץ/ה"}</td>
                      <td className="text-end numeric-display">
                        {enrollment
                          ? `${enrollment.credits_remaining}/${enrollment.credits_total}`
                          : "0"}
                      </td>
                      <td className="text-end">
                        {subscription ? (
                          <button
                            type="button"
                            className="btn-ghost inline-flex items-center gap-1 px-0 text-xs text-slate hover:text-destructive"
                            disabled={cancelSub.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  "לבטל חיובים עתידיים באשראי? התקופה הנוכחית וההיסטוריה יישארו.",
                                )
                              ) {
                                cancelSub.mutate(subscription.id);
                              }
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            ביטול חודשי
                          </button>
                        ) : (
                          <span className="text-xs text-slate">ללא חיוב חוזר</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </AdminPageShell>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <Field label={label}>
      <select
        className="editorial-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </Field>
  );
}

function KidsClassCard({
  cls,
  locale,
  assignments,
  attendanceByClassChild,
  onMark,
}: {
  cls: any;
  locale: string;
  assignments: any[];
  attendanceByClassChild: Map<string, any>;
  onMark: (childId: string, status: "present" | "absent" | "excused") => void;
}) {
  return (
    <div className="editorial-card p-4">
      <div className="flex items-start justify-between gap-3 border-b border-gold/20 pb-3">
        <div>
          <p className="cc-card-title">
            <bdi>{cls.title}</bdi>
          </p>
          <p className="mt-1 text-xs font-medium text-slate">
            {formatDateTime(cls.starts_at, locale)} · {cls.room}
          </p>
        </div>
        <span className="rounded-full border border-gold/35 px-2.5 py-1 text-xs font-semibold text-navy">
          {cls.kids_assigned_count}/{cls.capacity}
        </span>
      </div>
      {assignments.length === 0 ? (
        <p className="py-5 text-sm text-slate">אין ילדים משובצים לשיעור הזה.</p>
      ) : (
        <div className="divide-y divide-gold/15">
          {assignments.map((assignment) => {
            const attendance = attendanceByClassChild.get(`${cls.id}:${assignment.child_id}`);
            return (
              <div
                key={assignment.id}
                className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div>
                  <p className="font-semibold text-navy">
                    <bdi>{assignment.child?.child_name}</bdi>
                  </p>
                  <p className="mt-1 text-xs text-slate">
                    {attendance ? attendanceLabel(attendance.status) : "עדיין לא סומן"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AttendButton
                    active={attendance?.status === "present"}
                    onClick={() => onMark(assignment.child_id, "present")}
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  >
                    נוכח/ת
                  </AttendButton>
                  <AttendButton
                    active={attendance?.status === "absent"}
                    onClick={() => onMark(assignment.child_id, "absent")}
                    icon={<XCircle className="h-3.5 w-3.5" />}
                  >
                    חסרה
                  </AttendButton>
                  <AttendButton
                    active={attendance?.status === "excused"}
                    onClick={() => onMark(assignment.child_id, "excused")}
                    icon={<Baby className="h-3.5 w-3.5" />}
                  >
                    מוצדק
                  </AttendButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttendButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
        active
          ? "border-navy bg-navy text-ivory"
          : "border-gold/35 bg-white text-navy hover:border-gold/60"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function attendanceLabel(status: string) {
  if (status === "present") return "נוכח/ת · ירד קרדיט";
  if (status === "absent") return "חסרה · לא ירד קרדיט";
  return "חיסור מוצדק · לא ירד קרדיט";
}

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function assignmentMatchesClass(assignment: any, cls: any) {
  if (assignment.class_id && assignment.class_id === cls.id) return true;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(cls.starts_at))
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const time = `${parts.hour}:${parts.minute}`;
  return (
    Number(assignment.weekday ?? 1) === weekday &&
    String(assignment.start_time ?? "18:00:00").slice(0, 5) === time
  );
}
