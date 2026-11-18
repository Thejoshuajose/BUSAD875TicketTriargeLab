import { useState } from "react";
import { runEvaluation } from "@/lib/evaluation";
export function EvaluationPanel() {
  const [report, setReport] = useState<ReturnType<typeof runEvaluation> | null>(null);
  const [feedback, setFeedback] = useState("");
  function download() {
    if (!report) return;
    try {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "triage-regression-evidence.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("Evidence download requested.");
    } catch {
      setFeedback("Download failed. Review the results below.");
    }
  }
  return (
    <section className="panel" aria-labelledby="evaluation-heading">
      <div className="section-heading">
        <div>
          <h2 id="evaluation-heading">Regression evidence bench</h2>
          <p className="small muted">
            Ten known synthetic cases. Runs rules only; makes no model request and adds no queue
            records.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            setReport(runEvaluation());
            setFeedback("Regression evaluation complete.");
          }}
        >
          Run known regressions
        </button>
      </div>
      <p className="small muted">
        This is a development check, not an accuracy estimate or proof of deployment readiness. Keep
        fresh tests and independent reviewer results separate.
      </p>
      {feedback && <p aria-live="polite">{feedback}</p>}
      {report && (
        <>
          <div className="section-heading">
            <strong>
              {report.passed} / {report.total} known scenarios passed
            </strong>
            <button className="btn-secondary" onClick={download}>
              Download regression evidence
            </button>
          </div>
          <div className="evidence-list">
            {report.results.map((r) => (
              <details key={r.id}>
                <summary>
                  {r.id} · {r.passed ? "Pass" : "Fail"} · {r.actual.category} · {r.actual.priority}
                </summary>
                <p>{r.input}</p>
                <p className="small">
                  Expected: {r.expected.category}, {r.expected.priority}, {r.expected.disposition}.
                  Actual disposition: {r.disposition}.
                </p>
                <p className="small">Summary: {r.actual.summary}</p>
                <p className="small">
                  Checks:{" "}
                  {Object.entries(r.checks)
                    .map(([k, v]) => `${k}: ${v ? "pass" : "fail"}`)
                    .join(" · ")}
                </p>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
