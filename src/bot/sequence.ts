import type { Api } from "grammy";
import { db } from "../db/client.js";
import { setProgress, type SectionRun } from "../daily/dailySet.js";
import { resolveRun, sendNext } from "./runner.js";
import { sendWritingTask } from "./writing.js";

export type OpenSection = SectionRun | "WRITING";

export async function openSection(api: Api, chatId: number, setId: string, section: OpenSection) {
  const set = await db.dailySet.findUnique({ where: { id: setId } });
  if (!set) return;
  if (section === "WRITING") {
    if (!set.writingId) { await api.sendMessage(chatId, "Bugun 쓰기 topshirig'i yo'q."); return; }
    await sendWritingTask(api, chatId, set.writingId, set.id);
    return;
  }
  const run = await resolveRun(`d${set.id}`, section);
  if (!run || !run.ids.length) { await api.sendMessage(chatId, "Bu bo'limda bugun savol yo'q."); return; }
  await sendNext(api, chatId, run);
}

/** Official exam order in "run everything" mode: 듣기 → 쓰기 → 읽기, then 🔁. */
const ORDER: OpenSection[] = ["LISTENING", "WRITING", "READING", "REVIEW"];

export async function startSequence(api: Api, chatId: number, setId: string) {
  const set = await db.dailySet.findUnique({ where: { id: setId } });
  if (!set) return;
  await db.dailySet.update({ where: { id: setId }, data: { progress: { ...(set.progress as object), sequential: true } } });
  await continueSequence(api, chatId, setId, true);
}

export async function continueSequence(api: Api, chatId: number, setId: string, starting = false) {
  const set = await db.dailySet.findUnique({ where: { id: setId } });
  if (!set) return;
  const sequential = (set.progress as { sequential?: boolean })?.sequential;
  if (!sequential && !starting) {
    await api.sendMessage(chatId, "Boshqa bo'limni tanlash uchun: /today");
    return;
  }
  const p = await setProgress(set);
  const pending: Record<OpenSection, boolean> = {
    LISTENING: p.listening.done < p.listening.total,
    WRITING: p.writing.required && !p.writing.done,
    READING: p.reading.done < p.reading.total,
    REVIEW: p.review.done < p.review.total,
  };
  const next = ORDER.find((s) => pending[s]);
  if (next) await openSection(api, chatId, setId, next);
}
