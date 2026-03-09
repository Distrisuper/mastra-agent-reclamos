import { registerApiRoute } from "@mastra/core/server";
import { getPool } from "../services/database";

export const healthRoute = registerApiRoute("/health", {
  method: "GET",
  requiresAuth: false,
  handler: async (c) => {
    let dbStatus = "disconnected";

    try {
      const pool = getPool();
      await pool.query("SELECT 1");
      dbStatus = "connected";
    } catch {
      // DB not reachable
    }

    const body = {
      status: dbStatus === "connected" ? "ok" : "error",
      db: dbStatus,
      timestamp: new Date().toISOString(),
    };

    return c.json(body, dbStatus === "connected" ? 200 : 503);
  },
});
