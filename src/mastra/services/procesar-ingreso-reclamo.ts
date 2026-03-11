/**
 * Servicio de procesamiento de reclamos.
 * Recibe el payload del API, construye RequestContext,
 * llama al agente con memory, e inspecciona el resultado
 * para determinar el outcome (conversing/submitted/error).
 */

import type { Agent } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";

import type {
  IngestReclamoPayload,
  IngestReclamoResponse,
} from "../api/schemas/ingest-reclamos-schema";

export async function procesarIngresoReclamo(
  agent: Agent,
  payload: IngestReclamoPayload
): Promise<IngestReclamoResponse> {
  const source = normalizarSegmento(payload.source || "external");
  const reporterId = normalizarSegmento(payload.reporter.id);
  const threadId = payload.conversationId.trim();
  const resourceId = `${source}:${reporterId}`;

  try {
    const requestContext = new RequestContext([
      ["userName", payload.reporter.name],
      [
        "attachmentUrl",
        (payload.metadata?.attachmentUrl as string) ?? null,
      ],
      ["canal", payload.source || "external"],
      ["creado_por_ref", payload.reporter.id],
      [
        "adjunto_url",
        (payload.metadata?.attachmentUrl as string) ?? null,
      ],
    ]);

    const response = await agent.generate(payload.message, {
      requestContext,
      maxSteps: 6,
      memory: {
        thread: threadId,
        resource: resourceId,
      },
      tracingOptions: {
        tags: ["ingest", source],
        metadata: {
          canal: payload.source ?? "external",
          reporterId: payload.reporter.id,
          reporterName: payload.reporter.name,
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          threadId,
          resourceId,
          hasAttachment: !!(payload.metadata?.attachmentUrl),
        },
      },
    });

    // Detectar si submit_claim fue ejecutado exitosamente
    const toolCalls =
      response.steps?.flatMap((s) => s.toolCalls ?? []) ?? [];
    const toolResults =
      response.steps?.flatMap((s) => s.toolResults ?? []) ?? [];

    const submitResult = toolResults.find(
      (tr) => tr.payload.toolName === "submitClaimTool"
    );
    const submitData = submitResult?.payload.result as
      | {
          success?: boolean;
          reclamo_codigo?: string;
        }
      | undefined;
    const isSubmitted = submitData?.success === true;

    return {
      success: true,
      replyText: response.text,
      outcome: isSubmitted ? "submitted" : "conversing",
      conversation: {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        threadId,
        resourceId,
      },
      source: {
        name: payload.source || "external",
        timestamp: payload.timestamp || new Date().toISOString(),
      },
      claimCode: isSubmitted
        ? (submitData?.reclamo_codigo ?? null)
        : null,
      claimData: isSubmitted
        ? extractClaimData(toolCalls)
        : null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return {
      success: false,
      replyText: `Error al procesar el reclamo: ${message}`,
      outcome: "error",
      conversation: {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        threadId,
        resourceId,
      },
      source: {
        name: payload.source || "external",
        timestamp: payload.timestamp || new Date().toISOString(),
      },
      claimCode: null,
      claimData: null,
      errors: [message],
    };
  }
}

function extractClaimData(
  toolCalls: Array<{ payload: { toolName: string; args?: Record<string, unknown> } }>
): Record<string, unknown> | null {
  const submitCall = toolCalls.find(
    (tc) => tc.payload.toolName === "submitClaimTool"
  );
  if (!submitCall?.payload.args) return null;
  return submitCall.payload.args;
}

function normalizarSegmento(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9:_-]+/g, "-")
    .replace(/-+/g, "-");
}
