import { run } from "@grammyjs/runner";
import { env, hasAI } from "./config.js";
import { db, getSettings } from "./db/client.js";
import { loadSeeds } from "./content/seed.js";
import { createBot, setCommands } from "./bot/index.js";
import { startScheduler } from "./scheduler/jobs.js";

async function main() {
  await getSettings();
  const seeded = await loadSeeds();
  console.log(`[seed] added=${seeded.added} existing=${seeded.skipped}${seeded.errors.length ? ` errors=${seeded.errors.length}` : ""}`);
  for (const e of seeded.errors) console.warn("[seed]", e);
  console.log(`[ai] ${hasAI ? `enabled (${env.ANTHROPIC_MODEL})` : "disabled: bank-only questions, heuristic 쓰기 grading"}`);

  const bot = createBot();
  await setCommands(bot);
  startScheduler(bot.api);
  const runner = run(bot);
  const me = await bot.api.getMe();
  console.log(`[bot] @${me.username} running (tz ${env.TZ_NAME}, exam ${env.EXAM_DATE})`);

  const stop = async () => { await runner.stop(); await db.$disconnect(); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch((e) => { console.error(e); process.exit(1); });
