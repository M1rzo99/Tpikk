import { z } from "zod";
import { askJson } from "../ai/claude.js";
import { VALIDATE_SYSTEM, validatePrompt } from "./prompts/validate.v1.js";
import type { AnyGroupT } from "./schemas.js";

const Verdict = z.object({
  verdict: z.enum(["VALIDATED", "REJECTED"]),
  solved: z.array(z.number().int()).default([]),
  reasons: z.array(z.string()).default([]),
});

/** Second, independent AI pass plus mechanical format checks. */
export async function validateGroup(g: AnyGroupT): Promise<{ ok: boolean; reasons: string[] }> {
  const local = formatProblems(g);
  if (local.length) return { ok: false, reasons: local };
  const v = await askJson({
    purpose: `validate:${g.typeKey}`,
    system: VALIDATE_SYSTEM,
    prompt: validatePrompt(JSON.stringify(g, null, 1)),
    schema: Verdict,
    maxTokens: 3000,
  });
  const qs = g.section === "WRITING" ? [] : g.questions;
  const mismatch = qs.some((q, i) => v.solved[i] !== undefined && v.solved[i] !== q.answerIndex);
  if (mismatch) return { ok: false, reasons: ["reviewer solved to a different answer", ...v.reasons] };
  return { ok: v.verdict === "VALIDATED", reasons: v.reasons };
}

export function formatProblems(g: AnyGroupT): string[] {
  const p: string[] = [];
  const len = (s: string) => s.replace(/\n/g, "").replace(/<\/?u>/g, "").length;
  if (g.section === "READING") {
    if (/^R_4[01]/.test(g.typeKey)) {
      if (!["㉠", "㉡", "㉢", "㉣"].every((m) => g.passage.includes(m))) p.push("missing ㉠~㉣ markers");
      if (!g.givenSentence) p.push("missing givenSentence");
    }
    if (["R_44_45_argument", "R_48_50_academic"].includes(g.typeKey) && !/\(\s{3,}\)/.test(g.passage)) p.push("missing blank");
    if (["R_42_43_literary", "R_48_50_academic"].includes(g.typeKey) && !/<u>.+?<\/u>/s.test(g.passage)) p.push("missing underline");
    if (len(g.passage) < 400 || len(g.passage) > 1000) p.push(`passage length ${len(g.passage)}`);
  }
  if (g.section === "LISTENING") {
    const n = g.script.reduce((a, l) => a + l.text.length, 0);
    if (n < 450 || n > 1000) p.push(`script length ${n}`);
  }
  if (g.section === "WRITING") {
    const n = len(g.modelAnswer);
    if (g.typeKey === "W_53_chart" && (n < 200 || n > 320 || !g.chartData)) p.push(`53 model/chart invalid (${n})`);
    if (g.typeKey === "W_54_essay" && (n < 580 || n > 720 || g.guideQuestions?.length !== 3)) p.push(`54 model/guide invalid (${n})`);
    if (g.chartData && g.chartData.chart.series.some((s) => s.values.length !== g.chartData!.chart.labels.length)) p.push("chart values/labels mismatch");
  } else {
    const nums = g.questions.map((q) => q.number);
    if (new Set(nums).size !== nums.length) p.push("duplicate question numbers");
  }
  return p;
}
