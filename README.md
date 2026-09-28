# TOPIK II Daily Bot

Faqat eng qiyin qism: **듣기 40–50, 읽기 40–50, 쓰기 53–54**. Har kuni bitta to'plam (🎧 + 📖 + ✍️ + 🔁), javoblar darhol tekshiriladi, 쓰기 real vaqtda yoziladi va baholanadi. Spetsifikatsiya: `../CLAUDE.md`.

## Savollar banki (`content/seed/`)
| Fayl | Tarkib |
|---|---|
| `listening_a.json` | 39~40 ×6, 41~42 ×6, 43~44 ×6 (30 savol) |
| `listening_b.json` | 45~46 ×6, 47~48 ×6, 49~50 ×6 (36 savol) |
| `reading_a.json` | 40 ×8, 41 ×8, 42~43 ×6, 44~45 ×6 (40 savol) |
| `reading_b.json` | 46~47 ×8, 48~50 ×8 (40 savol) |
| `writing.json` | 53 ×10 (grafik), 54 ×12 (esse), namuna javoblar bilan |
| `writing_rubric.md` | Rasmiy 채점 기준 (NIIED) va manbalar |

Hammasi original: rasmiy format va uslub taqlid qilingan, o'tgan yillar matnlari ko'chirilmagan (CLAUDE.md §5). Manbalar har bir fayldagi `sources` maydonida. `ANTHROPIC_API_KEY` bo'lsa, bot har kecha 02:00 da har bir tur bo'yicha zaxirani to'ldiradi (generatsiya → mustaqil validatsiya → bank).

## Muhit o'zgaruvchilari
| Nom | Majburiy | Izoh |
|---|---|---|
| `BOT_TOKEN` | ha | @BotFather dan |
| `DATABASE_URL` | ha | PostgreSQL |
| `OWNER_TELEGRAM_ID` | tavsiya | Bo'sh bo'lsa, birinchi `/start` bosgan odam egasi bo'ladi |
| `ANTHROPIC_API_KEY` | tavsiya | 쓰기 ni haqiqiy baholash + yangi savollar. Yo'q bo'lsa: bankdagi savollar va taxminiy baho |
| `ANTHROPIC_WORKSPACE_ID` | yo'q | Faqat kalit workspace'ga bog'lanmagan bo'lsa |
| `GOOGLE_APPLICATION_CREDENTIALS` | yo'q | Google TTS. Yo'q bo'lsa bepul Microsoft Edge ovozlari (SunHi / InJoon) |
| `TZ_NAME` | yo'q | `Asia/Seoul` (Toshkent uchun `Asia/Tashkent`) |
| `EXAM_DATE` | yo'q | `2026-10-18` |

## Ishga tushirish
**Railway:** GitHub repodan deploy → PostgreSQL plugin qo'shing → Variables ga yuqoridagilarni kiriting. Dockerfile avtomatik ishlatiladi.

**VPS (Docker):**
```bash
cp .env.example .env   # BOT_TOKEN va boshqalarni to'ldiring
docker compose up -d --build
```

**Lokal:**
```bash
npm install
npx prisma db push
npm run dev
```
Bot ishga tushganda bankni bazaga o'zi yuklaydi (`npm run seed` ham bor).

## Tuzilma
`src/bot` (buyruqlar, savol oqimi, 쓰기 maydoni) · `src/content` (turlar, generatsiya, validatsiya, promptlar) · `src/grading` (rubrika, baholash) · `src/media` (TTS → OGG, 53 grafiklari, D-day kartochka) · `src/daily` (kunlik to'plam) · `src/scheduler` (08:00 / 21:00 / 02:00) · `src/srs` (Leitner).

Spetsifikatsiyadan farqlar: rasmlar `satori` o'rniga to'g'ridan-to'g'ri SVG + resvg bilan chiziladi (native bog'liqliksiz); 쓰기 oqimi `conversations` plagini o'rniga bazada saqlanadigan holat bilan ishlaydi (qayta ishga tushsa ham yo'qolmaydi); bitta audio/matnga tegishli savollar `QGroup` jadvalida guruhlangan.
