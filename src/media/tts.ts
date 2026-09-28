import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "../config.js";
import type { ScriptLineT } from "../content/schemas.js";
import { pcmToOgg, silence, toPcm } from "./ffmpeg.js";

// Two clearly different Korean voices per engine, like the real exam (남/여 성우).
const GOOGLE_VOICES = { F: "ko-KR-Neural2-A", M: "ko-KR-Neural2-C" } as const;
const EDGE_VOICES = { F: "ko-KR-SunHiNeural", M: "ko-KR-InJoonNeural" } as const;

async function googleSegment(text: string, speaker: "M" | "F"): Promise<Buffer> {
  const { TextToSpeechClient } = await import("@google-cloud/text-to-speech");
  const client = new TextToSpeechClient();
  const [res] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode: "ko-KR", name: GOOGLE_VOICES[speaker] },
    audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000, speakingRate: 1.0 },
  });
  return toPcm(Buffer.from(res.audioContent as Uint8Array));
}

async function edgeSegment(text: string, speaker: "M" | "F"): Promise<Buffer> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
  const tts = new MsEdgeTTS();
  await tts.setMetadata(EDGE_VOICES[speaker], OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (d: Buffer) => chunks.push(d));
    audioStream.on("end", () => resolve());
    audioStream.on("close", () => resolve());
    audioStream.on("error", reject);
  });
  tts.close();
  if (!chunks.length) throw new Error("edge tts returned no audio");
  return toPcm(Buffer.concat(chunks));
}

/** Split long turns at sentence ends so each TTS request stays small. */
function sentences(text: string): string[] {
  return text.match(/[^.?!。]+[.?!。]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

/**
 * Script → OGG/Opus voice file. Voices alternate by speaker, 500 ms pause between
 * turns, 250 ms between sentences. Returns the file path (cached on disk).
 */
export async function renderScript(groupId: string, script: ScriptLineT[]): Promise<string> {
  const dir = join(env.ASSETS_DIR, "audio");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${groupId}.ogg`);
  if (existsSync(path)) return path;
  const engine = env.GOOGLE_APPLICATION_CREDENTIALS ? googleSegment : edgeSegment;
  const parts: Buffer[] = [silence(400)];
  for (const line of script) {
    for (const s of sentences(line.text)) {
      parts.push(await withRetry(() => engine(s, line.speaker)), silence(250));
    }
    parts.push(silence(500));
  }
  writeFileSync(path, await pcmToOgg(Buffer.concat(parts)));
  return path;
}

async function withRetry<T>(fn: () => Promise<T>, n = 3): Promise<T> {
  let err: unknown;
  for (let i = 0; i < n; i++) {
    try { return await fn(); } catch (e) { err = e; await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
  throw err;
}
