import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const draft = {
  summary: "Invoice question",
  category: "Billing",
  priority: "P3 Low",
  rationale: "Routine inquiry",
  confidence: 0.9,
  uncertainty: "",
};
const completed = (value = draft) => ({
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }],
});
let run: typeof import("./triage-openai.server").runOpenAiTriage;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("OpenAIKey", "test-placeholder-not-a-real-key");
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(completed())));
  vi.stubGlobal("fetch", fetchMock);
  run = (await import("./triage-openai.server")).runOpenAiTriage;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("server OpenAI connection", () => {
  it("keeps missing keys offline", async () => {
    vi.stubEnv("OpenAIKey", "");
    expect((await run("Invoice question")).mode).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("validates input before API usage", async () => {
    for (const text of [" ", "a".repeat(4001)]) expect((await run(text)).mode).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses the existing secret only in the server authorization header", async () => {
    const result = await run("Invoice question");
    expect(result.mode).toBe("live");
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(options.headers.Authorization).toBe("Bearer test-placeholder-not-a-real-key");
    expect(options.headers["Lovable-API-Key"]).toBeUndefined();
    expect(JSON.parse(options.body)).toMatchObject({
      store: false,
      stream: false,
      max_output_tokens: 1600,
    });
    expect(JSON.stringify(result)).not.toContain("test-placeholder");
    if (result.mode === "live") expect(result.draft.suggested_owner).toBe("Billing Specialist");
  });
  it.each([401, 403, 429, 500])(
    "safely falls back on HTTP %i without exposing provider text",
    async (status) => {
      fetchMock.mockResolvedValue(new Response("private provider message", { status }));
      const result = await run("Invoice question");
      expect(result.mode).toBe("unavailable");
      expect(JSON.stringify(result)).not.toContain("private");
    },
  );
  it.each([
    { status: "incomplete", output: [] },
    { status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] },
    { status: "completed", output: [] },
    completed({ ...draft, confidence: 2 }),
    completed({ ...draft, summary: "x".repeat(141) }),
  ])("rejects unusable responses", async (payload) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
    expect((await run("Invoice question")).mode).toBe("unavailable");
  });
  it("does not disclose thrown errors and permits later requests", async () => {
    fetchMock.mockRejectedValueOnce(new Error("test-placeholder-not-a-real-key"));
    expect(JSON.stringify(await run("Invoice question"))).not.toContain("test-placeholder");
    expect((await run("Invoice question")).mode).toBe("live");
  });
  it("retains deterministic safety policy on live drafts", async () => {
    const result = await run(
      "The entire website is down and checkout is failing for all customers.",
    );
    expect(result.mode).toBe("live");
    if (result.mode === "live") expect(result.draft.priority).toBe("P0 Critical");
  });
  it("caps requests per instance and resets after the minute", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(100000);
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(completed())));
    for (let i = 0; i < 10; i++) await run("Invoice question");
    expect((await run("Invoice question")).mode).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(10);
    now.mockReturnValue(160001);
    expect((await run("Invoice question")).mode).toBe("live");
    now.mockRestore();
  });
  it("caps concurrency and releases slots after completion", async () => {
    let release!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    let releaseTwo!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseTwo = resolve;
        }),
    );
    const first = run("Invoice question");
    const second = run("Invoice question");
    expect((await run("Invoice question")).mode).toBe("unavailable");
    release(new Response(JSON.stringify(completed())));
    releaseTwo(new Response(JSON.stringify(completed())));
    await Promise.all([first, second]);
    expect((await run("Invoice question")).mode).toBe("live");
  });
});
