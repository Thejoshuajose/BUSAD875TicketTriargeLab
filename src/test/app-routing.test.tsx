import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { Route } from "@/routes/index";
import { rulesTriage, POLICY_VERSION } from "@/lib/triage-rules";
import { aiTriage } from "@/lib/triage.functions";

vi.mock("@/lib/triage.functions", () => ({ aiTriage: vi.fn() }));

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

// Component-level jsdom checks, not browser/layout QA. Model requests are mocked.
const Lab = Route.options.component as ComponentType;
const KEY = "fiwb-triage-lab-workbench-v2";
const LEGACY = "fiwb-triage-lab-log";
const routine = "Please update the existing page and replace the footer text with a new event description.";
function record(input = routine) {
  return {
    id: "fixture-1",
    time: "2026-11-10T10:00:00.000Z",
    input,
    mode: "rules",
    modeNote: "Rules-only demonstration",
    draft: rulesTriage(input),
    decision: "pending",
    escalation: [],
    policyVersion: POLICY_VERSION,
  };
}
function savedRecords() {
  return JSON.parse(localStorage.getItem(KEY) ?? "[]") as (ReturnType<typeof record> & {
    reviewReasons?: string[];
    disposition?: string;
  })[];
}
async function analyze(input: string) {
  fireEvent.change(screen.getByLabelText("Ticket text"), { target: { value: input } });
  fireEvent.click(screen.getByRole("button", { name: "Analyze ticket" }));
  await screen.findByText(input, { selector: ".original-ticket" });
}
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("Triage workbench component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    let id = 0;
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => `test-record-${++id}` });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("blocks empty and whitespace-only tickets without calling the model", () => {
    render(<Lab />);
    expect(screen.getByRole("button", { name: "Analyze ticket" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ticket text"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze ticket" }));
    expect(aiTriage).not.toHaveBeenCalled();
    expect(savedRecords()).toHaveLength(0);
  });

  it.each(["{broken json", JSON.stringify([{ id: "bad", draft: { confidence: 9 } }])])(
    "preserves invalid saved history and warns that new work is session-only: %s",
    async (raw) => {
      localStorage.setItem(KEY, raw);
      render(<Lab />);
      expect(screen.getByRole("alert")).toHaveTextContent("session-only");
      await analyze(routine);
      expect(localStorage.getItem(KEY)).toBe(raw);
      expect(screen.getByText(routine, { selector: ".original-ticket" })).toBeInTheDocument();
    },
  );

  it("loads a valid legacy record and resumes it without removing the legacy log", () => {
    const raw = JSON.stringify([record()]);
    localStorage.setItem(LEGACY, raw);
    render(<Lab />);
    fireEvent.click(screen.getByRole("button", { name: "Resume record fixture-" }));
    expect(screen.getByText(routine, { selector: ".original-ticket" })).toBeInTheDocument();
    expect(localStorage.getItem(LEGACY)).toBe(raw);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("resets acknowledgment when review fields or notes change and prevents duplicate decisions", async () => {
    render(<Lab />);
    await analyze(routine);
    const acknowledgment = screen.getByRole("checkbox");
    fireEvent.click(acknowledgment);
    expect(screen.getByRole("button", { name: "Accept triage locally" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: "Revised synthetic summary" } });
    expect(acknowledgment).not.toBeChecked();
    fireEvent.click(acknowledgment);
    fireEvent.change(screen.getByLabelText(/Decision notes/), { target: { value: "Reviewed against original." } });
    expect(acknowledgment).not.toBeChecked();
    fireEvent.click(acknowledgment);
    const accept = screen.getByRole("button", { name: "Accept triage locally" });
    fireEvent.click(accept);
    fireEvent.click(accept);
    expect(savedRecords()).toHaveLength(1);
    expect(savedRecords()[0]?.decision).toBe("edited & accepted");
    expect(screen.queryByRole("button", { name: "Accept triage locally" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Summary/)).toBeDisabled();
  });

  it("requires a clarification note as well as acknowledgment for a low-confidence ticket", async () => {
    render(<Lab />);
    await analyze("Something seems off with the site.");
    const button = screen.getByRole("button", { name: "Record clarification needed locally" });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Decision notes/), {
      target: { value: "Which page is affected, and what error appears?" },
    });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(savedRecords()[0]?.decision).toBe("clarification needed");
  });

  it("requires nonempty summary and rationale, while retaining the original analyzed input", async () => {
    render(<Lab />);
    await analyze(routine);
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: " " } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Accept triage locally" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Summary/), { target: { value: "Updated summary" } });
    fireEvent.change(screen.getByLabelText(/Rationale/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Accept triage locally" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ticket text"), { target: { value: "A different next ticket." } });
    expect(savedRecords()[0]?.input).toBe(routine);
  });

  it("preserves an incident escalation gate after priority is lowered", async () => {
    render(<Lab />);
    await analyze("Our entire site is down and every customer sees HTTP 503 errors.");
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "P3 Low" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Record manual escalation locally" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Accept triage locally" })).not.toBeInTheDocument();
  });

  it("quotes CSV and neutralizes formula-leading input in the exported Blob", async () => {
    const fixture = record("=SUM(1,2) synthetic update request");
    localStorage.setItem(KEY, JSON.stringify([fixture]));
    let exported: Blob | undefined;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        exported = blob;
        return "blob:test";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<Lab />);
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    expect(exported).toBeDefined();
    const csv = await readBlob(exported!);
    expect(csv).toContain('"\'=SUM(1,2) synthetic update request"');
    expect(csv).toContain('"analyzed_input"');
    expect(screen.getByRole("status")).toHaveTextContent("CSV download requested");
  });

  it("reports storage write failure while retaining the analyzed record in this session", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    render(<Lab />);
    await analyze(routine);
    expect(screen.getByRole("alert")).toHaveTextContent("session only");
    expect(screen.getByRole("button", { name: "Resume record test-rec" })).toBeInTheDocument();
  });

  it("uses labeled rules fallback when the mocked live model is unavailable", async () => {
    vi.mocked(aiTriage).mockResolvedValue({ mode: "unavailable", reason: "Controlled test outage" });
    render(<Lab />);
    fireEvent.change(screen.getByLabelText("Analysis engine"), { target: { value: "live" } });
    await analyze(routine);
    expect(aiTriage).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Rules fallback: Controlled test outage")).toBeInTheDocument();
    await waitFor(() => expect(savedRecords()).toHaveLength(1));
  });
  it("keeps routine review reasons separate from incident escalation reasons", async () => {
    render(<Lab />);
    await analyze(routine);
    expect(savedRecords()[0]?.escalation).toEqual([]);
    expect(savedRecords()[0]?.disposition).toBe("review");
    expect(savedRecords()[0]?.reviewReasons?.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Accept triage locally" }));
    expect(savedRecords()[0]?.escalation).toEqual([]);
    expect(savedRecords()[0]?.disposition).toBe("review");
  });

  it("stores clarification reasons without classifying them as incident escalation", async () => {
    render(<Lab />);
    await analyze("Something seems off with the site.");
    expect(savedRecords()[0]?.escalation).toEqual([]);
    expect(savedRecords()[0]?.disposition).toBe("clarify");
    expect(savedRecords()[0]?.reviewReasons?.join(" ")).toMatch(/confidence/i);
    fireEvent.change(screen.getByLabelText(/Decision notes/), { target: { value: "Which page is affected?" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Record clarification needed locally" }));
    expect(savedRecords()[0]?.escalation).toEqual([]);
    expect(savedRecords()[0]?.disposition).toBe("clarify");
  });
});

describe("November 14 completeness pass", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  it("runs known evidence without model calls or queue mutations", async () => {
    render(<Lab />);
    fireEvent.click(screen.getByRole("button", { name: "Run known regressions" }));
    expect(screen.getByText("10 / 10 known scenarios passed")).toBeInTheDocument();
    expect(aiTriage).not.toHaveBeenCalled();
    expect(savedRecords()).toHaveLength(0);
  });
  it("shows staging exclusion evidence while retaining full original", async () => {
    render(<Lab />);
    await analyze("Checkout fails only in our isolated staging simulation; production orders work.");
    expect(screen.getByText("Incident context evidence")).toBeInTheDocument();
    expect(screen.getByText("checkout fails only in our isolated staging simulation")).toBeInTheDocument();
  });
  it("combines priority and status filters and exports exactly visible records", async () => {
    const critical = { ...record("All payments fail right now."), id: "critical" };
    localStorage.setItem(KEY, JSON.stringify([critical, record()]));
    let exported: Blob | undefined;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((b: Blob) => {
        exported = b;
        return "blob:test";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<Lab />);
    fireEvent.change(screen.getByLabelText("Filter by priority"), { target: { value: "P0 Critical" } });
    fireEvent.change(screen.getByLabelText("Filter by decision status"), { target: { value: "pending" } });
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export filtered JSON" }));
    const data = JSON.parse(await readBlob(exported!));
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("critical");
  });
  it("preserves all 250 existing records instead of dropping the oldest on new analysis", () => {
    const existing = Array.from({ length: 250 }, (_, i) => ({ ...record(), id: `fixture-${i}` }));
    localStorage.setItem(KEY, JSON.stringify(existing));
    render(<Lab />);
    fireEvent.change(screen.getByLabelText("Ticket text"), { target: { value: "Please provide a receipt." } });
    fireEvent.click(screen.getByRole("button", { name: "Analyze ticket" }));
    expect(screen.getByRole("status")).toHaveTextContent("Queue capacity reached");
    expect(savedRecords()).toEqual(existing);
    expect(aiTriage).not.toHaveBeenCalled();
  });
});
