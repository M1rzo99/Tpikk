import { InputFile, type Api } from "grammy";
import type { QGroup, Question } from "@prisma/client";
import { db, getSettings } from "../db/client.js";
import { idsFor, type SectionRun } from "../daily/dailySet.js";
import { renderScript } from "../media/tts.js";
import { recordResult } from "../srs/leitner.js";
import { afterAnswerKb, answerKb } from "../ui/keyboards.js";
import { type Lang, listeningCaption, passageMessage, questionMessage, scriptMessage } from "../ui/templates.js";
import { refreshIntro } from "./today.js";
import { continueSequence } from "./sequence.js";

/**
 * A "run" is an ordered list of question ids:
 *   d<dailySetId>  — today's set (section chosen by the caller)
 *   p<sessionId>   — /practice or /mistakes session
 */
export interface Run { key: string; ids: string[]; section: SectionRun; setId?: string; sessionId?: string; tag?: string }

export async function resolveRun(key: string, section?: SectionRun, qid?: string): Promise<Run | null> {
  if (key.startsWith("d")) {
    const set = await db.dailySet.findUnique({ where: { id: key.slice(1) } });
    if (!set) return null;
    const sec = section ?? (["LISTENING", "READING", "REVIEW"] as SectionRun[]).find((s) => qid && idsFor(set, s).includes(qid)) ?? "LISTENING";
    return { key, ids: idsFor(set, sec), section: sec, setId: set.id, tag: sec === "REVIEW" ? "🔁" : undefined };
  }
  const s = await db.session.findUnique({ where: { id: key.slice(1) } });
  if (!s) return null;
  return { key, ids: s.questionIds, section: section ?? "READING", sessionId: s.id, tag: s.kind === "review" ? "🔁" : "🎯" };
}

const ctxOf = (run: Run) => (run.setId ? (run.section === "REVIEW" ? "review" : "daily") : `p:${run.sessionId}`);

async function answered(run: Run): Promise<Map<string, number>> {
  const where = run.setId ? { dailySetId: run.setId, questionId: { in: run.ids } } : { context: ctxOf(run), questionId: { in: run.ids } };
  const rows = await db.attempt.findMany({ where, select: { questionId: true, chosenIndex: true } });
  return new Map(rows.map((r) => [r.questionId!, r.chosenIndex ?? -1]));
}

const replays = new Map<string, number>(); // `${runKey}:${groupId}` → times replayed (max 1, like exam)

export async function sendNext(api: Api, chatId: number, run: Run): Promise<void> {
  const done = await answered(run);
  const idx = run.ids.findIndex((id) => !done.has(id));
  if (idx < 0) return sectionDone(api, chatId, run, done);

  const q = await db.question.findUnique({ where: { id: run.ids[idx] }, include: { group: true } });
  if (!q) return;
  const g = q.group;
  const prev = idx > 0 ? await db.question.findUnique({ where: { id: run.ids[idx - 1] }, select: { groupId: true } }) : null;
  const firstOfGroup = !prev || prev.groupId !== q.groupId;

  if (firstOfGroup) {
    if (q.section === "LISTENING") await sendAudio(api, chatId, g, idx, run);
    else await api.sendMessage(chatId, passageMessage(g, idx, run.ids.length, run.tag), { parse_mode: "HTML" });
  }
  const canReplay = q.section === "LISTENING" && (replays.get(`${run.key}:${g.id}`) ?? 0) < 1;
  await api.sendMessage(chatId, questionMessage(q, g, idx, run.ids.length, { tag: run.tag }), {
    parse_mode: "HTML",
    reply_markup: answerKb(q.id, run.key, canReplay),
  });
}

async function sendAudio(api: Api, chatId: number, g: QGroup, idx: number, run: Run) {
  const caption = listeningCaption(g, idx, run.ids.length, run.tag);
  if (g.audioFileId) {
    await api.sendVoice(chatId, g.audioFileId, { caption, parse_mode: "HTML" });
    return;
  }
  await api.sendChatAction(chatId, "record_voice");
  try {
    const path = await renderScript(g.id, g.script as never);
    const msg = await api.sendVoice(chatId, new InputFile(path), { caption, parse_mode: "HTML" });
    if (msg.voice) await db.qGroup.update({ where: { id: g.id }, data: { audioFileId: msg.voice.file_id, audioPath: path } });
  } catch (e) {
    console.error("[tts]", e);
    await api.sendMessage(chatId, `${caption}\n\n⚠️ Audio hozircha tayyorlanmadi (TTS xizmati javob bermadi). Skriptni o'qib chiqing:`, { parse_mode: "HTML" });
    await api.sendMessage(chatId, scriptMessage(g), { parse_mode: "HTML" });
  }
}

export async function replay(api: Api, chatId: number, qid: string, runKey: string): Promise<string> {
  const q = await db.question.findUnique({ where: { id: qid }, include: { group: true } });
  if (!q) return "Savol topilmadi";
  const k = `${runKey}:${q.groupId}`;
  if ((replays.get(k) ?? 0) >= 1) return "Imtihondagidek: faqat 1 marta qayta eshitish mumkin";
  replays.set(k, (replays.get(k) ?? 0) + 1);
  const run = await resolveRun(runKey, undefined, qid);
  await sendAudio(api, chatId, q.group, 0, run ?? { key: runKey, ids: [qid], section: "LISTENING" });
  return "🔁 Qayta eshitish";
}

export async function answer(api: Api, chatId: number, messageId: number, qid: string, chosen: number, runKey: string): Promise<string> {
  const run = await resolveRun(runKey, undefined, qid);
  const q = await db.question.findUnique({ where: { id: qid }, include: { group: true } });
  if (!run || !q) return "Savol topilmadi";
  const done = await answered(run);
  if (done.has(qid)) return "Bu savolga javob berilgan";

  const correct = chosen === q.answerIndex;
  await db.attempt.create({
    data: { questionId: qid, dailySetId: run.setId, context: ctxOf(run), chosenIndex: chosen, isCorrect: correct },
  });
  await recordResult(q.typeKey, correct);

  const settings = await getSettings();
  const pos = run.ids.indexOf(qid);
  await api.editMessageText(chatId, messageId, questionMessage(q, q.group, pos + 1, run.ids.length, { tag: run.tag, result: { chosen, lang: settings.explainLang as Lang } }), {
    parse_mode: "HTML",
    reply_markup: afterAnswerKb(run.key, run.section, q.groupId, q.section === "LISTENING", run.ids.every((id) => id === qid || done.has(id))),
  });
  if (run.setId) await refreshIntro(api, chatId, run.setId);
  return correct ? "✅ To'g'ri" : `❌ Noto'g'ri`;
}

async function sectionDone(api: Api, chatId: number, run: Run, done: Map<string, number>) {
  const qs = await db.question.findMany({ where: { id: { in: run.ids } }, select: { id: true, answerIndex: true } });
  const right = qs.filter((q) => done.get(q.id) === q.answerIndex).length;
  const name = run.section === "LISTENING" ? "🎧 듣기" : run.section === "READING" ? "📖 읽기" : "🔁 복습";
  await api.sendMessage(chatId, `${run.sessionId ? "🎯 Mashq" : name} yakunlandi: <b>${right}/${qs.length}</b> to'g'ri.`, { parse_mode: "HTML" });
  if (run.setId) await continueSequence(api, chatId, run.setId);
}

export async function showScript(api: Api, chatId: number, groupId: string) {
  const g = await db.qGroup.findUnique({ where: { id: groupId } });
  if (g) await api.sendMessage(chatId, scriptMessage(g), { parse_mode: "HTML" });
}
