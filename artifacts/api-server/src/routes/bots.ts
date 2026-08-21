import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  activateBotProfile,
  createBotProfile,
  deleteBotProfile,
  listBotProfiles,
} from "@workspace/db";
import { verifyDiscordCredentials } from "../lib/verify-discord";
import { authGuard } from "../middlewares/auth";

const router: IRouter = Router();

// List all bot profiles (NO secrets returned).
router.get("/bots", authGuard, async (_req, res) => {
  try {
    const profiles = await listBotProfiles();
    res.json(profiles);
  } catch {
    res.status(500).json({ error: "فشل جلب قائمة البوتات." });
  }
});

const CreateBotSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب").max(80),
  clientId: z.string().min(1, "Client ID مطلوب"),
  botToken: z.string().min(10, "Bot Token غير صالح"),
  clientSecret: z.string().min(1, "Client Secret مطلوب"),
});

// Create a bot: verify live -> fetch public bot info -> encrypt + persist.
router.post("/bots", authGuard, async (req, res) => {
  const parsed = CreateBotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: "بيانات غير مكتملة", details: parsed.error.issues });
    return;
  }
  const { name, clientId, botToken, clientSecret } = parsed.data;

  try {
    const verification = await verifyDiscordCredentials({ botToken, clientId, clientSecret });
    if (!verification.ok || !verification.botUser) {
      res.status(422).json({
        ok: false,
        checks: verification.checks,
        message: verification.message || "فشل التحقق من بيانات Discord.",
      });
      return;
    }

    const botInfo = {
      id: verification.botUser.id,
      username: verification.botUser.username,
      tag: verification.botUser.tag,
      avatarUrl: null, // Discord tag has no avatar; client can derive from id+tag if needed
    };

    const profile = await createBotProfile({
      name,
      botToken,
      clientId,
      clientSecret,
      botInfo,
    });

    res.status(201).json({ ok: true, profile, message: `تم حفظ البوت ${name} وتفعيله.` });
  } catch {
    res.status(500).json({ ok: false, message: "تعذر حفظ البوت في قاعدة البيانات." });
  }
});

// Activate a bot profile (switches the active bot).
router.post("/bots/:id/activate", authGuard, async (req, res) => {
  try {
    await activateBotProfile(String(req.params.id));
    res.json({ ok: true, message: "تم تفعيل البوت." });
  } catch {
    res.status(500).json({ ok: false, message: "فشل تفعيل البوت." });
  }
});

// Delete a bot profile.
router.delete("/bots/:id", authGuard, async (req, res) => {
  try {
    await deleteBotProfile(String(req.params.id));
    res.json({ ok: true, message: "تم حذف البوت." });
  } catch {
    res.status(500).json({ ok: false, message: "فشل حذف البوت." });
  }
});

export default router;
