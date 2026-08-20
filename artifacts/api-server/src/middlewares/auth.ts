import { Router, type IRouter, Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { discordSessionsTable, db } from "@workspace/db";

// Extract the hashed session token from the request cookies.
function getSessionToken(req: Request): string | null {
  const raw = req.cookies?.dwb_session;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

// Validate the session against the database and attach the Discord user
// identity to the request for downstream handlers. Any request without a
// valid, non-expired session is rejected with 401.
export async function authGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getSessionToken(req);
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
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

    // Attach the authenticated Discord identity for downstream use.
    (req as Request & { auth?: { discordUserId: string; username: string; avatarUrl: string | null } }).auth = {
      discordUserId: session.discordUserId,
      username: session.username,
      avatarUrl: session.avatarUrl,
    };
    next();
  } catch {
    res.status(500).json({ error: "Session lookup failed" });
  }
}

const router: IRouter = Router();

export default router;
