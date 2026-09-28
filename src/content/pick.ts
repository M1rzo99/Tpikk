import type { QGroup, Question } from "@prisma/client";
import { db } from "../db/client.js";

type GroupWithQ = QGroup & { questions: Question[] };

/** Group ids already placed in a daily set (even if not answered yet). */
async function scheduledGroupIds(): Promise<Set<string>> {
  const sets = await db.dailySet.findMany({ select: { listeningIds: true, readingIds: true, reviewIds: true, writingId: true } });
  const qids = sets.flatMap((s) => [...s.listeningIds, ...s.readingIds, ...s.reviewIds]);
  const qs = qids.length ? await db.question.findMany({ where: { id: { in: qids } }, select: { groupId: true } }) : [];
  return new Set([...qs.map((q) => q.groupId), ...sets.map((s) => s.writingId).filter((x): x is string => !!x)]);
}

/**
 * Pick the freshest group of a type: never scheduled & never attempted first,
 * otherwise the one attempted longest ago. Random among equals.
 */
export async function pickGroup(typeKey: string, exclude: Set<string> = new Set()): Promise<GroupWithQ | null> {
  const groups = await db.qGroup.findMany({
    where: { typeKey, status: "VALIDATED", id: { notIn: [...exclude] } },
    include: { questions: { orderBy: { topikNumber: "asc" } } },
  });
  if (!groups.length) return null;
  const scheduled = await scheduledGroupIds();
  const lastUse = new Map<string, number>();
  const attempts = await db.attempt.findMany({
    where: { OR: [{ groupId: { in: groups.map((g) => g.id) } }, { question: { groupId: { in: groups.map((g) => g.id) } } }] },
    select: { groupId: true, createdAt: true, question: { select: { groupId: true } } },
  });
  for (const a of attempts) {
    const gid = a.groupId ?? a.question?.groupId;
    if (gid) lastUse.set(gid, Math.max(lastUse.get(gid) ?? 0, a.createdAt.getTime()));
  }
  const score = (g: GroupWithQ) => (lastUse.has(g.id) ? lastUse.get(g.id)! : scheduled.has(g.id) ? -1 : -2);
  const shuffled = groups.sort(() => Math.random() - 0.5);
  return shuffled.reduce((best, g) => (score(g) < score(best) ? g : best));
}

/** A question of this type the user got wrong before (for 🔁 review), else a fresh one. */
export async function pickReviewQuestion(typeKey: string, exclude: Set<string>): Promise<Question | null> {
  const wrong = await db.attempt.findFirst({
    where: { isCorrect: false, question: { typeKey, groupId: { notIn: [...exclude] } } },
    orderBy: { createdAt: "asc" },
    include: { question: true },
  });
  if (wrong?.question) return wrong.question;
  const g = await pickGroup(typeKey, exclude);
  return g?.questions[0] ?? null;
}
