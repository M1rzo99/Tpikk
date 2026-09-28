import { z } from "zod";
import { hasAI } from "../config.js";
import { askJson } from "../ai/claude.js";
import { GRADE_SYSTEM, gradePrompt } from "../content/prompts/grade.v1.js";
import { RUBRIC, countChars, findColloquial, type WritingKey } from "./rubric.js";

export const GradeResult = z.object({
  scores: z.object({ content: z.number(), structure: z.number(), language: z.number() }),
  total: z.number(),
  strengths: z.array(z.string()).default([]),
  corrections: z.array(z.object({ original: z.string(), fixed: z.string(), reason_uz: z.string() })).default([]),
  correctedText: z.string().default(""),
  modelAnswer: z.string().default(""),
  nextFocus: z.string().default(""),
});
export type GradeResultT = z.infer<typeof GradeResult> & { charCount: number; colloquial: string[]; approximate: boolean };

export async function gradeWriting(o: {
  key: WritingKey; task: string; text: string; bankModelAnswer?: string | null; previous?: { total: number; text: string };
}): Promise<GradeResultT> {
  const charCount = countChars(o.text);
  const colloquial = findColloquial(o.text);
  const r = RUBRIC[o.key];
  if (hasAI) {
    try {
      const g = await askJson({
        purpose: `grade:${o.key}`,
        system: GRADE_SYSTEM,
        prompt: gradePrompt({ key: o.key, task: o.task, text: o.text, charCount, colloquial, previous: o.previous }),
        schema: GradeResult,
        maxTokens: 6000,
      });
      // Clamp to the official maxima so a model slip never shows 13/12.
      const [c, s, l] = r.parts;
      g.scores.content = clamp(g.scores.content, c.max);
      g.scores.structure = clamp(g.scores.structure, s.max);
      g.scores.language = clamp(g.scores.language, l.max);
      g.total = g.scores.content + g.scores.structure + g.scores.language;
      if (!g.modelAnswer && o.bankModelAnswer) g.modelAnswer = o.bankModelAnswer;
      return { ...g, charCount, colloquial, approximate: false };
    } catch (e) {
      console.warn("[grade] AI grading failed, falling back:", String(e).slice(0, 200));
    }
  }
  return heuristicGrade(o.key, o.text, charCount, colloquial, o.bankModelAnswer ?? "");
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v * 2) / 2));

/** Offline estimate when no API key: length, register, connectives, sentence endings. */
function heuristicGrade(key: WritingKey, text: string, charCount: number, colloquial: string[], model: string): GradeResultT {
  const r = RUBRIC[key];
  const [c, s, l] = r.parts;
  const lenRatio = Math.min(1, charCount / r.min);
  const over = charCount > r.maxChars + 30;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 3);
  const daEndings = sentences.filter((x) => /(다|다\.|까\?)\s*$/.test(x.trim().replace(/\.$/, "") + "")).length;
  const register = sentences.length ? daEndings / sentences.length : 0;
  const connectives = (text.match(/그러나|하지만|따라서|그러므로|반면|또한|게다가|이처럼|이에 따라|요컨대|결론적으로|첫째|둘째|마지막으로|한편|뿐만 아니라/g) ?? []).length;
  const paragraphs = text.split(/\n\s*\n|\n/).filter((p) => p.trim()).length;
  const advanced = (text.match(/(?:에 따르면|는 반면|로 인해|에 불과하|기 마련이|ㄹ 수밖에|는 셈이|을 뿐만 아니라|에 비해|는 데 반해|고 할 수 있|음에도 불구하고)/g) ?? []).length;

  const content = clamp(c.max * lenRatio * (over ? 0.85 : 1), c.max);
  const structure = clamp(s.max * Math.min(1, 0.45 + connectives * 0.1 + (key === "W_54_essay" ? Math.min(paragraphs, 3) * 0.08 : 0.15)) * lenRatio, s.max);
  const language = clamp(l.max * Math.min(1, 0.5 + register * 0.3 + advanced * 0.04) * lenRatio - colloquial.length * 1.5, l.max);
  const strengths: string[] = [];
  if (register > 0.8) strengths.push("Gaplar izchil ravishda 문어체 (-다) bilan tugagan.");
  if (connectives >= 3) strengths.push(`Bog'lovchi ifodalar yetarli (${connectives} ta).`);
  if (charCount >= r.min && charCount <= r.maxChars) strengths.push("Belgilar soni talab doirasida.");
  return {
    scores: { content, structure, language },
    total: content + structure + language,
    strengths,
    corrections: colloquial.map((cq) => ({ original: cq.split("«")[1]?.replace("»", "") ?? cq, fixed: "문어체 (-다/-ㄴ다) shakli", reason_uz: "Yozma imtihonda og'zaki uslub ball kamaytiradi." })),
    correctedText: "",
    modelAnswer: model,
    nextFocus: charCount < r.min ? "Avval hajmni talab doirasiga yetkazing." : "Yuqori darajadagi grammatik konstruksiyalarni ko'paytiring.",
    charCount, colloquial, approximate: true,
  };
}
