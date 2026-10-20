import { describe, it, expect } from "vitest";
import { rulesTriage, escalationReasons, SAMPLES } from "@/lib/triage-rules";

const s = (l: string) => SAMPLES.find((x) => x.label === l)!.text;

describe("rules triage", () => {
  it("outage is P0 and escalated", () => {
    const d = rulesTriage(s("Outage"));
    expect(d.priority).toBe("P0 Critical");
    expect(escalationReasons(d, s("Outage")).length).toBeGreaterThan(0);
  });
  it("lockout is Access issue", () => expect(rulesTriage(s("Login lockout")).category).toBe("Access issue"));
  it("billing is Billing", () => expect(rulesTriage(s("Billing question")).category).toBe("Billing"));
  it("ambiguous is low confidence and escalated", () => {
    const d = rulesTriage(s("Ambiguous report"));
    expect(d.confidence).toBeLessThan(0.6);
    expect(escalationReasons(d, s("Ambiguous report"))).toContainEqual(expect.stringMatching(/Low confidence/));
  });
  it("security text escalates", () => {
    const d = rulesTriage(s("Security concern"));
    expect(escalationReasons(d, s("Security concern"))).toContainEqual(expect.stringMatching(/security/));
  });
});
