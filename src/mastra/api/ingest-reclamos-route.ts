import { registerApiRoute } from "@mastra/core/server";
import { zodToJsonSchema } from "@mastra/core/utils/zod-to-json";
import type { OpenAPIV3_1 } from "openapi-types";

import {
  ingestReclamoResponseSchema,
  ingestReclamoSchema,
} from "./schemas/ingest-reclamos-schema";
import { procesarIngresoReclamo } from "../services/procesar-ingreso-reclamo";

const requestJsonSchema = zodToJsonSchema(
  ingestReclamoSchema
) as unknown as OpenAPIV3_1.SchemaObject;
const responseJsonSchema = zodToJsonSchema(
  ingestReclamoResponseSchema
) as unknown as OpenAPIV3_1.SchemaObject;

export const ingestReclamosRoute = registerApiRoute("/ingest/reclamos", {
  method: "POST",
  requiresAuth: false,
  middleware: [
    async (c, next) => {
      const configuredSecret = process.env.INGEST_API_SECRET?.trim();

      if (!configuredSecret) {
        await next();
        return;
      }

      const providedSecret = c.req.header("x-ingest-secret");
      if (providedSecret !== configuredSecret) {
        return c.json(
          {
            success: false,
            error: "Unauthorized",
            message: "Invalid or missing x-ingest-secret header.",
          },
          401
        );
      }

      await next();
    },
  ],
  openapi: {
    summary: "Ingest technical claims from any source",
    description:
      "Receives a normalized message payload, preserves conversation continuity, and executes the technical claims agent.",
    tags: ["ingest"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: requestJsonSchema,
        },
      },
    },
    responses: {
      200: {
        description: "Claim processed successfully",
        content: {
          "application/json": {
            schema: responseJsonSchema,
          },
        },
      },
      400: {
        description: "Invalid payload",
      },
      401: {
        description: "Unauthorized",
      },
      500: {
        description: "Processing error",
      },
    },
  },
  handler: async (c) => {
    let rawBody: unknown;

    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(
        {
          success: false,
          error: "Invalid JSON body",
        },
        400
      );
    }

    const parsedPayload = ingestReclamoSchema.safeParse(rawBody);
    if (!parsedPayload.success) {
      return c.json(
        {
          success: false,
          error: "Invalid payload",
          details: parsedPayload.error.flatten(),
        },
        400
      );
    }

    try {
      const mastra = c.get("mastra");
      const agent = mastra.getAgent("reclamosAgent");
      const response = await procesarIngresoReclamo(agent, parsedPayload.data);

      return c.json(response, response.success ? 200 : 500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown processing error";

      return c.json(
        {
          success: false,
          replyText: `Error al procesar el reclamo: ${message}`,
          outcome: "error",
          errors: [message],
        },
        500
      );
    }
  },
});
