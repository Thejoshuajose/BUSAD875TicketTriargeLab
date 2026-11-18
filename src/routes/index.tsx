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
  incidentContext,
  reviewDisposition,
  POLICY_VERSION,
  type TriageDraft,
  type Category,
  type Priority,
} from "@/lib/triage-rules";
import { EvaluationPanel } from "@/components/EvaluationPanel";
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
  const s = String(value …12591 tokens truncated….08 85);
  color: oklch(0.4 0.07 70);
}
.edit-fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
  display: grid;
  gap: 17px;
}
.edit-fieldset:disabled .field {
  background: oklch(0.97 0.005 230);
  opacity: 1;
  color: var(--foreground);
}
.optional {
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--muted-foreground);
  margin-left: 5px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
textarea.summary-input {
  min-height: 70px;
}
textarea.rationale-input {
  min-height: 105px;
}
.decision-gate {
  border-top: 1px solid var(--border);
  margin-top: 23px;
  padding-top: 20px;
}
.ack {
  display: flex;
  gap: 10px;
  font-size: 0.81rem;
  cursor: pointer;
  min-height: 44px;
  align-items: flex-start;
}
.ack input {
  width: 21px;
  height: 21px;
  flex-shrink: 0;
  margin-top: 2px;
  accent-color: var(--primary);
}
.ack .muted {
  display: block;
  font-size: 0.73rem;
  margin-top: 3px;
}
.decision-gate > button {
  margin: 16px 0 10px;
}
.validation {
  margin-top: 12px;
  font-size: 0.8rem;
  color: var(--danger);
}
.decision-receipt {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding: 16px;
  background: var(--soft-teal);
  border-radius: 7px;
  color: var(--primary);
}
.technical-details {
  border-top: 1px solid var(--border);
}
.technical-details > summary {
  padding: 17px 24px;
  font-size: 0.85rem;
  font-weight: 600;
  min-height: 44px;
}
.technical-details summary span {
  font-size: 0.75rem;
  font-weight: 400;
  margin-left: 10px;
}
.details-content {
  padding: 0 24px 24px;
}
.details-content .button-row {
  margin: 14px 0;
  align-items: flex-start;
}
.copy-control {
  display: inline-flex;
  flex-direction: column;
  gap: 5px;
}
.code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  background: oklch(0.97 0.008 230);
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 7px;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tag {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 5px 9px;
  border-radius: 5px;
  background: oklch(0.93 0.014 230);
  color: var(--foreground);
  white-space: nowrap;
}
.tag-danger {
  color: oklch(0.4 0.13 30);
  background: oklch(0.95 0.028 30);
}
.tag-pending {
  color: oklch(0.39 0.07 75);
  background: oklch(0.95 0.045 85);
}
.tag-success {
  color: oklch(0.35 0.07 175);
  background: var(--soft-teal);
}
.queue-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: oklch(0.986 0.002 230);
  border-bottom: 1px solid var(--border);
}
.queue-filters .field {
  margin: 0;
}
.search-field {
  position: relative;
  flex: 1;
}
.search-field svg {
  position: absolute;
  left: 12px;
  top: 13px;
  color: var(--muted-foreground);
}
.search-field input {
  padding-left: 38px;
}
.filter-field {
  width: 210px;
}
.queue-empty {
  padding: 32px 24px;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 8px;
  color: var(--muted-foreground);
  font-size: 0.85rem;
  text-align: center;
}
.queue-empty svg {
  margin-bottom: 5px;
}
.queue-empty strong {
  color: var(--foreground);
  font-weight: 600;
}
.queue-item {
  display: flex;
  gap: 20px;
  align-items: center;
  padding: 17px 24px;
  border-bottom: 1px solid var(--border);
}
.queue-item:last-child {
  border: 0;
}
.queue-item.selected {
  background: oklch(0.975 0.016 185);
  box-shadow: inset 3px 0 var(--primary);
}
.queue-ticket {
  flex: 1;
  min-width: 0;
}
.queue-ticket h3 {
  font-size: 0.88rem;
  margin: 4px 0;
  overflow-wrap: anywhere;
}
.queue-item button {
  white-space: nowrap;
}
.notice {
  padding: 12px 16px;
  font-size: 0.85rem;
  border-radius: 7px;
  margin-bottom: 18px;
  border: 1px solid var(--border);
}
.notice.feedback {
  background: var(--soft-teal);
}
.notice.danger {
  background: oklch(0.96 0.025 30);
  color: var(--danger);
}
.lab-footer {
  display: flex;
  justify-content: space-between;
  gap: 32px;
  font-size: 0.76rem;
  color: var(--muted-foreground);
  padding: 3px 0 20px;
}
.lab-footer strong {
  color: var(--foreground);
  font-weight: 600;
}
.lab-footer p {
  margin-top: 6px;
}
.lab-footer details {
  max-width: 540px;
  flex: 1;
}
.lab-footer summary {
  min-height: 44px;
}
.skip-link {
  position: fixed;
  top: -100px;
  left: 20px;
  z-index: 100;
  background: var(--card);
  color: var(--foreground);
  padding: 12px;
}
.skip-link:focus {
  top: 10px;
}
@media (min-width: 1100px) {
  .lab-footer details {
    text-align: right;
  }
  .lab-footer details[open] {
    text-align: left;
  }
}
@media (max-width: 1000px) {
  .metric {
    padding: 14px;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .intake-grid {
    grid-template-columns: minmax(0, 1fr) 250px;
    gap: 20px;
  }
  .engine-box {
    padding-left: 20px;
  }
  .review-grid {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .queue-item {
    gap: 12px;
  }
}
@media (max-width: 760px) {
  .topbar {
    padding: 17px 18px;
  }
  .lab-label {
    display: none;
  }
  .workspace {
    padding: 24px 16px;
  }
  .page-heading {
    align-items: flex-start;
  }
  .page-heading > a {
    display: none;
  }
  .metrics {
    gap: 9px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .metric {
    flex-direction: row;
    align-items: center;
  }
  .metric span {
    max-width: 100px;
    font-size: 0.73rem;
  }
  .section-heading {
    padding: 18px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .intake-grid,
  .review-grid {
    grid-template-columns: 1fr;
  }
  .intake-grid {
    padding: 18px;
    gap: 20px;
  }
  .engine-box {
    padding: 20px 0 0;
    border-left: 0;
    border-top: 1px solid var(--border);
  }
  .analyze-button {
    margin-top: 18px;
  }
  .source-pane {
    border-right: 0;
    border-bottom: 1px solid var(--border);
    padding: 18px;
  }
  .review-fields {
    padding: 18px;
  }
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }
  .queue-filters {
    flex-wrap: wrap;
    padding: 16px 18px;
  }
  .search-field {
    flex-basis: 100%;
  }
  .filter-field {
    flex: 1;
    width: auto;
  }
  .queue-item {
    flex-wrap: wrap;
    padding: 17px 18px;
  }
  .queue-ticket {
    flex-basis: 100%;
  }
  .queue-item > button {
    margin-left: auto;
  }
  .technical-details > summary {
    padding: 16px 18px;
  }
  .technical-details summary span {
    display: block;
    margin: 5px 0 0;
  }
  .details-content {
    padding: 0 18px 18px;
  }
  .lab-footer {
    flex-direction: column;
    gap: 15px;
  }
  .lab-footer details {
    max-width: none;
  }
}
@media (max-width: 420px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .field-help {
    flex-direction: column;
    gap: 3px;
  }
  .empty-steps {
    gap: 6px;
    font-size: 0.66rem;
  }
  .brand strong {
    font-size: 0.9rem;
  }
  .brand-mark {
    width: 36px;
    height: 36px;
  }
  .decision-gate > button {
    width: 100%;
  }
  .queue-item > .tag {
    white-space: normal;
    max-width: 45%;
  }
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

.context-evidence {
  margin: 1rem 0;
  padding: 0.8rem 0;
  border-block: 1px solid var(--border);
}
.context-evidence summary {
  cursor: pointer;
  font-weight: 600;
}
.context-evidence li {
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}
.evidence-list {
  display: grid;
  gap: 0.6rem;
  margin-top: 1rem;
}
.evidence-list details {
  padding: 0.8rem 1rem;
  border: 1px solid #d9e1e7;
  border-radius: 0.5rem;
}
.evidence-list summary {
  cursor: pointer;
  font-weight: 600;
}
.evidence-list p {
  margin-top: 0.6rem;
  overflow-wrap: anywhere;
}
.queue-filters {
  flex-wrap: wrap;
}
@media (max-width: 640px) {
  .section-heading {
    flex-wrap: wrap;
    gap: 0.8rem;
  }
  .queue-filters > * {
    width: 100%;
  }
  .evidence-list summary {
    font-size: 0.9rem;
  }
}
