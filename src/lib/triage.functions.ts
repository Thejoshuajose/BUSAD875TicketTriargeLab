import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CATEGORIES, PRIORITIES, OWNERS, type TriageDraft } from "./triage-rules";

export type AiResult =
  | { mode: "live"; model: string; draft: TriageDraft }
  | { mode: "unavailable"; reason: string };

const MODEL = "google/gemini-2.5-flash";

export const aiTriage = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ text: z.string().min(1).max(4000) }).parse(i))
  .handler(async ({ data }): Promise<AiResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { mode: "unavailable", reason: "Built-in AI service not configured for this project." };
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: `You triage SYNTHETIC website support tickets for an educational demo. Reply with ONLY a JSON object with keys: summary (string, <=140 chars), category (one of ${JSON.stringify(CATEGORIES)}), priority (one of ${JSON.stringify(PRIORITIES)}), rationale (string), confidence (number 0-1, be honest and low for vague tickets), uncertainty (string). Security incidents or full outages are P0 Critical.` },
            { role: "user", content: data.text },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) return { mode: "unavailable", reason: `AI service returned ${res.status}.` };
      const j = await res.json();
      const raw = String(j.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
      const p = z.object({
        summary: z.string(), category: z.enum(CATEGORIES), priority: z.enum(PRIORITIES),
        rationale: z.string(), confidence: z.coerce.number().min(0).max(1), uncertainty: z.string(),
      }).parse(JSON.parse(raw));
      return { mode: "live", model: MODEL, draft: { ...p, suggested_owner: OWNERS[p.category] } };
    } catch (e) {
      return { mode: "unavailable", reason: `AI output could not be used (${e instanceof Error ? e.message.slice(0, 80) : "error"}).` };
    }
  });
