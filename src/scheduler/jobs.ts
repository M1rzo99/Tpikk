import cron from "node-cron";
import type { Api } from "grammy";
import { env } from "../config.js";
import { db, getSettings } from "../db/client.js";
import { topUpBank } from "../content/generate.js";
import { getOrCreateToday, setProgress } from "../daily/dailySet.js";
import { renderScript } from "../media/tts.js";
import { localDay, localHHMM } from "../time.js";
import { ownerId } from "../bot/index.js";
import { sendToday } from "../bot/today.js";

let nightlyRunning = false;

export function startScheduler(api: Api) {
  // One tick per minute: times are editable in /settings, so compare at runtime.
  cron.schedule("* * * * *", () => tick(api).catch((e) => console.error("[cron]", e)), { timezone: env.TZ_NAME });
}

async function tick(api: Api) {
  const s = await getSettings();
  const owner = await ownerId();
  const now = localHHMM();
  if (now === "02:00") void nightly();
  if (!owner || s.paused) return;

  if (now === s.dailyTime) {
    const set = await db.dailySet.findUnique({ where: { date: localDay() } });
    if (!set?.sentAt) await sendToday(api, owner);
  }
  if (now === s.reminderTime) {
    const set = await db.dailySet.findUnique({ where: { date: localDay() } });
    if (set?.sentAt && !set.completedAt && !set.remindedAt) {
      const p = await setProgress(set);
      const left = [
        p.listening.done < p.listening.total ? `🎧 듣기 ${p.listening.total - p.listening.done}` : "",
        p.reading.done < p.reading.total ? `📖 읽기 ${p.reading.total - p.reading.done}` : "",
        p.writing.required && !p.writing.done ? "✍️ 쓰기" : "",
        p.review.done < p.review.total ? `🔁 복습 ${p.review.total - p.review.done}` : "",
      ].filter(Boolean);
      await api.sendMessage(owner, `🔔 Bugungi to'plamdan qoldi: ${left.join(" · ")}\nDavom etish: /today`);
      await db.dailySet.update({ where: { id: set.id }, data: { remindedAt: new Date() } });
    }
  }
}

/** 02:00 — top up the bank with validated AI items and pre-render tomorrow's audio. */
export async function nightly() {
  if (nightlyRunning) return;
  nightlyRunning = true;
  try {
    const made = await topUpBank(3);
    if (Object.keys(made).length) console.log("[nightly] generated", made);
    const tomorrow = new Date(Date.now() + 86_400_000);
    const set = await getOrCreateToday(tomorrow);
    const qs = await db.question.findMany({ where: { id: { in: set.listeningIds } }, include: { group: true } });
    for (const g of new Map(qs.map((q) => [q.groupId, q.group])).values()) {
      if (!g.audioFileId) await renderScript(g.id, g.script as never).catch((e) => console.warn("[nightly tts]", String(e).slice(0, 200)));
    }
  } finally {
    nightlyRunning = false;
  }
}
