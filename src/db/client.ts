import "../config.js";
import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient();

export async function getSettings() {
  return db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}
