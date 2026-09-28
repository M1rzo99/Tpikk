import type { DailySet } from "@prisma/client";
import { db } from "../db/client.js";
import { pickGroup, pickReviewQuestion } from "../content/pick.js";
import { typesOf } from "../content/questionTypes.js";
import { dueTypes } from "../srs/leitner.js";
import { dayIndex, daysUntilExam, localDay } from "../time.js";

const LISTENING_TYPES = typesOf("LISTENING").map((t) => t.typeKey);
const LONG_READING = ["R_42_43_literary", "R_44_45_argument", "R_46_47_attitude", "R_48_50_academic"];

export function writingTypeFor(date = new Date()): "W_53_chart" | "W_54_essay" {
  return dayIndex(date) % 3 === 0 ? "W_53_chart" : "W_54_essay"; // cycle 53 → 54 → 54
}

/** Today's set; built on first request. One set per local day (CLAUDE.md §7). */
export async function getOrCreateToday(date = new Date()): Promise<DailySet> {
  const day = localDay(date);
  const existing = await db.dailySet.findUnique({ where: { date: day } });
  if (existing) return existing;

  const di = dayIndex(date);
  const used = new Set<string>();
  const listeningIds: string[] = [];
  const readingIds: string[] = [];
  const reviewIds: string[] = [];
  let writingId: string | null = null;

  if (daysUntilExam(date) === 1) {
    // D-1: no new material — mistakes only (+ 54 model answers from the menu).
    const wrong = await db.attempt.findMany({ where: { isCorrect: false }, orderBy: { createdAt: "desc" }, take: 30, select: { questionId: true } });
    for (const w of wrong) if (w.questionId && !reviewIds.includes(w.questionId) && reviewIds.length < 8) reviewIds.push(w.questionId);
  } else {
    // 🎧 3 audios × 2 questions, rotating through the six listening types.
    for (let k = 0; k < 3; k++) {
      const typeKey = LISTENING_TYPES[(di * 3 + k) % LISTENING_TYPES.length];
      const g = await pickGroup(typeKey, used);
      if (!g) continue;
      used.add(g.id);
      listeningIds.push(...g.questions.map((q) => q.id));
    }
    // 📖 one 40/41 + two long texts.
    const insert = await pickGroup(di % 2 ? "R_41_review_insert" : "R_40_insert", used);
    if (insert) { used.add(insert.id); readingIds.push(...insert.questions.map((q) => q.id)); }
    for (let k = 0; k < 2; k++) {
      const g = await pickGroup(LONG_READING[(di * 2 + k) % LONG_READING.length], used);
      if (!g) continue;
      used.add(g.id);
      readingIds.push(...g.questions.map((q) => q.id));
    }
    // ✍️ one task.
    writingId = (await pickGroup(writingTypeFor(date), used))?.id ?? null;
    // 🔁 1–2 Leitner items.
    for (const t of await dueTypes(2)) {
      const q = await pickReviewQuestion(t, used);
      if (q) { used.add(q.groupId); reviewIds.push(q.id); }
    }
  }

  return db.dailySet.upsert({
    where: { date: day },
    update: {},
    create: { date: day, listeningIds, readingIds, reviewIds, writingId, progress: {} },
  });
}

export type SectionRun = "LISTENING" | "READING" | "REVIEW";

export function idsFor(set: DailySet, section: SectionRun): string[] {
  return section === "LISTENING" ? set.listeningIds : section === "READING" ? set.readingIds : set.reviewIds;
}

export async function answeredIds(setId: string): Promise<Set<string>> {
  const a = await db.attempt.findMany({ where: { dailySetId: setId, questionId: { not: null } }, select: { questionId: true } });
  return new Set(a.map((x) => x.questionId!));
}

export async function setProgress(set: DailySet) {
  const done = await answeredIds(set.id);
  const count = (ids: string[]) => ids.filter((id) => done.has(id)).length;
  const writingAttempt = set.writingId
    ? await db.attempt.findFirst({ where: { dailySetId: set.id, groupId: set.writingId }, orderBy: { createdAt: "desc" } })
    : null;
  const correct = await db.attempt.count({ where: { dailySetId: set.id, isCorrect: true } });
  const p = {
    listening: { done: count(set.listeningIds), total: set.listeningIds.length },
    reading: { done: count(set.readingIds), total: set.readingIds.length },
    review: { done: count(set.reviewIds), total: set.reviewIds.length },
    writing: { done: !!writingAttempt, score: writingAttempt?.score ?? null, max: writingAttempt?.maxScore ?? null, required: !!set.writingId },
    correct,
  };
  const complete =
    p.listening.done === p.listening.total && p.reading.done === p.reading.total && p.review.done === p.review.total && (!p.writing.required || p.writing.done);
  return { ...p, complete };
}
