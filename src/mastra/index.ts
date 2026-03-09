/**
 * Punto de entrada principal de la configuración de Mastra.
 * Registra el agente de reclamos (Sofía) y el tool submit_claim.
 */

import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";

import { ingestReclamosRoute } from "./api/ingest-reclamos-route";
import { healthRoute } from "./api/health-route";
import { reclamosAgent } from "./agents/reclamos-agent";
import { submitClaimTool } from "./tools/submit-claim-tool";
import { consultaEstadoTool } from "./tools/consulta-estado-tool";
import { closePool } from "./services/database";

export const mastra = new Mastra({
  agents: {
    reclamosAgent,
  },

  tools: {
    submitClaimTool,
    consultaEstadoTool,
  },

  storage: new LibSQLStore({
    id: "reclamos-storage",
    url: process.env.DATABASE_URL || "file:./reclamos.db",
  }),

  logger: new PinoLogger({
    name: "ReclamosAgent",
    level: (process.env.LOG_LEVEL || "info") as "info" | "debug" | "warn" | "error",
  }),

  server: {
    apiRoutes: [ingestReclamosRoute, healthRoute],
  },
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down gracefully...");
  try {
    await mastra.shutdown();
  } catch (e) {
    console.error("Error shutting down Mastra:", e);
  }
  try {
    await closePool();
  } catch (e) {
    console.error("Error closing DB pool:", e);
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
