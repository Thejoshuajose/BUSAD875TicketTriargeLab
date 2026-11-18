import {
  rulesTriage,
  reviewDisposition,
  POLICY_VERSION,
  type Category,
  type Priority,
} from "./triage-rules";
export interface Scenario {
  id: string;
  input: string;
  category: Category;
  priority: Priority;
  disposition: "review" | "clarify" | "escalate";
  summaryIncludes?: string[];
}
export const REGRESSION_SCENARIOS: Scenario[] = [
  {
    id: "R01",
    input: "Can I download my monthly invoice for accounting?",
    category: "Billing",
    priority: "P3 Low",
    disposition: "review",
  },
  {
    id: "R02",
    input: "I cannot sign into the portal to view my invoice.",
    category: "Access issue",
    priority: "P1 High",
    disposition: "review",
  },
  {
    id: "R03",
    input: "All payment transactions receive HTTP 502 but the storefront still loads.",
    category: "Website incident",
    priority: "P0 Critical",
    disposition: "escalate",
  },
  {
    id: "R04",
    input: "Would a failed payment count as an incident in our training guide?",
    category: "Change request",
    priority: "P3 Low",
    disposition: "clarify",
  },
  {
    id: "R05",
    input: "Orders aren’t going through for any customers.",
    category: "Website incident",
    priority: "P0 Critical",
    disposition: "escalate",
  },
  {
    id: "R06",
    input: "Checkout fails only in our isolated staging simulation; production orders work.",
    category: "Website incident",
    priority: "P2 Medium",
    disposition: "clarify",
    summaryIncludes: ["staging", "production orders work"],
  },
  {
    id: "R07",
    input: "I can sign into the dashboard now. Please provide a receipt.",
    category: "Billing",
    priority: "P3 Low",
    disposition: "review",
    summaryIncludes: ["receipt"],
  },
  {
    id: "R08",
    input: "Please provide a copy of my invoice.",
    category: "Billing",
    priority: "P3 Low",
    disposition: "review",
  },
  {
    id: "R09",
    input: "Something seems off with the site.",
    category: "Website incident",
    priority: "P2 Medium",
    disposition: "clarify",
  },
  {
    id: "R10",
    input:
      "Would a failed payment count as an incident in our training guide? Payments are failing right now.",
    category: "Website incident",
    priority: "P0 Critical",
    disposition: "escalate",
  },
];
export function runEvaluation(scenarios = REGRESSION_SCENARIOS) {
  const results = scenarios.map((scenario) => {
    const actual = rulesTriage(scenario.input);
    const disposition = reviewDisposition(actual, scenario.input).kind;
    const checks = {
      category: actual.category === scenario.category,
      priority: actual.priority === scenario.priority,
      disposition: disposition === scenario.disposition,
      summary:
        (scenario.summaryIncludes ?? []).every((s) =>
          actual.summary.toLowerCase().includes(s.toLowerCase()),
        ) &&
        actual.summary.length > 0 &&
        actual.summary.length <= 140,
    };
    return {
      id: scenario.id,
      input: scenario.input,
      expected: {
        category: scenario.category,
        priority: scenario.priority,
        disposition: scenario.disposition,
        summaryIncludes: scenario.summaryIncludes ?? [],
      },
      actual,
      disposition,
      checks,
      passed: Object.values(checks).every(Boolean),
    };
  });
  return {
    policy: POLICY_VERSION,
    engine: "rules-only",
    generatedAt: new Date().toISOString(),
    purpose:
      "Known development regressions, not unseen accuracy, live model verification or independent human validation.",
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    results,
  };
}
