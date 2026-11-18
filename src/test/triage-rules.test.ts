import { describe, it, expect } from "vitest";
import {
  rulesTriage,
  escalationReasons,
  SAMPLES,
  CATEGORIES,
  PRIORITIES,
  applySafetyPolicy,
  reviewDisposition,
  POLICY_VERSION,
  impactReasons,
  summarizeTicket,
} from "@/lib/triage-rules";

const s = (l: string) => SAMPLES.find((x) => x.label === l)!.text;

describe("rules triage", () => {
  it("outage is P0 and escalated", () => {
    const d = rulesTriage(s("Outage"));
    expect(d.priority).toBe("P0 Critical");
    expect(escalationReasons(d, s("Outage")).length).toBeGreaterThan(0);
  });
  it("lockout is Access issue", () => expect(rulesTriage(s("Login lockout")).category).toBe("Access issue"));
  it("billing is Billing", () => expect(rulesTriage(s("Billing question")).category).toBe("Billing"));
  it("ambiguous is low confidence and needs clarification", () => {
    const d = rulesTriage(s("Ambiguous report"));
    expect(d.confidence).toBeLessThan(0.6);
    expect(escalationReasons(d, s("Ambiguous report"))).toEqual([]);
    expect(reviewDisposition(d, s("Ambiguous report")).kind).toBe("clarify");
  });
  it("security text escalates", () => {
    const d = rulesTriage(s("Security concern"));
    expect(escalationReasons(d, s("Security concern"))).toContainEqual(expect.stringMatching(/security/));
  });
});

const challengeCases = [
  {
    id: "C01",
    input: "All payment transactions receive HTTP 502 but the storefront still loads.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C02",
    input: "The payment page returns HTTP 503 to every buyer who tries to pay.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C03",
    input: "The checkout submit button does nothing and nobody can place an order.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C04",
    input: "The store looks fine but every transaction fails with a gateway timeout.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C05",
    input: "Every customer's card payment is being declined even though valid cards worked yesterday.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C06",
    input: "Payments cannot be processed because the upstream service returns HTTP 504.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C07",
    input: "Our transaction API returns HTTP 500 for each purchase attempt.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C08",
    input: "We cannot take orders through the website and have been losing sales all morning.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C09",
    input: "An unauthorized administrator has accessed customer records in this synthetic test site.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C10",
    input: "We suspect a data breach after a synthetic customer export appeared publicly.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C11",
    input: "The website appears infected with malware and redirects visitors to suspicious links.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C12",
    input: "Our entire site is completely down and every page returns a server error.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C13",
    input: "The site is offline for all customers; none of the pages are reachable.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C14",
    input: "There is a full website outage affecting every visitor right now.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C15",
    input: "Checkout is not working for any customer and no orders can be completed.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C16",
    input: "Repeated HTTP 502 errors occur on checkout, although product pages are still available.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C17",
    input: "This is not a storefront outage, but purchases cannot be completed by any customer.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C18",
    input: "The homepage loads normally. No customer can pay for an order.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C19",
    input: "The payment gateway is unavailable and all transactions are rejected.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "C20",
    input: "Customers report money taken but no orders created after completing checkout.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "M01",
    input: "I cannot log in to view my invoice and charges.",
    expected_category: "Access issue",
  },
  {
    id: "M02",
    input: "I am locked out of my account and need to download a billing receipt.",
    expected_category: "Access issue",
  },
  {
    id: "M03",
    input: "The password reset link fails, preventing me from checking my subscription invoice.",
    expected_category: "Access issue",
  },
  {
    id: "M04",
    input: "My MFA code is rejected so I cannot sign in to review a disputed charge.",
    expected_category: "Access issue",
  },
  {
    id: "M05",
    input: "I can't access the billing portal because my account is locked.",
    expected_category: "Access issue",
  },
  {
    id: "M06",
    input: "I can log in normally, but my latest invoice includes a duplicate charge.",
    expected_category: "Billing",
  },
  {
    id: "M07",
    input: "Account access is working. Please explain the subscription price increase on my invoice.",
    expected_category: "Billing",
  },
  {
    id: "M08",
    input: "My login was restored yesterday. Today I need a refund for a duplicate payment.",
    expected_category: "Billing",
  },
  {
    id: "M09",
    input: "Please send a receipt for my payment. There is no login or account access problem.",
    expected_category: "Billing",
  },
  {
    id: "M10",
    input: "I cannot log in after changing my password, and the invoice payment deadline is tomorrow.",
    expected_category: "Access issue",
  },
  {
    id: "W01",
    input: "Can I download my monthly invoice for accounting?",
    expected_category: "Billing",
    must_escalate: false,
  },
  {
    id: "W02",
    input: "I am downloading an invoice and need an explanation of the billing charges.",
    expected_category: "Billing",
    must_escalate: false,
  },
  {
    id: "W03",
    input: "Please provide a breakdown of the charges on our monthly invoice.",
    expected_category: "Billing",
    must_escalate: false,
  },
  {
    id: "W04",
    input: "The site is down and checkout is unavailable for every customer.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "W05",
    input: "We are experiencing downtime across the entire site and nobody can order.",
    expected_category: "Website incident",
    must_escalate: true,
  },
  {
    id: "W06",
    input: "Please update the download button label on the new page next week.",
    expected_category: "Change request",
    must_escalate: false,
  },
  {
    id: "W07",
    input: "We need a breakdown of the subscription price, not an outage investigation.",
    expected_category: "Billing",
    must_escalate: false,
  },
  {
    id: "W08",
    input: "There are no payment failures or HTTP 502 errors. I only need a copy of my invoice.",
    expected_category: "Billing",
    must_escalate: false,
  },
] as const;

describe("Lesson 11 synthetic challenge", () => {
  for (const c of challengeCases) {
    it(c.id + ": " + c.input, () => {
      const d = rulesTriage(c.input);
      expect(d.category).toBe(c.expected_category);
      if ("must_escalate" in c) expect(escalationReasons(d, c.input).length > 0).toBe(c.must_escalate);
      expect(CATEGORIES).toContain(d.category);
      expect(PRIORITIES).toContain(d.priority);
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
      expect(d.summary.length).toBeLessThanOrEqual(140);
    });
  }
  it("shared policy corrects an unsafe model-like payment draft", () => {
    const text = challengeCases[0].input;
    const d = applySafetyPolicy(
      { ...rulesTriage("invoice"), category: "Billing", priority: "P3 Low", confidence: 0.99 },
      text,
    );
    expect(d.category).toBe("Website incident");
    expect(d.priority).toBe("P0 Critical");
    expect(escalationReasons({ ...d, priority: "P3 Low" }, text).length).toBeGreaterThan(0);
  });
  it("blocked access retains multiple matched categories", () => {
    const d = rulesTriage("I cannot log in to view my invoice and charges.");
    expect(d.detected_categories).toContain("Access issue");
    expect(d.detected_categories).toContain("Billing");
    expect(d.ambiguity).toBe(true);
  });
});

const stateCases = [
  ["V01", "Checkout fails for every customer right now.", true],
  ["V02", "What should we do if checkout fails in the future?", false],
  ["V03", "Checkout is not failing. Please send my invoice.", false],
  ["V04", "The checkout failure was fixed yesterday. I only need a copy of the invoice.", false],
  ["V05", "The checkout failure was fixed yesterday, but all transactions fail now.", true],
  ["V06", "There are no HTTP 502 errors, but checkout is unavailable.", true],
  ["V07", "If checkout fails tomorrow, we will call support. Checkout is unavailable now.", true],
  ["V08", "The site is working, but purchases never finish and every shopper gives up.", true],
  ["V09", "Customers see a spinning wheel forever after clicking Pay; no purchase completes.", true],
  ["V10", "The entire site is working for all customers. Please send a billing invoice.", false],
  ["V11", "There is no evidence of a security breach. Please update our security policy page.", false],
  ["V12", "There is no evidence of a security breach; however our homepage is defaced now.", true],
  ["V13", "The HTTP 502 error has been resolved. Please send my receipt.", false],
  ["V14", "HTTP 502 errors occur now, although yesterday's outage was resolved.", true],
  ["V15", "If our entire site goes offline in the future, what should we do?", false],
] as const;
describe("Lesson 11 v2 event state and review policy", () => {
  for (const [id, text, critical] of stateCases) {
    it(id + ": " + text, () => {
      const draft = rulesTriage(text);
      expect(impactReasons(text).length > 0).toBe(critical);
      expect(draft.priority === "P0 Critical").toBe(critical);
      expect(reviewDisposition(draft, text).kind === "escalate").toBe(critical);
    });
  }
  it("uses a versioned policy and treats planning as a change request", () => {
    expect(POLICY_VERSION).toBe("lesson11-v3");
    expect(rulesTriage(stateCases[1][1]).category).toBe("Change request");
  });
  for (const text of [
    "I cannot sign into the dashboard; a receipt is needed.",
    "I can't log into my dashboard. Please send an invoice.",
    "I am unable to sign in to review a billing charge.",
  ])
    it("recognizes blocked entry with billing context: " + text, () => {
      const draft = rulesTriage(text);
      expect(draft.category).toBe("Access issue");
      expect(draft.priority).toBe("P1 High");
      expect(draft.blockedAccess).toBe(true);
      expect(draft.detected_categories).toEqual(expect.arrayContaining(["Billing", "Access issue"]));
      expect(draft.ambiguity).toBe(true);
      expect(reviewDisposition(draft, text).kind).not.toBe("escalate");
    });
  it("resolved access is not a current entry blocker", () => {
    const draft = rulesTriage("My account was restored yesterday. Please send a billing invoice.");
    expect(draft.category).toBe("Billing");
    expect(draft.blockedAccess).toBe(false);
  });
  it("uses actionable sentence instead of a negated lead", () => {
    expect(rulesTriage(challengeCases[37].input).summary).toContain("need a copy of my invoice");
  });
  it("includes both current blocker and actionable request", () => {
    const summary = summarizeTicket("I cannot sign into the dashboard. Please send a receipt.");
    expect(summary).toContain("cannot sign into");
    expect(summary).toContain("receipt");
    expect(summary.length).toBeLessThanOrEqual(140);
  });
  it("reserves room for request after a verbose critical sentence", () => {
    const summary = summarizeTicket(
      "Checkout fails for every customer " + "right now ".repeat(20) + ". Please help restore payments.",
    );
    expect(summary).toContain("Checkout fails");
    expect(summary).toContain("restore payments");
    expect(summary.length).toBeLessThanOrEqual(140);
  });
  it("critical impact wins over low confidence and edited priority", () => {
    const text = stateCases[8][1];
    const draft = { ...rulesTriage(text), priority: "P3 Low" as const, confidence: 0.2 };
    const disposition = reviewDisposition(draft, text);
    expect(disposition.kind).toBe("escalate");
    expect(disposition.reasons.join(" ")).toMatch(/ordering disruption/);
    expect(disposition.reasons.join(" ")).not.toMatch(/Low confidence/);
  });
  it("ordinary supported request requires review and low confidence requires clarification", () => {
    const draft = rulesTriage(s("Billing question"));
    expect(reviewDisposition(draft, s("Billing question")).kind).toBe("review");
    expect(reviewDisposition({ ...draft, confidence: 0.59 }, "invoice").kind).toBe("clarify");
    expect(reviewDisposition({ ...draft, confidence: 0.6 }, "invoice").kind).toBe("review");
  });
  it("does not silently truncate critical source text outside the input limit", () => {
    expect(() => rulesTriage("a".repeat(4001))).toThrow(RangeError);
    expect(() => impactReasons("a".repeat(4001))).toThrow(RangeError);
    const source = " ".repeat(3975) + "Checkout fails right now.";
    expect(source.length).toBe(4000);
    expect(rulesTriage(source).priority).toBe("P0 Critical");
    expect(rulesTriage("").summary).toBe("(empty ticket)");
  });
  it("shared policy never elevates a correctly noncritical hypothetical model draft", () => {
    const text = stateCases[1][1];
    const draft = applySafetyPolicy({ ...rulesTriage(text), priority: "P3 Low", category: "Change request" }, text);
    expect(draft.priority).toBe("P3 Low");
    expect(reviewDisposition(draft, text).kind).not.toBe("escalate");
  });
});

const v2bCases = [
  ["B01", "Payments do not fail anymore. Please send an invoice.", false],
  ["B02", "If you need more details, checkout is failing for every buyer right now.", true],
  ["B03", "Yesterday checkout was fixed and now all transactions fail.", true],
  ["B04", "No orders are failing. Please provide a receipt.", false],
  ["B05", "Customers cannot complete their baskets.", true],
  ["B06", "Payments do not fail, but checkout is unavailable.", true],
  ["B07", "No orders are failing, however the site is completely down now.", true],
  ["B08", "The outage was resolved and currently checkout fails for every customer.", true],
  ["B09", "If checkout fails tomorrow, please call support.", false],
  ["B10", "If the entire site is offline in the future, what should we do?", false],
  ["B11", "If you need screenshots, no orders are failing. Please send an invoice.", false],
  ["B12", "I cannot edit the color of the cart button. Please update it.", false],
  ["B13", "Customers are unable to finish their carts.", true],
  ["B14", "No orders are failing and now the payment gateway is unavailable.", true],
  ["B15", "Payments do not fail and currently no purchases complete.", true],
] as const;
describe("Lesson 11 v2b documented follow-up regression cases", () => {
  for (const [id, text, critical] of v2bCases)
    it(id + ": " + text, () => {
      const draft = rulesTriage(text);
      expect(impactReasons(text).length > 0).toBe(critical);
      expect(reviewDisposition(draft, text).kind === "escalate").toBe(critical);
    });
});
