import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { healthClinicalRequest } from "@/lib/health-clinical.functions";
import { useI18n } from "@/lib/i18n";
import { healthPolicyCopy } from "@/lib/health-policy-copy";
import type { ClinicalResponse } from "@/lib/health-clinical-contract";
export function HealthRetentionReview() {
  const { lang } = useI18n(),
    c = healthPolicyCopy[lang];
  const request = useServerFn(healthClinicalRequest);
  const [items, setItems] = useState<ClinicalResponse["retentionItems"]>();
  const [signedOn, setSignedOn] = useState("");
  const [id, setId] = useState(""),
    [reason, setReason] = useState("incident"),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const active = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function run(decision?: string, cursor?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const r = await request({
        data: {
          action:
            decision === "date"
              ? "retention_date"
              : decision
                ? "retention_hold"
                : "retention_queue",
          payload: decision
            ? { id, reason, decision, confirmed, signedOn }
            : cursor
              ? { cursor }
              : {},
        },
      });
      if (r.error) throw new Error("unavailable");
      if (active.current) {
        if (decision) {
          setConfirmed(false);
          setItems(undefined);
          setMessage(c.done);
        } else setItems(r.retentionItems ?? []);
      }
    } catch {
      if (active.current) setMessage(c.error);
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <section className="border rounded-2xl p-5 space-y-4">
      <h2>{c.retention}</h2>
      <p>{c.reviewRequired}</p>
      <button className="border rounded-xl p-3" disabled={busy} onClick={() => void run()}>
        {c.load}
      </button>
      {items?.length === 0 && <p>{c.empty}</p>}
      {items?.map((x) => (
        <article key={x.id} className="border p-3">
          <p>{x.participant_name}</p>
          <p className="break-all">{x.id}</p>
          <p>{x.held ? c.held : c.reviewRequired}</p>
          {x.has_document && !x.signed_on && <p>{c.certificateDateMissing}</p>}
        </article>
      ))}
      {items?.length === 100 && (
        <button
          disabled={busy}
          className="border rounded-xl p-3"
          onClick={() => void run(undefined, items[items.length - 1].id)}
        >
          {c.more}
        </button>
      )}
      <label className="block">
        {c.reference}
        <input
          className="block w-full border p-2"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setConfirmed(false);
          }}
          disabled={busy}
        />
      </label>
      <label className="block">
        {c.reason}
        <select
          className="block border p-2"
          value={reason}
          disabled={busy}
          onChange={(e) => {
            setReason(e.target.value);
            setConfirmed(false);
          }}
        >
          {(["incident", "claim", "other_review"] as const).map((k) => (
            <option key={k} value={k}>
              {c[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {c.confirmed}
      </label>
      <label className="block">
        {c.signedOn}
        <input
          type="date"
          className="block border p-2"
          value={signedOn}
          disabled={busy}
          onChange={(e) => {
            setSignedOn(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <button
        disabled={busy || !confirmed || !signedOn || !/^[0-9a-f-]{36}$/i.test(id)}
        onClick={() => void run("date")}
        className="border rounded-xl p-3"
      >
        {c.recordDate}
      </button>
      {(["hold", "release"] as const).map((d) => (
        <button
          key={d}
          className="border rounded-xl p-3"
          disabled={busy || !confirmed || !/^[0-9a-f-]{36}$/i.test(id)}
          onClick={() => void run(d)}
        >
          {c[d]}
        </button>
      ))}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
