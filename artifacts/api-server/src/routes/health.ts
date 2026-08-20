import { Router } from "express";

const router = Router();

// Health check — always public
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
