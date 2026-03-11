/**
 * Punto de entrada principal de la configuración de Mastra.
 * Registra el agente de reclamos (Sofía) y el tool submit_claim.
 */

import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import {
  Observability,
  DefaultExporter,
  SensitiveDataFilter,
} from "@mastra/observability";
import type { AnySpan } from "@mastra/core/observability";

import { ingestReclamosRoute } from "./api/ingest-reclamos-route";
import { healthRoute } from "./api/health-route";
import { reclamosAgent } from "./agents/reclamos-agent";
import { submitClaimTool } from "./tools/submit-claim-tool";
import { checkDuplicateClaimTool } from "./tools/check-duplicate-claim-tool";
import { consultaEstadoTool } from "./tools/consulta-estado-tool";
import { closePool } from "./services/database";

/**
 * Custom span processor that enriches every span with deployment metadata.
 * Adds environment, service label, and agent version to all exported spans.
 */
class ReclamosContextProcessor {
  name = "reclamos-context-enricher";

  process(span: AnySpan): AnySpan {
    span.metadata = {
      ...span.metadata,
      environment: process.env.NODE_ENV ?? "development",
      service: "distri-reclamos",
      agentVersion: "1.0.0",
    };
    return span;
  }

  async shutdown(): Promise<void> {}
}

export const mastra = new Mastra({
  agents: {
    reclamosAgent,
  },

  tools: {
    submitClaimTool,
    checkDuplicateClaimTool,
    consultaEstadoTool,
  },

  storage: new LibSQLStore({
    id: "reclamos-storage",
    url: process.env.DATABASE_URL || "file:./reclamos.db",
  }),

  observability: new Observability({
    configs: {
      default: {
        serviceName: "distri-reclamos-agent",
        serializationOptions: {
          maxStringLength: 4096,
          maxDepth: 10,
          maxArrayLength: 100,
          maxObjectKeys: 75,
        },
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
          new ReclamosContextProcessor(),
        ],
      },
    },
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
