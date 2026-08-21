import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type CardDesign = {
  width: number;
  height: number;
  backgroundMode: "url" | "transparent";
  backgroundUrl: string | null;
  avatar: {
    enabled: boolean;
    x: number;
    y: number;
    size: number;
    shape: "square" | "rounded" | "circle";
  };
  username: {
    enabled: boolean;
    text: string;
    x: number;
    y: number;
    font: "CairoBold" | "ChangaBold" | "AlmaraiBold";
    size: number;
    lineHeight: number;
    align: "right" | "center" | "left";
    color: string;
    shadow: boolean;
    shadowColor: string;
    shadowX: number;
    shadowY: number;
    shadowBlur: number;
  };
  extra: {
    enabled: boolean;
    url: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
  };
};

export type MessageSuite = {
  welcomeChannelEnabled: boolean;
  welcomeMessage: string;
  dmEnabled: boolean;
  dmMessage: string;
  leaveEnabled: boolean;
  leaveMessage: string;
};

export type CommandConfig = {
  name: string;
  enabled: boolean;
  aliases: string[];
  allowedRoleIds: string[];
  blockedChannelIds: string[];
  deleteCommand: boolean;
  deleteBotResponse: boolean;
};

export const defaultCardDesign: CardDesign = {
  width: 1100,
  height: 500,
  backgroundMode: "transparent",
  backgroundUrl: null,
  avatar: { enabled: true, x: 72, y: 98, size: 148, shape: "circle" },
  username: {
    enabled: true,
    text: "[userName]",
    x: 260,
    y: 145,
    font: "CairoBold",
    size: 48,
    lineHeight: 1.2,
    align: "right",
    color: "#FFFFFF",
    shadow: true,
    shadowColor: "#000000",
    shadowX: 2,
    shadowY: 2,
    shadowBlur: 8,
  },
  extra: {
    enabled: false,
    url: null,
    x: 820,
    y: 280,
    width: 180,
    height: 140,
    opacity: 100,
  },
};

export const defaultMessageSuite: MessageSuite = {
  welcomeChannelEnabled: true,
  welcomeMessage: "أهلًا بك [user] في [serverName]. أنت العضو رقم [memberCount].",
  dmEnabled: false,
  dmMessage: "مرحبًا [userName]، سعداء بانضمامك إلى [serverName].",
  leaveEnabled: false,
  leaveMessage: "غادر [userName] السيرفر. [wasInvitedBy]",
};

export const defaultCommandConfig: CommandConfig[] = [
  {
    name: "welcome",
    enabled: true,
    aliases: ["join"],
    allowedRoleIds: [],
    blockedChannelIds: [],
    deleteCommand: false,
    deleteBotResponse: false,
  },
  {
    name: "setup",
    enabled: true,
    aliases: ["config"],
    allowedRoleIds: [],
    blockedChannelIds: [],
    deleteCommand: true,
    deleteBotResponse: false,
  },
];

export const guildWelcomeSettingsTable = pgTable(
  "guild_welcome_settings",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull().unique(),
    enabled: boolean("enabled").notNull().default(true),
    style: text("style").notNull().default("embed"),
    channelId: text("channel_id"),
    headline: text("headline").notNull().default("أهلًا بك في السيرفر"),
    body: text("body")
      .notNull()
      .default("نورتنا {member}، نتمنى لك وقتًا ممتعًا."),
    accentColor: text("accent_color").notNull().default("#E50914"),
    backgroundUrl: text("background_url"),
    includeInviter: boolean("include_inviter").notNull().default(true),
    autoRoleIds: jsonb("auto_role_ids").$type<string[]>().notNull().default([]),
    memberAutoRoleIds: jsonb("member_auto_role_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    botAutoRoleIds: jsonb("bot_auto_role_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    cardDesign: jsonb("card_design").$type<CardDesign>().notNull().default(defaultCardDesign),
    messageSuite: jsonb("message_suite").$type<MessageSuite>().notNull().default(defaultMessageSuite),
    commandConfig: jsonb("command_config")
      .$type<CommandConfig[]>()
      .notNull()
      .default(defaultCommandConfig),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("guild_welcome_settings_guild_idx").on(table.guildId)],
);

export const welcomeEventsTable = pgTable(
  "welcome_events",
  {
    id: serial("id").primaryKey(),
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    inviterId: text("inviter_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("welcome_events_guild_created_idx").on(
      table.guildId,
      table.createdAt,
    ),
  ],
);

export const discordSessionsTable = pgTable(
  "discord_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    discordUserId: text("discord_user_id").notNull(),
    username: text("username").notNull(),
    avatarUrl: text("avatar_url"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("discord_sessions_expiry_idx").on(table.expiresAt)],
);

/**
 * App-level Discord configuration (Dual-Config store).
 *
 * Method 1: environment variables (DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID,
 * DISCORD_CLIENT_SECRET, DATABASE_URL) read directly by the server.
 * Method 2: an admin-entered config persisted here, encrypted at rest with a
 * server-side key (APP_SECRETS_KEY / fallback dev key). The token/secret are
 * NEVER returned to the frontend — only a boolean `configured` flag and the
 * bot's public identity (tag/id) are exposed.
 */
export const appSecretsTable = pgTable("app_secrets", {
  id: text("id").primaryKey().default("default"),
  botTokenEnc: text("bot_token_enc").notNull(),
  clientIdEnc: text("client_id_enc").notNull(),
  clientSecretEnc: text("client_secret_enc").notNull(),
  databaseUrlEnc: text("database_url_enc"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertGuildWelcomeSettingsSchema = createInsertSchema(
  guildWelcomeSettingsTable,
).omit({ id: true, updatedAt: true });

export const insertWelcomeEventSchema = createInsertSchema(
  welcomeEventsTable,
).omit({ id: true, createdAt: true });

export type GuildWelcomeSettings = typeof guildWelcomeSettingsTable.$inferSelect;
export type InsertGuildWelcomeSettings = z.infer<
  typeof insertGuildWelcomeSettingsSchema
>;
export type WelcomeEvent = typeof welcomeEventsTable.$inferSelect;
export type InsertWelcomeEvent = z.infer<typeof insertWelcomeEventSchema>;
export type DiscordSession = typeof discordSessionsTable.$inferSelect;