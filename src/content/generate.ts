import { randomUUID } from "node:crypto";
import { hasAI } from "../config.js";
import { db } from "../db/client.js";
import { askJson } from "../ai/claude.js";
import { AnyGroup, type AnyGroupT } from "./schemas.js";
import { GENERATE_SYSTEM, generatePrompt } from "./prompts/generate.v1.js";
import { QUESTION_TYPES, typeByKey } from "./questionTypes.js";
import { saveGroup } from "./store.js";
import { validateGroup } from "./validate.js";

/** Topics used in the last 14 days + every topic in the bank of this type (to avoid repeats). */
async function avoidTopics(typeKey: string): Promise<string[]> {
  const rows = await db.qGroup.findMany({ where: { typeKey }, select: { topic: true }, orderBy: { createdAt: "desc" }, take: 80 });
  return rows.map((r) => r.topic);
}

/** Generate one group, validate independently, retry up to 2 times. Returns saved group id or null. */
export async function generateOne(typeKey: string): Promise<string | null> {
  const t = typeByKey.get(typeKey);
  if (!t || !hasAI) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const g = await askJson({
        purpose: `generate:${typeKey}`,
        system: GENERATE_SYSTEM,
        prompt: generatePrompt(t, await avoidTopics(typeKey)),
        schema: AnyGroup,
      }) as AnyGroupT;
      g.id = `ai-${typeKey.split("_").slice(0, 2).join("")}-${randomUUID().slice(0, 8)}`;
      const v = await validateGroup(g);
      if (!v.ok) { console.warn(`[gen] ${typeKey} rejected: ${v.reasons.join(" | ")}`); continue; }
      await saveGroup(g, "ai");
      return g.id;
    } catch (e) {
      console.warn(`[gen] ${typeKey} failed: ${String(e).slice(0, 200)}`);
    }
  }
  return null;
}

/** Unused = no attempt on any of its questions (or, for writing, on the group). */
export async function unusedGroupCount(typeKey: string): Promise<number> {
  const t = typeByKey.get(typeKey)!;
  if (t.section === "WRITING") {
    const used = await db.attempt.findMany({ where: { groupId: { not: null } }, select: { groupId: true }, distinct: ["groupId"] });
    return db.qGroup.count({ where: { typeKey, status: "VALIDATED", id: { notIn: used.map((u) => u.groupId!) } } });
  }
  return db.qGroup.count({ where: { typeKey, status: "VALIDATED", questions: { every: { attempts: { none: {} } } } } });
}

/** Nightly job: keep a stock of unused groups per type (daily need + 20% reserve). */
export async function topUpBank(minPerType = 3): Promise<Record<string, number>> {
  const made: Record<string, number> = {};
  if (!hasAI) return made;
  for (const t of QUESTION_TYPES) {
    const have = await unusedGroupCount(t.typeKey);
    for (let i = have; i < minPerType; i++) {
      if (await generateOne(t.typeKey)) made[t.typeKey] = (made[t.typeKey] ?? 0) + 1;
    }
  }
  return made;
}
