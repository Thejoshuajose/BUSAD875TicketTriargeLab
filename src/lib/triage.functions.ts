import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { TriageDraft } from "./triage-rules";

export type AiResult = { mode: "live"; model: string; draft: TriageDraft } | { mode: "unavailable"; reason: string };

export const aiTriage = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ text: z.string().trim().min(1).max(4000) }).parse(i))
  .handler(async ({ data }): Promise<AiResult> => {
    const { runOpenAiTriage } = await import("./triage-openai.server");
    return runOpenAiTriage(data.text);
  });
