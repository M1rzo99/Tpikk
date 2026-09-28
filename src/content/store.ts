import type { Prisma } from "@prisma/client";
import { db } from "../db/client.js";
import { typeByKey } from "./questionTypes.js";
import type { AnyGroupT } from "./schemas.js";

/** Insert (or refresh) one validated group with its questions. */
export async function saveGroup(g: AnyGroupT, origin: "seed" | "ai" = "seed") {
  const t = typeByKey.get(g.typeKey);
  if (!t || t.section !== g.section) throw new Error(`Unknown typeKey ${g.typeKey} for ${g.section}`);
  const data: Prisma.QGroupCreateInput = {
    id: g.id,
    section: g.section,
    typeKey: g.typeKey,
    topikRange: g.topikRange || t.topikRange,
    instruction: g.instruction || t.instruction,
    topic: g.topic,
    difficulty: g.difficulty,
    keyExpressions: g.keyExpressions,
    origin,
  };
  if (g.section === "LISTENING") {
    data.genre = g.genre ?? t.genre;
    data.script = g.script;
  } else if (g.section === "READING") {
    data.passage = g.passage;
    data.givenSentence = g.givenSentence;
  } else {
    data.prompt = g.prompt;
    data.topicIntro = g.topicIntro;
    data.guideQuestions = g.guideQuestions;
    data.chartData = g.chartData;
    data.modelAnswer = g.modelAnswer;
    data.explanation = g.explanation;
  }
  const existing = await db.qGroup.findUnique({ where: { id: g.id } });
  if (existing) return existing; // seeds are immutable once loaded (attempts reference them)
  return db.qGroup.create({
    data: {
      ...data,
      questions: {
        create: g.section === "WRITING" ? [] : g.questions.map((q) => ({
          section: g.section,
          topikNumber: q.number,
          typeKey: g.typeKey,
          stem: q.stem,
          options: q.options,
          answerIndex: q.answerIndex,
          explanation: q.explanation,
        })),
      },
    },
  });
}
