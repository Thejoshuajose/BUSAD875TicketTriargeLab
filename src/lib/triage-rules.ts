export const CATEGORIES = ["Website incident", "Access issue", "Billing", "Change request"] as const;
export const PRIORITIES = ["P0 Critical", "P1 High", "P2 Medium", "P3 Low"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface TriageDraft {
  summary: string;
  category: Category;
  priority: Priority;
  suggested_owner: string;
  rationale: string;
  confidence: number;
  uncertainty: string;
  detected_categories?: Category[];
  ambiguity?: boolean;
  blockedAccess?: boolean;
  policy_notes?: string[];
}

export const OWNERS: Record<Category, string> = {
  "Website incident": "Hosting & Reliability Specialist",
  "Access issue": "Identity & Access Specialist",
  Billing: "Billing Specialist",
  "Change request": "Web Development Specialist",
};
const KW: Record<Category, string[]> = {
  "Website incident": [
    "down",
    "outage",
    "downtime",
    "error",
    "errors",
    "not loading",
    "crash",
    "crashed",
    "slow",
    "broken",
    "offline",
    "timeout",
  ],
  "Access issue": [
    "login",
    "log in",
    "password",
    "locked",
    "lockout",
    "2fa",
    "mfa",
    "access",
    "sign in",
    "sign into",
    "log into",
    "account",
  ],
  Billing: [
    "invoice",
    "invoices",
    "billing",
    "charge",
    "charges",
    "charged",
    "payment",
    "payments",
    "refund",
    "price",
    "subscription",
    "receipt",
  ],
  "Change request": ["update", "change", "add", "new page", "replace", "modify", "redesign", "could you", "request"],
};
export const SECURITY_KW = [
  "hack",
  "hacked",
  "breach",
  "malware",
  "phishing",
  "defaced",
  "suspicious",
  "unauthorized",
  "compromised",
  "injection",
  "leak",
  "leaked",
];
export const CONFIDENCE_THRESHOLD = 0.6;
export const POLICY_VERSION = "lesson11-v2";

export const normalize = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
/** Match complete words/phrases. "down" must not match "download" or "breakdown". */
export function hasPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}
/** Bounded, clause-scoped cues, not general language understanding. Never discard a whole ticket. */
export const MAX_INPUT_LENGTH = 4000;
function bounded(text: string): string {
  if (text.length > MAX_INPUT_LENGTH) throw new RangeError("Ticket must be 4000 characters or fewer.");
  return text;
}
function clauses(text: string): string[] {
  return normalize(bounded(text))
    .split(/[.;!?]|\b(?:but|however|although|yet|whereas)\b|(?:,|\band)\s*(?:now|currently)\b/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function inactiveClause(clause: string): boolean {
  return (
    /\b(?:what if|in case|hypothetically|in the future|could potentially)\b/.test(clause) ||
    /\bif\s+(?:(?:our|the|a|an|all|any)\s+){0,2}(?:checkout|payments?|transactions?|purchases?|orders?|site|website|entire site|whole site|customers?|login|access|we cannot|we can't)\b/.test(
      clause,
    ) ||
    /\b(?:was|were|has been|have been|is now)\s+(?:fixed|resolved|restored|repaired)\b|\b(?:outage|failure|issue|incident)\s+(?:is|was)\s+(?:over|resolved)\b/.test(
      clause,
    ) ||
    /^(?:there (?:is|are) )?no (?:payment failures?|http 5\d\d|login|account access|evidence of|signs? of|outage|security incident)/.test(
      clause,
    ) ||
    /\b(?:is|are) not (?:down|offline|failing|broken|unavailable|an? (?:storefront )?outage)\b/.test(clause) ||
    /\b(?:payments?|transactions?|checkout|purchases?|orders?)\s+(?:do|does) not (?:fail|time out)\b/.test(clause) ||
    /\bno (?:payments?|transactions?|purchases?|orders?) (?:are|is) (?:failing|declined|rejected)\b/.test(clause)
  );
}
function activeText(text: string): string {
  return clauses(text)
    .filter((clause) => !inactiveClause(clause))
    .map((clause) =>
      clause.replace(
        /\bnot (?:an? )?(?:outage|storefront outage|security incident|payment failure)(?: investigation)?\b/g,
        "",
      ),
    )
    .join(". ");
}
function accessBlocked(text: string): boolean {
  return /\b(?:cannot|can't|unable to)\s+(?:(?:successfully|currently)\s+)?(?:log in(?:to)?|login|sign in(?:to)?|access)\b|\blocked out\b|\baccount (?:is )?locked\b|\bpassword reset\b.{0,45}\b(?:fails?|broken|does not work)\b|\b(?:mfa|2fa)\b.{0,35}\b(?:rejected|fails?|blocked)\b/.test(
    text,
  );
}
export function impactReasons(text: string): string[] {
  const t = activeText(text);
  const reasons: string[] = [];
  const security = SECURITY_KW.filter((word) => hasPhrase(t, word));
  if (security.length) reasons.push(`Possible security issue (${security.join(", ")})`);
  if (/\b(?:http\s*5\d\d|5\d\d\s+(?:error|errors|response|responses))\b/.test(t))
    reasons.push("Server-side 5xx failure requires manual investigation");
  const disruptedTransaction = t.split(/[.,;]|\band\b/).some((clause) => {
    const transaction = /\b(?:payments?|transactions?|checkout|purchases?|orders?|pay)\b/.test(clause);
    const failure =
      /\b(?:fail|fails|failed|failing|declined|declining|rejected|unavailable|timeout|cannot|can't|unable|nobody|not working|does nothing)\b|\bno (?:customer|orders?|purchases?)\b|\bnever (?:finish|finishes|complete|completes)\b|\b(?:do|does) not (?:finish|complete)\b|\bnot be (?:completed|processed)\b|\bmoney taken\b/.test(
        clause,
      );
    const blockedBasketCompletion =
      /\b(?:baskets?|carts?)\b/.test(clause) &&
      /\b(?:cannot|can't|unable to)\s+(?:complete|finish|purchase|check out)\b|\b(?:never|do not|does not)\s+(?:complete|finish)\b/.test(
        clause,
      );
    return (transaction && failure) || blockedBasketCompletion;
  });
  if (disruptedTransaction) reasons.push("Payment or ordering disruption requires manual escalation");
  if (
    /\b(?:outage|downtime|completely down|losing sales)\b/.test(t) ||
    /\b(?:entire site|whole site|all customers)\b.{0,80}\b(?:down|offline|unreachable|unavailable|not working|error)\b/.test(
      t,
    ) ||
    /\b(?:down|offline|unreachable|unavailable)\b.{0,80}\b(?:entire site|whole site|all customers)\b/.test(t)
  )
    reasons.push("Potential widespread service disruption");
  return [...new Set(reasons)];
}
function evidence(text: string) {
  const t = activeText(text);
  const scores = CATEGORIES.map((category) => ({
    category,
    hits: KW[category].filter((word) => hasPhrase(t, word)),
  })).sort((a, b) => b.hits.length - a.hits.length);
  const blocked = accessBlocked(t);
  const categories = scores.filter((s) => s.hits.length > 0).map((s) => s.category);
  if (blocked && !categories.includes("Access issue")) categories.push("Access issue");
  return {
    t,
    scores,
    categories,
    blocked,
    impact: impactReasons(text),
  };
}
/** Apply the same deterministic safeguards after either engine. They cannot be removed by editing priority. */
export function applySafetyPolicy(draft: TriageDraft, text: string): TriageDraft {
  const e = evidence(text);
  let category = draft.category;
  let priority = draft.priority;
  const notes = [...e.impact];
  if (e.impact.length) {
    category = "Website incident";
    priority = "P0 Critical";
  } else if (e.blocked) {
    category = "Access issue";
    if (priority === "P2 Medium" || priority === "P3 Low") priority = "P1 High";
    notes.push("Current account-entry blocker takes precedence over billing context");
  }
  const mixed = e.categories.includes("Access issue") && e.categories.includes("Billing");
  if (mixed)
    notes.push(
      e.blocked
        ? "Mixed access/billing intent: access is the immediate blocker"
        : "Mixed access/billing vocabulary: coordinator must confirm the primary request",
    );
  return {
    ...draft,
    category,
    priority,
    suggested_owner: OWNERS[category],
    detected_categories: e.categories,
    ambiguity: mixed,
    blockedAccess: e.blocked,
    policy_notes: notes,
    rationale: notes.length ? `${draft.rationale} Policy: ${notes.join("; ")}.` : draft.rationale,
  };
}
export function rulesTriage(text: string): TriageDraft {
  const e = evidence(text);
  const [top, second] = e.scores;
  let category: Category = top!.hits.length ? top!.category : "Website incident";
  if (
    !e.blocked &&
    e.categories.includes("Billing") &&
    /\b(?:access is working|can log in|login was restored|no login)\b/.test(normalize(text))
  )
    category = "Billing";
  if (!e.t && /\b(?:what should|what if|in the future|in case)\b/.test(normalize(text))) category = "Change request";
  const priority: Priority = /\b(?:urgent|asap|cannot|can't|unable|blocked|deadline)\b/.test(e.t)
    ? "P1 High"
    : category === "Website incident" || category === "Access issue"
      ? "P2 Medium"
      : "P3 Low";
  let confidence = top!.hits.length ? 0.55 + Math.min(top!.hits.length, 4) * 0.08 : 0.35;
  const tied = top!.hits.length > 0 && second!.hits.length === top!.hits.length;
  if (tied && !e.blocked) confidence -= 0.25;
  if (text.trim().split(/\s+/).length < 8) confidence -= 0.15;
  confidence = Math.max(0.1, Math.min(0.9, Number(confidence.toFixed(2))));
  const uncertain = [
    !top!.hits.length ? "No category evidence; default category needs confirmation." : "",
    tied ? "Multiple categories have equal keyword evidence." : "",
    e.blocked ? "Access blocker detected; confirm the exact login failure." : "",
  ]
    .filter(Boolean)
    .join(" ");
  const summary = summarizeTicket(text);
  return applySafetyPolicy(
    {
      summary,
      category,
      priority,
      suggested_owner: OWNERS[category],
      rationale: top!.hits.length
        ? `Whole-word/phrase matches: ${top!.hits.join(", ")}.`
        : "No strong category keywords found.",
      confidence,
      uncertainty:
        uncertain || "Rule confidence is a heuristic, not a calibrated probability; human review is required.",
    },
    text,
  );
}
export function escalationReasons(draft: TriageDraft, text: string): string[] {
  const reasons = impactReasons(text);
  if (draft.priority === "P0 Critical") reasons.push("Priority is P0 Critical");

  return [...new Set(reasons)];
}

export function reviewDisposition(
  draft: TriageDraft,
  text: string,
): { kind: "escalate" | "clarify" | "review"; reasons: string[] } {
  const reasons = escalationReasons(draft, text);
  if (reasons.length) return { kind: "escalate", reasons };
  if (draft.confidence < CONFIDENCE_THRESHOLD)
    return {
      kind: "clarify",
      reasons: [
        `Low confidence (${Math.round(draft.confidence * 100)}% < ${CONFIDENCE_THRESHOLD * 100}%); ask for the current symptom and impact.`,
      ],
    };
  return { kind: "review", reasons: ["Coordinator review required before any action."] };
}
/** Extract source wording, prioritizing a current blocker, then an actionable request. */
export function summarizeTicket(text: string): string {
  bounded(text);
  const sentences = text
    .trim()
    .split(/(?<=[.!?;])\s+/)
    .filter(Boolean);
  const ranked = sentences
    .map((sentence, index) => {
      const active = activeText(sentence);
      const critical = impactReasons(sentence).length > 0 || accessBlocked(active);
      const request = /\b(?:please|need|needed|could you|can i|explain|send|provide|update|add|refund)\b/.test(active);
      return { sentence, index, score: critical ? 3 : request ? 2 : active ? 1 : 0 };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const first = ranked[0];
  if (!first) return "(empty ticket)";
  const next = ranked.find((item) => item.index !== first.index && item.score >= 2);
  // Reserve room for both the blocker and request when both exist.
  const clip = (value: string, limit: number) =>
    value.length <= limit ? value : value.slice(0, limit - 3).trimEnd() + "...";
  return next
    ? `${clip(first.sentence, 90)} ${clip(next.sentence, 139 - Math.min(first.sentence.length, 90))}`
    : clip(first.sentence, 140);
}

export const SAMPLES = [
  {
    label: "Outage",
    text: "Our entire site is completely down since 9am — visitors get a 500 error on every page and checkout is down, so we are losing sales. Please help urgently.",
  },
  {
    label: "Login lockout",
    text: "I'm locked out of the website admin after too many password attempts and the reset email never arrives. I can't publish today's blog post.",
  },
  {
    label: "Billing question",
    text: "Hi, our latest invoice shows a charge for two hosting plans but we only have one subscription. Could someone explain the billing?",
  },
  { label: "Ambiguous report", text: "Something seems off with the site." },
  {
    label: "Security concern",
    text: "Our homepage looks defaced and shows suspicious links to another site. We think we may have been hacked.",
  },
  {
    label: "Change request",
    text: "Could you add a new page for our spring event and update the phone number in the footer?",
  },
];
