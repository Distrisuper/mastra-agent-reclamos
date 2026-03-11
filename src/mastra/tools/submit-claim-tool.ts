/**
 * Tool para registrar un reclamo confirmado.
 * Delega la persistencia al webhook n8n "Endpoint guardar reclamo".
 * Los datos de contexto (canal, creado_por_ref, adjunto_url) se obtienen
 * del RequestContext, no del LLM.
 */

import { createTool } from "@mastra/core/tools";
import { SpanType } from "@mastra/core/observability";
import { z } from "zod";

const N8N_GUARDAR_RECLAMO_URL =
  process.env.N8N_GUARDAR_RECLAMO_URL ??
  "http://distrimdp.dvrdns.org:5678/webhook/guardar-reclamo";

const FETCH_TIMEOUT_MS = 15_000;

export const submitClaimTool = createTool({
  id: "submit-claim",
  description:
    "Registra un reclamo confirmado en el sistema. Llamar SOLO cuando el usuario confirme explícitamente.",
  inputSchema: z.object({
    nombre: z.string().describe("Nombre del usuario que reporta"),
    tipo_reclamo: z
      .enum(["Interno", "Externo"])
      .describe("Tipo de reclamo"),
    n_cliente: z
      .string()
      .nullable()
      .describe(
        "Número de cliente (obligatorio si tipo_reclamo=Externo, null si Interno)"
      ),
    sistema: z
      .string()
      .describe("Nombre exacto del sistema afectado"),
    area: z.string().describe("Nombre exacto del área responsable"),
    prioridad: z
      .enum(["Urgente", "Alta", "Normal"])
      .describe("Nivel de prioridad asignado"),
    motivo: z
      .string()
      .describe("Resumen corto del problema (mínimo 5 palabras)"),
    descripcion: z
      .string()
      .describe(
        "Descripción detallada que responde qué pasó, alcance y desde cuándo"
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reclamo_codigo: z.string().optional(),
    mensaje: z.string(),
    errores: z.array(z.string()).optional(),
  }),
  execute: async (inputData, context) => {
    const canal =
      (context?.requestContext?.get("canal") as string) ?? "chat";
    const creado_por_ref =
      (context?.requestContext?.get("creado_por_ref") as string) ?? null;
    const adjunto_url =
      (context?.requestContext?.get("adjunto_url") as string) ?? null;

    // --- Span: validación de campos requeridos ---
    const validationSpan = context?.tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.GENERIC,
      name: "submit-claim.validation",
      input: {
        tipo_reclamo: inputData.tipo_reclamo,
        sistema: inputData.sistema,
        area: inputData.area,
        prioridad: inputData.prioridad,
        canal,
        tieneNCliente: !!inputData.n_cliente,
      },
    });

    const errores: string[] = [];

    if (!inputData.nombre?.trim()) errores.push("nombre es requerido");
    if (!inputData.tipo_reclamo) errores.push("tipo_reclamo es requerido");
    if (!inputData.sistema?.trim()) errores.push("sistema es requerido");
    if (!inputData.area?.trim()) errores.push("area es requerido");
    if (!inputData.prioridad) errores.push("prioridad es requerida");
    if (!inputData.motivo?.trim()) errores.push("motivo es requerido");
    if (!inputData.descripcion?.trim())
      errores.push("descripcion es requerida");

    if (
      inputData.tipo_reclamo === "Externo" &&
      !inputData.n_cliente?.trim()
    ) {
      errores.push(
        "n_cliente es obligatorio para reclamos de tipo Externo"
      );
    }

    if (errores.length > 0) {
      validationSpan?.end({
        output: { valid: false, errores },
        metadata: { errorCount: errores.length },
      });
      return {
        success: false,
        mensaje: `Validación fallida: ${errores.join(", ")}`,
        errores,
      };
    }

    validationSpan?.end({
      output: { valid: true },
      metadata: { errorCount: 0 },
    });

    // --- Span: POST al webhook n8n ---
    const n8nSpan = context?.tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.GENERIC,
      name: "n8n.guardar_reclamo",
      input: {
        sistema: inputData.sistema,
        area: inputData.area,
        tipo: inputData.tipo_reclamo,
        prioridad: inputData.prioridad,
        canal,
        tieneAdjunto: !!adjunto_url,
      },
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const fetchStart = Date.now();
      const response = await fetch(N8N_GUARDAR_RECLAMO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: inputData.nombre,
          tipo_reclamo: inputData.tipo_reclamo,
          sistema: inputData.sistema,
          area: inputData.area,
          prioridad: inputData.prioridad,
          motivo: inputData.motivo,
          descripcion: inputData.descripcion,
          canal,
          n_cliente: inputData.n_cliente || null,
          creado_por_ref,
          adjunto_url,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const fetchMs = Date.now() - fetchStart;

      if (!response.ok) {
        const body = await response.text();
        n8nSpan?.error({
          error: new Error(`n8n respondió ${response.status}: ${body}`),
          endSpan: true,
          metadata: { fetchMs, status: response.status },
        });
        return {
          success: false,
          mensaje: `Error del webhook n8n (HTTP ${response.status})`,
          errores: [body],
        };
      }

      const data = await response.json() as {
        success: boolean;
        reclamo_codigo?: string;
        mensaje: string;
        errores?: string[];
      };

      if (!data.success) {
        n8nSpan?.end({
          output: data,
          metadata: { fetchMs },
        });
        return {
          success: false,
          mensaje: data.mensaje,
          errores: data.errores,
        };
      }

      n8nSpan?.end({
        output: { reclamo_codigo: data.reclamo_codigo },
        metadata: { fetchMs },
      });

      return {
        success: true,
        reclamo_codigo: data.reclamo_codigo,
        mensaje: data.mensaje,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? `Timeout: n8n no respondió en ${FETCH_TIMEOUT_MS / 1000}s`
            : error.message
          : "Error desconocido";
      n8nSpan?.error({
        error: error instanceof Error ? error : new Error(message),
        endSpan: true,
      });
      return {
        success: false,
        mensaje: `Error al enviar reclamo al webhook n8n: ${message}`,
        errores: [message],
      };
    }
  },
});
