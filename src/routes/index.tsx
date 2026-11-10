import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowRight,
  ClipboardCheck,
  FileText,
  Inbox,
  ShieldAlert,
  Download,
  Search,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import {
  CATEGORIES,
  PRIORITIES,
  OWNERS,
  SAMPLES,
  rulesTriage,
  reviewDisposition,
  POLICY_VERSION,
  type TriageDraft,
  type Category,
  type Priority,
} from "@/lib/triage-rules";
import { aiTriage } from "@/lib/triage.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FIWB Ticket Triage Lab | Review workbench" },
      {
        name: "description",
        content: "A synthetic-ticket learning workbench with human review and browser-local records.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Lab,
});

const draftSchema = z
  .object({
    summary: z.string().max(4000),
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    suggested_owner: z.string().max(500),
    rationale: z.string().max(10000),
    confidence: z.number().min(0).max(1),
    uncertainty: z.string().max(10000),
    detected_categories: z.array(z.enum(CATEGORIES)).max(4).optional(),
    ambiguity: z.boolean().optional(),
    blockedAccess: z.boolean().optional(),
    policy_notes: z.array(z.string().max(10000)).max(50).optional(),
  })
  .transform(
    (draft): TriageDraft =>
      Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== undefined)) as unknown as TriageDraft,
  );
const decisions = ["pending", "accepted", "edited & accepted", "escalated", "clarification needed"] as const;
const recordSchema = z.object({
  id: z.string().min(1).max(100),
  time: z.string().max(100),
  input: z.string().min(1).max(4000),
  mode: z.enum(["live", "rules"]),
  modeNote: z.string().max(2000),
  draft: draftSchema,
  final: draftSchema.optional(),
  review: draftSchema.optional(),
  decision: z.enum(decisions),
  escalation: z.array(z.string().max(10000)).max(50),
  reviewReasons: z.array(z.string().max(10000)).max(50).optional(),
  disposition: z.enum(["escalate", "clarify", "review"]).optional(),
  policyVersion: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  decidedAt: z.string().max(100).optional(),
  decisionPolicyVersion: z.string().max(100).optional(),
  corrections: z
    .array(z.object({ field: z.string().max(100), before: z.unknown(), after: z.unknown() }))
    .max(30)
    .optional(),
});
type RecordEntry = z.infer<typeof recordSchema>;
const KEY = "fiwb-triage-lab-workbench-v2";
const LEGACY_KEY = "fiwb-triage-lab-log";
const labels: Record<RecordEntry["decision"], string> = {
  pending: "Pending review",
  accepted: "Accepted",
  "edited & accepted": "Accepted with edits",
  escalated: "Escalation recorded",
  "clarification needed": "Clarification needed",
};
function Copy({ text, label }: { text: string; label: string }) {
  const [feedback, setFeedback] = useState("");
  return (
    <span className="copy-control">
      <button
        className="btn-secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setFeedback("Copied to clipboard.");
          } catch {
            setFeedback("Copy failed. Select the JSON below or download it.");
          }
        }}
      >
        {label}
      </button>
      <span className="small" role="status">
        {feedback}
      </span>
    </span>
  );
}
function csvCell(value: unknown) {
  const s = String(value ?? "");
  return `"${(/^[\s]*[=+\-@\t\r\n]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"`;
}
function makeCsv(records: RecordEntry[]) {
  const cols = [
    "id",
    "created_at",
    "decision_at",
    "decision",
    "engine",
    "policy",
    "decision_policy",
    "analyzed_input",
    "summary",
    "category",
    "priority",
    "suggested_owner",
    "confidence",
    "rationale",
    "notes",
    "reasons",
  ];
  return [
    cols.map(csvCell).join(","),
    ...records.map((r) => {
      const d = r.final ?? r.review ?? r.draft;
      return [
        r.id,
        r.time,
        r.decidedAt,
        r.decision,
        r.mode,
        r.policyVersion,
        r.decisionPolicyVersion,
        r.input,
        d.summary,
        d.category,
        d.priority,
        d.suggested_owner,
        d.confidence,
        d.rationale,
        r.notes,
        (r.reviewReasons ?? r.escalation).join("; "),
      ]
        .map(csvCell)
        .join(",");
    }),
  ].join("\r\n");
}

function Lab() {
  const [text, setText] = useState("");
  const [engine, setEngine] = useState("rules");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const request = useRef(0);
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const recordsRef = useRef<RecordEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const storageBlocked = useRef(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const current = records.find((r) => r.id === currentId);
  const edit = current?.final ?? current?.review ?? current?.draft;
  const disposition = current && edit ? reviewDisposition(edit, current.input) : null;
  const completed = current?.decision !== "pending";
  const valid =
    !!edit &&
    edit.summary.trim().length > 0 &&
    edit.summary.length <= 140 &&
    edit.rationale.trim().length > 0 &&
    edit.suggested_owner.trim().length > 0;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
      if (raw) {
        if (raw.length > 5000000) throw new Error("Storage exceeds safe read limit");
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("Invalid records");
        const checked = parsed.map((value) => recordSchema.safeParse(value));
        const good = checked.flatMap((value) => (value.success ? [value.data] : []));
        if (good.length !== parsed.length || new Set(good.map((r) => r.id)).size !== good.length)
          throw new Error("Invalid record shape or duplicate ID");
        recordsRef.current = good.slice(0, 250);
        setRecords(recordsRef.current);
      }
    } catch {
      storageBlocked.current = true;
      setStorageError(
        "Saved history could not be read safely. Existing storage has been left untouched. New work is session-only; export it before leaving.",
      );
    }
    setReady(true);
    return () => {
      request.current += 1;
    };
  }, []);
  function save(next: RecordEntry[]) {
    recordsRef.current = next.slice(0, 250);
    setRecords(recordsRef.current);
    if (storageBlocked.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(recordsRef.current));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Changes are kept in this session only. Export your records before leaving.",
      );
    }
  }
  function update(fields: Partial<TriageDraft>, notes?: string) {
    if (!current || !edit || completed) return;
    setAck(false);
    setFeedback("");
    save(
      recordsRef.current.map((r) =>
        r.id === current.id ? { ...r, review: { ...edit, ...fields }, ...(notes !== undefined ? { notes } : {}) } : r,
      ),
    );
  }
  async function analyze() {
    if (busyRef.current || !ready || !text.trim() || text.length > 4000) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback("");
    setAck(false);
    const token = ++request.current;
    const input = text.trim();
    const selectedEngine = engine;
    let draft: TriageDraft;
    let mode: "live" | "rules" = "rules";
    let modeNote = "";
    try {
      if (selectedEngine === "live") {
        const result = await aiTriage({ data: { text: input } });
        if (result.mode === "live") {
          draft = draftSchema.parse(result.draft);
          mode = "live";
          modeNote = `Live model: ${result.model}`;
        } else {
          draft = rulesTriage(input);
          modeNote = `Rules fallback: ${result.reason}`;
        }
      } else {
        draft = rulesTriage(input);
        modeNote =
          selectedEngine === "simulate"
            ? "Simulated outage: rules fallback used. No model request sent."
            : "Rules-only demonstration. No model request sent.";
      }
    } catch {
      draft = rulesTriage(input);
      modeNote = "Live model unavailable or invalid output: rules fallback used.";
    }
    if (token !== request.current) return;
    const initialDisposition = reviewDisposition(draft, input);
    const entry: RecordEntry = {
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
      input,
      mode,
      modeNote,
      draft,
      decision: "pending",
      escalation: initialDisposition.kind === "escalate" ? initialDisposition.reasons : [],
      reviewReasons: initialDisposition.reasons,
      disposition: initialDisposition.kind,
      policyVersion: POLICY_VERSION,
      notes: "",
    };
    save([entry, ...recordsRef.current]);
    setCurrentId(entry.id);
    setBusy(false);
    busyRef.current = false;
    setFeedback("Draft ready. Read the original ticket, review the fields, then record a local decision.");
    setTimeout(() => reviewHeading.current?.focus(), 0);
  }
  function decide() {
    const record = recordsRef.current.find((r) => r.id === currentId);
    if (!record || record.decision !== "pending" || !edit || !ack || !valid || !disposition) return;
    if (disposition.kind === "clarify" && !record.notes?.trim()) return;
    const changed = JSON.stringify(record.draft) !== JSON.stringify(edit);
    const decision: RecordEntry["decision"] =
      disposition.kind === "escalate"
        ? "escalated"
        : disposition.kind === "clarify"
          ? "clarification needed"
          : changed
            ? "edited & accepted"
            : "accepted";
    const corrections = Object.keys(edit)
      .filter(
        (key) =>
          JSON.stringify(record.draft[key as keyof TriageDraft]) !== JSON.stringify(edit[key as keyof TriageDraft]),
      )
      .map((field) => ({
        field,
        before: record.draft[field as keyof TriageDraft],
        after: edit[field as keyof TriageDraft],
      }));
    save(
      recordsRef.current.map((r) =>
        r.id === record.id
          ? {
              ...r,
              final: edit,
              decision,
              escalation: disposition.kind === "escalate" ? disposition.reasons : [],
              reviewReasons: disposition.reasons,
              disposition: disposition.kind,
              decidedAt: new Date().toISOString(),
              decisionPolicyVersion: POLICY_VERSION,
              corrections,
            }
          : r,
      ),
    );
    setAck(false);
    setFeedback(`${labels[decision]} locally. No message was sent and no ticket was routed.`);
  }
  function download(format: "json" | "csv", selected = recordsRef.current) {
    try {
      const content =
        format === "json"
          ? JSON.stringify(
              selected.map((r) => ({ ...r, analyzed_input: r.input })),
              null,
              2,
            )
          : makeCsv(selected);
      const blob = new Blob([format === "csv" ? "\uFEFF" + content : content], {
        type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fiwb-triage-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback(`${format.toUpperCase()} download requested. Check your browser downloads.`);
    } catch {
      setFeedback("Export failed. Try copying the JSON from record details.");
    }
  }
  const visible = records.filter(
    (r) =>
      (filter === "all" || (filter === "accepted" ? r.decision.includes("accepted") : r.decision === filter)) &&
      `${r.input} ${r.id} ${(r.final ?? r.review ?? r.draft).summary}`.toLowerCase().includes(search.toLowerCase()),
  );
  const output = current
    ? JSON.stringify({ ...current, analyzed_input: current.input, review_disposition: disposition }, null, 2)
    : "";
  return (
    <div className="lab-shell">
      <a className="skip-link" href="#main">
        Skip to workbench
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ClipboardCheck size={23} />
          </span>
          <div>
            <strong>
              FIWB <span className="brand-divider">/</span> Ticket Triage Lab
            </strong>
            <span className="topbar-sub">Support operations · Learning workbench</span>
          </div>
        </div>
        <span className="lab-label">
          <FlaskConical size={15} aria-hidden="true" /> Educational prototype
        </span>
      </header>
      <main id="main" className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">HUMAN-IN-THE-LOOP TRIAGE</p>
            <h1>Ticket review workbench</h1>
            <p className="muted">Analyze a synthetic request. Check the draft. Record your decision.</p>
          </div>
          <a className="text-link" href="#queue">
            Review queue <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="safety-notice">
          <ShieldAlert size={18} aria-hidden="true" />
          <p>
            <strong>Synthetic tickets only.</strong> No client emails, personal information or secrets. Decisions stay
            in this browser; no tickets are routed.
          </p>
        </div>
        <section className="metrics" aria-label="Local review counts">
          {[
            ["Total records", records.length],
            ["Pending review", records.filter((r) => r.decision === "pending").length],
            ["Escalations recorded", records.filter((r) => r.decision === "escalated").length],
            ["Accepted", records.filter((r) => r.decision.includes("accepted")).length],
          ].map(([label, value]) => (
            <div className="metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>
        {storageError && (
          <div className="notice danger" role="alert">
            {storageError}
          </div>
        )}
        <div role="status" aria-live="polite" className={feedback ? "notice feedback" : "sr-only"}>
          {feedback}
        </div>
        <section className="panel intake" aria-labelledby="intake-heading">
          <div className="section-heading">
            <div className="step-title">
              <span className="step">01</span>
              <div>
                <h2 id="intake-heading">Start with a ticket</h2>
                <p className="muted small">Use a sample or write your own synthetic scenario.</p>
              </div>
            </div>
            <span className="subtle-label">{POLICY_VERSION}</span>
          </div>
          <div className="intake-grid">
            <div>
              <label className="field-label" htmlFor="ticket">
                Ticket text
              </label>
              <textarea
                id="ticket"
                className="field ticket-input"
                value={text}
                maxLength={4000}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe what happened, who is affected, and any urgency…"
                aria-describedby="ticket-help"
              />
              <div className="field-help" id="ticket-help">
                <span>Only the analyzed snapshot is saved with each record.</span>
                <span>{text.length.toLocaleString()} / 4,000</span>
              </div>
              <div className="sample-row">
                <span className="small muted">Try a scenario</span>
                <div className="samples">
                  {SAMPLES.map((s) => (
                    <button className="sample" disabled={busy} key={s.label} onClick={() => setText(s.text)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="engine-box">
              <label className="field-label" htmlFor="engine">
                Analysis engine
              </label>
              <select
                id="engine"
                className="field"
                value={engine}
                disabled={busy}
                onChange={(e) => setEngine(e.target.value)}
              >
                <option value="rules">Rules-only demonstration</option>
                <option value="live">Live model with rules fallback</option>
                <option value="simulate">Simulated AI outage</option>
              </select>
              <p className="small muted">
                {engine === "rules"
                  ? "Reproducible keyword rules, not AI inference. A useful baseline for testing."
                  : engine === "simulate"
                    ? "Tests the fallback path without sending a model request."
                    : "Sends this synthetic ticket to the configured model service. If unavailable, uses rules and labels the result."}
              </p>
              <button
                className="btn-primary analyze-button"
                disabled={!text.trim() || busy || !ready}
                onClick={analyze}
              >
                {busy ? "Analyzing ticket…" : "Analyze ticket"}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <p className="small muted">Every result requires your review.</p>
            </div>
          </div>
        </section>
        <section className="panel review-panel" aria-labelledby="review-heading">
          <div className="section-heading">
            <div className="step-title">
              <span className="step">02</span>
              <div>
                <h2 ref={reviewHeading} tabIndex={-1} id="review-heading">
                  {completed && current ? "Inspect local decision" : "Review & decide"}
                </h2>
                <p className="muted small">Compare the original request with the proposed triage.</p>
              </div>
            </div>
            {current && (
              <span className={`tag ${current.decision === "escalated" ? "tag-danger" : ""}`}>
                {labels[current.decision]}
              </span>
            )}
          </div>
          {!current || !edit || !disposition ? (
            <div className="empty-review">
              <FileText size={30} aria-hidden="true" />
              <h3>Your review starts here</h3>
              <p>Analyze a ticket above, or resume a pending case from the queue below.</p>
              <div className="empty-steps">
                <span>Original request</span>
                <ChevronRight size={15} />
                <span>Editable draft</span>
                <ChevronRight size={15} />
                <span>Local decision</span>
              </div>
            </div>
          ) : (
            <>
              <div className="review-grid">
                <aside className="source-pane">
                  <div className="section-heading compact">
                    <h3>Original ticket</h3>
                    <span className="subtle-label">Read-only snapshot</span>
                  </div>
                  <p className="original-ticket">{current.input}</p>
                  <dl className="record-meta">
                    <div>
                      <dt>Record</dt>
                      <dd className="record-id">{current.id.slice(0, 8)}</dd>
                    </div>
                    <div>
                      <dt>Analyzed</dt>
                      <dd>
                        {new Date(current.time).toString() === "Invalid Date"
                          ? current.time
                          : new Date(current.time).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt>Actual engine</dt>
                      <dd>{current.mode === "live" ? "Live model" : "Rules-only"}</dd>
                    </div>
                    <div>
                      <dt>Draft policy</dt>
                      <dd>{current.policyVersion ?? "Legacy / unknown"}</dd>
                    </div>
                  </dl>
                  <p className="engine-note">{current.modeNote}</p>
                  <div className="confidence">
                    <span>
                      Draft confidence <strong>{Math.round(edit.confidence * 100)}%</strong>
                    </span>
                    <meter min={0} max={1} value={edit.confidence} aria-label="Uncalibrated draft confidence" />
                    <p className="small muted">{edit.uncertainty}</p>
                    <p className="small muted">Heuristic or model-reported, not a calibrated probability.</p>
                  </div>
                </aside>
                <div className="review-fields">
                  <div className={`policy-banner ${disposition.kind}`}>
                    <strong>
                      {disposition.kind === "escalate"
                        ? "Manual incident escalation required"
                        : disposition.kind === "clarify"
                          ? "Clarification needed before acceptance"
                          : "Ready for human review"}
                    </strong>
                    {disposition.reasons.length ? (
                      <ul>
                        {disposition.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No mandatory escalation flag detected. Check the facts yourself.</p>
                    )}
                  </div>
                  <fieldset disabled={completed} className="edit-fieldset">
                    <legend className="sr-only">Review triage fields</legend>
                    <label className="field-label">
                      Summary <span className="optional">Required · 1–140 characters</span>
                      <textarea
                        className="field summary-input"
                        maxLength={140}
                        value={edit.summary}
                        onChange={(e) => update({ summary: e.target.value })}
                      />
                    </label>
                    <div className="form-grid">
                      <label className="field-label">
                        Category
                        <select
                          className="field"
                          value={edit.category}
                          onChange={(e) => {
                            const category = e.target.value as Category;
                            update({ category, suggested_owner: OWNERS[category] });
                          }}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label">
                        Priority
                        <select
                          className="field"
                          value={edit.priority}
                          onChange={(e) => update({ priority: e.target.value as Priority })}
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="field-label">
                      Suggested owner <span className="optional">Suggestion only</span>
                      <input
                        className="field"
                        maxLength={500}
                        value={edit.suggested_owner}
                        onChange={(e) => update({ suggested_owner: e.target.value })}
                      />
                    </label>
                    <label className="field-label">
                      Rationale <span className="optional">Required</span>
                      <textarea
                        className="field rationale-input"
                        maxLength={10000}
                        value={edit.rationale}
                        onChange={(e) => update({ rationale: e.target.value })}
                      />
                    </label>
                    <label className="field-label">
                      Decision notes{" "}
                      <span className="optional">
                        {disposition.kind === "clarify" ? "Required: what needs clarification?" : "Optional"}
                      </span>
                      <textarea
                        className="field"
                        maxLength={2000}
                        value={current.notes ?? ""}
                        onChange={(e) => update({}, e.target.value)}
                        placeholder="Capture your reasoning or the question to ask next."
                      />
                    </label>
                  </fieldset>
                  {completed ? (
                    <div className="decision-receipt">
                      <ClipboardCheck size={20} aria-hidden="true" />
                      <div>
                        <strong>{labels[current.decision]} locally</strong>
                        <p className="small">
                          {current.decidedAt ? new Date(current.decidedAt).toLocaleString() : "Legacy record"} · No
                          ticket routed or message sent.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="decision-gate">
                      <label className="ack">
                        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                        <span>
                          I have read the original ticket and reviewed every field myself.{" "}
                          <span className="muted">This is a learning acknowledgment, not identity verification.</span>
                        </span>
                      </label>
                      {!valid && (
                        <p className="validation" role="status">
                          Enter a summary of 1–140 characters, an owner and a rationale to continue.
                        </p>
                      )}
                      <button
                        className={disposition.kind === "escalate" ? "btn-danger" : "btn-primary"}
                        disabled={!ack || !valid || (disposition.kind === "clarify" && !current.notes?.trim())}
                        onClick={decide}
                      >
                        {disposition.kind === "escalate"
                          ? "Record manual escalation locally"
                          : disposition.kind === "clarify"
                            ? "Record clarification needed locally"
                            : "Accept triage locally"}
                        <ClipboardCheck size={17} aria-hidden="true" />
                      </button>
                      <p className="small muted">
                        Editing any field resets acknowledgment. Pending edits are saved when browser storage is
                        available.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <details className="technical-details">
                <summary>
                  Record details & JSON{" "}
                  <span className="muted">Original draft, reviewed fields and correction history</span>
                </summary>
                <div className="details-content">
                  <p className="small muted">
                    Browser-local learning record, not a verified enterprise audit trail. Review decisions use current
                    policy {POLICY_VERSION}.
                  </p>
                  <div className="button-row">
                    <Copy text={output} label="Copy record JSON" />
                    <button className="btn-secondary" onClick={() => download("json", [current])}>
                      <Download size={16} aria-hidden="true" />
                      Export record JSON
                    </button>
                  </div>
                  <pre className="code" tabIndex={0} aria-label="Record JSON">
                    {output}
                  </pre>
                </div>
              </details>
            </>
          )}
        </section>
        <section className="panel queue-panel" id="queue" aria-labelledby="queue-heading">
          <div className="section-heading">
            <div className="step-title">
              <span className="step">03</span>
              <div>
                <h2 id="queue-heading">Review queue & history</h2>
                <p className="small muted">Latest 250 records in this browser. Export to keep a separate copy.</p>
              </div>
            </div>
            <div className="button-row">
              <button className="btn-secondary" disabled={!records.length} onClick={() => download("json")}>
                <Download size={16} aria-hidden="true" />
                JSON
              </button>
              <button className="btn-secondary" disabled={!records.length} onClick={() => download("csv")}>
                <Download size={16} aria-hidden="true" />
                CSV
              </button>
            </div>
          </div>
          <div className="queue-filters">
            <label className="search-field">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search ticket text, summary or record ID</span>
              <input
                className="field"
                type="search"
                placeholder="Search tickets or record ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label className="filter-field">
              <span className="sr-only">Filter by decision status</span>
              <select className="field" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending review</option>
                <option value="accepted">Accepted</option>
                <option value="escalated">Escalation recorded</option>
                <option value="clarification needed">Clarification needed</option>
              </select>
            </label>
            <span className="small muted">
              {visible.length} of {records.length}
            </span>
          </div>
          {!visible.length ? (
            <div className="queue-empty">
              <Inbox size={26} aria-hidden="true" />
              <strong>{records.length ? "No matching records" : "A clean queue, ready for your first case"}</strong>
              <p>
                {records.length
                  ? "Try a different search or status filter."
                  : "Analyze a synthetic ticket to create a pending review."}
              </p>
            </div>
          ) : (
            <div className="queue-list">
              {visible.map((r) => {
                const d = r.final ?? r.review ?? r.draft;
                return (
                  <article className={`queue-item ${r.id === currentId ? "selected" : ""}`} key={r.id}>
                    <div className="queue-ticket">
                      <span className="record-id">
                        {r.id.slice(0, 8)} <span className="muted">· {r.mode === "live" ? "Live model" : "Rules"}</span>
                      </span>
                      <h3>{d.summary || "Untitled review"}</h3>
                      <p className="small muted">
                        {d.category} · {d.priority}
                      </p>
                    </div>
                    <span
                      className={`tag ${r.decision === "escalated" ? "tag-danger" : r.decision === "pending" || r.decision === "clarification needed" ? "tag-pending" : "tag-success"}`}
                    >
                      {labels[r.decision]}
                    </span>
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      aria-label={`${r.decision === "pending" ? "Resume" : "Inspect"} record ${r.id.slice(0, 8)}`}
                      onClick={() => {
                        setCurrentId(r.id);
                        setAck(false);
                        setFeedback("");
                        setTimeout(() => reviewHeading.current?.focus(), 0);
                      }}
                    >
                      {r.decision === "pending" ? "Resume review" : "Inspect record"}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <footer className="lab-footer">
          <div>
            <strong>Built for learning. Kept under human control.</strong>
            <p>This standalone lab is not part of the FIWB Client Portal and is not production-ready.</p>
          </div>
          <details>
            <summary>Policy, privacy & limitations</summary>
            <p>
              Use nonsensitive synthetic data only. Rules are limited language heuristics; they can miss context and
              make mistakes. Incident signals and P0 require an escalation record. Low confidence requires
              clarification, not automatic incident escalation. Input-based incident flags survive priority edits.
            </p>
            <p>
              History and pending edits are stored in localStorage on this browser, limited to the latest 250 records.
              Browser clearing or device changes may remove them. No account identity, multi-user synchronization or
              protected audit storage is provided. Legacy history is retained under its original key. JSON and CSV
              exports include full synthetic ticket text. Live mode sends ticket text to the configured model service;
              rules and simulated-outage modes do not send model requests.
            </p>
          </details>
        </footer>
      </main>
    </div>
  );
}
