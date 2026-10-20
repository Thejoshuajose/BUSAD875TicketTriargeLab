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
  confidence: number; // 0..1
  uncertainty: string;
}

export const OWNERS: Record<Category, string> = {
  "Website incident": "Hosting & Reliability Specialist",
  "Access issue": "Identity & Access Specialist",
  Billing: "Billing Specialist",
  "Change request": "Web Development Specialist",
};

const KW: Record<Category, string[]> = {
  "Website incident": ["down", "outage", "500", "error", "not loading", "crash", "slow", "broken", "offline", "timeout"],
  "Access issue": ["login", "log in", "password", "locked", "lockout", "2fa", "mfa", "access", "sign in", "account"],
  Billing: ["invoice", "billing", "charge", "charged", "payment", "refund", "price", "subscription", "receipt"],
  "Change request": ["update", "change", "add", "new page", "replace", "modify", "redesign", "could you", "request"],
};

export const SECURITY_KW = ["hack", "hacked", "breach", "malware", "phishing", "defaced", "suspicious", "unauthorized", "compromised", "injection", "leak"];
const CRITICAL_KW = ["entire site", "whole site", "all customers", "completely down", "outage", "checkout is down", "cannot take orders", "losing sales"];
const HIGH_KW = ["urgent", "asap", "locked out", "cannot", "can't", "unable", "blocked", "deadline"];

const has = (t: string, w: string) => t.includes(w);

export function rulesTriage(text: string): TriageDraft {
  const t = text.toLowerCase();
  const scores = CATEGORIES.map((c) => ({ c, hits: KW[c].filter((w) => has(t, w)) }));
  scores.sort((a, b) => b.hits.length - a.hits.length);
  const top = scores[0], second = scores[1];
  const security = SECURITY_KW.filter((w) => has(t, w));
  const critical = CRITICAL_KW.filter((w) => has(t, w));
  const high = HIGH_KW.filter((w) => has(t, w));

  let category: Category = top.hits.length ? top.c : "Website incident";
  if (security.length) category = "Website incident";

  let priority: Priority = "P3 Low";
  if (security.length || critical.length) priority = "P0 Critical";
  else if (high.length) priority = "P1 High";
  else if (category === "Website incident" || category === "Access issue") priority = "P2 Medium";

  let confidence = 0.35;
  if (top.hits.length) confidence = 0.55 + Math.min(top.hits.length, 4) * 0.08;
  if (top.hits.length && second.hits.length === top.hits.length) confidence -= 0.25;
  if (text.trim().split(/\s+/).length < 8) confidence -= 0.15;
  confidence = Math.max(0.1, Math.min(0.9, Number(confidence.toFixed(2))));

  const uncertaintyParts: string[] = [];
  if (!top.hits.length) uncertaintyParts.push("No category keywords matched; category is a default guess.");
  if (top.hits.length && second.hits.length === top.hits.length) uncertaintyParts.push(`Tie between "${top.c}" and "${second.c}".`);
  if (text.trim().split(/\s+/).length < 8) uncertaintyParts.push("Very short ticket; little evidence.");
  if (security.length) uncertaintyParts.push("Possible security issue; rules cannot assess severity.");

  const first = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  const summary = (first.length > 140 ? first.slice(0, 137) + "…" : first) || "(empty ticket)";

  const rationale = [
    top.hits.length ? `Matched ${category} keywords: ${top.hits.join(", ")}.` : "No strong category keywords found.",
    security.length ? `Security terms: ${security.join(", ")}.` : "",
    critical.length ? `Critical-impact terms: ${critical.join(", ")}.` : "",
    high.length ? `Urgency terms: ${high.join(", ")}.` : "",
  ].filter(Boolean).join(" ");

  return {
    summary,
    category,
    priority,
    suggested_owner: OWNERS[category],
    rationale,
    confidence,
    uncertainty: uncertaintyParts.join(" ") || "Keyword evidence is consistent; still requires human review.",
  };
}

export const CONFIDENCE_THRESHOLD = 0.6;

/** Reasons a ticket must go to explicit manual escalation (empty = normal review). */
export function escalationReasons(draft: TriageDraft, text: string): string[] {
  const r: string[] = [];
  if (draft.priority === "P0 Critical") r.push("Priority is P0 Critical");
  const t = text.toLowerCase();
  const sec = SECURITY_KW.filter((w) => t.includes(w));
  if (sec.length) r.push(`Possible security issue (${sec.join(", ")})`);
  if (draft.confidence < CONFIDENCE_THRESHOLD) r.push(`Low confidence (${Math.round(draft.confidence * 100)}% < ${CONFIDENCE_THRESHOLD * 100}%)`);
  return r;
}

export const SAMPLES = [
  { label: "Outage", text: "Our entire site is completely down since 9am — visitors get a 500 error on every page and checkout is down, so we are losing sales. Please help urgently." },
  { label: "Login lockout", text: "I'm locked out of the website admin after too many password attempts and the reset email never arrives. I can't publish today's blog post." },
  { label: "Billing question", text: "Hi, our latest invoice shows a charge for two hosting plans but we only have one subscription. Could someone explain the billing?" },
  { label: "Ambiguous report", text: "Something seems off with the site." },
  { label: "Security concern", text: "Our homepage looks defaced and shows suspicious links to another site. We think we may have been hacked." },
  { label: "Change request", text: "Could you add a new page for our spring event and update the phone number in the footer?" },
];
