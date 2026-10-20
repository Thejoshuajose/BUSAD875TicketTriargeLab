import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CATEGORIES, PRIORITIES, OWNERS, type TriageDraft } from "./triage-rules";

export type AiResult =
  | { mode: "live"; model: string; draft: TriageDraft }
  | { mode: "unavailable"; reason: string };

const MODEL = "openai/gpt-6-astra";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "category", "priority", "rationale", "confidence", "uncertainty"],
  properties: {
    summary: { type: "string" },
    category: { type: "string", enum: [...CATEGORIES] },
    priority: { type: "string", enum: [...PRIORITIES] },
    rationale: { type: "string" },
    confidence: { type: "number" },
    uncertainty: { type: "string" },
  },
};

export const aiTriage = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ text: z.string().min(1).max(4000) }).parse(i))
  .handler(async ({ data }): Promise<AiResult> => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { mode: "unavailable", reason: "Built-in AI service not configured for this project." };
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: { "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({
          model: MODEL,
          stream: true,
          store: false,
          reasoning: { effort: "low" },
          instructions: "You triage SYNTHETIC website support tickets for an educational demo. Return JSON: summary (<=140 chars), category, priority, rationale, confidence (0-1; be honest and low for vague tickets), uncertainty. Security incidents or full outages are P0 Critical.",
          input: data.text,
          text: { format: { type: "json_schema", name: "triage", strict: true, schema } },
        }),
      });
      if (!res.ok || !res.body) return { mode: "unavailable", reason: `AI service returned ${res.status}.` };
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", out = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.startsWith("data:")) continue;
          const p = l.slice(5).trim();
          if (!p || p === "[DONE]") continue;
          try {
            const ev = JSON.parse(p);
            if (ev.type === "response.output_text.delta") out += ev.delta;
          } catch { /* ignore */ }
        }
      }
      const p = z.object({
        summary: z.string(), category: z.enum(CATEGORIES), priority: z.enum(PRIORITIES),
        rationale: z.string(), confidence: z.coerce.number().min(0).max(1), uncertainty: z.string(),
      }).parse(JSON.parse(out));
      return { mode: "live", model: MODEL, draft: { ...p, suggested_owner: OWNERS[p.category] } };
    } catch (e) {
      return { mode: "unavailable", reason: `AI output could not be used (${e instanceof Error ? e.message.slice(0, 80) : "error"}).` };
    }
  });
