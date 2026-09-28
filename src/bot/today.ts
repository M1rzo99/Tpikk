import { InputFile, type Api } from "grammy";
import type { DailySet } from "@prisma/client";
import { db } from "../db/client.js";
import { getOrCreateToday, setProgress } from "../daily/dailySet.js";
import { renderDdayCard } from "../media/cards.js";
import { dDayLabel, daysUntilExam, localDateKey } from "../time.js";
import { todayKb } from "../ui/keyboards.js";
import { SEP, bar, esc } from "../ui/templates.js";

export async function introCaption(set: DailySet): Promise<string> {
  const p = await setProgress(set);
  const w = set.writingId ? await db.qGroup.findUnique({ where: { id: set.writingId }, select: { topikRange: true } }) : null;
  const wLine = !p.writing.required
    ? "✍️ 쓰기   — (bugun yo'q)"
    : `✍️ 쓰기   ${w?.topikRange ?? ""}번 · ${p.writing.done ? `✅ ${p.writing.score}/${p.writing.max}` : "⬜"}`;
  const lines = [
    `📅 <b>${dDayLabel()}</b> · 오늘의 TOPIK II 세트`,
    SEP,
    `🎧 듣기   ${bar(p.listening.done, p.listening.total) || "—"}`,
    `📖 읽기   ${bar(p.reading.done, p.reading.total) || "—"}`,
    wLine,
  ];
  if (p.review.total) lines.push(`🔁 복습   ${bar(p.review.done, p.review.total)}`);
  if (daysUntilExam() === 1) lines.push("", "<i>D-1: yangi material yo'q — faqat xatolar takrori va 54 namuna javoblar.</i>");
  if (p.complete) lines.push("", "🎉 <b>Bugungi to'plam bajarildi.</b>");
  return lines.join("\n");
}

/** Send the morning intro (D-day card + progress + menu) and remember its message id. */
export async function sendToday(api: Api, chatId: number, date = new Date()) {
  const set = await getOrCreateToday(date);
  const p = await setProgress(set);
  const photo = new InputFile(renderDdayCard({ date: localDateKey(date).replace(/-/g, ".") }), "dday.png");
  const msg = await api.sendPhoto(chatId, photo, {
    caption: await introCaption(set),
    parse_mode: "HTML",
    reply_markup: todayKb({ writingDone: p.writing.done || !p.writing.required, hasReview: set.reviewIds.length > 0 }),
  });
  await db.dailySet.update({ where: { id: set.id }, data: { introMessageId: msg.message_id, sentAt: set.sentAt ?? new Date() } });
  return set;
}

/** Refresh the intro caption in place after each answer. */
export async function refreshIntro(api: Api, chatId: number, setId: string) {
  const set = await db.dailySet.findUnique({ where: { id: setId } });
  if (!set?.introMessageId) return;
  const p = await setProgress(set);
  await api
    .editMessageCaption(chatId, set.introMessageId, {
      caption: await introCaption(set),
      parse_mode: "HTML",
      reply_markup: todayKb({ writingDone: p.writing.done || !p.writing.required, hasReview: set.reviewIds.length > 0 }),
    })
    .catch(() => {}); // "message is not modified" or too old
  if (p.complete && !set.completedAt) {
    await db.dailySet.update({ where: { id: set.id }, data: { completedAt: new Date() } });
    await sendDayEnd(api, chatId, set.id);
  }
}

async function sendDayEnd(api: Api, chatId: number, setId: string) {
  const set = (await db.dailySet.findUnique({ where: { id: setId } }))!;
  const p = await setProgress(set);
  const mc = p.listening.total + p.reading.total + p.review.total;
  const streak = await streakDays();
  const weakest = await db.attempt.groupBy({ by: ["questionId"], where: { dailySetId: setId, isCorrect: false }, _count: true });
  const wrongTypes = weakest.length
    ? (await db.question.findMany({ where: { id: { in: weakest.map((w) => w.questionId!).filter(Boolean) } }, select: { topikNumber: true } })).map((q) => `${q.topikNumber}번`)
    : [];
  const lines = [
    "🏁 <b>Kun yakuni</b>",
    SEP,
    `🎯 Test savollari: <b>${p.correct}/${mc}</b>`,
    p.writing.required ? `✍️ 쓰기: <b>${p.writing.score ?? "—"}/${p.writing.max ?? "—"}</b>` : "",
    `🔥 Streak: <b>${streak}</b> kun`,
    wrongTypes.length ? `\n<b>Ertangi urg'u:</b> ${esc(wrongTypes.join(", "))} — xatolar takrorlash navbatiga qo'shildi.` : "\nXatosiz kun. Ertaga shu sur'atda davom etamiz.",
  ].filter(Boolean);
  await api.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML" });
}

export async function streakDays(): Promise<number> {
  const sets = await db.dailySet.findMany({ orderBy: { date: "desc" }, take: 60, select: { date: true, completedAt: true } });
  let n = 0;
  for (const s of sets) {
    if (s.completedAt) n++;
    else if (n > 0 || s.date.getTime() < Date.now() - 86_400_000) break;
  }
  return n;
}
