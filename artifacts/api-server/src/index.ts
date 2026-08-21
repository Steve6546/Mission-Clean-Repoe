import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import app from "./app";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In production the frontend is built into dist/public by the dashboard's
// Vite build (outDir: dist/public). The backend serves it so a single
// process handles both the SPA and the /api routes (Replit "application"
// router deploy expects one long-running server on $PORT).
const publicDir = path.resolve(__dirname, "public");

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Serve the built dashboard (SPA). API routes are mounted under /api in app.ts.
app.use(express.static(publicDir));
// SPA fallback: any non-API GET that isn't a static asset returns index.html
// so client-side routing (wouter) works on refresh / deep links.
app.get(/^(?!\/api).*/u, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
