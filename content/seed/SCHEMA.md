# Seed bank schema (TOPIK II 듣기 40–50, 읽기 40–50, 쓰기 53–54)

Every seed file is a JSON object:
{ "sources": [ {"title": "...", "url": "..."} ], "groups": [ Group, ... ] }

Group = one passage/audio plus the questions that share it.

## Common fields
- id: string, unique, e.g. "L41-03", "R48-02", "W54-07"
- section: "LISTENING" | "READING" | "WRITING"
- typeKey: one of the keys below
- topikRange: "41~42" etc (string shown to the user)
- instruction: official-style Korean instruction line, e.g. "※ [41~42] 다음은 강연입니다. 잘 듣고 물음에 답하십시오."
- topic: short Korean topic label (used to avoid repeats), e.g. "도시 열섬 현상"
- difficulty: 5 or 6
- keyExpressions: 3–6 advanced expressions from the text, e.g. ["~에 불과하다", "역부족이다"]
- questions: [Question]

Question = {
  "number": 42,                       // official TOPIK question number
  "stem": "들은 내용과 같은 것을 고르십시오.",
  "options": ["...", "...", "...", "..."],   // exactly 4, no ①② prefixes
  "answerIndex": 0,                   // 0–3, exactly one correct
  "explanation": { "ko": "왜 정답인지 + 오답 이유 간단히", "uz": "O'zbekcha (lotin) izoh" }
}

## LISTENING extra fields
- genre: "대담" | "강연" | "다큐멘터리" | "인터뷰"
- script: [ {"speaker": "M" | "F", "text": "..."} ]   // one entry per turn; lectures may be one speaker split into 3–6 chunks
typeKeys and questions:
- L_39_40_dialogue  (39~40, 대담; only question 40 "들은 내용과 같은 것을 고르십시오.") script starts mid-discussion (refers back to what was said before)
- L_41_42_lecture   (41 "이 강연의 중심 내용으로 가장 알맞은 것을 고르십시오." / 42 "들은 내용과 같은 것을 고르십시오.")
- L_43_44_documentary (43 "무엇에 대한 내용인지 가장 알맞은 것을 고르십시오." / 44 "~의 이유(원인)로 맞는 것을 고르십시오." style)
- L_45_46_lecture   (45 "들은 내용과 같은 것을 고르십시오." / 46 "여자(남자)의 말하는 방식으로 가장 알맞은 것을 고르십시오.")
- L_47_48_interview (47 "들은 내용과 같은 것을 고르십시오." / 48 "남자(여자)의 태도로 가장 알맞은 것을 고르십시오.")
- L_49_50_lecture   (49 "들은 내용과 같은 것을 고르십시오." / 50 "남자(여자)의 태도로 가장 알맞은 것을 고르십시오.")
Script length 550–900 Korean characters. 문어체-heavy spoken register of lectures/debates.

## READING extra fields
- passage: string. Use "\n" between paragraphs.
  - insertion markers: ( ㉠ ) ( ㉡ ) ( ㉢ ) ( ㉣ )
  - blank: ( ) written exactly as "(          )"
  - underlined part: <u>...</u>
- givenSentence: string (only for R_40 / R_41, the <보기> sentence)
typeKeys and questions:
- R_40_insert      (40: "주어진 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오." options ["㉠","㉡","㉢","㉣"])  expository/news text
- R_41_review_insert (41: same instruction, text = 서평/영화평/공연평)
- R_42_43_literary (42: "밑줄 친 부분에 나타난 '나'(인물)의 심정으로 가장 알맞은 것을 고르십시오." / 43: "윗글의 내용으로 알 수 있는 것을 고르십시오.") 소설 excerpt, original
- R_44_45_argument (44: "(  )에 들어갈 내용으로 가장 알맞은 것을 고르십시오." / 45: "윗글의 주제로 가장 알맞은 것을 고르십시오.")
- R_46_47_attitude (46: "윗글에 나타난 필자의 태도로 가장 알맞은 것을 고르십시오." / 47: "윗글의 내용과 같은 것을 고르십시오.")
- R_48_50_academic (48: "필자가 이 글을 쓴 목적으로 가장 알맞은 것을 고르십시오." / 49: "(  )에 들어갈 내용으로 가장 알맞은 것을 고르십시오." / 50: "밑줄 친 부분에 나타난 필자의 태도로 가장 알맞은 것을 고르십시오.")
Passage length: 40/41 ≈ 450–650자, 42–43 ≈ 700–900자, 44–50 ≈ 650–900자.

## WRITING (questions = [] for writing groups)
- W_53_chart:
  - prompt: "다음은 '...'에 대한 자료이다. 이 내용을 200~300자의 글로 쓰시오. 단, 글의 제목은 쓰지 마시오."
  - chartData: { "surveyBy": "조사 기관", "title": "...", "chart": {"type": "bar"|"line"|"pie", "unit": "%"|"명"|"억 원"..., "labels": [...], "series": [{"name": "...", "values": [numbers]}]}, "notes": [ {"heading": "원인" | "전망" | "변화 이유" | "특징", "items": ["...", "..."]} ] }
  - modelAnswer: 6급 model answer, 250–300자 (count with spaces)
- W_54_essay:
  - prompt: "다음을 주제로 하여 자신의 생각을 600~700자로 글을 쓰시오. 단, 문제를 그대로 옮겨 쓰지 마시오."
  - topicIntro: 2–3 sentence framing paragraph
  - guideQuestions: exactly 3 Korean guide questions (the • bullets)
  - modelAnswer: 6급 model answer, 620–700자 (count with spaces), 문어체 (-다), 서론/본론/결론
- both: keyExpressions, topic, difficulty, explanation {ko, uz} = writing tips for this task

## Quality rules (all)
- ORIGINAL content only: imitate official format and style; never copy text of past papers.
- Level 5–6급: academic/abstract topics (science, society, economy, culture, philosophy, environment, tech ethics, history, arts), advanced vocabulary and grammar.
- Exactly one correct answer; distractors plausible (partial truths, reversed causation, overgeneralisation) but clearly wrong on close reading.
- Spread correct answerIndex roughly evenly across 0–3.
- No two groups in the same file share a topic.
- Explanation uz: Uzbek Latin script, 1–3 sentences.
