import { RUBRIC, type WritingKey } from "../../grading/rubric.js";

export const GRADE_SYSTEM = `You are an official TOPIK II 쓰기 rater (NIIED). You grade strictly and consistently with the official rubric, as for a candidate aiming at 6급.
Uzbek text must be in Latin script. Output ONLY JSON.`;

export function gradePrompt(o: {
  key: WritingKey; task: string; text: string; charCount: number; colloquial: string[]; previous?: { total: number; text: string };
}): string {
  const r = RUBRIC[o.key];
  return `TASK (TOPIK ${o.key === "W_53_chart" ? "53" : "54"}, ${r.max}점):
${o.task}

RUBRIC:
${r.parts.map((p) => `- ${p.name} (${p.max}점): ${p.desc}`).join("\n")}

FACTS COMPUTED BY CODE (trust these):
- Character count (spaces included): ${o.charCount} (required ${r.min}–${r.maxChars}). Below the minimum → deduct in 내용 및 과제 수행 proportionally; far below (under 70%) → content at most 40% of its max.
- Colloquial markers found: ${o.colloquial.length ? o.colloquial.join("; ") : "none"} (each deducts from 언어 사용).
${o.previous ? `- This is a rewrite. Previous attempt scored ${o.previous.total}/${r.max}.` : ""}

CANDIDATE ANSWER:
"""
${o.text}
"""

Return JSON:
{
 "scores": {"content": number, "structure": number, "language": number},
 "total": number,
 "strengths": ["2–4 items, Uzbek"],
 "corrections": [{"original": "exact fragment from the answer", "fixed": "improved 6급 Korean", "reason_uz": "short Uzbek reason"}],  // 4–10 most valuable
 "correctedText": "the candidate's text minimally corrected to 6급 standard, same ideas",
 "modelAnswer": "your own 6급 model answer for this task, inside ${r.min}–${r.maxChars} characters",
 "nextFocus": "one Uzbek sentence: what to practise next"
}`;
}
