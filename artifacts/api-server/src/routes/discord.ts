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
  getActiveBotProfile,
  resolveDiscordConfig,
  saveDiscordConfig,
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
import { verifyDiscordCredentials } from "../lib/verify-discord";
import { authGuard } from "../middlewares/auth";

const router: IRouter = Router();

// --- Public: Discord connection status (reflects active bot: DB or .env) ---
router.get("/discord/status", async (_req, res) => {
  const activeBot = await getActiveBotProfile();
  const envConfigured = Boolean(
    process.env.DISCORD_BOT_TOKEN &&
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET,
  );
  const source = activeBot ? "database" : envConfigured ? "env" : "none";
  const configured = Boolean(activeBot || envConfigured);
  const readyClient = configured ? await getReadyClient() : null;
  const botUser =
    activeBot?.botInfo?.tag ??
    activeBot?.botInfo?.username ??
    readyClient?.user?.tag ??
    null;
  const response = GetDiscordStatusResponse.parse({
    configured,
    connected: Boolean(readyClient?.isReady()),
    botUser,
    message: configured
      ? readyClient
        ? `متصل${activeBot ? `: ${activeBot.name}` : ""}.`
        : "تم حفظ الإعدادات، لكن يتعذر الاتصال حاليًا. تحقق من التوكن والصلاحيات."
      : "أضف بوت Discord (عبر الإعدادات أو ملف البيئة) لتفعيل البيانات الحقيقية.",
  });
  res.json(response);
});

// --- Public: verify a config set against the live Discord API ---
const VerifyConfigSchema = z.object({
  botToken: z.string().min(10, "Bot token مطلوب"),
  clientId: z.string().min(1, "Client ID مطلوب"),
  clientSecret: z.string().min(1, "Client Secret مطلوب"),
  databaseUrl: z.string().url().optional().or(z.literal("")),
});

router.post("/discord/verify-config", async (req, res) => {
  const parsed = VerifyConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      message: "بيانات غير مكتملة",
      details: parsed.error.issues,
    });
    return;
  }
  const { botToken, clientId, clientSecret, databaseUrl } = parsed.data;

  try {
    const verification = await verifyDiscordCredentials({
      botToken,
      clientId,
      clientSecret,
    });

    if (!verification.ok) {
      res.status(422).json({
        ok: false,
        checks: verification.checks,
        message: verification.message,
      });
      return;
    }

    // Verification passed: persist as the Dual-Config DB source (encrypted).
    try {
      await saveDiscordConfig({
        botToken,
        clientId,
        clientSecret,
        databaseUrl: databaseUrl || undefined,
      });
    } catch {
      // If DB is unavailable we still return success for env-less verification,
      // but flag that persistence failed.
      res.status(200).json({
        ok: true,
        botUser: verification.botUser,
        message: verification.message + " (لم يتم الحفظ في قاعدة البيانات — تأكد من DATABASE_URL).",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      botUser: verification.botUser,
      message: verification.message,
    });
  } catch {
    res.status(500).json({ ok: false, message: "تعذر التحقق من إعدادات Discord." });
  }
});

// --- Protected: read persisted config meta (no secrets leaked) ---
router.get("/discord/config", authGuard, async (_req, res) => {
  const cfg = await resolveDiscordConfig();
  res.json({
    configured: Boolean(cfg.botToken && cfg.clientId && cfg.clientSecret),
    source: cfg.source,
    hasDatabaseUrl: Boolean(cfg.databaseUrl),
    // NOTE: botToken / clientSecret / clientId are intentionally omitted.
  });
});

// --- Protected: save config via admin form (DB source, encrypted) ---
router.post("/discord/config", authGuard, async (req, res) => {
  const parsed = VerifyConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: "بيانات غير مكتملة" });
    return;
  }
  const { botToken, clientId, clientSecret, databaseUrl } = parsed.data;
  try {
    await saveDiscordConfig({
      botToken,
      clientId,
      clientSecret,
      databaseUrl: databaseUrl || undefined,
    });
    res.status(200).json({ ok: true, message: "تم حفظ الإعدادات." });
  } catch {
    res.status(500).json({ ok: false, message: "فشل حفظ الإعدادات في قاعدة البيانات." });
  }
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
