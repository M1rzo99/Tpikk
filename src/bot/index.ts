import { Bot, GrammyError, type Context } from "grammy";
import { env } from "../config.js";
import { db, getSettings } from "../db/client.js";
import { COMMANDS, registerCommands } from "./commands.js";
import { answer, replay, resolveRun, sendNext, showScript } from "./runner.js";
import { openSection, startSequence } from "./sequence.js";
import { getOrCreateToday, type SectionRun } from "../daily/dailySet.js";
import { cancelWriting, clearWriting, finishWriting, onWritingText, sendWritingTask, showCorrected, showModel, startWriting } from "./writing.js";

export async function ownerId(): Promise<number | null> {
  if (env.OWNER_TELEGRAM_ID) return env.OWNER_TELEGRAM_ID;
  const s = await getSettings();
  return s.ownerId ? Number(s.ownerId) : null;
}

export function createBot() {
  const bot = new Bot<Context>(env.BOT_TOKEN);

  // Owner guard: the bot serves exactly one person.
  bot.use(async (ctx, next) => {
    const uid = ctx.from?.id;
    if (!uid) return;
    let owner = await ownerId();
    if (!owner && ctx.message?.text?.startsWith("/start")) {
      await db.settings.update({ where: { id: 1 }, data: { ownerId: String(uid) } });
      console.log(`[owner] claimed by ${uid}; set OWNER_TELEGRAM_ID=${uid} to pin it`);
      owner = uid;
    }
    if (uid !== owner) {
      if (ctx.chat?.type === "private") await ctx.reply(`Bu shaxsiy bot. (ID: ${uid})`).catch(() => {});
      return;
    }
    return next();
  });

  registerCommands(bot);

  const chat = (ctx: Context) => ctx.chat!.id;

  bot.callbackQuery(/^a:(\w+):(\d):(\w+)$/, async (ctx) => {
    const [, qid, i, run] = ctx.match;
    const msg = await answer(ctx.api, chat(ctx), ctx.callbackQuery.message!.message_id, qid, Number(i), run);
    await ctx.answerCallbackQuery(msg);
  });
  bot.callbackQuery(/^n:(\w+):(LISTENING|READING|REVIEW)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup().catch(() => {});
    const run = await resolveRun(ctx.match[1], ctx.match[2] as SectionRun);
    if (run) await sendNext(ctx.api, chat(ctx), run);
  });
  bot.callbackQuery(/^rp:(\w+):(\w+)$/, async (ctx) => ctx.answerCallbackQuery(await replay(ctx.api, chat(ctx), ctx.match[1], ctx.match[2])));
  bot.callbackQuery(/^sc:([\w-]+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showScript(ctx.api, chat(ctx), ctx.match[1]); });

  bot.callbackQuery(/^o:(LISTENING|READING|WRITING|REVIEW)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const set = await getOrCreateToday();
    await openSection(ctx.api, chat(ctx), set.id, ctx.match[1] as SectionRun | "WRITING");
  });
  bot.callbackQuery("all", async (ctx) => {
    await ctx.answerCallbackQuery("▶️ 듣기 → 쓰기 → 읽기");
    const set = await getOrCreateToday();
    await startSequence(ctx.api, chat(ctx), set.id);
  });

  bot.callbackQuery(/^ws:([\w-]+)$/, async (ctx) => { await ctx.answerCallbackQuery("⏱ Boshlandi"); await startWriting(ctx.api, chat(ctx), ctx.match[1]); });
  bot.callbackQuery("wd", async (ctx) => {
    const st = await db.writingState.findUnique({ where: { id: 1 } });
    if (!st?.active || !st.buffer.trim()) return ctx.answerCallbackQuery({ text: st?.active ? "Avval matn yuboring" : "Faol yozish yo'q", show_alert: true });
    await ctx.answerCallbackQuery("⏳");
    await finishWriting(ctx.api, chat(ctx));
  });
  bot.callbackQuery("wc", async (ctx) => { await ctx.answerCallbackQuery("Tozalandi"); await clearWriting(ctx.api, chat(ctx)); });
  bot.callbackQuery("wx", async (ctx) => { await ctx.answerCallbackQuery(); await cancelWriting(ctx.api, chat(ctx)); });
  bot.callbackQuery(/^wf:(\w+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showCorrected(ctx.api, chat(ctx), ctx.match[1]); });
  bot.callbackQuery(/^wm:(\w+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showModel(ctx.api, chat(ctx), ctx.match[1]); });
  bot.callbackQuery(/^wr:([\w-]+)$/, async (ctx) => { await ctx.answerCallbackQuery("🔄"); await sendWritingTask(ctx.api, chat(ctx), ctx.match[1]); });

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    const used = await onWritingText(ctx.api, chat(ctx), ctx.message.message_id, ctx.message.text);
    if (!used) await ctx.reply("Bugungi to'plam: /today · Yozish uchun: /write");
  });

  bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError && /message is not modified|query is too old/.test(e.description)) return;
    console.error("[bot]", e);
    err.ctx.reply("⚠️ Kutilmagan xato yuz berdi. Qayta urinib ko'ring yoki /today.").catch(() => {});
  });

  return bot;
}

export async function setCommands(bot: Bot<Context>) {
  await bot.api.setMyCommands(COMMANDS);
}
