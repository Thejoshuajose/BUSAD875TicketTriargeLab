import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CATEGORIES,
  PRIORITIES,
  OWNERS,
  SAMPLES,
  rulesTriage,
  escalationReasons,
  POLICY_VERSION,
  type TriageDraft,
  type Category,
  type Priority,
} from "@/lib/triage-rules";
import { aiTriage } from "@/lib/triage.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FIWB Ticket Triage Lab — Educational Prototype" },
      {
        name: "description",
        content: "Educational prototype for drafting support ticket triage with a mandatory human review gate.",
      },
      { property: "og:title", content: "FIWB Ticket Triage Lab" },
      {
        property: "og:description",
        content: "Educational triage prototype with manual review and escalation safeguards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lab,
});

type Mode = "live" | "rules";
interface LogEntry {
  id: string;
  time: string;
  input: string;
  mode: Mode;
  modeNote: string;
  draft: TriageDraft;
  final?: TriageDraft;
  decision: "accepted" | "edited & accepted" | "escalated" | "pending";
  escalation: string[];
  policyVersion?: string;
  corrections?: { field: string; before: unknown; after: unknown }[];
}
const LOG_KEY = "fiwb-triage-lab-log";

function Copy({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="btn-secondary"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? "Copied" : label}
    </button>
  );
}

function Lab() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [enginePreference, setEnginePreference] = useState("live");
  const [mode, setMode] = useState<Mode | null>(null);
  const [modeNote, setModeNote] = useState("Not yet run");
  const [draft, setDraft] = useState<TriageDraft | null>(null);
  const [edit, setEdit] = useState<TriageDraft | null>(null);
  const [analyzedText, setAnalyzedText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    try {
      setLog(JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"));
    } catch {
      /* */
    }
  }, []);
  useEffect(() => {
    setAck(false);
  }, [edit]);
  const saveLog = (l: LogEntry[]) => {
    setLog(l);
    localStorage.setItem(LOG_KEY, JSON.stringify(l));
  };

  async function analyze() {
    if (!text.trim() || busy) return;
    const input = text.trim();
    setBusy(true);
    setAck(false);
    setDraft(null);
    setEdit(null);
    let d: TriageDraft, m: Mode, note: string;
    try {
      const r =
        enginePreference === "live"
          ? await aiTriage({ data: { text: input } })
          : {
              mode: "unavailable" as const,
              reason:
                enginePreference === "simulate"
                  ? "Simulated AI outage for fallback testing; no model request sent."
                  : "Rules-only mode selected for reproducible testing; no model request sent.",
            };
      if (r.mode === "live") {
        d = r.draft;
        m = "live";
        note = `Live model: ${r.model}`;
      } else {
        d = rulesTriage(input);
        m = "rules";
        note = `Rules-only demonstration (${r.reason})`;
      }
    } catch {
      d = rulesTriage(input);
      m = "rules";
      note = "Rules-only demonstration (AI service unreachable)";
    }
    const esc = escalationReasons(d, input);
    const entry: LogEntry = {
      id: Math.random().toString(36).slice(2),
      time: new Date().toLocaleString(),
      input,
      policyVersion: POLICY_VERSION,
      mode: m,
      modeNote: note,
      draft: d,
      decision: "pending",
      escalation: esc,
    };
    saveLog([entry, ...log].slice(0, 250));
    setCurrent(entry.id);
    setDraft(d);
    setEdit({ ...d });
    setMode(m);
    setModeNote(note);
    setAnalyzedText(input);
    setAck(false);
    setBusy(false);
  }

  const esc = draft ? escalationReasons(edit ?? draft, analyzedText) : [];
  const edited = draft && edit && JSON.stringify(draft) !== JSON.stringify(edit);

  function decide(decision: LogEntry["decision"]) {
    if (!current || !edit || !draft || !ack) return;
    if (decision !== "escalated" && esc.length) return;
    const corrections = Object.keys(edit)
      .filter(
        (key) => JSON.stringify(draft[key as keyof TriageDraft]) !== JSON.stringify(edit[key as keyof TriageDraft]),
      )
      .map((field) => ({ field, before: draft[field as keyof TriageDraft], after: edit[field as keyof TriageDraft] }));
    saveLog(log.map((e) => (e.id === current ? { ...e, final: edit, decision, escalation: esc, corrections } : e)));
    setDraft(null);
    setEdit(null);
    setCurrent(null);
  }

  const outputJson = draft
    ? JSON.stringify(
        {
          policy_version: POLICY_VERSION,
          analyzed_input: analyzedText,
          mode: modeNote,
          draft,
          reviewed_fields: edit,
          escalation_required: esc.length > 0,
          escalation_reasons: esc,
        },
        null,
        2,
      )
    : "";

  return (
    <div className="min-h-screen">
      <div className="banner" role="note">
        EDUCATIONAL PROTOTYPE — synthetic tickets only. Not connected to any FIWB client portal or production system.
        Not production-ready.
      </div>
      <header className="mx-auto max-w-6xl px-6 pt-8 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">FIWB Ticket Triage Lab</h1>
          <p className="text-muted-foreground mt-1">
            Draft a triage, then a coordinator must review it before anything happens.
          </p>
        </div>
        <div
          className={`status ${mode === "live" ? "status-live" : mode === "rules" ? "status-rules" : ""}`}
          aria-live="polite"
        >
          <span className="font-semibold">Engine:</span>{" "}
          {mode === "live" ? "Live model" : mode === "rules" ? "Rules-only demonstration" : "Not yet run"}
          {mode && <div className="text-sm opacity-80">{modeNote}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 grid gap-6 lg:grid-cols-2">
        <section className="card" aria-labelledby="intake">
          <h2 id="intake" className="card-title">
            1. Ticket intake (synthetic only)
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {SAMPLES.map((s) => (
              <button key={s.label} className="chip" disabled={busy} onClick={() => setText(s.text)}>
                {s.label}
              </button>
            ))}
          </div>
          <label className="block mb-3">
            Engine selection
            <select
              className="field"
              value={enginePreference}
              disabled={busy}
              onChange={(e) => setEnginePreference(e.target.value)}
            >
              <option value="live">Live model with labeled fallback</option>
              <option value="rules">Rules-only demonstration</option>
              <option value="simulate">Simulated AI outage for fallback test</option>
            </select>
          </label>
          <label htmlFor="ticket" className="block font-medium mb-1">
            Ticket text
          </label>
          <textarea
            id="ticket"
            disabled={busy}
            className="field min-h-40"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or write a SYNTHETIC ticket. Do not enter real names, emails or client data."
            maxLength={4000}
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-primary" disabled={busy || !text.trim()} onClick={analyze}>
              {busy ? "Analyzing…" : "Analyze ticket"}
            </button>
            {text && <Copy text={text} label="Copy input" />}
          </div>
        </section>

        <section className="card" aria-labelledby="draftH">
          <h2 id="draftH" className="card-title">
            2. Draft output{" "}
            {mode && (
              <span className="text-sm font-normal text-muted-foreground">
                ({mode === "live" ? "from live model" : "from keyword rules — not AI"})
              </span>
            )}
          </h2>
          {!draft ? (
            <p className="text-muted-foreground">Run an analysis to see the draft JSON.</p>
          ) : (
            <>
              <pre className="code" aria-label="Draft JSON output">
                {outputJson}
              </pre>
              <div className="mt-3 flex gap-2">
                <Copy text={outputJson} label="Copy output JSON" />
                <Copy text={`INPUT:\n${analyzedText}\n\nOUTPUT:\n${outputJson}`} label="Copy input + output" />
              </div>
            </>
          )}
        </section>

        {draft && edit && (
          <section
            className={`card lg:col-span-2 ${esc.length ? "gate-escalate" : "gate-review"}`}
            aria-labelledby="gate"
          >
            <h2 id="gate" className="card-title">
              3. {esc.length ? "MANUAL ESCALATION REQUIRED" : "Manual review gate — coordinator decision required"}
            </h2>
            {esc.length > 0 && (
              <div className="alert" role="alert">
                <p className="font-semibold">
                  This ticket must not be auto-routed. Escalate to the on-call lead per the critical-issue process.
                </p>
                <ul className="list-disc ml-6 mt-1">
                  {esc.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <label className="md:col-span-2">
                <span className="lbl">Summary</span>
                <input
                  className="field"
                  value={edit.summary}
                  onChange={(e) => setEdit({ ...edit, summary: e.target.value })}
                />
              </label>
              <label>
                <span className="lbl">Category</span>
                <select
                  className="field"
                  value={edit.category}
                  onChange={(e) => {
                    const c = e.target.value as Category;
                    setEdit({ ...edit, category: c, suggested_owner: OWNERS[c] });
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="lbl">Priority</span>
                <select
                  className="field"
                  value={edit.priority}
                  onChange={(e) => setEdit({ ...edit, priority: e.target.value as Priority })}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="lbl">Suggested owner</span>
                <input
                  className="field"
                  value={edit.suggested_owner}
                  onChange={(e) => setEdit({ ...edit, suggested_owner: e.target.value })}
                />
              </label>
              <div>
                <span className="lbl">Confidence</span>
                <p className="text-lg font-semibold">{Math.round(edit.confidence * 100)}%</p>
                <p className="text-muted-foreground">{edit.uncertainty}</p>
              </div>
              <label className="md:col-span-2">
                <span className="lbl">Rationale</span>
                <textarea
                  className="field"
                  value={edit.rationale}
                  onChange={(e) => setEdit({ ...edit, rationale: e.target.value })}
                />
              </label>
            </div>
            <label className="flex items-start gap-2 mt-4">
              <input type="checkbox" className="mt-1 size-5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>I am the coordinator and I have read the ticket and reviewed every field myself.</span>
            </label>
            <div className="flex flex-wrap gap-2 mt-4">
              {esc.length > 0 ? (
                <button className="btn-danger" disabled={!ack} onClick={() => decide("escalated")}>
                  Record manual escalation
                </button>
              ) : (
                <button
                  className="btn-primary"
                  disabled={!ack}
                  onClick={() => decide(edited ? "edited & accepted" : "accepted")}
                >
                  {edited ? "Accept edited triage" : "Accept triage"}
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => {
                  setDraft(null);
                  setEdit(null);
                }}
              >
                Discard
              </button>
            </div>
          </section>
        )}

        <section className="card lg:col-span-2" aria-labelledby="logH">
          <div className="flex items-center justify-between">
            <h2 id="logH" className="card-title">
              4. Test history (stored only in this browser)
            </h2>
            {log.length > 0 && (
              <div className="flex gap-2">
                <Copy text={JSON.stringify(log, null, 2)} label="Copy log" />
                <button className="btn-secondary" onClick={() => saveLog([])}>
                  Clear
                </button>
              </div>
            )}
          </div>
          {log.length === 0 ? (
            <p className="text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-3">Time</th>
                    <th className="pr-3">Engine</th>
                    <th className="pr-3">Input</th>
                    <th className="pr-3">Category / Priority</th>
                    <th className="pr-3">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((e) => {
                    const f = e.final ?? e.draft;
                    return (
                      <tr key={e.id} className="border-b align-top">
                        <td className="py-2 pr-3 whitespace-nowrap">{e.time}</td>
                        <td className="pr-3">{e.mode === "live" ? "Live model" : "Rules-only"}</td>
                        <td className="pr-3 max-w-sm">
                          {e.input.slice(0, 90)}
                          {e.input.length > 90 ? "…" : ""}
                        </td>
                        <td className="pr-3">
                          {f.category} / {f.priority}
                        </td>
                        <td className="pr-3">
                          <span
                            className={`tag ${e.decision === "escalated" ? "tag-esc" : e.decision === "pending" ? "tag-pend" : "tag-ok"}`}
                          >
                            {e.decision}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card lg:col-span-2" aria-labelledby="about">
          <h2 id="about" className="card-title">
            About & limitations
          </h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>
              Educational prototype only. It is <strong>not production-ready</strong> and is not part of the FIWB Client
              Portal.
            </li>
            <li>Use synthetic tickets only — no client emails, personal information, secrets or live data.</li>
            <li>
              The engine label shows honestly whether output came from the built-in live model or from the keyword{" "}
              <strong>rules-only demonstration</strong>. Rule output is not AI inference.
            </li>
            <li>
              Every draft needs a coordinator decision. Payment/ordering disruption, server 5xx errors, widespread
              outages, security signals, P0 Critical and low-confidence (&lt;60%) cases require escalation. Input-based
              flags survive priority edits.
            </li>
            <li>
              Confidence figures are rough heuristics (rules) or self-reported (model) and are not calibrated. Flags
              support, never replace, human judgment.
            </li>
            <li>
              Test history stores original and final fields, field-level corrections, engine and policy version locally
              (latest 250 runs). It can be cleared. Negation and mixed-intent rules are limited heuristics, not general
              language understanding.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
