import { rulesTriage, reviewDisposition } from "../src/lib/triage-rules.ts";
import { writeFileSync } from "node:fs";
// Declared before execution, after implementation freeze. No changes made against these results.
const cases = [
  ["N01", "Please send my receipt.", "Billing", "P3 Low", "review"],
  [
    "N02",
    "I cannot log into the portal. Please provide my invoice.",
    "Access issue",
    "P1 High",
    "review",
  ],
  [
    "N03",
    "Our checkout returns HTTP 503 to all buyers.",
    "Website incident",
    "P0 Critical",
    "escalate",
  ],
  [
    "N04",
    "We discuss failed payments in a training guide, but checkout is unavailable right now.",
    "Website incident",
    "P0 Critical",
    "escalate",
  ],
  [
    "N05",
    "Customers reach checkout but the Pay button keeps spinning and their purchase never materializes.",
    "Website incident",
    "P0 Critical",
    "escalate",
  ],
  ["N06", "Please refund invoice 17.", "Billing", "P3 Low", "review"],
  [
    "N07",
    "This training guide describes what to do because payments are failing for all customers right now.",
    "Website incident",
    "P0 Critical",
    "escalate",
  ],
  ["N09", "No puedo iniciar sesión para ver mi factura.", "Access issue", "P1 High", "review"],
  ["N08", "The billing login is working; please provide a receipt.", "Billing", "P3 Low", "review"],
];
const results = cases.map(([id, input, category, priority, disposition]) => {
  const actual = rulesTriage(input);
  const route = reviewDisposition(actual, input).kind;
  const passed =
    actual.category === category && actual.priority === priority && route === disposition;
  return {
    id,
    input,
    expected: { category, priority, disposition },
    actual,
    actualDisposition: route,
    passed,
  };
});
const result = {
  scope:
    "Fresh synthetic probes, AI-authored expected labels, no independent reviewers or live-model execution",
  results,
  passed: results.filter((r) => r.passed).length,
  total: results.length,
};
writeFileSync("evidence/fresh-results.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
