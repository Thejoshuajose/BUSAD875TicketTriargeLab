import { describe, it, expect } from "vitest";
import {
  rulesTriage,
  impactReasons,
  reviewDisposition,
  incidentContext,
  applySafetyPolicy,
} from "../lib/triage-rules";
const regressions = [
  [
    "training",
    "Would a failed payment count as an incident in our training guide?",
    "Change request",
    "P3 Low",
    false,
  ],
  [
    "active order failure",
    "Orders aren’t going through for any customers.",
    "Website incident",
    "P0 Critical",
    true,
  ],
  [
    "staging qualification",
    "Checkout fails only in our isolated staging simulation; production orders work.",
    "Website incident",
    "P2 Medium",
    false,
  ],
  [
    "working access",
    "I can sign into the dashboard now. Please provide a receipt.",
    "Billing",
    "P3 Low",
    false,
  ],
  ["clear short request", "Please provide a copy of my invoice.", "Billing", "P3 Low", false],
] as const;
describe("November 14 pass 1 known failure repairs", () => {
  for (const [id, input, category, priority, incident] of regressions)
    it(id, () => {
      const d = rulesTriage(input);
      expect(d.category).toBe(category);
      expect(d.priority).toBe(priority);
      expect(impactReasons(input).length > 0).toBe(incident);
      expect(d.summary.length).toBeLessThanOrEqual(140);
    });
  it("preserves both staging and production wording", () =>
    expect(rulesTriage(regressions[2][1]).summary).toBe(regressions[2][1]));
  it("clear invoice does not force unnecessary clarification", () =>
    expect(reviewDisposition(rulesTriage(regressions[4][1]), regressions[4][1]).kind).toBe(
      "review",
    ));
  it("exposes exclusion evidence without hiding original", () =>
    expect(incidentContext(regressions[2][1]).excludedClauses).toHaveLength(1));
  it("shared policy does not override correctly noncritical training output", () =>
    expect(applySafetyPolicy(rulesTriage(regressions[0][1]), regressions[0][1]).priority).toBe(
      "P3 Low",
    ));
});
const paired = [
  [
    "Would a failed payment count as an incident in our training guide? Payments are failing right now.",
    true,
  ],
  [
    "Checkout fails only in our isolated staging simulation; production orders are not going through.",
    true,
  ],
  ["Orders aren't going through for any customers.", true],
  ["Orders are not going through for any customers.", true],
  ["The payment will not complete for any customer.", true],
  ["Please send my receipt.", false],
  ["I can log into the portal now. Please send my invoice.", false],
  ["I cannot sign into the dashboard now. Please provide a receipt.", false],
] as const;
describe("November 14 paired regressions", () => {
  for (const [input, incident] of paired)
    it(input, () => expect(impactReasons(input).length > 0).toBe(incident));
  it("retains blocked access despite billing request", () =>
    expect(rulesTriage(paired[7][0]).priority).toBe("P1 High"));
});

import { runEvaluation } from "../lib/evaluation";
describe("Evidence bench", () => {
  it("runs all ten known scenarios without a provider", () => {
    const r = runEvaluation();
    expect(r.total).toBe(10);
    expect(r.passed).toBe(10);
    expect(r.engine).toBe("rules-only");
    expect(r.results.every((x) => x.checks.summary)).toBe(true);
  });
  it("reports actual failures instead of forcing success", () => {
    const r = runEvaluation([
      {
        id: "bad-expectation",
        input: "Please provide a receipt.",
        category: "Access issue",
        priority: "P0 Critical",
        disposition: "escalate",
      },
    ]);
    expect(r.passed).toBe(0);
    expect(r.results[0]!.checks.priority).toBe(false);
  });
});
describe("Pass 2 correction after fresh probe", () => {
  it("does not treat a training mention as proof that a current incident is hypothetical", () => {
    const t =
      "This training guide describes what to do because payments are failing for all customers right now.";
    expect(rulesTriage(t).priority).toBe("P0 Critical");
  });
});

describe("review-discovered safety regressions", () => {
  it.each(["P0 Critical", "P1 High"] as const)(
    "preserves model incident severity %s despite billing context",
    (priority) => {
      const text =
        "I can sign into the portal. Please send a receipt. Customers reach checkout but the Pay button keeps spinning and their purchase never materializes.";
      const draft = { ...rulesTriage(text), category: "Website incident" as const, priority };
      const actual = applySafetyPolicy(draft, text);
      expect(actual.category).toBe("Website incident");
      expect(actual.priority).toBe(priority);
    },
  );
  it("does not downgrade urgent billing", () => {
    const text = "I can sign in. Please send my invoice before today's tax deadline.";
    expect(applySafetyPolicy({ ...rulesTriage(text), priority: "P1 High" }, text).priority).toBe(
      "P1 High",
    );
  });
  it.each([
    "Could you update the training guide because checkout fails for all buyers?",
    "Checkout fails only in our staging sandbox and production transactions are failing too.",
  ])("retains active incident: %s", (text) => {
    expect(rulesTriage(text).priority).toBe("P0 Critical");
    expect(impactReasons(text).length).toBeGreaterThan(0);
  });
});
