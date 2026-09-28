import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AnyGroup, SeedFile } from "./schemas.js";
import { saveGroup } from "./store.js";
import { db } from "../db/client.js";

const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../content/seed");

export async function loadSeeds(dir = SEED_DIR): Promise<{ added: number; skipped: number; errors: string[] }> {
  let added = 0, skipped = 0;
  const errors: string[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const file = SeedFile.parse(JSON.parse(readFileSync(join(dir, f), "utf8")));
    for (const raw of file.groups) {
      const r = AnyGroup.safeParse(raw);
      if (!r.success) { errors.push(`${f}:${raw?.id}: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`); continue; }
      const before = await db.qGroup.count({ where: { id: r.data.id } });
      await saveGroup(r.data, "seed");
      before ? skipped++ : added++;
    }
  }
  return { added, skipped, errors };
}

// CLI: npm run seed
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  loadSeeds().then((r) => { console.log(r); return db.$disconnect(); });
}
