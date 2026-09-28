import type { ChartDataT } from "../content/schemas.js";
import { PALETTE as P, esc, svgToPng } from "./render.js";

const W = 1200, H = 720;
const SERIES = [P.a, P.b, P.c, P.d];

const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(1));

function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v * 1.1) ?? v * 1.2;
}

function axes(x0: number, y0: number, w: number, h: number, max: number, unit: string): string {
  let s = "";
  for (let i = 0; i <= 4; i++) {
    const y = y0 + h - (h * i) / 4;
    s += `<line x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}" stroke="${P.line}" stroke-width="${i === 0 ? 2 : 1}"/>`;
    s += `<text x="${x0 - 12}" y="${y + 6}" font-size="17" fill="${P.sub}" text-anchor="end">${fmt((max * i) / 4)}</text>`;
  }
  if (unit) s += `<text x="${x0 - 12}" y="${y0 - 16}" font-size="16" fill="${P.sub}" text-anchor="end">(${esc(unit)})</text>`;
  return s;
}

function bar(c: ChartDataT["chart"], x0: number, y0: number, w: number, h: number): string {
  const max = niceMax(Math.max(...c.series.flatMap((s) => s.values)));
  let s = axes(x0, y0, w, h, max, c.unit);
  const slot = w / c.labels.length;
  const bw = Math.min(70, (slot * 0.7) / c.series.length);
  c.labels.forEach((label, i) => {
    const cx = x0 + slot * i + slot / 2;
    c.series.forEach((ser, k) => {
      const v = ser.values[i] ?? 0;
      const bh = (h * v) / max;
      const x = cx - (bw * c.series.length) / 2 + k * bw;
      s += `<rect x="${x + 3}" y="${y0 + h - bh}" width="${bw - 6}" height="${bh}" rx="4" fill="${SERIES[k]}"/>`;
      s += `<text x="${x + bw / 2}" y="${y0 + h - bh - 10}" font-size="18" font-weight="600" fill="${P.ink}" text-anchor="middle">${fmt(v)}</text>`;
    });
    s += `<text x="${cx}" y="${y0 + h + 32}" font-size="19" fill="${P.ink}" text-anchor="middle">${esc(label)}</text>`;
  });
  return s;
}

function line(c: ChartDataT["chart"], x0: number, y0: number, w: number, h: number): string {
  const max = niceMax(Math.max(...c.series.flatMap((s) => s.values)));
  let s = axes(x0, y0, w, h, max, c.unit);
  const step = w / c.labels.length;
  c.labels.forEach((label, i) => {
    s += `<text x="${x0 + step * i + step / 2}" y="${y0 + h + 32}" font-size="19" fill="${P.ink}" text-anchor="middle">${esc(label)}</text>`;
  });
  c.series.forEach((ser, k) => {
    const pts = ser.values.map((v, i) => [x0 + step * i + step / 2, y0 + h - (h * v) / max]);
    s += `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${SERIES[k]}" stroke-width="4" stroke-linejoin="round"/>`;
    pts.forEach(([x, y], i) => {
      s += `<circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="${SERIES[k]}" stroke-width="4"/>`;
      s += `<text x="${x}" y="${y - (k === 0 ? 16 : -30)}" font-size="18" font-weight="600" fill="${P.ink}" text-anchor="middle">${fmt(ser.values[i])}</text>`;
    });
  });
  return s;
}

function pie(c: ChartDataT["chart"], x0: number, y0: number, w: number, h: number): string {
  const vals = c.series[0].values;
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const r = Math.min(w, h) / 2 - 70, cx = x0 + w / 2, cy = y0 + h / 2;
  const colors = [P.a, P.b, P.c, P.d, "#6C8F5B", "#9B7EBD"];
  let a0 = -Math.PI / 2, s = "";
  vals.forEach((v, i) => {
    const a1 = a0 + (2 * Math.PI * v) / total;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, rr = r) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    s += `<path d="M${cx},${cy} L${p(a0)} A${r},${r} 0 ${large} 1 ${p(a1)} Z" fill="${colors[i % colors.length]}" stroke="#fff" stroke-width="3"/>`;
    const mid = (a0 + a1) / 2;
    // Small slices get their label outside the pie so it is never clipped.
    const outside = v / total < 0.15;
    const [lx, ly] = p(mid, outside ? r + 34 : r * 0.62).split(",").map(Number);
    const anchor = outside ? (Math.cos(mid) >= 0 ? "start" : "end") : "middle";
    const color = outside ? P.ink : "#fff";
    if (outside) s += `<line x1="${p(mid, r * 0.92).split(",")[0]}" y1="${p(mid, r * 0.92).split(",")[1]}" x2="${p(mid, r + 20).split(",")[0]}" y2="${p(mid, r + 20).split(",")[1]}" stroke="${P.sub}" stroke-width="1.5"/>`;
    s += `<text x="${lx}" y="${ly - 4}" font-size="18" font-weight="600" fill="${color}" text-anchor="${anchor}">${esc(c.labels[i])}</text>`;
    s += `<text x="${lx}" y="${ly + 20}" font-size="18" fill="${color}" text-anchor="${anchor}">${fmt(v)}${esc(c.unit)}</text>`;
    a0 = a1;
  });
  return s;
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if ((cur + " " + word).trim().length > max) { if (cur) out.push(cur); cur = word; } else cur = (cur + " " + word).trim();
  }
  if (cur) out.push(cur);
  return out;
}

/** 53번 자료: title, source, chart on the left, 원인/전망 boxes on the right. */
export function renderChart(d: ChartDataT): Buffer {
  const hasNotes = d.notes.length > 0;
  const cw = hasNotes ? 700 : 1080;
  let body = "";
  const c = d.chart;
  const area = { x: 110, y: 170, w: cw - 130, h: 430 };
  body += c.type === "bar" ? bar(c, area.x, area.y, area.w, area.h) : c.type === "line" ? line(c, area.x, area.y, area.w, area.h) : pie(c, 60, 150, cw - 60, 500);

  // legend
  if (c.series.length > 1 || c.type !== "pie") {
    c.series.forEach((ser, k) => {
      const lx = 110 + k * 170;
      body += `<rect x="${lx}" y="118" width="18" height="18" rx="3" fill="${SERIES[k]}"/><text x="${lx + 28}" y="133" font-size="18" fill="${P.ink}">${esc(ser.name)}</text>`;
    });
  }

  // notes
  let ny = 150;
  for (const n of d.notes) {
    const lines = n.items.flatMap((it) => wrap(it, 19).map((l, j) => (j ? `   ${l}` : `· ${l}`)));
    const bh = 60 + lines.length * 32;
    body += `<rect x="790" y="${ny}" width="370" height="${bh}" rx="14" fill="${P.paper}" stroke="${P.line}"/>`;
    body += `<text x="815" y="${ny + 38}" font-size="21" font-weight="700" fill="${P.a}">${esc(n.heading)}</text>`;
    lines.forEach((l, i) => { body += `<text x="815" y="${ny + 76 + i * 32}" font-size="19" fill="${P.ink}">${esc(l)}</text>`; });
    ny += bh + 22;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${P.bg}"/>
<rect x="0" y="0" width="${W}" height="8" fill="${P.a}"/>
<text x="60" y="70" font-size="30" font-weight="700" fill="${P.ink}">${esc(d.title)}</text>
${d.surveyBy ? `<text x="${W - 50}" y="70" font-size="18" fill="${P.sub}" text-anchor="end">조사 기관: ${esc(d.surveyBy)}</text>` : ""}
${body}
<text x="${W - 50}" y="${H - 24}" font-size="15" fill="${P.sub}" text-anchor="end">TOPIK II 쓰기 53 · 가상 자료</text>
</svg>`;
  return svgToPng(svg, W);
}
