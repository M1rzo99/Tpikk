// Official TOPIK II 쓰기 scoring categories (NIIED, 「TOPIK Ⅱ 쓰기 답안 작성 방법」).
export const RUBRIC = {
  W_53_chart: {
    max: 30, min: 200, maxChars: 300,
    parts: [
      { key: "content", name: "내용 및 과제 수행", max: 7, desc: "자료의 내용을 빠짐없이 정확하게 기술했는가 (조사 개요, 수치 비교, 원인·전망 등)" },
      { key: "structure", name: "글의 전개 구조", max: 7, desc: "도입-전개-마무리가 자연스럽고 담화 표지를 적절히 사용했는가" },
      { key: "language", name: "언어 사용", max: 16, desc: "문법·어휘를 다양하고 정확하게 사용했는가, 문어체(-다)로 썼는가, 맞춤법" },
    ],
  },
  W_54_essay: {
    max: 50, min: 600, maxChars: 700,
    parts: [
      { key: "content", name: "내용 및 과제 수행", max: 12, desc: "세 가지 과제를 모두 수행했는가, 주제에 맞고 내용이 풍부한가" },
      { key: "structure", name: "글의 전개 구조", max: 12, desc: "서론·본론·결론 구성, 단락 구분, 논리적 연결과 담화 표지" },
      { key: "language", name: "언어 사용", max: 26, desc: "고급 문법·어휘의 다양성과 정확성, 문어체, 맞춤법·띄어쓰기" },
    ],
  },
} as const;

export type WritingKey = keyof typeof RUBRIC;

/** Character count close to 원고지 counting: spaces count, line breaks do not. */
export function countChars(text: string): number {
  return text.replace(/\r?\n/g, "").trim().length;
}

const COLLOQUIAL: [RegExp, string][] = [
  [/[가-힣](?:아|어|여|해)요[.?!\s]/g, "-아/어요 (구어체 존댓말)"],
  [/[가-힣](?:습|ㅂ)니다[.?!\s]|[가-힣]니다[.?!\s]/g, "-(스)ㅂ니다 (쓰기에서는 -다 사용)"],
  [/근데|그런데요|그래서요/g, "근데 / -요 연결 (구어)"],
  [/되게|엄청|진짜|너무너무/g, "구어 부사 (되게/엄청/진짜)"],
  [/거(?:예요|야|든)/g, "-거예요/-거든 (구어)"],
  [/[가-힣]+(?:잖아|는데요)/g, "-잖아/-는데요 (구어)"],
];

export function findColloquial(text: string): string[] {
  const hits = new Set<string>();
  for (const [re, label] of COLLOQUIAL) {
    const m = text.match(re);
    if (m) hits.add(`${label}: «${m[0].trim()}»`);
  }
  return [...hits];
}
