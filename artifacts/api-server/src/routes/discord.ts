import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { createHash } from "node:crypto";
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
import { authGuard } from "../middlewares/auth";

const router: IRouter = Router();

// --- Public: Discord connection status ---
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

// --- Protected: dashboard summary ---
router.get("/dashboard/summary", authGuard, async (_req, res) => {
  try {
    const summary = await getDashboardSummary();
    const response = GetDashboardSummaryResponse.parse(summary);
    res.json(response);
  } catch {
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

// --- Protected: list guilds ---
router.get("/guilds", authGuard, async (_req, res) => {
  try {
    const guilds = await listGuilds();
    const response = ListGuildsResponse.parse(guilds);
    res.json(response);
  } catch {
    res.status(500).json({ error: "Failed to list guilds" });
  }
});

// --- Protected: get single guild ---
router.get("/guilds/:guildId", authGuard, async (req, res) => {
  try {
    const params = GetGuildParams.parse(req.params);
    const guild = await getGuildDetails(params.guildId);
    if (!guild) {
      res.status(404).json({ error: "Guild not found" });
      return;
    }
    res.json(GetGuildResponse.parse(guild));
  } catch {
    res.status(500).json({ error: "Failed to get guild" });
  }
});

// --- Protected: list guild activity ---
router.get("/guilds/:guildId/activity", authGuard, async (req, res) => {
  try {
    const params = ListGuildActivityParams.parse(req.params);
    const activity = await listActivity(params.guildId);
    res.json(ListGuildActivityResponse.parse(activity));
  } catch {
    res.status(500).json({ error: "Failed to list activity" });
  }
});

// --- Protected: get welcome settings ---
router.get("/guilds/:guildId/settings", authGuard, async (req, res) => {
  try {
    const params = GetWelcomeSettingsParams.parse(req.params);
    const settings = await getSavedSettings(params.guildId);
    res.json(
      GetWelcomeSettingsResponse.parse(
        settings ?? getWelcomeDefaults(params.guildId),
      ),
    );
  } catch {
    res.status(500).json({ error: "Failed to get settings" });
  }
});

// --- Protected: update welcome settings ---
router.put("/guilds/:guildId/settings", authGuard, async (req, res) => {
  try {
    const params = UpdateWelcomeSettingsParams.parse(req.params);
    const input = UpdateWelcomeSettingsBody.parse(req.body);

    const guild = await getGuildDetails(params.guildId);
    if (!guild) {
      res.status(404).json({ error: "Guild not found" });
      return;
    }

    // Guard: only proceed if the bot is present in this guild
    // (the authenticated user has added the bot, which implies trust).
    if (!guild.botPresent) {
      res.status(403).json({ error: "Bot not present in this guild" });
      return;
    }

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
          memberAutoRoleIds: input.memberAutoRoleIds,
          botAutoRoleIds: input.botAutoRoleIds,
          cardDesign: input.cardDesign ?? defaultCardDesign,
          messageSuite: input.messageSuite ?? defaultMessageSuite,
          commandConfig: input.commandConfig ?? defaultCommandConfig,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(UpdateWelcomeSettingsResponse.parse(settings));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
