import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  // Tolerate pasted quotes, spaces, stray symbols and a "bot" prefix; the format is <digits>:<35 chars>.
  BOT_TOKEN: z
    .string()
    .transform((v) => v.replace(/^[^0-9A-Za-z]+|[^0-9A-Za-z_-]+$/g, "").replace(/^bot(?=\d)/i, ""))
    .refine((v) => /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(v), "BOT_TOKEN format is wrong: expected 123456789:AA... exactly as @BotFather shows it"),
  OWNER_TELEGRAM_ID: z.coerce.number().int().optional(),
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional().transform((v) => (v ? v : undefined)),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  // Needed only for keys that are not scoped to a workspace.
  ANTHROPIC_WORKSPACE_ID: z.string().optional().transform((v) => (v ? v : undefined)),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().transform((v) => (v ? v : undefined)),
  TZ_NAME: z.string().default("Asia/Seoul"),
  EXAM_DATE: z.string().default("2026-10-18"),
  ASSETS_DIR: z.string().default("assets"),
});

export const env = Env.parse(process.env);
export const hasAI = Boolean(env.ANTHROPIC_API_KEY);
