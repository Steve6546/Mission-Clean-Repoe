/**
 * Discord verification helpers (Discord API v10).
 *
 * Used by POST /api/discord/verify-config to validate admin-entered secrets
 * against the live Discord REST API before they are persisted (Dual-Config
 * method 2). We never return raw secrets to the client — only a boolean
 * success flag plus the bot's PUBLIC identity (id / tag).
 *
 * References:
 *  - https://discord.com/developers/docs/reference (v10 base path)
 *  - https://discord.com/developers/docs/topics/oauth2 (client credentials)
 */
const DISCORD_API = "https://discord.com/api/v10";

export type VerifyResult = {
  ok: boolean;
  botUser?: { id: string; tag: string; username: string };
  checks: {
    botToken: "ok" | "invalid" | "error";
    clientCredentials: "ok" | "invalid" | "error" | "skipped";
  };
  message: string;
};

async function discordFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/**
 * Validate a bot token + client credentials set against Discord.
 *
 * 1. Bot token: GET /users/@me with Authorization: Bot <token>.
 *    A 200 means the token is a valid bot token.
 * 2. Client credentials: POST /oauth2/token (client_credentials grant).
 *    A 200 means client_id + client_secret are valid.
 */
export async function verifyDiscordCredentials(input: {
  botToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<VerifyResult> {
  const result: VerifyResult = {
    ok: false,
    checks: { botToken: "error", clientCredentials: "skipped" },
    message: "",
  };

  // --- 1. Bot token ---
  let botUser: { id: string; username: string; discriminator?: string } | null = null;
  try {
    const meRes = await discordFetch("/users/@me", {
      headers: { Authorization: `Bot ${input.botToken}` },
    });
    if (meRes.ok) {
      const me = (await meRes.json()) as {
        id: string;
        username: string;
        discriminator?: string;
      };
      botUser = me;
      result.checks.botToken = "ok";
    } else if (meRes.status === 401) {
      result.checks.botToken = "invalid";
    } else {
      result.checks.botToken = "error";
    }
  } catch {
    result.checks.botToken = "error";
  }

  // --- 2. Client credentials ---
  try {
    const tokenRes = await discordFetch("/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: input.clientId,
        client_secret: input.clientSecret,
        scope: "identify",
      }),
    });
    if (tokenRes.ok) {
      result.checks.clientCredentials = "ok";
    } else if (tokenRes.status === 401) {
      result.checks.clientCredentials = "invalid";
    } else {
      result.checks.clientCredentials = "error";
    }
  } catch {
    result.checks.clientCredentials = "error";
  }

  // --- Compose a clear, convincing message ---
  if (result.checks.botToken !== "ok") {
    if (result.checks.botToken === "invalid") {
      result.message = "توكن البوت غير صالح (401). تأكد أنه Bot Token صحيح وغير منتهٍ.";
    } else {
      result.message = "تعذر الاتصال بـ Discord للتحقق من توكن البوت (مشكلة شبكة).";
    }
    return result;
  }

  if (result.checks.clientCredentials === "invalid") {
    result.message = "معرّف التطبيق (Client ID) أو السر (Client Secret) غير صحيح.";
    return result;
  }
  if (result.checks.clientCredentials === "error") {
    result.message = "التوكن صالح، لكن تعذر التحقق من Client Credentials (مشكلة شبكة).";
    return result;
  }

  result.ok = true;
  if (botUser) {
    result.botUser = {
      id: botUser.id,
      username: botUser.username,
      tag: botUser.discriminator ? `${botUser.username}#${botUser.discriminator}` : botUser.username,
    };
    result.message = `تم التحقق بنجاح — البوت ${result.botUser.tag} متصل.`;
  }
  return result;
}
