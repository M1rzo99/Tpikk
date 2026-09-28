import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  BOT_TOKEN: z.string().min(10, "BOT_TOKEN is required (get it from @BotFather)"),
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
