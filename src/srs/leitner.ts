import { db } from "../db/client.js";

const INTERVAL_DAYS = [1, 2, 4, 7, 12]; // box 1..5

/** Wrong → box 1; right on a tracked type → next box; box 5 passed → mastered. */
export async function recordResult(typeKey: string, correct: boolean) {
  const item = await db.reviewItem.findUnique({ where: { typeKey } });
  const now = Date.now();
  if (!correct) {
    await db.reviewItem.upsert({
      where: { typeKey },
      update: { box: 1, mastered: false, nextDueAt: new Date(now + INTERVAL_DAYS[0] * 86_400_000) },
      create: { typeKey, box: 1, nextDueAt: new Date(now + INTERVAL_DAYS[0] * 86_400_000) },
    });
    return;
  }
  if (!item || item.mastered) return;
  const box = item.box + 1;
  if (box > INTERVAL_DAYS.length) {
    await db.reviewItem.update({ where: { typeKey }, data: { mastered: true } });
  } else {
    await db.reviewItem.update({ where: { typeKey }, data: { box, nextDueAt: new Date(now + INTERVAL_DAYS[box - 1] * 86_400_000) } });
  }
}

export async function dueTypes(limit = 2): Promise<string[]> {
  const due = await db.reviewItem.findMany({ where: { mastered: false, nextDueAt: { lte: new Date() } }, orderBy: [{ box: "asc" }, { nextDueAt: "asc" }], take: limit });
  return due.map((d) => d.typeKey);
}
