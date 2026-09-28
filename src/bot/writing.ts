import { InputFile, type Api } from "grammy";
import type { QGroup } from "@prisma/client";
import { hasAI } from "../config.js";
import { db } from "../db/client.js";
import type { ChartDataT } from "../content/schemas.js";
import { RUBRIC, countChars, type WritingKey } from "../grading/rubric.js";
import { gradeWriting, type GradeResultT } from "../grading/writing.js";
import { renderChart } from "../media/charts.js";
import { writingLiveKb, writingResultKb, writingStartKb } from "../ui/keyboards.js";
import { SEP, bar, esc } from "../ui/templates.js";
import { refreshIntro } from "./today.js";
import { continueSequence } from "./sequence.js";

const MINUTES: Record<WritingKey, number> = { W_53_chart: 12, W_54_essay: 30 };
const timers = new Map<string, NodeJS.Timeout>();

function taskText(g: QGroup): string {
  const key = g.typeKey as WritingKey;
  const r = RUBRIC[key];
  let s = `✍️ <b>쓰기 ${g.topikRange}번</b> · ${r.max}점 · ${r.min}~${r.maxChars}자\n${SEP}\n<i>${esc(g.prompt ?? g.instruction)}</i>`;
  if (key === "W_54_essay") {
    if (g.topicIntro) s += `\n\n${esc(g.topicIntro)}`;
    const gq = (g.guideQuestions as string[]) ?? [];
    s += `\n\n${gq.map((q) => `• ${esc(q)}`).join("\n")}`;
  }
  s += `\n\n⏱ Tavsiya: ${MINUTES[key]} daqiqa. «Boshlash»ni bosing, so'ng matnni shu chatga yozing — belgilar soni real vaqtda ko'rinadi.`;
  return s;
}

/** Task card: 53 → chart image with caption; 54 → text. */
export async function sendWritingTask(api: Api, chatId: number, groupId: string, _dailySetId?: string) {
  const g = await db.qGroup.findUnique({ where: { id: groupId } });
  if (!g) return;
  const kb = writingStartKb(g.id, MINUTES[g.typeKey as WritingKey]);
  if (g.typeKey === "W_53_chart" && g.chartData) {
    const photo = g.imageFileId ?? new InputFile(renderChart(g.chartData as ChartDataT), `${g.id}.png`);
    const msg = await api.sendPhoto(chatId, photo, { caption: taskText(g), parse_mode: "HTML", reply_markup: kb });
    if (!g.imageFileId && msg.photo?.length) await db.qGroup.update({ where: { id: g.id }, data: { imageFileId: msg.photo.at(-1)!.file_id } });
  } else {
    await api.sendMessage(chatId, taskText(g), { parse_mode: "HTML", reply_markup: kb });
  }
}

function liveText(key: WritingKey, buffer: string, startedAt: Date): string {
  const r = RUBRIC[key];
  const n = countChars(buffer);
  const mins = Math.floor((Date.now() - startedAt.getTime()) / 60000);
  const ok = n >= r.min && n <= r.maxChars ? "✅" : n > r.maxChars ? "⚠️ ko'p" : "";
  const preview = buffer.length > 700 ? `…${buffer.slice(-700)}` : buffer;
  return [
    `📝 <b>Yozish maydoni</b> · ${key === "W_53_chart" ? "53" : "54"}번`,
    SEP,
    `글자 수: <b>${n}자</b> / ${r.min}~${r.maxChars}자 ${ok}   ${bar(Math.min(n, r.maxChars), r.maxChars, 10).split(" ")[0]}`,
    `⏱ ${mins} / ${MINUTES[key]} daq`,
    buffer ? `\n<blockquote expandable>${esc(preview)}</blockquote>` : "\n<i>Matnni yuboring (bir yoki bir necha xabar). Tugagach «✅ Tugatdim».</i>",
  ].join("\n");
}

export async function startWriting(api: Api, chatId: number, groupId: string) {
  const g = await db.qGroup.findUnique({ where: { id: groupId } });
  if (!g) return;
  const set = await db.dailySet.findFirst({ where: { writingId: groupId }, orderBy: { date: "desc" } });
  const dailySetId = set && !(await db.attempt.findFirst({ where: { dailySetId: set.id, groupId } })) ? set.id : null;
  const startedAt = new Date();
  const msg = await api.sendMessage(chatId, liveText(g.typeKey as WritingKey, "", startedAt), { parse_mode: "HTML", reply_markup: writingLiveKb() });
  await db.writingState.upsert({
    where: { id: 1 },
    update: { groupId, dailySetId, startedAt, buffer: "", active: true, liveMessageId: msg.message_id },
    create: { id: 1, groupId, dailySetId, startedAt, buffer: "", active: true, liveMessageId: msg.message_id },
  });
  const mins = MINUTES[g.typeKey as WritingKey];
  clearTimeout(timers.get("w"));
  timers.set("w", setTimeout(async () => {
    const st = await db.writingState.findUnique({ where: { id: 1 } });
    if (st?.active && st.startedAt?.getTime() === startedAt.getTime())
      await api.sendMessage(chatId, `⏱ Tavsiya etilgan ${mins} daqiqa tugadi. Yakunlash uchun «✅ Tugatdim» ni bosing.`).catch(() => {});
  }, mins * 60_000));
}

/** Returns true when the text was consumed by an active writing session. */
export async function onWritingText(api: Api, chatId: number, messageId: number, text: string): Promise<boolean> {
  const st = await db.writingState.findUnique({ where: { id: 1 } });
  if (!st?.active || !st.groupId || !st.startedAt) return false;
  const g = await db.qGroup.findUnique({ where: { id: st.groupId } });
  if (!g) return false;
  const buffer = st.buffer ? `${st.buffer}\n${text}` : text;
  await db.writingState.update({ where: { id: 1 }, data: { buffer } });
  await api.setMessageReaction(chatId, messageId, [{ type: "emoji", emoji: "✍" }]).catch(() => {});
  // Move the live counter below the latest text so it stays in view.
  if (st.liveMessageId) await api.deleteMessage(chatId, st.liveMessageId).catch(() => {});
  const live = await api.sendMessage(chatId, liveText(g.typeKey as WritingKey, buffer, st.startedAt), { parse_mode: "HTML", reply_markup: writingLiveKb() });
  await db.writingState.update({ where: { id: 1 }, data: { liveMessageId: live.message_id } });
  return true;
}

export async function clearWriting(api: Api, chatId: number) {
  const st = await db.writingState.findUnique({ where: { id: 1 } });
  if (!st?.active || !st.groupId || !st.startedAt) return;
  const g = await db.qGroup.findUnique({ where: { id: st.groupId } });
  await db.writingState.update({ where: { id: 1 }, data: { buffer: "" } });
  if (st.liveMessageId && g)
    await api.editMessageText(chatId, st.liveMessageId, liveText(g.typeKey as WritingKey, "", st.startedAt), { parse_mode: "HTML", reply_markup: writingLiveKb() }).catch(() => {});
}

export async function cancelWriting(api: Api, chatId: number) {
  const st = await db.writingState.update({ where: { id: 1 }, data: { active: false } }).catch(() => null);
  if (st?.liveMessageId) await api.editMessageText(chatId, st.liveMessageId, "✖️ Yozish bekor qilindi.").catch(() => {});
}

export async function finishWriting(api: Api, chatId: number): Promise<string | null> {
  const st = await db.writingState.findUnique({ where: { id: 1 } });
  if (!st?.active || !st.groupId) return "Faol yozish yo'q";
  if (!st.buffer.trim()) return "Avval matn yuboring";
  const g = await db.qGroup.findUnique({ where: { id: st.groupId } });
  if (!g) return "Topshiriq topilmadi";
  await db.writingState.update({ where: { id: 1 }, data: { active: false } });
  clearTimeout(timers.get("w"));
  if (st.liveMessageId) await api.editMessageReplyMarkup(chatId, st.liveMessageId).catch(() => {});

  const wait = await api.sendMessage(chatId, "⏳ Baholanmoqda…");
  await api.sendChatAction(chatId, "typing");
  const typing = setInterval(() => api.sendChatAction(chatId, "typing").catch(() => {}), 4500);

  const key = g.typeKey as WritingKey;
  const prev = await db.attempt.findFirst({ where: { groupId: g.id, score: { not: null } }, orderBy: { createdAt: "desc" } });
  let result: GradeResultT;
  try {
    result = await gradeWriting({
      key,
      task: writingTaskForGrader(g),
      text: st.buffer,
      bankModelAnswer: g.modelAnswer,
      previous: prev ? { total: prev.score!, text: prev.writingText ?? "" } : undefined,
    });
  } finally {
    clearInterval(typing);
  }
  const durationSec = st.startedAt ? Math.round((Date.now() - st.startedAt.getTime()) / 1000) : null;
  const attempt = await db.attempt.create({
    data: {
      groupId: g.id, dailySetId: st.dailySetId, context: st.dailySetId ? "daily" : "write",
      writingText: st.buffer, charCount: result.charCount, score: result.total, maxScore: RUBRIC[key].max,
      feedback: result as never, durationSec,
    },
  });
  await api.editMessageText(chatId, wait.message_id, resultText(g, result, durationSec, prev?.score ?? null), {
    parse_mode: "HTML",
    reply_markup: writingResultKb(attempt.id, g.id),
  });
  if (st.dailySetId) {
    await refreshIntro(api, chatId, st.dailySetId);
    await continueSequence(api, chatId, st.dailySetId);
  }
  return null;
}

function writingTaskForGrader(g: QGroup): string {
  if (g.typeKey === "W_53_chart") return `${g.prompt}\n자료(JSON): ${JSON.stringify(g.chartData)}`;
  return `${g.prompt}\n${g.topicIntro ?? ""}\n${((g.guideQuestions as string[]) ?? []).map((q) => `• ${q}`).join("\n")}`;
}

function resultText(g: QGroup, r: GradeResultT, durationSec: number | null, prevScore: number | null): string {
  const key = g.typeKey as WritingKey;
  const rub = RUBRIC[key];
  const cells = Math.round((r.total / rub.max) * 10);
  const delta = prevScore !== null ? `  (${r.total - prevScore >= 0 ? "+" : ""}${r.total - prevScore} oldingiga nisbatan)` : "";
  const inRange = r.charCount >= rub.min && r.charCount <= rub.maxChars;
  const rows = rub.parts.map((p) => `• ${p.name}  <b>${r.scores[p.key as keyof typeof r.scores]}</b> / ${p.max}`).join("\n");
  const corr = r.corrections.slice(0, 8).map((c) => `• <s>${esc(c.original)}</s> → ${esc(c.fixed)}\n  <i>${esc(c.reason_uz)}</i>`).join("\n");
  let s = [
    `✍️ <b>쓰기 ${g.topikRange}번</b> · 채점 결과`,
    SEP,
    `<b>종합: ${r.total} / ${rub.max}</b>   ${"▰".repeat(cells)}${"▱".repeat(10 - cells)}${delta}`,
    rows,
    `글자 수: ${r.charCount}자 ${inRange ? "✅" : `⚠️ (${rub.min}~${rub.maxChars})`}${durationSec ? ` · ⏱ ${Math.round(durationSec / 60)} daq` : ""}`,
    r.colloquial.length ? `⚠️ 구어체: ${esc(r.colloquial.join("; "))}` : "",
    r.strengths.length ? `\n<b>Kuchli tomonlar</b>\n${r.strengths.map((x) => `• ${esc(x)}`).join("\n")}` : "",
    corr ? `\n<b>Tuzatishlar</b>\n<blockquote expandable>${corr}</blockquote>` : "",
    r.nextFocus ? `\n<b>Keyingi urg'u:</b> ${esc(r.nextFocus)}` : "",
    r.approximate ? `\n<i>ℹ️ Taxminiy baho (AI kaliti ulanmagan): hajm, uslub va bog'lovchilar bo'yicha hisoblandi.</i>` : "",
  ].filter(Boolean).join("\n");
  if (s.length > 4000) s = s.slice(0, 3990) + "…";
  return s;
}

export async function showCorrected(api: Api, chatId: number, attemptId: string) {
  const a = await db.attempt.findUnique({ where: { id: attemptId } });
  const fb = a?.feedback as GradeResultT | null;
  const text = fb?.correctedText || (hasAI ? "" : "Tuzatilgan matn AI kaliti ulanganda tayyorlanadi.");
  await api.sendMessage(chatId, `📝 <b>Tuzatilgan matn</b>\n${SEP}\n${esc(text || "—")}`, { parse_mode: "HTML" });
}

export async function showModel(api: Api, chatId: number, attemptId: string) {
  const a = await db.attempt.findUnique({ where: { id: attemptId } });
  const g = a?.groupId ? await db.qGroup.findUnique({ where: { id: a.groupId } }) : null;
  const fb = a?.feedback as GradeResultT | null;
  const model = fb?.modelAnswer || g?.modelAnswer || "—";
  const tips = g?.explanation as { ko: string; uz: string } | null;
  const keys = (g?.keyExpressions as string[]) ?? [];
  let s = `🏆 <b>Namuna javob</b> · ${countChars(model)}자\n${SEP}\n${esc(model)}`;
  if (keys.length) s += `\n\n<b>Asosiy ifodalar:</b> ${keys.map(esc).join(" · ")}`;
  if (tips) s += `\n<blockquote expandable><b>팁</b> ${esc(tips.ko)}\n\n<b>Maslahat</b> ${esc(tips.uz)}</blockquote>`;
  await api.sendMessage(chatId, s, { parse_mode: "HTML" });
}
