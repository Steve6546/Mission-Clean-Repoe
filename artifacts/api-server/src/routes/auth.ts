import { Router, type IRouter, Request, Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { discordSessionsTable, db } from "@workspace/db";

const router: IRouter = Router();

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

// --- Begin Discord OAuth2 flow (public) ---
router.get("/discord/login", (_req: Request, res: Response) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    res.status(500).json({ error: "OAuth not configured on server" });
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

// --- OAuth2 callback: exchange code for token, create session (public) ---
router.get("/discord/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const error = typeof req.query.error === "string" ? req.query.error : null;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (error || !code || !redirectUri || !clientId || !clientSecret) {
    res.status(400).json({ error: error ?? "Missing OAuth parameters" });
    return;
  }

  try {
    // Exchange authorization code for an access token
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
      res.status(401).json({ error: "Token exchange failed" });
      return;
    }

    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      res.status(401).json({ error: "No access token returned" });
      return;
    }

    // Fetch the Discord user identity
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userResponse.ok) {
      res.status(401).json({ error: "Failed to fetch user" });
      return;
    }
    const user = (await userResponse.json()) as {
      id: string;
      username: string;
      avatar?: string | null;
    };

    // Create a random session token, store only its hash
    const sessionToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : null;

    await db
      .insert(discordSessionsTable)
      .values({
        tokenHash,
        discordUserId: user.id,
        username: user.username,
        avatarUrl,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      })
      .onConflictDoUpdate({
        target: discordSessionsTable.tokenHash,
        set: {
          discordUserId: user.id,
          username: user.username,
          avatarUrl,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      });

    res.cookie("dwb_session", sessionToken, cookieOptions());
    // Redirect back to the dashboard (SPA handles the route)
    res.redirect(process.env.FRONTEND_URL ?? "/");
  } catch {
    res.status(500).json({ error: "OAuth callback failed" });
  }
});

// --- Session validation (returns user info or 401) ---
router.get("/me", async (req: Request, res: Response) => {
  const token = req.cookies?.dwb_session;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [session] = await db
    .select()
    .from(discordSessionsTable)
    .where(eq(discordSessionsTable.tokenHash, tokenHash))
    .limit(1);

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    res.clearCookie("dwb_session", { path: "/" });
    res.status(401).json({ error: "Session expired" });
    return;
  }

  res.json({
    id: session.discordUserId,
    username: session.username,
    avatarUrl: session.avatarUrl,
  });
});

// --- Logout ---
router.post("/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.dwb_session;
  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db
      .delete(discordSessionsTable)
      .where(eq(discordSessionsTable.tokenHash, tokenHash));
  }
  res.clearCookie("dwb_session", { path: "/" });
  res.status(204).end();
});

export default router;
