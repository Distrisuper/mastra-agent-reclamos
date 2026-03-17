/**
 * Workflow de notificaciones post-submit.
 * Después de registrar un reclamo, notifica por WhatsApp según sistema/área.
 * Extensible: agregar branches para nuevos destinatarios.
 */

import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

const MESSAGING_SERVICE_URL =
  process.env.MESSAGING_SERVICE_URL ?? "https://messaging-service.aokitech.com.ar";
const MESSAGING_CHANNEL_ALIAS =
  process.env.MESSAGING_CHANNEL_ALIAS ?? "testaokisergio";
const FACTURACION_NOTIFY_NUMBER =
  process.env.FACTURACION_NOTIFY_NUMBER ?? "";
const MESSAGING_API_KEY =
  process.env.MESSAGING_API_KEY ?? "";

const FETCH_TIMEOUT_MS = 10_000;

const claimInputSchema = z.object({
  reclamo_codigo: z.string(),
  sistema: z.string(),
  area: z.string(),
  prioridad: z.string(),
  motivo: z.string(),
  nombre: z.string(),
  tipo_reclamo: z.string(),
});

const notificationOutputSchema = z.object({
  notified: z.boolean(),
  reason: z.string().optional(),
  error: z.string().optional(),
});

const notifyFacturacionStep = createStep({
  id: "notify-facturacion",
  description: "Envía WhatsApp a responsable de Facturación Automática",
  inputSchema: claimInputSchema,
  outputSchema: notificationOutputSchema,
  execute: async ({ inputData }) => {
    if (!FACTURACION_NOTIFY_NUMBER) {
      return { notified: false, reason: "FACTURACION_NOTIFY_NUMBER not configured" };
    }

    const message = [
      `🔔 *Nuevo reclamo de Facturación Automática*`,
      ``,
      `📋 *Código:* ${inputData.reclamo_codigo}`,
      `📌 *Motivo:* ${inputData.motivo}`,
      `⚙️ *Sistema:* ${inputData.sistema}`,
      `🔴 *Prioridad:* ${inputData.prioridad}`,
      `👤 *Reportado por:* ${inputData.nombre}`,
      `📝 *Tipo:* ${inputData.tipo_reclamo}`,
    ].join("\n");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(`${MESSAGING_SERVICE_URL}/api/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(MESSAGING_API_KEY && { "X-API-Key": MESSAGING_API_KEY }),
        },
        body: JSON.stringify({
          channelAlias: MESSAGING_CHANNEL_ALIAS,
          recipient: FACTURACION_NOTIFY_NUMBER,
          content: {
            type: "text",
            text: message,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text();
        console.error(`Notification failed (HTTP ${response.status}):`, body);
        return { notified: false, reason: "http-error", error: `HTTP ${response.status}: ${body}` };
      }

      return { notified: true, reason: "sent" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Notification fetch error:", message);
      return { notified: false, reason: "fetch-error", error: message };
    }
  },
});

const noopStep = createStep({
  id: "noop",
  description: "No notification needed for this claim",
  inputSchema: claimInputSchema,
  outputSchema: notificationOutputSchema,
  execute: async () => {
    return { notified: false, reason: "no-match" };
  },
});

export const postSubmitNotifications = createWorkflow({
  id: "post-submit-notifications",
  description: "Envía notificaciones después de registrar un reclamo",
  inputSchema: claimInputSchema,
  outputSchema: notificationOutputSchema,
})
  .branch([
    [
      async ({ inputData }) => inputData.sistema === "Facturacion Automatica",
      notifyFacturacionStep,
    ],
    [async () => true, noopStep],
  ])
  .commit();
