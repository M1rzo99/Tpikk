import { Resvg } from "@resvg/resvg-js";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const FONT_DIR = join(dirname(require.resolve("pretendard/package.json")), "dist/public/static");
const FONTS = ["Regular", "Medium", "SemiBold", "Bold"].map((w) => join(FONT_DIR, `Pretendard-${w}.otf`));

export function svgToPng(svg: string, width: number): Buffer {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Pretendard" },
  });
  return r.render().asPng();
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const PALETTE = {
  ink: "#1F2933",
  sub: "#52606D",
  line: "#D9E2EC",
  bg: "#FFFFFF",
  paper: "#F7F9FB",
  a: "#2F5D8A",   // series 1
  b: "#E0A43A",   // series 2
  c: "#8AA9C6",
  d: "#C8553D",
};
