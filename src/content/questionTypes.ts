export type SectionKey = "LISTENING" | "READING" | "WRITING";

export interface QuestionType {
  typeKey: string;
  section: SectionKey;
  topikRange: string;
  numbers: number[];
  instruction: string;
  genre?: string;
  format: string;          // short description used in prompts and menus
  label: string;           // Uzbek menu label
  weight: number;
}

// Scope is strictly 듣기 40–50, 읽기 40–50, 쓰기 53–54 (CLAUDE.md §4).
export const QUESTION_TYPES: QuestionType[] = [
  { typeKey: "L_39_40_dialogue", section: "LISTENING", topikRange: "39~40", numbers: [40], genre: "대담",
    instruction: "※ [39~40] 다음은 대담입니다. 잘 듣고 물음에 답하십시오.",
    format: "대담 (discussion that starts mid-conversation); ask only Q40: 들은 내용과 같은 것", label: "40 · 대담 (mazmun)", weight: 1 },
  { typeKey: "L_41_42_lecture", section: "LISTENING", topikRange: "41~42", numbers: [41, 42], genre: "강연",
    instruction: "※ [41~42] 다음은 강연입니다. 잘 듣고 물음에 답하십시오.",
    format: "강연; Q41 중심 내용, Q42 들은 내용과 같은 것", label: "41~42 · ma'ruza", weight: 2 },
  { typeKey: "L_43_44_documentary", section: "LISTENING", topikRange: "43~44", numbers: [43, 44], genre: "다큐멘터리",
    instruction: "※ [43~44] 다음은 다큐멘터리입니다. 잘 듣고 물음에 답하십시오.",
    format: "다큐멘터리 narration; Q43 무엇에 대한 내용, Q44 이유/원인", label: "43~44 · hujjatli film", weight: 2 },
  { typeKey: "L_45_46_lecture", section: "LISTENING", topikRange: "45~46", numbers: [45, 46], genre: "강연",
    instruction: "※ [45~46] 다음은 강연입니다. 잘 듣고 물음에 답하십시오.",
    format: "강연; Q45 들은 내용과 같은 것, Q46 말하는 방식", label: "45~46 · nutq usuli", weight: 2 },
  { typeKey: "L_47_48_interview", section: "LISTENING", topikRange: "47~48", numbers: [47, 48], genre: "대담",
    instruction: "※ [47~48] 다음은 대담입니다. 잘 듣고 물음에 답하십시오.",
    format: "대담/인터뷰; Q47 들은 내용과 같은 것, Q48 태도", label: "47~48 · intervyu", weight: 2 },
  { typeKey: "L_49_50_lecture", section: "LISTENING", topikRange: "49~50", numbers: [49, 50], genre: "강연",
    instruction: "※ [49~50] 다음은 강연입니다. 잘 듣고 물음에 답하십시오.",
    format: "academic 강연; Q49 들은 내용과 같은 것, Q50 태도", label: "49~50 · akademik ma'ruza", weight: 2 },

  { typeKey: "R_40_insert", section: "READING", topikRange: "40", numbers: [40],
    instruction: "※ [39~41] 주어진 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오.",
    format: "expository text with ㉠~㉣ slots and a <보기> sentence", label: "40 · gap o'rni", weight: 1 },
  { typeKey: "R_41_review_insert", section: "READING", topikRange: "41", numbers: [41],
    instruction: "※ [39~41] 주어진 문장이 들어갈 곳으로 가장 알맞은 것을 고르십시오.",
    format: "book/film/performance review with ㉠~㉣ slots", label: "41 · sharh, gap o'rni", weight: 1 },
  { typeKey: "R_42_43_literary", section: "READING", topikRange: "42~43", numbers: [42, 43],
    instruction: "※ [42~43] 다음 글을 읽고 물음에 답하십시오.",
    format: "소설 excerpt; Q42 심정 (underlined), Q43 내용", label: "42~43 · adabiy matn", weight: 2 },
  { typeKey: "R_44_45_argument", section: "READING", topikRange: "44~45", numbers: [44, 45],
    instruction: "※ [44~45] 다음을 읽고 물음에 답하십시오.",
    format: "argumentative text; Q44 blank, Q45 주제", label: "44~45 · bo'shliq · g'oya", weight: 2 },
  { typeKey: "R_46_47_attitude", section: "READING", topikRange: "46~47", numbers: [46, 47],
    instruction: "※ [46~47] 다음을 읽고 물음에 답하십시오.",
    format: "editorial; Q46 필자의 태도, Q47 내용", label: "46~47 · muallif munosabati", weight: 2 },
  { typeKey: "R_48_50_academic", section: "READING", topikRange: "48~50", numbers: [48, 49, 50],
    instruction: "※ [48~50] 다음을 읽고 물음에 답하십시오.",
    format: "academic text; Q48 목적, Q49 blank, Q50 underlined 태도", label: "48~50 · akademik matn", weight: 3 },

  { typeKey: "W_53_chart", section: "WRITING", topikRange: "53", numbers: [53],
    instruction: "※ [53] 다음을 참고하여 200~300자로 글을 쓰십시오. 단, 글의 제목을 쓰지 마십시오. (30점)",
    format: "chart description 200–300자", label: "53 · grafik tavsifi", weight: 1 },
  { typeKey: "W_54_essay", section: "WRITING", topikRange: "54", numbers: [54],
    instruction: "※ [54] 다음을 참고하여 600~700자로 글을 쓰십시오. 단, 문제를 그대로 옮겨 쓰지 마십시오. (50점)",
    format: "argumentative essay 600–700자 with 3 guide questions", label: "54 · esse", weight: 1 },
];

export const typeByKey = new Map(QUESTION_TYPES.map((t) => [t.typeKey, t]));
export const typesOf = (s: SectionKey) => QUESTION_TYPES.filter((t) => t.section === s);
