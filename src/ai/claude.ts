import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { env } from "../config.js";
import { db } from "../db/client.js";

let client: Anthropic | null = null;
function ai(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  return (client ??= new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    defaultHeaders: env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID } : undefined,
  }));
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("no JSON in model output");
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Ask Claude for JSON and validate it with zod. Retries with the validation
 * error fed back; never surfaces raw model output to the user.
 */
export async function askJson<T extends z.ZodTypeAny>(opts: {
  purpose: string;
  system: string;
  prompt: string;
  schema: T;
  maxTokens?: number;
  retries?: number;
}): Promise<z.infer<T>> {
  const { purpose, system, schema, maxTokens = 8000, retries = 2 } = opts;
  let prompt = opts.prompt;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let inTok = 0, outTok = 0;
    try {
      const res = await ai().messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });
      inTok = res.usage.input_tokens;
      outTok = res.usage.output_tokens;
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const parsed = schema.safeParse(extractJson(text));
      if (!parsed.success) {
        const issue = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw new Error(`schema: ${issue}`);
      }
      await log(purpose, inTok, outTok, true);
      return parsed.data;
    } catch (e) {
      lastErr = e;
      await log(purpose, inTok, outTok, false, String(e).slice(0, 300));
      prompt = `${opts.prompt}\n\nYour previous answer was rejected (${String(e).slice(0, 300)}). Return ONLY valid JSON matching the schema.`;
    }
  }
  throw lastErr;
}

async function log(purpose: string, inputTokens: number, outputTokens: number, ok: boolean, note?: string) {
  console.log(`[ai] ${purpose} ok=${ok} in=${inputTokens} out=${outputTokens}${note ? ` ${note}` : ""}`);
  await db.aiLog.create({ data: { purpose, model: env.ANTHROPIC_MODEL, inputTokens, outputTokens, ok, note } }).catch(() => {});
}
