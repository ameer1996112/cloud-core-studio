import { useEffect, useState } from "react";
import { auditScenarios } from "./fixtures";
import type { AuditLanguage, AuditScenario } from "./types";
import { setActiveLang } from "../../src/lib/i18n";
import { InteractionFixture, type InteractionJourney } from "./InteractionFixture";

const defaultScenario = auditScenarios.find((scenario) => scenario.kind === "visual")!;

function readScenario(): AuditScenario {
  const requestedId = new URLSearchParams(window.location.search).get("scenario");
  return auditScenarios.find((scenario) => scenario.id === requestedId) ?? defaultScenario;
}

function readLanguage(scenario: AuditScenario): AuditLanguage {
  const requestedLanguage = new URLSearchParams(window.location.search).get("language");
  return scenario.languages.includes(requestedLanguage as AuditLanguage)
    ? (requestedLanguage as AuditLanguage)
    : scenario.languages[0];
}

export function FixtureApp() {
  const [scenario, setScenario] = useState(readScenario);
  const [language, setLanguage] = useState(() => readLanguage(readScenario()));
  const evidenceMode = new URLSearchParams(window.location.search).get("evidence") === "1";
  const interactionMode = new URLSearchParams(window.location.search).get("interaction") === "1";
  const requestedJourney = new URLSearchParams(window.location.search).get("journey");
  const interactionJourney: InteractionJourney = [
    "booking",
    "cancellation",
    "instructor-attendance",
    "admin-destructive-confirmation",
  ].includes(requestedJourney ?? "")
    ? (requestedJourney as InteractionJourney)
    : "all";
  setActiveLang(language);

  useEffect(() => {
    const syncFromQuery = () => {
      const nextScenario = readScenario();
      setScenario(nextScenario);
      setLanguage(readLanguage(nextScenario));
    };

    window.addEventListener("popstate", syncFromQuery);
    return () => window.removeEventListener("popstate", syncFromQuery);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "en" ? "ltr" : "rtl";
  }, [language]);

  const updateQuery = (nextScenario: AuditScenario, nextLanguage: AuditLanguage) => {
    const query = new URLSearchParams({ scenario: nextScenario.id, language: nextLanguage });
    window.history.replaceState(null, "", `${window.location.pathname}?${query.toString()}`);
    setScenario(nextScenario);
    setLanguage(nextLanguage);
  };

  return (
    <main
      className={evidenceMode ? "audit-shell audit-shell-evidence" : "audit-shell"}
      lang={language}
      dir={language === "en" ? "ltr" : "rtl"}
    >
      {!evidenceMode ? (
        <>
          <p className="fixture-banner" role="status">
            Fixture-only UI evidence mode — no live services or production routing are available.
          </p>
          <header>
            <p className="eyebrow">UI evidence harness</p>
            <h1>{scenario.id}</h1>
            <p>
              Role: {scenario.role} · Route: {scenario.route} · State: {scenario.state}
            </p>
          </header>
          <section aria-label="Fixture controls" className="fixture-controls">
            <label>
              Scenario
              <select
                value={scenario.id}
                onChange={(event) => {
                  const nextScenario =
                    auditScenarios.find((item) => item.id === event.target.value) ??
                    defaultScenario;
                  updateQuery(nextScenario, nextScenario.languages[0]);
                }}
              >
                {auditScenarios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Language
              <select
                value={language}
                onChange={(event) => updateQuery(scenario, event.target.value as AuditLanguage)}
              >
                {scenario.languages.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </>
      ) : null}
      {interactionMode ? (
        <InteractionFixture language={language} journey={interactionJourney} />
      ) : scenario.kind === "visual" ? (
        scenario.render({ language })
      ) : (
        <section aria-labelledby="non-visual-evidence-title">
          <h2 id="non-visual-evidence-title">Source and behavior evidence only</h2>
          <p>This matrix cell is intentionally excluded from screenshots and axe scans.</p>
        </section>
      )}
    </main>
  );
}
