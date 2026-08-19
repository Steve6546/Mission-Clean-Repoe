import { Router, type IRouter } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetDiscordStatusResponse,
  GetGuildParams,
  GetGuildResponse,
  GetWelcomeSettingsParams,
  GetWelcomeSettingsResponse,
  ListGuildActivityParams,
  ListGuildActivityResponse,
  ListGuildsResponse,
  UpdateWelcomeSettingsBody,
  UpdateWelcomeSettingsParams,
  UpdateWelcomeSettingsResponse,
} from "@workspace/api-zod";
import {
  db,
  defaultCardDesign,
  defaultCommandConfig,
  defaultMessageSuite,
  discordSessionsTable,
  guildWelcomeSettingsTable,
  type InsertGuildWelcomeSettings,
} from "@workspace/db";
import {
  getDashboardSummary,
  getGuildDetails,
  getReadyClient,
  getSavedSettings,
  getWelcomeDefaults,
  listActivity,
  listGuilds,
} from "../lib/discord";

const router: IRouter = Router();
const oauthTokenResponseSchema = z.object({
  access_token: z.string(),
});
const oauthUserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatar: z.string().nullable().optional(),
});
const sessionCookieName = "dwb_session";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

router.get("/discord/status", async (_req, res) => {
  const configured = Boolean(
    process.env.DISCORD_BOT_TOKEN &&
      process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET,
  );
  const readyClient = configured ? await getReadyClient() : null;
  const response = GetDiscordStatusResponse.parse({
    configured,
    connected: Boolean(readyClient?.isReady()),
    botUser: readyClient?.user?.tag ?? null,
    message: configured
      ? readyClient
        ? "تم الاتصال بـ Discord بنجاح."
        : "تعذر الاتصال حاليًا. تحقق من التوكن والصلاحيات."
      : "أضف أسرار Discord لتفعيل البيانات الحقيقية.",
  });
  res.json(response);
});

router.get("/dashboard/summary", async (_req, res) => {
  const response = GetDashboardSummaryResponse.parse(
    await getDashboardSummary(),
  );
  res.json(response);
});

router.get("/guilds", async (_req, res) => {
  const response = ListGuildsResponse.parse(await listGuilds());
  res.json(response);
});

router.get("/guilds/:guildId", async (req, res) => {
  const params = GetGuildParams.parse(req.params);
  const guild = await getGuildDetails(params.guildId);
  if (!guild) {
    res.status(404).json({ error: "Guild not found" });
    return;
  }
  res.json(GetGuildResponse.parse(guild));
});

router.get("/guilds/:guildId/activity", async (req, res) => {
  const params = ListGuildActivityParams.parse(req.params);
  res.json(ListGuildActivityResponse.parse(await listActivity(params.guildId)));
});

router.get("/guilds/:guildId/settings", async (req, res) => {
  const params = GetWelcomeSettingsParams.parse(req.params);
  const settings = await getSavedSettings(params.guildId);
  res.json(
    GetWelcomeSettingsResponse.parse(
      settings ?? getWelcomeDefaults(params.guildId),
    ),
  );
});

router.put("/guilds/:guildId/settings", async (req, res) => {
  const params = UpdateWelcomeSettingsParams.parse(req.params);
  const input = UpdateWelcomeSettingsBody.parse(req.body);
  const values: InsertGuildWelcomeSettings = {
    guildId: params.guildId,
    ...input,
    cardDesign: input.cardDesign ?? defaultCardDesign,
    messageSuite: input.messageSuite ?? defaultMessageSuite,
    commandConfig: input.commandConfig ?? defaultCommandConfig,
  };

  const [settings] = await db
    .insert(guildWelcomeSettingsTable)
    .values(values)
    .onConflictDoUpdate({
      target: guildWelcomeSettingsTable.guildId,
      set: {
        enabled: input.enabled,
        style: input.style,
        channelId: input.channelId,
        headline: input.headline,
        body: input.body,
        accentColor: input.accentColor,
        backgroundUrl: input.backgroundUrl,
        includeInviter: input.includeInviter,
        autoRoleIds: input.autoRoleIds,
        cardDesign: input.cardDesign ?? defaultCardDesign,
        messageSuite: input.messageSuite ?? defaultMessageSuite,
        commandConfig: input.commandConfig ?? defaultCommandConfig,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(UpdateWelcomeSettingsResponse.parse(settings));
});

router.get("/auth/discord", (_req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    res.status(503).json({ error: "Discord OAuth is not configured" });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify guilds",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get("/auth/discord/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!code || !clientId || !clientSecret || !redirectUri) {
    res.redirect("/settings?oauth=missing");
    return;
  }

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Discord token exchange failed (${tokenResponse.status})`);
    }

    const token = oauthTokenResponseSchema.parse(await tokenResponse.json());
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (!userResponse.ok) {
      throw new Error(`Discord user lookup failed (${userResponse.status})`);
    }

    const user = oauthUserResponseSchema.parse(await userResponse.json());
    const sessionToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + sessionDurationMs);

    await db.insert(discordSessionsTable).values({
      tokenHash: hashSessionToken(sessionToken),
      discordUserId: user.id,
      username: user.username,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : null,
      expiresAt,
    });

    res.cookie(sessionCookieName, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionDurationMs,
      path: "/",
    });
    res.redirect("/");
  } catch (error) {
    req.log.error({ err: error }, "Discord OAuth callback failed");
    res.redirect("/settings?oauth=error");
  }
});

router.get("/auth/me", async (req, res) => {
  const token = req.cookies?.[sessionCookieName];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [session] = await db
    .select()
    .from(discordSessionsTable)
    .where(eq(discordSessionsTable.tokenHash, hashSessionToken(token)))
    .limit(1);

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    res.clearCookie(sessionCookieName, { path: "/" });
    res.status(401).json({ error: "Session expired" });
    return;
  }

  res.json({
    id: session.discordUserId,
    username: session.username,
    avatarUrl: session.avatarUrl,
  });
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.[sessionCookieName];
  if (token) {
    await db
      .delete(discordSessionsTable)
      .where(eq(discordSessionsTable.tokenHash, hashSessionToken(token)));
  }
  res.clearCookie(sessionCookieName, { path: "/" });
  res.status(204).end();
});

export default router;