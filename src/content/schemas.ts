import { z } from "zod";

export const Explanation = z.object({ ko: z.string().min(1), uz: z.string().min(1) });

export const QuestionSchema = z.object({
  number: z.number().int().min(39).max(54),
  stem: z.string().min(3),
  options: z.array(z.string().min(1)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: Explanation,
});

export const ScriptLine = z.object({ speaker: z.enum(["M", "F"]), text: z.string().min(1) });

const Base = z.object({
  id: z.string().min(1),
  typeKey: z.string(),
  topikRange: z.string(),
  instruction: z.string(),
  topic: z.string(),
  difficulty: z.number().int().min(1).max(6).default(6),
  keyExpressions: z.array(z.string()).default([]),
});

export const ListeningGroup = Base.extend({
  section: z.literal("LISTENING"),
  genre: z.string().optional(),
  script: z.array(ScriptLine).min(1),
  questions: z.array(QuestionSchema).min(1).max(2),
});

export const ReadingGroup = Base.extend({
  section: z.literal("READING"),
  passage: z.string().min(100),
  givenSentence: z.string().optional(),
  questions: z.array(QuestionSchema).min(1).max(3),
});

export const ChartData = z.object({
  surveyBy: z.string().optional(),
  title: z.string(),
  chart: z.object({
    type: z.enum(["bar", "line", "pie"]),
    unit: z.string().default(""),
    labels: z.array(z.string()).min(2),
    series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })).min(1).max(3),
  }),
  notes: z.array(z.object({ heading: z.string(), items: z.array(z.string()) })).default([]),
});

export const WritingGroup = Base.extend({
  section: z.literal("WRITING"),
  prompt: z.string(),
  topicIntro: z.string().optional(),
  guideQuestions: z.array(z.string()).optional(),
  chartData: ChartData.optional(),
  modelAnswer: z.string().min(100),
  explanation: Explanation.optional(),
  questions: z.array(z.any()).default([]),
});

export const AnyGroup = z.discriminatedUnion("section", [ListeningGroup, ReadingGroup, WritingGroup]);
export type AnyGroupT = z.infer<typeof AnyGroup>;
export type ChartDataT = z.infer<typeof ChartData>;
export type ScriptLineT = z.infer<typeof ScriptLine>;

export const SeedFile = z.object({
  sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
  groups: z.array(z.any()),
});
