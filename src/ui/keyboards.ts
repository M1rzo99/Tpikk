import { InlineKeyboard } from "grammy";
import { CIRCLED } from "./templates.js";

// Callback data (≤64 bytes):
//  a:<qid>:<i>:<run>   answer        n:<run>:<section>  next question
//  rp:<qid>:<run>      replay audio  sc:<groupId>       show script
//  o:<section>         open section of today's set      all  run everything
//  ws:<groupId>        start writing wd done  wc clear  wx cancel
//  wf:<attemptId> corrected  wm:<attemptId> model  wr:<groupId> rewrite

export function answerKb(qid: string, run: string, replay: boolean) {
  const kb = new InlineKeyboard();
  CIRCLED.forEach((c, i) => kb.text(c, `a:${qid}:${i}:${run}`));
  if (replay) kb.row().text("🔁 Yana eshitish", `rp:${qid}:${run}`);
  return kb;
}

export function afterAnswerKb(run: string, section: string, groupId: string, listening: boolean, last = false) {
  const kb = new InlineKeyboard();
  if (listening) kb.text("📜 Skript", `sc:${groupId}`);
  return kb.text(last ? "Bo'limni yakunlash ✓" : "Keyingi savol →", `n:${run}:${section}`);
}

export function todayKb(opts: { writingDone: boolean; hasReview: boolean }) {
  const kb = new InlineKeyboard()
    .text("🎧 듣기", "o:LISTENING").text("📖 읽기", "o:READING").text(opts.writingDone ? "✍️ 쓰기 ✓" : "✍️ 쓰기", "o:WRITING");
  if (opts.hasReview) kb.row().text("🔁 복습", "o:REVIEW");
  return kb.row().text("▶️ Hammasini ketma-ket boshlash", "all");
}

export const writingStartKb = (groupId: string, minutes: number) =>
  new InlineKeyboard().text(`⏱ Boshlash (${minutes} daq)`, `ws:${groupId}`);

export const writingLiveKb = () =>
  new InlineKeyboard().text("✅ Tugatdim", "wd").row().text("🗑 Tozalash", "wc").text("✖️ Bekor qilish", "wx");

export const writingResultKb = (attemptId: string, groupId: string) =>
  new InlineKeyboard()
    .text("📝 Tuzatilgan matn", `wf:${attemptId}`).text("🏆 Namuna javob", `wm:${attemptId}`).row()
    .text("🔄 Qayta yozish", `wr:${groupId}`);
