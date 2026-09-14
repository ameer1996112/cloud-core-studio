import { ReviewButton } from "@/components/member/design/VisualSystem";
import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, LockKeyhole, PenLine } from "lucide-react";
import "./health-form.css";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  healthClinicalRequest,
  uploadHealthDocument,
  readHealthDocument,
  downloadHealthReceipt,
} from "@/lib/health-clinical.functions";
import {
  completeHealthAnswers,
  HEALTH_DOCUMENT_MAX_BYTES,
  type HealthAnswers,
} from "@/lib/health-real-form";
import { healthDocumentName } from "@/lib/health-document";
import { clinicalCopy } from "@/lib/health-clinical-copy";
import type { ClinicalResponse } from "@/lib/health-clinical-contract";

import { healthPolicyCopy } from "@/lib/health-policy-copy";
import { HealthRetentionReview } from "./HealthRetentionReview";
import { receiptCopy } from "@/lib/health-receipt";

const button = "rounded-full border border-current px-5 py-3 disabled:opacity-50";
export function ClinicalWorkspace({
  userId,
  parent = false,
  review = false,
}: {
  userId: string;
  parent?: boolean;
  review?: boolean;
}) {
  const { lang, dir } = useI18n();
  const c = clinicalCopy[lang];
  const policy = healthPolicyCopy[lang];
  const request = useServerFn(healthClinicalRequest),
    upload = useServerFn(uploadHealthDocument),
    read = useServerFn(readHealthDocument),
    receiptPdf = useServerFn(downloadHealthReceipt);
  const [boot, setBoot] = useState<ClinicalResponse>();
  const [participant, setParticipant] = useState("");
  const [state, setState] = useState<ClinicalResponse>();
  const [answers, setAnswers] = useState<HealthAnswers>({});
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [revoked, setRevoked] = useState(false);
  const [receipt, setReceipt] = useState<ClinicalResponse["declaration"]>();
  const [pdfDownload, setPdfDownload] = useState<string>();
  const pdfUrl = useRef("");
  function clearPdf() {
    if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
    pdfUrl.current = "";
    setPdfDownload(undefined);
  }
  const [file, setFile] = useState<File>();
  const [queue, setQueue] = useState<NonNullable<ClinicalResponse["items"]>>([]);
  const [readId, setReadId] = useState("");
  const [signedOn, setSignedOn] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [download, setDownload] = useState<{ url: string; name: string }>();
  const active = useRef(true),
    locked = useRef(false),
    epoch = useRef(0),
    objectUrl = useRef("");
  const pending = useRef<{ locale: typeof lang; [key: string]: unknown } | null>(null);
  function clearDownload() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = "";
    setDownload(undefined);
  }
  useEffect(() => {
    active.current = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        active.current = false;
        epoch.current++;
        pending.current = null;
        setBoot(undefined);
        setState(undefined);
        setAnswers({});
        setConfirmations({});
        setFile(undefined);
        setReceipt(undefined);
        clearPdf();
        setQueue([]);
        setReadId("");
        setReviewConfirmed(false);
        setSignedOn("");
        clearDownload();
        setRevoked(true);
      }
    });
    return () => {
      active.current = false;
      subscription.unsubscribe();
      if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, [userId]);
  useEffect(() => {
    let current = true;
    void request({ data: { action: "bootstrap" } })
      .then(async (b) => {
        if (b.error) throw new Error("unavailable");
        if (!current || !active.current) return;
        setBoot(b);
        if (review) {
          const q = await request({ data: { action: "queue" } });
          if (q.error) throw new Error("unavailable");
          if (current && active.current) setQueue(q.items ?? []);
        } else if (!parent) {
          const s = await request({
            data: { action: "status", payload: { participantId: userId } },
          });
          if (current && active.current) {
            setParticipant(userId);
            setState(s);
          }
        }
      })
      .catch(() => {
        if (current && active.current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [request, userId, parent, review]);
  async function call(action: string, payload: Record<string, unknown> = {}) {
    const r = await request({ data: { action, payload } });
    if (r.error) throw new Error(r.error);
    return r;
  }
  async function run(task: () => Promise<void>) {
    if (locked.current || !active.current) return;
    locked.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await task();
    } catch (error) {
      if (active.current) {
        setFailed(true);
        if (
          error instanceof Error &&
          ["HEALTH_TEMPLATE_UNAVAILABLE", "HEALTH_INVALID_REQUEST", "HEALTH_FORBIDDEN"].includes(
            error.message,
          )
        ) {
          pending.current = null;
          setConfirmations({});
          if (error.message === "HEALTH_TEMPLATE_UNAVAILABLE") {
            try {
              const fresh = await call("bootstrap");
              const refreshedStatus = await call("status", { participantId: participant });
              if (active.current) {
                setBoot(fresh);
                setState(refreshedStatus);
                const questions = fresh.form?.wording[lang].questions ?? [];
                setAnswers((old) =>
                  Object.fromEntries(
                    questions.flatMap((q) => {
                      const answer = old[q.id];
                      return answer === "yes" || answer === "no" || (q.na && answer === "na")
                        ? [[q.id, answer]]
                        : [];
                    }),
                  ),
                );
              }
            } catch {
              /* Keep the error visible; a retry can refresh again. */
            }
          }
        }
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function choose(id: string) {
    epoch.current++;
    const version = epoch.current;
    setParticipant(id);
    setAnswers({});
    setConfirmations({});
    setState(undefined);
    setReceipt(undefined);
    clearPdf();
    setFile(undefined);
    clearDownload();
    await run(async () => {
      const s = await call("status", { participantId: id });
      if (active.current && version === epoch.current) setState(s);
    });
  }
  async function downloadDocument(id: string) {
    clearDownload();
    await run(async () => {
      const r = await read({ data: { id } });
      if (r.error || !r.base64 || !r.mimeType) throw new Error("unavailable");
      if (!active.current) return;
      const bytes = Uint8Array.from(atob(r.base64), (x) => x.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mimeType }));
      objectUrl.current = url;
      setDownload({ url, name: healthDocumentName(r.mimeType) });
      setReadId(id);
      setReviewConfirmed(false);
      setSignedOn("");
    });
  }
  const displayLang = pending.current?.locale ?? lang;
  const content = boot?.form?.wording[displayLang];
  const formUi = {
    en: {
      questions: "Health questionnaire",
      answered: "questions answered",
      signing: "Review & sign",
      required: "Answer every question and confirm each statement before submitting.",
    },
    he: {
      questions: "שאלון בריאות",
      answered: "שאלות נענו",
      signing: "בדיקה וחתימה",
      required: "יש לענות על כל השאלות ולאשר את כל ההצהרות לפני ההגשה.",
    },
    ar: {
      questions: "استبيان الصحة",
      answered: "أسئلة تمت الإجابة عنها",
      signing: "المراجعة والتوقيع",
      required: "يرجى الإجابة عن جميع الأسئلة وتأكيد كل إقرار قبل الإرسال.",
    },
  }[displayLang];
  const answeredCount = content?.questions.filter((q) => answers[q.id] !== undefined).length ?? 0;
  const frozen = pending.current !== null;
  const complete =
    completeHealthAnswers(answers) &&
    ["truthful", "advice", "changes", "privacy", "signer"].every((k) => confirmations[k]);
  const remainingQuestions = (content?.questions.length ?? 0) - answeredCount;
  const remainingConfirmations =
    Number(!["truthful", "advice", "changes", "signer"].every((key) => confirmations[key])) +
    Number(!confirmations.privacy);
  const submissionHint = busy
    ? c.loading
    : frozen
      ? c.retry
      : complete
        ? { en: "Ready to submit", he: "ההצהרה מוכנה להגשה", ar: "الإقرار جاهز للإرسال" }[
            displayLang
          ]
        : remainingQuestions > 0
          ? {
              en: `Unanswered questions: ${remainingQuestions}`,
              he: `שאלות שנותרו למענה: ${remainingQuestions}`,
              ar: `الأسئلة المتبقية: ${remainingQuestions}`,
            }[displayLang]
          : {
              en: `Required confirmations remaining: ${remainingConfirmations}`,
              he: `אישורים שנותרו להשלמה: ${remainingConfirmations}`,
              ar: `التأكيدات المطلوبة المتبقية: ${remainingConfirmations}`,
            }[displayLang];
  const allowed =
    boot?.participants?.filter((p) => (parent ? p.id !== userId : p.id === userId)) ?? [];
  if (revoked) return null;
  return (
    <section
      data-private="true"
      data-dd-privacy="hidden"
      className="space-y-6 hj-suppress"
      dir={dir}
    >
      {failed && <p role="alert">{c.error}</p>}
      {!boot && !failed && <p role="status">{c.loading}</p>}
      {boot?.testOnly && <p className="rounded-xl border p-4">{c.draft}</p>}
      {review ? (
        <>
          <h2 className="text-2xl font-display">{c.review}</h2>
          {boot?.retentionAdmin && <HealthRetentionReview />}
          {!queue.length && <p>{c.empty}</p>}
          {queue.map((item) => (
            <article key={item.id} className="border rounded-2xl p-5 space-y-4">
              <h3>{item.participant_name}</h3>
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy}
                onClick={() => void downloadDocument(item.id)}
              >
                {c.download}
              </ReviewButton>
              {readId === item.id && download && (
                <>
                  <a
                    href={download.url}
                    download={download.name}
                    className="underline inline-block py-3"
                  >
                    {c.downloadReady}
                  </a>
                  <label className="block">
                    {policy.signedOn}
                    <input
                      type="date"
                      className="block border p-3"
                      value={signedOn}
                      max={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" })}
                      onChange={(e) => {
                        setSignedOn(e.target.value);
                        setReviewConfirmed(false);
                      }}
                      disabled={busy}
                    />
                  </label>
                  <label className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={reviewConfirmed}
                      onChange={(e) => setReviewConfirmed(e.target.checked)}
                    />
                    {c.reviewed}
                  </label>
                  {(["accepted", "rejected"] as const).map((decision) => (
                    <ReviewButton
                      variant="primary"
                      type="submit"
                      key={decision}
                      className={button}
                      disabled={busy || !reviewConfirmed || (decision === "accepted" && !signedOn)}
                      onClick={() =>
                        void run(async () => {
                          await call("review", {
                            id: item.id,
                            decision,
                            confirmed: true,
                            signedOn,
                          });
                          const q = await call("queue");
                          if (active.current) {
                            setQueue(q.items ?? []);
                            setReadId("");
                            setReviewConfirmed(false);
                            setSignedOn("");
                            clearDownload();
                          }
                        })
                      }
                    >
                      {decision === "accepted" ? c.accept : c.reject}
                    </ReviewButton>
                  ))}
                </>
              )}
            </article>
          ))}
        </>
      ) : (
        <>
          {parent && (
            <>
              <label htmlFor="clinical-participant">{c.choose}</label>
              <select
                id="clinical-participant"
                className="w-full border rounded-xl p-3"
                value={participant}
                disabled={busy || frozen}
                onChange={(e) => void choose(e.target.value)}
              >
                <option value="">{c.choose}</option>
                {allowed.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
          {participant && (
            <p className="font-medium">{allowed.find((p) => p.id === participant)?.name}</p>
          )}
          {state?.error && <p role="alert">{c.error}</p>}
          {state?.renewalDue && (
            <aside className="rounded-xl border p-4 space-y-3">
              <p>{policy.renewal}</p>
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy}
                onClick={() => setState((s) => ({ ...s, status: "superseded", renewalDue: false }))}
              >
                {policy.renew}
              </ReviewButton>
            </aside>
          )}
          {state?.status && <p role="status">{c[state.status as keyof typeof c] ?? c.missing}</p>}
          {participant &&
            content &&
            state &&
            !state.error &&
            ["missing", "expired", "superseded"].includes(state.status ?? "missing") && (
              <form
                className="health-declaration-form"
                lang={displayLang}
                dir={displayLang === "en" ? "ltr" : "rtl"}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!complete && !frozen) return;
                  pending.current ??= {
                    participantId: participant,
                    templateVersion: boot!.form!.version,
                    locale: lang,
                    answers: structuredClone(answers),
                    confirmations: structuredClone(confirmations),
                    idempotencyKey: crypto.randomUUID(),
                  };
                  void run(async () => {
                    const s = await call("submit", pending.current!);
                    if (active.current) {
                      pending.current = null;
                      setState(s);
                      setAnswers({});
                      setConfirmations({});
                    }
                  });
                }}
              >
                <header className="health-form-intro">
                  <ClipboardCheck size={28} strokeWidth={1.5} aria-hidden="true" />
                  <h2>{content.title}</h2>
                  <p>{parent ? content.parentIntroduction : content.introduction}</p>
                </header>
                <div className="health-form-progress">
                  <div>
                    <h3>{formUi.questions}</h3>
                    <span>
                      <bdi dir="ltr">
                        {answeredCount} / {content.questions.length}
                      </bdi>{" "}
                      {formUi.answered}
                    </span>
                  </div>
                  <progress
                    value={answeredCount}
                    max={content.questions.length}
                    aria-label={formUi.answered}
                  />
                </div>
                <fieldset disabled={busy || frozen} className="space-y-5">
                  <legend className="sr-only">{content.title}</legend>
                  {content.questions.map((q, i) => (
                    <fieldset key={q.id} className="health-question">
                      <legend>
                        <span className="health-question-number" aria-hidden="true">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{parent ? q.parent : q.adult}</span>
                      </legend>
                      <div className="health-answer-options">
                        {(["yes", "no", ...(q.na ? ["na"] : [])] as const).map((value) => (
                          <label key={value} className="health-answer-option">
                            <input
                              type="radio"
                              name={q.id}
                              value={value}
                              required
                              checked={answers[q.id] === value}
                              onChange={() =>
                                setAnswers((a) => ({ ...a, [q.id]: value as "yes" | "no" | "na" }))
                              }
                            />
                            {c[value as "yes" | "no" | "na"]}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button type="button" className="health-privacy-link">
                        <LockKeyhole size={20} aria-hidden="true" />
                        <span>{c.privacy}</span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent
                      className="health-privacy-page"
                      dir={displayLang === "en" ? "ltr" : "rtl"}
                      lang={displayLang}
                      aria-describedby={undefined}
                      data-private="true"
                      data-dd-privacy="hidden"
                    >
                      <DialogTitle className="health-privacy-title">{c.privacy}</DialogTitle>
                      <div className="health-privacy-copy hj-suppress">
                        {content.privacy.split(/\n\s*\n/).map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                      </div>
                      <DialogClose asChild>
                        <ReviewButton
                          variant="primary"
                          type="button"
                          className="health-form-submit"
                        >
                          {displayLang === "he"
                            ? "חזרה להצהרת הבריאות"
                            : displayLang === "ar"
                              ? "العودة إلى الإقرار الصحي"
                              : "Back to health declaration"}
                        </ReviewButton>
                      </DialogClose>
                    </DialogContent>
                  </Dialog>
                  <section className="health-signing-panel">
                    <div className="health-signing-heading">
                      <PenLine size={22} strokeWidth={1.5} aria-hidden="true" />
                      <h3>{formUi.signing}</h3>
                    </div>
                    <div id="health-signing-statements" className="health-signing-statements">
                      {content.confirmations
                        .filter((item) => item.id !== "privacy")
                        .map((item) => (
                          <p key={item.id}>{item.text}</p>
                        ))}
                      <p className="health-signer-statement">
                        {parent ? content.parentConfirmation : content.adultConfirmation}
                      </p>
                    </div>
                    <label className="health-confirmation health-signer-confirmation">
                      <input
                        type="checkbox"
                        name="declaration-confirmation"
                        required
                        aria-describedby="health-signing-statements"
                        checked={["truthful", "advice", "changes", "signer"].every(
                          (key) => !!confirmations[key],
                        )}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfirmations((v) => ({
                            ...v,
                            truthful: checked,
                            advice: checked,
                            changes: checked,
                            signer: checked,
                          }));
                        }}
                      />
                      <span>
                        {displayLang === "he"
                          ? "קראתי ואני מאשר/ת את כל ההצהרות המפורטות לעיל."
                          : displayLang === "ar"
                            ? "قرأتُ جميع الإقرارات الواردة أعلاه وأؤكدها."
                            : "I have read and confirm all the statements above."}
                      </span>
                    </label>
                    {content.confirmations
                      .filter((item) => item.id === "privacy")
                      .map((item) => (
                        <label
                          key={item.id}
                          className="health-confirmation health-signer-confirmation"
                        >
                          <input
                            type="checkbox"
                            name="privacy-confirmation"
                            required
                            checked={!!confirmations.privacy}
                            onChange={(e) =>
                              setConfirmations((v) => ({ ...v, privacy: e.target.checked }))
                            }
                          />
                          <span>{item.text}</span>
                        </label>
                      ))}
                  </section>
                </fieldset>
                <footer className="health-form-footer">
                  <p id="health-submission-hint" aria-live="polite" aria-atomic="true">
                    {submissionHint}
                  </p>
                  <ReviewButton
                    variant="primary"
                    type="submit"
                    className="health-form-submit"
                    disabled={busy || (!complete && !frozen)}
                    aria-busy={busy}
                    aria-describedby="health-submission-hint"
                  >
                    {busy ? c.loading : frozen ? c.retry : c.submit}
                  </ReviewButton>
                </footer>
              </form>
            )}
          {state?.id && (
            <div className="flex flex-wrap gap-3">
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await call("copy", { id: state.id });
                    if (active.current) setReceipt(r.declaration);
                  })
                }
              >
                {c.copy}
              </ReviewButton>
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    clearPdf();
                    const version = epoch.current;
                    const result = await receiptPdf({ data: { id: state.id } });
                    if (result.error || !result.base64 || result.mimeType !== "application/pdf")
                      throw new Error("unavailable");
                    if (!active.current || version !== epoch.current) return;
                    const bytes = Uint8Array.from(atob(result.base64), (x) => x.charCodeAt(0));
                    pdfUrl.current = URL.createObjectURL(
                      new Blob([bytes], { type: "application/pdf" }),
                    );
                    setPdfDownload(pdfUrl.current);
                  })
                }
              >
                {receiptCopy[lang].download}
              </ReviewButton>
              {pdfDownload && (
                <a className={button} href={pdfDownload} download="cloud-core-declaration.pdf">
                  {receiptCopy[lang].ready}
                </a>
              )}
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await call("change", { id: state.id });
                    if (active.current) {
                      setState(r);
                      setReceipt(undefined);
                      clearPdf();
                      setFile(undefined);
                      clearDownload();
                    }
                  })
                }
              >
                {c.change}
              </ReviewButton>
            </div>
          )}
          {receipt && (
            <article
              className="rounded-2xl border p-5 space-y-4"
              lang={receipt.locale}
              dir={receipt.locale === "en" ? "ltr" : "rtl"}
            >
              <h3>{receipt.snapshot.wording.title}</h3>
              <p>
                {c.submitted}: {new Date(receipt.submittedAt).toLocaleString(lang)}
              </p>
              <p>
                {c.version}: {receipt.templateVersion}
              </p>
              {receipt.snapshot.wording.questions.map((q) => (
                <p key={q.id}>
                  {receipt.snapshot.signerRole === "parent" ? q.parent : q.adult}
                  <br />
                  <strong>{c[receipt.answers[q.id] as "yes" | "no" | "na"]}</strong>
                </p>
              ))}
              {receipt.snapshot.wording.confirmations.map((x) => (
                <p key={x.id}>
                  {x.text} — {c.yes}
                </p>
              ))}
              <p>
                {receipt.snapshot.signerRole === "parent"
                  ? receipt.snapshot.wording.parentConfirmation
                  : receipt.snapshot.wording.adultConfirmation}
              </p>
              <p>{receipt.snapshot.wording.privacy}</p>
            </article>
          )}
          {state?.status === "requires_medical_document" && (
            <form
              className="space-y-4 rounded-2xl border p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (!file || !state.id) return;
                const body = new FormData();
                body.set("id", state.id);
                body.set("file", file);
                void run(async () => {
                  const r = await upload({ data: body });
                  if (r.error) throw new Error(r.error);
                  if (active.current) {
                    setState((s) => ({ ...s, ...r }));
                    setFile(undefined);
                  }
                });
              }}
            >
              <label htmlFor="medical-certificate">{c.document}</label>
              <p>{c.fileHelp}</p>
              <input
                key={state.id}
                id="medical-certificate"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (
                    f &&
                    f.size <= HEALTH_DOCUMENT_MAX_BYTES &&
                    ["application/pdf", "image/jpeg", "image/png"].includes(f.type)
                  ) {
                    setFile(f);
                    setFailed(false);
                  } else {
                    setFile(undefined);
                    setFailed(true);
                    e.target.value = "";
                  }
                }}
              />
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy || !file}
              >
                {c.upload}
              </ReviewButton>
            </form>
          )}
          {state?.id && state.hasDocument && (
            <>
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy}
                onClick={() => void downloadDocument(state.id!)}
              >
                {c.download}
              </ReviewButton>
              {download && (
                <a
                  href={download.url}
                  download={download.name}
                  className="underline inline-block p-3"
                >
                  {c.downloadReady}
                </a>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
