import { InlineKeyboard, type Bot, type Context } from "grammy";
import { db, getSettings } from "../db/client.js";
import { env, hasAI } from "../config.js";
import { pickGroup } from "../content/pick.js";
import { typesOf, typeByKey } from "../content/questionTypes.js";
import { dDayLabel } from "../time.js";
import { SEP, esc, typeLabel } from "../ui/templates.js";
import { sendNext, resolveRun } from "./runner.js";
import { sendToday, streakDays } from "./today.js";
import { sendWritingTask } from "./writing.js";

export const COMMANDS = [
  { command: "today", description: "Bugungi to'plam (듣기 · 읽기 · 쓰기)" },
  { command: "practice", description: "Qo'shimcha mashq: savol turini tanlash" },
  { command: "write", description: "쓰기 topshiriq (53 yoki 54)" },
  { command: "stats", description: "Taxminiy ball va zaif turlar" },
  { command: "mistakes", description: "Xatolar daftari" },
  { command: "settings", description: "Vaqt, izoh tili, pauza" },
  { command: "help", description: "Yo'riqnoma" },
];

const HELP = `<b>TOPIK II · 6급 yangilash</b>
${SEP}
Har kuni belgilangan vaqtda bitta to'plam keladi: 🎧 듣기 40–50, 📖 읽기 40–50, ✍️ 쓰기 53/54 va 🔁 takrorlash.

/today — bugungi to'plam va progress
/practice — istalgan tur bo'yicha qo'shimcha mashq
/write — 쓰기 53 yoki 54, darhol baholash bilan
/stats — taxminiy ball (6급 = 230+)
/mistakes — xatolar va ularni qayta ishlash
/settings — yuborish vaqti, izoh tili, pauza

Javob tugmasini bossangiz, natija va izoh shu xabarning o'zida chiqadi. 듣기 audiosini imtihondagidek bir marta qayta eshitish mumkin.`;

export function registerCommands(bot: Bot<Context>) {
  bot.command("start", async (ctx) => {
    await ctx.reply(`안녕하세요! 📅 <b>${dDayLabel()}</b> · ${env.EXAM_DATE.replace(/-/g, ".")}\n\n${HELP}${hasAI ? "" : "\n\n<i>ℹ️ AI kaliti ulanmagan: savollar tayyor bankdan, 쓰기 bahosi taxminiy.</i>"}`, { parse_mode: "HTML" });
    await sendToday(ctx.api, ctx.chat!.id);
  });
  bot.command("help", (ctx) => ctx.reply(HELP, { parse_mode: "HTML" }));
  bot.command("today", (ctx) => sendToday(ctx.api, ctx.chat!.id));

  // /practice → section → type
  bot.command("practice", (ctx) =>
    ctx.reply("🎯 <b>Qo'shimcha mashq</b>\nBo'limni tanlang:", {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("🎧 듣기 40–50", "pr:LISTENING").text("📖 읽기 40–50", "pr:READING"),
    }),
  );
  bot.callbackQuery(/^pr:(LISTENING|READING)$/, async (ctx) => {
    const kb = new InlineKeyboard();
    typesOf(ctx.match[1] as "LISTENING" | "READING").forEach((t, i) => { kb.text(t.label, `pt:${t.typeKey}`); if (i % 2) kb.row(); });
    await ctx.editMessageText(`🎯 <b>Qo'shimcha mashq</b> · ${ctx.match[1] === "LISTENING" ? "🎧 듣기" : "📖 읽기"}\nSavol turini tanlang:`, { parse_mode: "HTML", reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
  bot.callbackQuery(/^pt:(\w+)$/, async (ctx) => {
    const t = typeByKey.get(ctx.match[1]);
    if (!t) return ctx.answerCallbackQuery();
    const groups = t.numbers.length === 1 ? 3 : 2;
    const used = new Set<string>();
    const ids: string[] = [];
    for (let i = 0; i < groups; i++) {
      const g = await pickGroup(t.typeKey, used);
      if (!g) break;
      used.add(g.id);
      ids.push(...g.questions.map((q) => q.id));
    }
    await ctx.answerCallbackQuery();
    if (!ids.length) return ctx.reply("Bu tur uchun savol topilmadi.");
    const s = await db.session.create({ data: { kind: "practice", questionIds: ids } });
    await ctx.editMessageText(`🎯 <b>${esc(t.label)}</b> · ${ids.length} ta savol`, { parse_mode: "HTML" });
    const run = await resolveRun(`p${s.id}`, t.section as "LISTENING" | "READING");
    if (run) await sendNext(ctx.api, ctx.chat!.id, run);
  });

  // /write → 53 | 54
  bot.command("write", (ctx) =>
    ctx.reply("✍️ <b>쓰기</b> · topshiriqni tanlang:", {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("53 · grafik (200–300자)", "wt:W_53_chart").row().text("54 · esse (600–700자)", "wt:W_54_essay"),
    }),
  );
  bot.callbackQuery(/^wt:(W_53_chart|W_54_essay)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const g = await pickGroup(ctx.match[1]);
    if (!g) return ctx.reply("Topshiriq topilmadi.");
    await sendWritingTask(ctx.api, ctx.chat!.id, g.id);
  });

  bot.command("stats", async (ctx) => ctx.reply(await statsText(), { parse_mode: "HTML" }));

  bot.command("mistakes", async (ctx) => {
    const wrong = await db.attempt.findMany({
      where: { isCorrect: false }, orderBy: { createdAt: "desc" }, take: 40,
      include: { question: { select: { id: true, topikNumber: true, typeKey: true, section: true, group: { select: { topic: true } } } } },
    });
    const seen = new Set<string>();
    const items = wrong.filter((w) => w.question && !seen.has(w.question.id) && seen.add(w.question.id)).slice(0, 15);
    if (!items.length) return ctx.reply("Xatolar daftari bo'sh. 👍");
    const lines = items.map((w, i) => `${i + 1}. ${w.question!.section === "LISTENING" ? "🎧" : "📖"} ${w.question!.topikNumber}번 · ${esc(w.question!.group.topic)}`);
    await ctx.reply(`📕 <b>Xatolar daftari</b> (oxirgi ${items.length})\n${SEP}\n${lines.join("\n")}`, {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("🔁 Xatolarni qayta ishlash", "mk"),
    });
  });
  bot.callbackQuery("mk", async (ctx) => {
    await ctx.answerCallbackQuery();
    const wrong = await db.attempt.findMany({ where: { isCorrect: false }, orderBy: { createdAt: "desc" }, take: 40, select: { questionId: true } });
    const ids = [...new Set(wrong.map((w) => w.questionId!).filter(Boolean))].slice(0, 6);
    if (!ids.length) return;
    const s = await db.session.create({ data: { kind: "review", questionIds: ids } });
    const run = await resolveRun(`p${s.id}`, "REVIEW");
    if (run) await sendNext(ctx.api, ctx.chat!.id, run);
  });

  bot.command("settings", async (ctx) => ctx.reply(await settingsText(), { parse_mode: "HTML", reply_markup: settingsKb() }));
  bot.callbackQuery(/^st:(t|r|l|p):?(.*)$/, async (ctx) => {
    const [, k, v] = ctx.match;
    const s = await getSettings();
    const data = k === "t" ? { dailyTime: v } : k === "r" ? { reminderTime: v } : k === "l" ? { explainLang: v } : { paused: !s.paused };
    await db.settings.update({ where: { id: 1 }, data });
    await ctx.editMessageText(await settingsText(), { parse_mode: "HTML", reply_markup: settingsKb() }).catch(() => {});
    await ctx.answerCallbackQuery("Saqlandi");
  });
}

async function settingsText(): Promise<string> {
  const s = await getSettings();
  const lang = { "ko+uz": "해설 + o'zbekcha", ko: "faqat 해설", uz: "faqat o'zbekcha" }[s.explainLang] ?? s.explainLang;
  return `⚙️ <b>Sozlamalar</b>\n${SEP}\n📬 Kunlik to'plam: <b>${s.dailyTime}</b> (${env.TZ_NAME})\n🔔 Eslatma: <b>${s.reminderTime}</b>\n💬 Izoh tili: <b>${lang}</b>\n⏸ Pauza: <b>${s.paused ? "yoqilgan" : "yo'q"}</b>`;
}

function settingsKb() {
  const kb = new InlineKeyboard();
  ["06:00", "07:00", "08:00", "09:00"].forEach((t) => kb.text(`📬 ${t}`, `st:t:${t}`));
  kb.row();
  ["20:00", "21:00", "22:00"].forEach((t) => kb.text(`🔔 ${t}`, `st:r:${t}`));
  kb.row().text("해설+uz", "st:l:ko+uz").text("해설", "st:l:ko").text("uz", "st:l:uz");
  return kb.row().text("⏸ Pauza / ▶️ Davom", "st:p");
}

async function statsText(): Promise<string> {
  const since = new Date(Date.now() - 14 * 86_400_000);
  const rows = await db.attempt.findMany({
    where: { createdAt: { gte: since }, questionId: { not: null } },
    select: { isCorrect: true, question: { select: { section: true, typeKey: true } } },
  });
  const acc = (sec: string) => {
    const r = rows.filter((x) => x.question?.section === sec);
    return r.length ? r.filter((x) => x.isCorrect).length / r.length : null;
  };
  const byType = new Map<string, { n: number; ok: number }>();
  for (const r of rows) {
    const t = r.question!.typeKey;
    const v = byType.get(t) ?? { n: 0, ok: 0 };
    v.n++; if (r.isCorrect) v.ok++;
    byType.set(t, v);
  }
  const weak = [...byType.entries()].filter(([, v]) => v.n >= 2 && v.ok < v.n).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).slice(0, 5);
  const w = async (typeKey: string) => {
    const g = await db.attempt.findMany({ where: { score: { not: null }, groupId: { not: null } }, orderBy: { createdAt: "desc" }, take: 20, select: { score: true, maxScore: true, groupId: true } });
    const ids = (await db.qGroup.findMany({ where: { typeKey }, select: { id: true } })).map((x) => x.id);
    const mine = g.filter((x) => ids.includes(x.groupId!)).slice(0, 3);
    return mine.length ? mine.reduce((a, x) => a + x.score! / x.maxScore!, 0) / mine.length : null;
  };
  const [w53, w54] = [await w("W_53_chart"), await w("W_54_essay")];
  const L = acc("LISTENING"), R = acc("READING");
  const W = w53 !== null || w54 !== null ? ((w53 ?? w54!) * 30 + (w54 ?? w53!) * 50) / 80 : null;
  const est = [L, R, W].every((x) => x !== null) ? Math.round((L! + R! + W!) * 100) : null;
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}`);
  return [
    `📊 <b>Statistika</b> · oxirgi 14 kun`,
    SEP,
    `🎧 듣기   ~<b>${pct(L)}</b> / 100`,
    `📖 읽기   ~<b>${pct(R)}</b> / 100`,
    `✍️ 쓰기   ~<b>${pct(W)}</b> / 100  <i>(53/54 asosida)</i>`,
    est !== null ? `\n<b>Taxminiy: ${est} / 300 · ${est >= 230 ? "6급 ✅" : "6급 uchun"} (${est >= 230 ? "+" : ""}${est - 230})</b>` : "\n<i>Taxminiy ball uchun har bo'limdan natija kerak.</i>",
    weak.length ? `\n<b>Zaif turlar</b>\n${weak.map(([t, v]) => `• ${esc(typeLabel(t))} — ${v.ok}/${v.n}`).join("\n")}` : "",
    `\n🔥 Streak: ${await streakDays()} kun`,
  ].filter(Boolean).join("\n");
}
