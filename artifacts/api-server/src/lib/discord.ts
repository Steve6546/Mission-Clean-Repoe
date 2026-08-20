import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type PartialGuildMember,
} from "discord.js";
import { and, count, desc, eq, gte } from "drizzle-orm";
import {
  db,
  defaultCardDesign,
  defaultCommandConfig,
  defaultMessageSuite,
  guildWelcomeSettingsTable,
  welcomeEventsTable,
  type GuildWelcomeSettings,
} from "@workspace/db";
import { logger } from "./logger";

const welcomeDefaults = {
  enabled: true,
  style: "embed" as const,
  channelId: null,
  headline: "أهلًا بك في السيرفر",
  body: "نورتنا {member}، نتمنى لك وقتًا ممتعًا.",
  accentColor: "#E50914",
  backgroundUrl: null,
  includeInviter: true,
  autoRoleIds: [] as string[],
  memberAutoRoleIds: [] as string[],
  botAutoRoleIds: [] as string[],
};

function resolveEmbedColor(value: string): `#${string}` {
  return /^#[0-9a-f]{6}$/i.test(value) ? (value as `#${string}`) : "#E50914";
}

let client: Client | null = null;
let loginPromise: Promise<Client | null> | null = null;
const inviteSnapshots = new Map<
  string,
  Map<string, { uses: number; inviterId: string | null }>
>();

function createClient(): Client | null {
  if (!process.env.DISCORD_BOT_TOKEN) {
    return null;
  }

  const nextClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildInvites,
    ],
  });

  nextClient.once("ready", (readyClient) => {
    logger.info({ userId: readyClient.user.id }, "Discord bot connected");
    void primeInviteSnapshots(readyClient);
  });

  nextClient.on("guildMemberAdd", (member) => {
    void handleMemberJoin(member);
  });

  nextClient.on("guildMemberRemove", (member) => {
    void handleMemberLeave(member);
  });

  client = nextClient;
  return nextClient;
}

export async function getReadyClient(): Promise<Client | null> {
  const currentClient = client ?? createClient();
  if (!currentClient) {
    return null;
  }

  if (currentClient.isReady()) {
    return currentClient;
  }

  if (!loginPromise) {
    loginPromise = currentClient
      .login(process.env.DISCORD_BOT_TOKEN)
      .then(() => currentClient)
      .catch((error: unknown) => {
        logger.error({ err: error }, "Discord bot connection failed");
        loginPromise = null;
        return null;
      });
  }

  return loginPromise;
}

export function getWelcomeDefaults(guildId: string) {
  return {
    guildId,
    ...welcomeDefaults,
    cardDesign: defaultCardDesign,
    messageSuite: defaultMessageSuite,
    commandConfig: defaultCommandConfig,
    updatedAt: null,
  };
}

export async function getSavedSettings(
  guildId: string,
): Promise<GuildWelcomeSettings | null> {
  const rows = await db
    .select()
    .from(guildWelcomeSettingsTable)
    .where(eq(guildWelcomeSettingsTable.guildId, guildId))
    .limit(1);
  return rows[0] ?? null;
}

export function toGuildResponse(guild: Guild) {
  const botMember = guild.members.me;
  const canManage =
    guild.ownerId === guild.client.user?.id ||
    Boolean(botMember?.permissions.has(PermissionFlagsBits.ManageGuild));

  const clientId = process.env.DISCORD_CLIENT_ID;
  const inviteUrl = clientId
    ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot%20applications.commands&permissions=0&guild_id=${encodeURIComponent(guild.id)}`
    : null;

  return {
    id: guild.id,
    name: guild.name,
    iconUrl: guild.iconURL({ size: 128 }),
    memberCount: guild.memberCount,
    canManage,
    botPresent: Boolean(botMember),
    inviteUrl,
  };
}

export async function listGuilds() {
  const readyClient = await getReadyClient();
  if (!readyClient) {
    return [];
  }
  return [...readyClient.guilds.cache.values()]
    .filter((guild) => guild.available)
    .map(toGuildResponse)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGuildDetails(guildId: string) {
  const readyClient = await getReadyClient();
  const guild = readyClient?.guilds.cache.get(guildId);
  if (!guild) {
    return null;
  }

  return {
    ...toGuildResponse(guild),
    channels: [...guild.channels.cache.values()]
      .filter((channel) => channel.isTextBased())
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type.toString(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    roles: [...guild.roles.cache.values()]
      .filter((role) => !role.managed)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        managed: role.managed,
        permissions: role.permissions.toArray(),
      }))
      .sort((a, b) => b.position - a.position),
  };
}

export async function getDashboardSummary() {
  const guilds = await listGuilds();
  const configuredRows = await db
    .select({ guildId: guildWelcomeSettingsTable.guildId })
    .from(guildWelcomeSettingsTable);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentRows = await db
    .select({
      id: welcomeEventsTable.id,
      guildId: welcomeEventsTable.guildId,
      memberId: welcomeEventsTable.memberId,
      inviterId: welcomeEventsTable.inviterId,
      createdAt: welcomeEventsTable.createdAt,
    })
    .from(welcomeEventsTable)
    .where(gte(welcomeEventsTable.createdAt, since))
    .orderBy(desc(welcomeEventsTable.createdAt))
    .limit(20);

  const attributed = recentRows.filter((row) => row.inviterId).length;
  return {
    guildCount: guilds.length,
    configuredGuildCount: configuredRows.filter((row) =>
      guilds.some((guild) => guild.id === row.guildId),
    ).length,
    totalMembers: guilds.reduce((total, guild) => total + guild.memberCount, 0),
    recentJoins: recentRows.length,
    inviteAttributionRate: recentRows.length
      ? Math.round((attributed / recentRows.length) * 100)
      : 0,
    latestActivity: recentRows.slice(0, 5).map(toActivityResponse),
  };
}

function toActivityResponse(row: {
  id: number;
  guildId: string;
  memberId: string;
  inviterId: string | null;
  createdAt: Date;
}) {
  return {
    id: String(row.id),
    kind: row.inviterId ? "invite" : "join",
    title: row.inviterId ? "تم تسجيل دعوة" : "انضمام عضو جديد",
    detail: row.inviterId
      ? `العضو ${row.memberId} دخل عبر دعوة ${row.inviterId}`
      : `العضو ${row.memberId} انضم إلى السيرفر ${row.guildId}`,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listActivity(guildId: string) {
  const rows = await db
    .select({
      id: welcomeEventsTable.id,
      guildId: welcomeEventsTable.guildId,
      memberId: welcomeEventsTable.memberId,
      inviterId: welcomeEventsTable.inviterId,
      createdAt: welcomeEventsTable.createdAt,
    })
    .from(welcomeEventsTable)
    .where(eq(welcomeEventsTable.guildId, guildId))
    .orderBy(desc(welcomeEventsTable.createdAt))
    .limit(30);

  return rows.map(toActivityResponse);
}

async function primeInviteSnapshots(readyClient: Client) {
  for (const guild of readyClient.guilds.cache.values()) {
    try {
      const invites = await guild.invites.fetch();
      inviteSnapshots.set(
        guild.id,
        new Map(
          invites.map((invite) => [
            invite.code,
            {
              uses: invite.uses ?? 0,
              inviterId: invite.inviter?.id ?? null,
            },
          ]),
        ),
      );
    } catch (error) {
      logger.warn({ err: error, guildId: guild.id }, "Could not cache guild invites");
    }
  }
}

async function findUsedInvite(member: GuildMember) {
  try {
    const invites = await member.guild.invites.fetch();
    const previous = inviteSnapshots.get(member.guild.id);
    const next = new Map(
      invites.map((invite) => [
        invite.code,
        {
          uses: invite.uses ?? 0,
          inviterId: invite.inviter?.id ?? null,
        },
      ]),
    );
    inviteSnapshots.set(member.guild.id, next);

    if (!previous) {
      return null;
    }

    const used = [...next.entries()].find(([code, current]) => {
      const before = previous.get(code);
      return current.uses > (before?.uses ?? 0);
    });
    return used
      ? {
          inviterId: used[1].inviterId,
          inviteCode: used[0],
          invitesCount: used[1].uses,
        }
      : null;
  } catch (error) {
    logger.warn(
      { err: error, guildId: member.guild.id },
      "Could not resolve joining invite",
    );
    return null;
  }
}

function daysSince(value: Date | null | undefined) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));
}

function renderTemplate(
  text: string,
  context: {
    member: GuildMember | PartialGuildMember;
    inviterId: string | null;
    inviterName: string;
    inviteCode: string;
    invitesCount: number;
    joinedAt: Date | null;
  },
) {
  const { member, inviterId, inviterName, inviteCode, invitesCount, joinedAt } =
    context;
  const values: Record<string, string> = {
    "[user]": member.toString(),
    "[userName]": member.displayName,
    "[userCreatedDate]": member.user.createdAt.toLocaleDateString("ar-SA"),
    "[userCreatedDays]": String(daysSince(member.user.createdAt)),
    "[serverName]": member.guild.name,
    "[memberCount]": member.guild.memberCount.toLocaleString("ar-SA"),
    "[inviter]": inviterId ? `<@${inviterId}>` : "غير معروف",
    "[inviterName]": inviterName,
    "[invitesCount]": String(invitesCount),
    "[inviteCode]": inviteCode || "غير معروف",
    "[joinedDate]": (joinedAt ?? new Date()).toLocaleDateString("ar-SA"),
    "[joinedDays]": String(daysSince(joinedAt)),
    "[wasInvitedBy]": inviterId
      ? `تمت دعوته بواسطة ${inviterName} (<@${inviterId}>)`
      : "لم يتم تحديد صاحب الدعوة",
    "[prefix]": "!",
  };
  return Object.entries(values).reduce(
    (result, [token, value]) => result.replaceAll(token, value),
    text,
  );
}

async function handleMemberJoin(member: GuildMember) {
  const settings = await getSavedSettings(member.guild.id);
  const activeSettings = settings ?? getWelcomeDefaults(member.guild.id);
  if (!activeSettings.enabled) {
    return;
  }

  const invite = activeSettings.includeInviter
    ? await findUsedInvite(member)
    : null;
  const inviterId = invite?.inviterId ?? null;
  let inviterName = "غير معروف";
  if (inviterId) {
    try {
      const inviter = await member.guild.members.fetch(inviterId);
      inviterName = inviter.displayName;
    } catch {
      inviterName = `<@${inviterId}>`;
    }
  }

  const configuredRoleIds = member.user.bot
    ? activeSettings.botAutoRoleIds
    : activeSettings.memberAutoRoleIds;
  const roleIds = configuredRoleIds.length
    ? configuredRoleIds
    : activeSettings.autoRoleIds;

  for (const roleId of roleIds) {
    try {
      const role = member.guild.roles.cache.get(roleId);
      if (
        !role ||
        role.managed ||
        role.permissions.has(PermissionFlagsBits.Administrator) ||
        role.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        logger.warn(
          { guildId: member.guild.id, roleId },
          "Skipped an unsafe auto-role",
        );
        continue;
      }
      await member.roles.add(roleId, "Welcome bot auto-role");
    } catch (error) {
      logger.warn(
        { err: error, guildId: member.guild.id, roleId },
        "Could not assign auto-role",
      );
    }
  }

  await db.insert(welcomeEventsTable).values({
    guildId: member.guild.id,
    memberId: member.id,
    inviterId,
  });

  const templateContext = {
    member,
    inviterId,
    inviterName,
    inviteCode: invite?.inviteCode ?? "",
    invitesCount: invite?.invitesCount ?? 0,
    joinedAt: member.joinedAt,
  };

  if (activeSettings.messageSuite.dmEnabled) {
    try {
      await member.send({
        content: renderTemplate(
          activeSettings.messageSuite.dmMessage,
          templateContext,
        ),
      });
    } catch (error) {
      logger.warn(
        { err: error, guildId: member.guild.id, memberId: member.id },
        "Could not send welcome DM",
      );
    }
  }

  if (
    !activeSettings.channelId ||
    !activeSettings.messageSuite.welcomeChannelEnabled
  ) {
    return;
  }

  const channel = member.guild.channels.cache.get(activeSettings.channelId);
  if (!channel?.isTextBased() || !("send" in channel)) {
    return;
  }

  const replaceTokens = (text: string) =>
    renderTemplate(
      text.replaceAll("{member}", "[user]").replaceAll("{inviter}", "[inviter]"),
      templateContext,
    );

  const embed = new EmbedBuilder()
    .setColor(resolveEmbedColor(activeSettings.accentColor))
    .setTitle(replaceTokens(activeSettings.headline))
    .setDescription(
      replaceTokens(
        activeSettings.messageSuite.welcomeMessage || activeSettings.body,
      ),
    )
    .setThumbnail(member.displayAvatarURL({ size: 256 }))
    .setTimestamp();

  const backgroundUrl =
    activeSettings.cardDesign?.backgroundMode === "url"
      ? activeSettings.cardDesign.backgroundUrl
      : activeSettings.backgroundUrl;
  if (backgroundUrl) {
    embed.setImage(backgroundUrl);
  }

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.warn(
      { err: error, guildId: member.guild.id, channelId: activeSettings.channelId },
      "Could not send welcome message",
    );
  }
}

async function handleMemberLeave(member: GuildMember | PartialGuildMember) {
  const settings = await getSavedSettings(member.guild.id);
  if (!settings?.messageSuite.leaveEnabled || !settings.channelId) return;
  const channel = member.guild.channels.cache.get(settings.channelId);
  if (!channel?.isTextBased() || !("send" in channel)) return;

  try {
    await channel.send({
      content: renderTemplate(settings.messageSuite.leaveMessage, {
        member,
        inviterId: null,
        inviterName: "غير معروف",
        inviteCode: "",
        invitesCount: 0,
        joinedAt: member.joinedAt,
      }),
    });
  } catch (error) {
    logger.warn(
      { err: error, guildId: member.guild.id },
      "Could not send leave message",
    );
  }
}

export async function countGuildEvents(guildId: string) {
  const rows = await db
    .select({ total: count(welcomeEventsTable.id) })
    .from(welcomeEventsTable)
    .where(and(eq(welcomeEventsTable.guildId, guildId)));
  return Number(rows[0]?.total ?? 0);
}