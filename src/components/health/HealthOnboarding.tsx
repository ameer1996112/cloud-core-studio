import { ReviewButton } from "@/components/member/design/VisualSystem";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { healthOnboardingRequest } from "@/lib/health-onboarding.functions";
import { onboardingCopy } from "@/lib/health-onboarding-copy";
import {
  parentInvitation,
  PARENT_INVITE_KEY,
  validBirthDate,
  type HealthOnboarding as OnboardingState,
} from "@/lib/health-onboarding";
import { ClinicalWorkspace } from "./ClinicalWorkspace";
import { HealthWorkspace } from "./HealthWorkspace";
import { healthReturnPath } from "@/lib/health-contract";

const button = "rounded-full border border-current px-6 py-3 disabled:opacity-50";

export function HealthOnboarding({
  userId,
  classId,
  parent = false,
  review = false,
}: {
  userId: string;
  classId?: string;
  parent?: boolean;
  review?: boolean;
}) {
  const { lang, dir } = useI18n();
  const c = onboardingCopy[lang];
  const request = useServerFn(healthOnboardingRequest);
  const [state, setState] = useState<OnboardingState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [birthDate, setBirthDate] = useState("");
  const [link, setLink] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [relationship, setRelationship] = useState("parent");
  const [confirmed, setConfirmed] = useState(false);
  const [verifiedId, setVerifiedId] = useState("");
  const [copied, setCopied] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const active = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    active.current = true;
    if (parent) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(PARENT_INVITE_KEY) ?? "null");
        if (saved && saved.expires > Date.now()) setToken(parentInvitation(saved.token));
        else sessionStorage.removeItem(PARENT_INVITE_KEY);
      } catch {
        /* no usable invitation */
      }
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        active.current = false;
        setState(undefined);
        setLink("");
        setToken(null);
        setBirthDate("");
        setConfirmed(false);
      }
    });
    return () => {
      active.current = false;
      subscription.unsubscribe();
    };
  }, [userId, parent]);
  useEffect(() => {
    let current = true;
    void request({ data: { action: "status" } })
      .then(async (result) => {
        if (review && result.enabled)
          result = { ...result, ...(await request({ data: { action: "guardian_queue" } })) };
        if (current && active.current) {
          setState(result);
          setError(Boolean(result.error));
        }
      })
      .catch(() => {
        if (current && active.current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [request, review, userId]);
  async function act(action: string, payload: Record<string, unknown> = {}) {
    if (locked.current || !active.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      const result = await request({ data: { action, payload } });
      if (result.error || result.enabled === false) throw new Error("unavailable");
      if (!active.current) return;
      if (result.token) {
        setLink(`${window.location.origin}/health/parent#${result.token}`);
        setCopied(false);
      }
      if (action === "claim") {
        sessionStorage.removeItem(PARENT_INVITE_KEY);
        setToken(null);
        setClaimed(true);
      }
      let refreshed = await request({ data: { action: "status" } });
      if (review)
        refreshed = { ...refreshed, ...(await request({ data: { action: "guardian_queue" } })) };
      if (active.current) {
        setState(refreshed);
        setError(Boolean(refreshed.error));
      }
    } catch {
      if (active.current) setError(true);
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <section
      dir={dir}
      data-private="true"
      className="mx-auto max-w-2xl px-5 py-10 space-y-7 hj-suppress"
      data-dd-privacy="hidden"
    >
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest">{c.studio}</p>
        <h1 className="font-display text-3xl">
          {review ? c.queue : parent ? c.guardianTitle : c.title}
        </h1>
        <p>{c.intro}</p>
      </header>
      {error && (
        <div role="alert">
          <p>{c.error}</p>
          <ReviewButton
            variant="primary"
            type="submit"
            className={button}
            disabled={busy}
            onClick={() => window.location.reload()}
          >
            {c.retry}
          </ReviewButton>
        </div>
      )}
      {!state && !error && <p role="status">{c.loading}</p>}
      {state && !state.enabled && !error && (
        <section className="rounded-2xl border p-6 space-y-4">
          <p>{c.paused}</p>
          <p>{c.adult}</p>
          <p>{c.parent}</p>
          <p>{c.verification}</p>
        </section>
      )}
      {state?.enabled && (
        <>
          {(state.testOnly || state.collectionKind !== "clinical") && (
            <p className="text-sm">{c.test}</p>
          )}
          {state.needsNotice && !parent && !review && (
            <section className="rounded-2xl border p-5 space-y-4">
              <p>{c.notice}</p>
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy}
                onClick={() => void act("acknowledge_notice")}
              >
                {c.acknowledge}
              </ReviewButton>
            </section>
          )}
          {state.graceEndsAt && !parent && !review && (
            <p>
              {c.grace}: {new Date(state.graceEndsAt).toLocaleDateString(lang)}
            </p>
          )}
          {state.route === "birth_date" && !review && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (validBirthDate(birthDate)) void act("birth_date", { birthDate });
              }}
            >
              <label className="block" htmlFor="health-birth-date">
                {c.dob}
              </label>
              <input
                id="health-birth-date"
                type="date"
                required
                min="1900-01-01"
                max={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" })}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-xl border p-3"
              />
              <p>{c.dobHelp}</p>
              <ReviewButton
                variant="primary"
                type="submit"
                className={button}
                disabled={busy || !validBirthDate(birthDate)}
              >
                {c.save}
              </ReviewButton>
            </form>
          )}
          {!parent && !review && state.route === "parent" && (
            <section className="rounded-2xl border p-6 space-y-5">
              <p>{c.parent}</p>
              <p>{c.verification}</p>
              <p role="status">
                {state.status === "valid"
                  ? c.valid
                  : state.guardianState === "pending"
                    ? c.pending
                    : state.guardianState === "verified"
                      ? c.verified
                      : state.guardianState === "expired"
                        ? c.expired
                        : ""}
              </p>
              {!["pending", "verified"].includes(state.guardianState ?? "") && (
                <ReviewButton
                  variant="primary"
                  type="submit"
                  className={button}
                  disabled={busy}
                  onClick={() => void act("invite")}
                >
                  {c.share}
                </ReviewButton>
              )}
              {link && (
                <div className="space-y-3">
                  <p>{c.linkHelp}</p>
                  <input
                    aria-label={c.share}
                    className="w-full border rounded-xl p-3"
                    readOnly
                    value={link}
                    onFocus={(e) => e.target.select()}
                  />
                  <ReviewButton
                    variant="primary"
                    type="submit"
                    className={button}
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(link)
                        .then(() => setCopied(true))
                        .catch(() => setError(true));
                    }}
                  >
                    {copied ? c.copied : c.copy}
                  </ReviewButton>
                </div>
              )}
            </section>
          )}
          {parent && (
            <section className="space-y-4">
              <p>{c.guardianIntro}</p>
              {claimed || state.children?.some((child) => child.state === "pending") ? (
                <p role="status">{c.pending}</p>
              ) : null}
              {token && state.route === "adult" && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (confirmed) void act("claim", { token, relationship });
                  }}
                >
                  <label htmlFor="guardian-relationship">{c.relationship}</label>
                  <select
                    id="guardian-relationship"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full border rounded-xl p-3"
                  >
                    <option value="parent">{c.parentOption}</option>
                    <option value="guardian">{c.guardianOption}</option>
                  </select>
                  <label className="flex gap-3">
                    <input
                      type="checkbox"
                      required
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    {c.confirm}
                  </label>
                  <ReviewButton
                    variant="primary"
                    type="submit"
                    className={button}
                    disabled={!confirmed || busy}
                  >
                    {c.request}
                  </ReviewButton>
                </form>
              )}
              {!token && !claimed && !state.children?.length && <p>{c.noLink}</p>}
            </section>
          )}
          {review && (
            <section className="space-y-4">
              {!state.items?.length && <p>{c.noQueue}</p>}
              {state.items?.map((item) => (
                <article className="rounded-xl border p-5 space-y-3" key={item.id}>
                  <p>
                    {item.member} — {item.guardian} (
                    {item.relationship === "parent" ? c.parentOption : c.guardianOption})
                  </p>
                  {item.state === "pending" && (
                    <>
                      <label className="flex gap-3">
                        <input
                          type="checkbox"
                          checked={verifiedId === item.id}
                          onChange={(e) => setVerifiedId(e.target.checked ? item.id : "")}
                        />
                        {c.ownerConfirm}
                      </label>
                      <ReviewButton
                        variant="primary"
                        type="submit"
                        className={button}
                        disabled={busy || verifiedId !== item.id}
                        onClick={() => void act("verify", { id: item.id, confirmed: true })}
                      >
                        {c.approve}
                      </ReviewButton>
                    </>
                  )}
                  <ReviewButton
                    variant="primary"
                    type="submit"
                    className={button}
                    disabled={busy}
                    onClick={() => void act("revoke", { id: item.id })}
                  >
                    {c.revoke}
                  </ReviewButton>
                </article>
              ))}
            </section>
          )}
          {state.collectionEnabled &&
            (review ||
              (!parent && state.route === "adult") ||
              (parent && state.children?.some((child) => child.state === "verified"))) &&
            (state.collectionKind === "clinical" ? (
              <ClinicalWorkspace userId={userId} parent={parent} review={review} />
            ) : (
              <HealthWorkspace
                userId={userId}
                review={review}
                classId={classId}
                participantScope={review ? undefined : parent ? "dependents" : "self"}
              />
            ))}
        </>
      )}
      <a
        className="underline inline-block py-3"
        href={review ? "/admin" : healthReturnPath(classId)}
      >
        {c.continue}
      </a>
    </section>
  );
}
