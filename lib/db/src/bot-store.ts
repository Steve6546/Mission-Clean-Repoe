import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { botProfilesTable } from "./schema";
import { decryptValue, encryptValue } from "./secrets";

/**
 * Hybrid bot-profile store.
 *
 * Primary: PostgreSQL via Drizzle (bot_profiles table).
 * Fallback: a local JSON file (data/bot_profiles.json) used automatically
 * when DATABASE_URL is not provisioned. This guarantees persistence across
 * page refreshes even in local/dev runs without Postgres, and transparently
 * upgrades to Postgres when the DB becomes available.
 */

export type BotProfilePublic = {
  id: string;
  name: string;
  isActive: boolean;
  botInfo: { id: string; username: string; tag?: string; avatarUrl: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type BotProfileInput = {
  name: string;
  botToken: string;
  clientId: string;
  clientSecret: string;
  botInfo: { id: string; username: string; tag?: string; avatarUrl: string | null };
};

type StoredProfile = {
  id: string;
  name: string;
  botTokenEnc: string;
  clientIdEnc: string;
  clientSecretEnc: string;
  isActive: boolean;
  botInfo: BotProfilePublic["botInfo"];
  createdAt: string;
  updatedAt: string;
};

const JSON_PATH = path.resolve(process.cwd(), "data", "bot_profiles.json");

async function readJson(): Promise<StoredProfile[]> {
  try {
    const raw = await fs.readFile(JSON_PATH, "utf8");
    return JSON.parse(raw) as StoredProfile[];
  } catch {
    return [];
  }
}

async function writeJson(rows: StoredProfile[]): Promise<void> {
  await fs.mkdir(path.dirname(JSON_PATH), { recursive: true });
  await fs.writeFile(JSON_PATH, JSON.stringify(rows, null, 2), "utf8");
}

function toPublic(p: StoredProfile): BotProfilePublic {
  return {
    id: p.id,
    name: p.name,
    isActive: p.isActive,
    botInfo: p.botInfo,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** List all bot profiles (no secrets exposed). */
export async function listBotProfiles(): Promise<BotProfilePublic[]> {
  try {
    const rows = await db
      .select()
      .from(botProfilesTable)
      .orderBy(desc(botProfilesTable.updatedAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isActive: r.isActive,
      botInfo: r.botInfo,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch {
    const rows = await readJson();
    return rows.map(toPublic);
  }
}

/** Get the currently active profile (DB-backed or .env-derived). */
export async function getActiveBotProfile(): Promise<BotProfilePublic | null> {
  try {
    const rows = await db
      .select()
      .from(botProfilesTable)
      .where(eq(botProfilesTable.isActive, true))
      .limit(1);
    if (rows[0]) {
      return {
        id: rows[0].id,
        name: rows[0].name,
        isActive: true,
        botInfo: rows[0].botInfo,
        createdAt: rows[0].createdAt.toISOString(),
        updatedAt: rows[0].updatedAt.toISOString(),
      };
    }
  } catch {
    const rows = await readJson();
    const active = rows.find((r) => r.isActive);
    if (active) return toPublic(active);
  }
  return null;
}

/** Resolve decrypted secrets for the active profile, or null if none. */
export async function getActiveBotSecrets(): Promise<{
  botToken: string;
  clientId: string;
  clientSecret: string;
} | null> {
  try {
    const rows = await db
      .select()
      .from(botProfilesTable)
      .where(eq(botProfilesTable.isActive, true))
      .limit(1);
    if (rows[0]) {
      return {
        botToken: decryptValue(rows[0].botTokenEnc),
        clientId: decryptValue(rows[0].clientIdEnc),
        clientSecret: decryptValue(rows[0].clientSecretEnc),
      };
    }
  } catch {
    const rows = await readJson();
    const active = rows.find((r) => r.isActive);
    if (active) {
      return {
        botToken: decryptValue(active.botTokenEnc),
        clientId: decryptValue(active.clientIdEnc),
        clientSecret: decryptValue(active.clientSecretEnc),
      };
    }
  }
  return null;
}

/** Create a new profile (encrypted) and mark it active. */
export async function createBotProfile(input: BotProfileInput): Promise<BotProfilePublic> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const stored: StoredProfile = {
    id,
    name: input.name,
    botTokenEnc: encryptValue(input.botToken),
    clientIdEnc: encryptValue(input.clientId),
    clientSecretEnc: encryptValue(input.clientSecret),
    isActive: false,
    botInfo: input.botInfo,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Deactivate others, then insert the new active one.
    await db.update(botProfilesTable).set({ isActive: false });
    await db.insert(botProfilesTable).values({
      id,
      name: stored.name,
      botTokenEnc: stored.botTokenEnc,
      clientIdEnc: stored.clientIdEnc,
      clientSecretEnc: stored.clientSecretEnc,
      isActive: true,
      botInfo: stored.botInfo,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
    return toPublic(stored);
  } catch {
    const rows = await readJson();
    for (const r of rows) r.isActive = false;
    rows.push({ ...stored, isActive: true });
    await writeJson(rows);
    return toPublic({ ...stored, isActive: true });
  }
}

/** Set a profile as the active one (deactivates the rest). */
export async function activateBotProfile(id: string): Promise<void> {
  try {
    await db.update(botProfilesTable).set({ isActive: false });
    await db
      .update(botProfilesTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(botProfilesTable.id, id));
    return;
  } catch {
    const rows = await readJson();
    for (const r of rows) r.isActive = r.id === id;
    await writeJson(rows);
  }
}

/** Delete a profile by id. */
export async function deleteBotProfile(id: string): Promise<void> {
  try {
    await db.delete(botProfilesTable).where(eq(botProfilesTable.id, id));
    return;
  } catch {
    const rows = await readJson();
    await writeJson(rows.filter((r) => r.id !== id));
  }
}
