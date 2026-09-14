import { ReviewButton } from "@/components/member/design/VisualSystem";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n, applyLang, LANG_META, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { healthRequest } from "@/lib/health.functions";
import { healthCopy } from "@/lib/health-copy";
import {
  SYNTHETIC_DOCUMENT,
  healthReturnPath,
  type HealthResponse,
  type HealthParticipant,
} from "@/lib/health-contract";

export function HealthWorkspace({
  userId,
  review = false,
  classId,
  participantScope,
}: {
  userId: string;
  review?: boolean;
  classId?: string;
  participantScope?: "self" | "dependents";
}) {
  const { lang, dir, locale } = useI18n();
  const c = healthCopy[lang];
  const request = useServerFn(healthRequest);
  const [boot, setBoot] = useState<HealthResponse>();
  const [participant, setParticipant] = useState<HealthParticipant>();
  const [state, setState] = useState<HealthResponse>();
  const [answer, setAnswer] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copy, setCopy] = useState<HealthResponse["declaration"]>();
  const [document, setDocument] = useState("");
  const [readId, setReadId] = useState("");
  const [queue, setQueue] = useState<NonNullable<HealthResponse["items"]>>([]);
  const [fileContent, setFileContent] = useState("");
  const [revoked, setRevoked] = useState(false);
  const pending = useRef<Record<string, unknown> | null>(null);
  const locked = useRef(false);
  const active = useRef(true);
  const selection = useRef(0);
  useEffect(() => {
    active.current = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        active.current = false;
        pending.current = null;
        setAnswer("");
        setConsent(false);
        setCopy(undefined);
        setDocument("");
        setFileContent("");
        setState(undefined);
        setBoot(undefined);
        setQueue([]);
        setRevoked(true);
      }
    });
    return () => {
      active.current = false;
      pending.current = null;
      subscription.unsubscribe();
    };
  }, [userId]);
  async function call(action: string, payload: Record<string, unknown> = {}) {
    const result = await request({ data: { action, payload } });
    if (result.error) throw new Error(result.error);
    return result;
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
          error.message === "HEALTH_TEMPLATE_UNAVAILABLE" &&
          pending.current
        ) {
          try {
            const refreshed = await call("bootstrap");
            if (active.current) {
              setBoot(refreshed);
              pending.current = null;
              setConsent(false);
            }
          } catch {
            /* Keep the draft and original retry key if refresh is unavailable. */
          }
        }
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function load() {
    const result = await call("bootstrap");
    if (!active.current) return;
    setBoot(result);
    if (review) {
      const q = await call("queue");
      if (active.current) setQueue(q.items ?? []);
    }
  }
  useEffect(() => {
    let mounted = true;
    locked.current = true;
    setBusy(true);
    void (async () => {
      try {
        const result = await request({ data: { action: "bootstrap", payload: {} } });
        if (result.error) throw new Error("health_load_failed");
        if (!mounted || !active.current) return;
        setBoot(result);
        if (review) {
          const resultQueue = await request({ data: { action: "queue", payload: {} } });
          if (resultQueue.error) throw new Error("health_load_failed");
          if (mounted && active.current) setQueue(resultQueue.items ?? []);
        }
      } catch {
        if (mounted && active.current) setFailed(true);
      } finally {
        if (mounted) {
          locked.current = false;
          if (active.current) setBusy(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [request, review]);
  const visibleParticipants = boot?.participants?.filter(
    (p) =>
      !participantScope ||
      (participantScope === "self" ? p.kind === "member" && p.id === userId : p.id !== userId),
  );
  async function choose(value: string) {
    const selected = visibleParticipants?.find((p) => `${p.kind}:${p.id}` === value);
    selection.current += 1;
    const current = selection.current;
    setParticipant(selected);
    setState(undefined);
    setAnswer("");
    setConsent(false);
    setSaved(false);
    setCopy(undefined);
    setDocument("");
    setFileContent("");
    pending.current = null;
    if (selected)
      await run(async () => {
        const result = await call("status", { kind: selected.kind, participantId: selected.id });
        if (active.current && current === selection.current) setState(result);
      });
  }
  const displayedLang = (pending.current?.locale as Lang | undefined) ?? lang;
  const wording = boot?.template?.wording[displayedLang];
  const statusLabel = (s: string) => c[s as keyof typeof c] ?? c.error;
  const button = "rounded-xl border border-current px-4 py-3 min-h-12 disabled:opacity-50";
  if (revoked) return <p role="status">{c.unavailable}</p>;
  return (
    <section
      dir={dir}
      className="member-page aura-member-page space-y-6 max-w-3xl mx-auto p-5"
      data-private="true"
      data-hj-suppress
      data-dd-privacy="hidden"
    >
      <h1 className="text-3xl">{review ? c.review : c.title}</h1>
      <p className="rounded-xl border p-4 font-semibold">{c.fixture}</p>
      <label>
        {c.language}
        <select
          aria-label={c.language}
          value={lang}
          onChange={(e) => applyLang(e.target.value as Lang)}
          className="m-2 p-3 rounded border"
        >
          {(["he", "ar", "en"] as const).map((l) => (
            <option key={l} value={l}>
              {LANG_META[l].label}
            </option>
          ))}
        </select>
      </label>
      {busy && <p role="status">{c.sending}</p>}
      {failed && (
        <div role="alert">
          <p>{boot ? c.error : c.unavailable}</p>
          {(!boot || review || (participant && !state)) && (
            <ReviewButton
              variant="primary"
              type="submit"
              className={button}
              disabled={busy}
              onClick={() =>
                void (!boot || review
                  ? run(load)
                  : participant
                    ? choose(`${participant.kind}:${participant.id}`)
                    : run(load))
              }
            >
              {c.retry}
            </ReviewButton>
          )}
        </div>
      )}
      {review && boot && (
        <div className="space-y-4">
          {!queue.length && <p>{c.empty}</p>}
          {queue.map((item) => (
            <article className="border rounded-xl p-4 space-y-3" key={item.id}>
              <p>
                <bdi>{item.participant_name ?? item.child_id ?? item.member_id}</bdi> —{" "}
                {statusLabel(item.status)}
              </p>
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy || item.status !== "pending_review"}
                onClick={() =>
                  void run(async () => {
                    const r = await call("document", { id: item.id });
                    if (active.current) {
                      setDocument(r.content ?? "");
                      setReadId(item.id);
                    }
                  })
                }
              >
                {c.read}
              </ReviewButton>
              {readId === item.id && (
                <>
                  <pre className="whitespace-pre-wrap">{document}</pre>
                  {(["accepted", "rejected"] as const).map((decision) => (
                    <ReviewButton
                      variant="primary"
                      type="submit"
                      key={decision}
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await call("review", { id: item.id, decision });
                          const q = await call("queue");
                          if (active.current) {
                            setQueue(q.items ?? []);
                            setReadId("");
                            setDocument("");
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
        </div>
      )}
      {!review && boot && (
        <>
          <p>{c.guardian}</p>
          <label className="block">
            {c.participant}
            <select
              className="block w-full rounded-xl border p-3 my-2"
              value={participant ? `${participant.kind}:${participant.id}` : ""}
              disabled={busy || !!pending.current}
              onChange={(e) => void choose(e.target.value)}
            >
              <option value="">{c.choose}</option>
              {visibleParticipants?.map((p) => (
                <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {state && (
            <div className="space-y-3 border rounded-xl p-4" aria-live="polite">
              <h2>
                {c.status}: {statusLabel(state.status)}
              </h2>
              {state.submittedAt && (
                <p>
                  {c.submittedAt}: {new Date(state.submittedAt).toLocaleString(locale)}
                </p>
              )}
              {state.expiresAt && (
                <p>
                  {c.expiresAt}: {new Date(state.expiresAt).toLocaleString(locale)}
                </p>
              )}
              {state.id && (
                <>
                  <ReviewButton
                    variant="primary"
                    type="submit"
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const r = await call("copy", { id: state.id });
                        if (active.current) setCopy(r.declaration);
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
                        await call("change", { id: state.id });
                        if (active.current) {
                          setState({ ...state, status: "superseded" });
                          setSaved(false);
                          setAnswer("");
                          setConsent(false);
                          pending.current = null;
                          setCopy(undefined);
                        }
                      })
                    }
                  >
                    {c.change}
                  </ReviewButton>
                </>
              )}
            </div>
          )}
          {copy && (
            <article className="border rounded-xl p-4">
              <h2>{c.readCopy}</h2>
              <div
                lang={copy.locale}
                dir={copy.locale === "en" ? "ltr" : "rtl"}
                className="space-y-3"
              >
                <h3>{copy.snapshot.wording.title}</h3>
                <p>{copy.snapshot.wording.notice}</p>
                <p>{copy.snapshot.wording.question}</p>
                <p>{copy.snapshot.wording[copy.answer]}</p>
                <p>{copy.snapshot.wording.consent}</p>
                <p>
                  <bdi>
                    {copy.template_version} · {copy.snapshot.policyVersion}
                  </bdi>
                </p>
              </div>
              <p>{c.history}</p>
            </article>
          )}
          {participant &&
            state &&
            wording &&
            ["missing", "expired", "superseded"].includes(state.status) &&
            !saved && (
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!answer || !consent) return;
                  void run(async () => {
                    pending.current ??= {
                      kind: participant.kind,
                      participantId: participant.id,
                      templateVersion: boot.template?.version,
                      locale: lang,
                      answer,
                      consent: true,
                      idempotencyKey: crypto.randomUUID(),
                    };
                    const result = await call("submit", pending.current);
                    if (active.current) {
                      setState(result);
                      setSaved(true);
                      setAnswer("");
                      setConsent(false);
                      pending.current = null;
                    }
                  });
                }}
              >
                <div lang={displayedLang} dir={displayedLang === "en" ? "ltr" : "rtl"}>
                  <h2 className="text-xl">{wording.title}</h2>
                  <p>{wording.notice}</p>
                  <fieldset disabled={busy || !!pending.current} className="space-y-3 mt-4">
                    <legend>{wording.question}</legend>
                    {(["clear", "document"] as const).map((value) => (
                      <label key={value} className="flex gap-3 border rounded-xl p-4">
                        <input
                          required
                          type="radio"
                          name="test-scenario"
                          checked={answer === value}
                          onChange={() => setAnswer(value)}
                        />
                        {wording[value]}
                      </label>
                    ))}
                    <label className="flex gap-3 border rounded-xl p-4">
                      <input
                        required
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      {wording.consent}
                    </label>
                  </fieldset>
                </div>
                <p>{c.draft}</p>
                <ReviewButton
                  variant="primary"
                  type="submit"
                  className={button}
                  disabled={busy || !answer || !consent}
                >
                  {busy ? c.sending : pending.current ? c.retry : c.send}
                </ReviewButton>
              </form>
            )}
          {state?.status === "requires_medical_document" && (
            <div className="space-y-3">
              <p>{c.pending}</p>
              <a
                className={button}
                download="TEST-ONLY.txt"
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(SYNTHETIC_DOCUMENT)}`}
              >
                {c.download}
              </a>
              <label className="block">
                {c.file}
                <input
                  className="block my-3"
                  type="file"
                  accept="text/plain,.txt"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setFileContent("");
                    void run(async () => {
                      if (!f || f.size > 128 || f.type !== "text/plain") throw new Error("invalid");
                      const text = await f.text();
                      if (text !== SYNTHETIC_DOCUMENT) throw new Error("invalid");
                      if (active.current) setFileContent(text);
                    });
                  }}
                />
              </label>
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy || fileContent !== SYNTHETIC_DOCUMENT}
                onClick={() =>
                  void run(async () => {
                    await call("upload", {
                      id: state.id,
                      content: fileContent,
                      mimeType: "text/plain",
                    });
                    if (active.current) {
                      setState({ ...state, status: "pending_review" });
                      setFileContent("");
                    }
                  })
                }
              >
                {c.upload}
              </ReviewButton>
            </div>
          )}
          {state?.status === "pending_review" && <p>{c.pending}</p>}
          {saved && <p role="status">{c.saved}</p>}
          <a className={`${button} inline-block`} href={healthReturnPath(classId)}>
            {c.back}
          </a>
        </>
      )}
    </section>
  );
}
