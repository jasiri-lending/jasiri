// ─────────────────────────────────────────────────────────────────
// BACKEND: backend/utils/logger.js
// Structured logging. In dev shows pretty colors, in prod outputs JSON.
// ─────────────────────────────────────────────────────────────────
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
    },
  }),
});

// Create a child logger with extra context fields
// Usage: const log = createLogger({ service: 'c2b', tenant_id: id })
export const createLogger = (ctx = {}) => logger.child(ctx);