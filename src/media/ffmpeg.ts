import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

const FFMPEG = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || "ffmpeg";

export function ffmpeg(args: string[], input?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", ...args]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg ${code}: ${Buffer.concat(err)}`))));
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}

export const SAMPLE_RATE = 24000;

/** Any audio container → raw PCM s16le mono 24 kHz. */
export const toPcm = (audio: Buffer) => ffmpeg(["-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", String(SAMPLE_RATE), "pipe:1"], audio);

/** Raw PCM → OGG/Opus (Telegram voice format). */
export const pcmToOgg = (pcm: Buffer) =>
  ffmpeg(["-f", "s16le", "-ar", String(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0", "-c:a", "libopus", "-b:a", "48k", "-application", "voip", "-f", "ogg", "pipe:1"], pcm);

export const silence = (ms: number) => Buffer.alloc(Math.round((SAMPLE_RATE * ms) / 1000) * 2);
