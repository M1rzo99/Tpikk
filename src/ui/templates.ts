import type { QGroup, Question } from "@prisma/client";
import { typeByKey } from "../content/questionTypes.js";

export const SEP = "━━━━━━━━━━━━";
export const CIRCLED = ["①", "②", "③", "④"];
export const ICON = { LISTENING: "🎧", READING: "📖", WRITING: "✍️", stats: "📊", review: "🔁" } as const;
export const NAME = { LISTENING: "듣기", READING: "읽기", WRITING: "쓰기" } as const;

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Escape everything except the <u>…</u> underline used in 읽기 passages. */
export const richText = (s: string) => esc(s).replace(/&lt;u&gt;/g, "<u>").replace(/&lt;\/u&gt;/g, "</u>");

export function bar(done: number, total: number, cells = 5): string {
  if (total <= 0) return "";
  const filled = Math.round((done / total) * cells);
  return `${"▰".repeat(filled)}${"▱".repeat(cells - filled)} ${done}/${total}`;
}

export function header(section: keyof typeof NAME, label: string, done?: number, total?: number, tag?: string): string {
  const p = total ? ` · ${bar(done ?? 0, total)}` : "";
  return `${tag ? `${tag} ` : ""}${ICON[section]} <b>${NAME[section]}</b> · ${label}${p}`;
}

export type Lang = "ko+uz" | "uz" | "ko";

export function passageMessage(g: QGroup, done: number, total: number, tag?: string): string {
  const range = g.topikRange.includes("~") ? `${g.topikRange}번` : `${g.topikRange}번`;
  let s = `${header("READING", range, done, total, tag)}\n${SEP}\n<i>${esc(g.instruction)}</i>\n\n${richText(g.passage ?? "")}`;
  if (g.givenSentence) s += `\n\n<b>&lt;보기&gt;</b>\n<blockquote>${esc(g.givenSentence)}</blockquote>`;
  return s;
}

export function questionMessage(q: Question, g: QGroup, done: number, total: number, opts: { tag?: string; result?: { chosen: number; lang: Lang } } = {}): string {
  const section = q.section as "LISTENING" | "READING";
  const options = q.options as string[];
  let s = `${header(section, `${q.topikNumber}번`, done, total, opts.tag)}\n${SEP}\n<b>${q.topikNumber}.</b> ${esc(q.stem)}\n\n`;
  s += options
    .map((o, i) => {
      let mark = CIRCLED[i];
      if (opts.result) {
        if (i === q.answerIndex) mark = `✅${CIRCLED[i]}`;
        else if (i === opts.result.chosen) mark = `❌${CIRCLED[i]}`;
      }
      const line = `${mark} ${esc(o)}`;
      return opts.result && i === q.answerIndex ? `<b>${line}</b>` : line;
    })
    .join("\n");
  if (opts.result) s += `\n${SEP}\n${resultBlock(q, g, opts.result.chosen, opts.result.lang)}`;
  return s;
}

export function resultBlock(q: Question, g: QGroup, chosen: number, lang: Lang): string {
  const ok = chosen === q.answerIndex;
  const ex = q.explanation as { ko: string; uz: string };
  const keys = (g.keyExpressions as string[]) ?? [];
  const head = ok ? `✅ <b>정답 ${CIRCLED[q.answerIndex]}</b>   (siz: ${CIRCLED[chosen]})` : `❌ <b>정답 ${CIRCLED[q.answerIndex]}</b>   (siz: ${CIRCLED[chosen]})`;
  const parts: string[] = [];
  if (lang !== "uz") parts.push(`<b>해설</b>  ${esc(ex.ko)}`);
  if (lang !== "ko") parts.push(`<b>Izoh</b>  ${esc(ex.uz)}`);
  if (keys.length) parts.push(`<b>Asosiy ifodalar:</b> ${keys.map(esc).join(" · ")}`);
  return `${head}\n<blockquote expandable>${parts.join("\n\n")}</blockquote>`;
}

export function listeningCaption(g: QGroup, done: number, total: number, tag?: string): string {
  return `${header("LISTENING", `${g.topikRange}번`, done, total, tag)}\n<i>${esc(g.instruction)}</i>`;
}

export function scriptMessage(g: QGroup): string {
  const script = (g.script as { speaker: "M" | "F"; text: string }[]) ?? [];
  const lines = script.map((l) => `<b>${l.speaker === "F" ? "여자" : "남자"}:</b> ${esc(l.text)}`).join("\n\n");
  return `📜 <b>스크립트</b> · ${g.topikRange}번 · <i>${esc(g.topic)}</i>\n${SEP}\n<blockquote expandable>${lines}</blockquote>`;
}

export function typeLabel(typeKey: string): string {
  return typeByKey.get(typeKey)?.label ?? typeKey;
}
