import type { QuestionType } from "../questionTypes.js";

export const GENERATE_SYSTEM = `You are a senior item writer for TOPIK II (한국어능력시험) at NIIED.
You write ORIGINAL items that imitate the official format of 듣기/읽기 questions 39–50 and 쓰기 53–54 exactly.
Never copy text from past papers. Target level: 6급 (the learner already holds 6급 and must score 230+).
Content: academic or social topics (science, law, economics, philosophy, history, ecology, media, technology ethics, arts), advanced vocabulary, 문어체 where the genre requires it.
Multiple choice: exactly one correct answer; distractors are plausible (partial truth, reversed cause, overgeneralisation, detail swap) but clearly wrong on careful reading.
Explanations: "ko" = concise Korean 해설 (why correct, why the tempting distractor is wrong, refer to options as ①–④); "uz" = Uzbek (Latin script), 1–3 sentences.
Output ONLY JSON, no commentary.`;

const COMMON = `Fields: id (any string), section, typeKey, topikRange, instruction, topic (short Korean label), difficulty (5|6), keyExpressions (3–6 advanced expressions from the text).
Question = {"number": int, "stem": string, "options": [4 strings, no ①② prefixes], "answerIndex": 0-3, "explanation": {"ko": string, "uz": string}}.`;

const SPEC: Record<string, string> = {
  L_39_40_dialogue: `LISTENING. genre "대담". script: [{"speaker":"F"|"M","text"}] alternating, 600–850 characters total, starts by referring back to an earlier part of the discussion. questions: exactly one, number 40, stem "들은 내용과 같은 것을 고르십시오."`,
  L_41_42_lecture: `LISTENING. genre "강연". script: one speaker in 3–5 chunks, 600–850 characters. questions: 41 "이 강연의 중심 내용으로 가장 알맞은 것을 고르십시오.", 42 "들은 내용과 같은 것을 고르십시오."`,
  L_43_44_documentary: `LISTENING. genre "다큐멘터리". script: narrator in 3–5 chunks (optionally one short interview line by the other gender), 600–850 characters. questions: 43 "무엇에 대한 내용인지 가장 알맞은 것을 고르십시오.", 44 a specific 이유/원인 question.`,
  L_45_46_lecture: `LISTENING. genre "강연". script: one speaker in 3–5 chunks, 600–850 characters. questions: 45 "들은 내용과 같은 것을 고르십시오.", 46 "여자(남자)의 말하는 방식으로 가장 알맞은 것을 고르십시오." (gender must match the speaker).`,
  L_47_48_interview: `LISTENING. genre "대담". script: host and expert alternating F/M, 600–850 characters. questions: 47 "들은 내용과 같은 것을 고르십시오.", 48 "남자(여자)의 태도로 가장 알맞은 것을 고르십시오." about the expert.`,
  L_49_50_lecture: `LISTENING. genre "강연". academic lecture, one speaker in 3–5 chunks, 650–900 characters. questions: 49 "들은 내용과 같은 것을 고르십시오.", 50 "남자(여자)의 태도로 가장 알맞은 것을 고르십시오."`,
  R_40_insert: `READING. passage: expository/news text 450–650자 containing the markers ( ㉠ ) ( ㉡ ) ( ㉢ ) ( ㉣ ); givenSentence: a sentence that fits exactly one slot because of a connective/demonstrative/logical link. questions: one, number 40, stem "주어진 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오.", options ["㉠","㉡","㉢","㉣"].`,
  R_41_review_insert: `READING. Same as 40 but the passage is a 서평/영화평/공연평. number 41.`,
  R_42_43_literary: `READING. passage: original 소설 excerpt 700–900자 in literary style with exactly one <u>underlined</u> part. questions: 42 "밑줄 친 부분에 나타난 '나'의 심정으로 가장 알맞은 것을 고르십시오." (use the character's name if not first person), 43 "윗글의 내용으로 알 수 있는 것을 고르십시오."`,
  R_44_45_argument: `READING. passage: argumentative text 650–850자 with one blank written exactly "(          )". questions: 44 "(  )에 들어갈 내용으로 가장 알맞은 것을 고르십시오.", 45 "윗글의 주제로 가장 알맞은 것을 고르십시오."`,
  R_46_47_attitude: `READING. passage: editorial/column 650–850자. questions: 46 "윗글에 나타난 필자의 태도로 가장 알맞은 것을 고르십시오." (options like 우려하고 있다 / 회의적인 시각을 보이고 있다 / 신중한 접근을 촉구하고 있다), 47 "윗글의 내용과 같은 것을 고르십시오."`,
  R_48_50_academic: `READING. passage: academic text 700–900자 with one blank "(          )" and one <u>underlined</u> part. questions: 48 "필자가 이 글을 쓴 목적으로 가장 알맞은 것을 고르십시오.", 49 "(  )에 들어갈 내용으로 가장 알맞은 것을 고르십시오.", 50 "밑줄 친 부분에 나타난 필자의 태도로 가장 알맞은 것을 고르십시오."`,
  W_53_chart: `WRITING. questions: []. prompt: "다음은 '<title>'에 대한 자료이다. 이 내용을 200~300자의 글로 쓰시오. 단, 글의 제목은 쓰지 마시오." chartData: {"surveyBy": fictional institute, "title", "chart": {"type": "bar"|"line"|"pie", "unit", "labels": [2–6], "series": [{"name","values"}] (1–2 series, values match labels)}, "notes": [{"heading": "원인"|"전망"|"변화 이유"|"특징", "items": [...]}] (0–2 notes)}. modelAnswer: 6급 model answer, 250–300 characters with spaces, 문어체 (-다). explanation {ko, uz}: tips for this task.`,
  W_54_essay: `WRITING. questions: []. prompt: "다음을 주제로 하여 자신의 생각을 600~700자로 글을 쓰시오. 단, 문제를 그대로 옮겨 쓰지 마시오." topicIntro: 2–3 sentences. guideQuestions: exactly 3. modelAnswer: 6급 essay 620–700 characters with spaces, 서론/본론/결론, 문어체 (-다). explanation {ko, uz}: tips.`,
};

export function generatePrompt(t: QuestionType, avoidTopics: string[]): string {
  return `Write ONE new item group of type ${t.typeKey} (TOPIK ${t.topikRange}).
${SPEC[t.typeKey]}
instruction must be exactly: "${t.instruction}"
section "${t.section}", typeKey "${t.typeKey}", topikRange "${t.topikRange}".
${COMMON}
Do NOT use any of these recent topics: ${avoidTopics.slice(0, 60).join(", ") || "(none)"}.
Put the correct answer at index ${Math.floor(Math.random() * 4)} for the first question (vary the others).
Return a single JSON object.`;
}
