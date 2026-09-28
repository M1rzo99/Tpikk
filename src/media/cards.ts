import { env } from "../config.js";
import { daysUntilExam } from "../time.js";
import { PALETTE as P, esc, svgToPng } from "./render.js";

/** Morning D-day card: D-21 · 2026.10.18 · Maqsad 230+ */
export function renderDdayCard(opts: { date: string; done?: number; total?: number }): Buffer {
  const n = daysUntilExam();
  const big = n > 0 ? `D-${n}` : n === 0 ? "D-DAY" : `D+${-n}`;
  const exam = env.EXAM_DATE.replace(/-/g, ".");
  const W = 1200, H = 520;
  const pct = Math.max(0, Math.min(1, 1 - n / 30));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16324F"/><stop offset="1" stop-color="#2F5D8A"/></linearGradient></defs>
<rect width="${W}" height="${H}" rx="0" fill="url(#g)"/>
<text x="80" y="110" font-size="30" font-weight="500" fill="#BCCCDC" letter-spacing="4">TOPIK II · 한국어능력시험</text>
<text x="72" y="290" font-size="190" font-weight="700" fill="#FFFFFF">${esc(big)}</text>
<text x="80" y="370" font-size="36" font-weight="500" fill="#FFFFFF">${exam} · 목표 6급 (230+)</text>
<rect x="80" y="420" width="1040" height="14" rx="7" fill="#FFFFFF" fill-opacity="0.18"/>
<rect x="80" y="420" width="${Math.round(1040 * pct)}" height="14" rx="7" fill="${P.b}"/>
<text x="1120" y="110" font-size="28" fill="#BCCCDC" text-anchor="end">${esc(opts.date)}</text>
</svg>`;
  return svgToPng(svg, W);
}
