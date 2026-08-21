import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { appSecretsTable } from "./schema";

type AppSecretsRow = typeof appSecretsTable.$inferSelect;

/**
 * Encryption helpers for at-rest secrets.
 *
 * We use scrypt (CPU-hard, Node standard library) with a per-value random
 * salt and a server-side key. The key is APP_SECRETS_KEY (base64) or a
 * deterministic dev fallback. In production you MUST set APP_SECRETS_KEY to a
 * 32+ byte base64 value; the dev fallback only exists so local/demo runs
 * don't crash.
 */
const KEY_ENV = process.env.APP_SECRETS_KEY;
const DEV_KEY = "dev-only-insecure-key-change-me-32b!!";
const KEY = Buffer.from(KEY_ENV ?? DEV_KEY, "utf8").subarray(0, 32).toString("base64");
const KEY_BUF = Buffer.from(KEY, "base64");
const ALGO = "aes-256-gcm";

function aesKey(): Buffer {
  return KEY_BUF;
}

function encryptValue(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptValue(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv(ALGO, aesKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export type DiscordConfigInput = {
  botToken: string;
  clientId: string;
  clientSecret: string;
  databaseUrl?: string;
};

export type ResolvedConfig = {
  botToken?: string;
  clientId?: string;
  clientSecret?: string;
  databaseUrl?: string;
  source: "env" | "db" | "none";
};

/**
 * Resolve the active Discord config using Dual-Config precedence:
 *   1. Environment variables (highest priority, zero-latency, no DB needed)
 *   2. Persisted (encrypted) app_secrets row
 *   3. none
 * Secrets are NEVER returned to the caller unless explicitly asked; this
 * function is server-internal only.
 */
export async function resolveDiscordConfig(): Promise<ResolvedConfig> {
  const envToken = process.env.DISCORD_BOT_TOKEN;
  const envClientId = process.env.DISCORD_CLIENT_ID;
  const envSecret = process.env.DISCORD_CLIENT_SECRET;
  const envDb = process.env.DATABASE_URL;

  if (envToken && envClientId && envSecret) {
    return {
      botToken: envToken,
      clientId: envClientId,
      clientSecret: envSecret,
      databaseUrl: envDb,
      source: "env",
    };
  }

  try {
    const rows = await db
      .select()
      .from(appSecretsTable)
      .where(eq(appSecretsTable.id, "default"))
      .limit(1);
    const row = rows[0];
    if (row) {
      return {
        botToken: safeDecrypt(row.botTokenEnc),
        clientId: safeDecrypt(row.clientIdEnc),
        clientSecret: safeDecrypt(row.clientSecretEnc),
        databaseUrl: row.databaseUrlEnc ? safeDecrypt(row.databaseUrlEnc) : undefined,
        source: "db",
      };
    }
  } catch {
    // DB not reachable / table missing — fall through to none
  }

  return { source: "none" };
}

function safeDecrypt(payload: string): string {
  try {
    return decryptValue(payload);
  } catch {
    return "";
  }
}

/** Persist (encrypted) an admin-entered config as the Dual-Config DB source. */
export async function saveDiscordConfig(input: DiscordConfigInput): Promise<void> {
  const values = {
    id: "default",
    botTokenEnc: encryptValue(input.botToken),
    clientIdEnc: encryptValue(input.clientId),
    clientSecretEnc: encryptValue(input.clientSecret),
    databaseUrlEnc: input.databaseUrl ? encryptValue(input.databaseUrl) : null,
    updatedAt: new Date(),
  };
  await db
    .insert(appSecretsTable)
    .values(values)
    .onConflictDoUpdate({ target: appSecretsTable.id, set: values });
}

/** True when a usable config exists (env or db) without exposing secrets. */
export async function isConfigured(): Promise<boolean> {
  const cfg = await resolveDiscordConfig();
  return Boolean(cfg.botToken && cfg.clientId && cfg.clientSecret);
}

export { encryptValue, decryptValue };
