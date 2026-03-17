/**
 * Tool para verificar reclamos duplicados antes de registrar uno nuevo.
 * Consulta el endpoint n8n de reclamos recientes filtrados por sistema y área.
 * El agente (LLM) evalúa semánticamente si algún motivo existente
 * coincide con el reclamo que está por crear.
 */

import { createTool } from "@mastra/core/tools";
import { SpanType } from "@mastra/core/observability";
import { z } from "zod";

const N8N_RECLAMOS_RECIENTES_URL =
  process.env.N8N_RECLAMOS_RECIENTES_URL ??
  "http://distrimdp.dvrdns.org:5678/webhook/reclamos-recientes";

const FETCH_TIMEOUT_MS = 10_000;

const reclamoRecienteSchema = z.object({
  codigo: z.string(),
  motivo: z.string(),
  prioridad: z.string(),
  estado: z.string(),
  creado_por: z.string(),
  fecha_creacion: z.string(),
  area: z.string(),
  sistema: z.string(),
  tipo: z.string(),
  cliente_codigo: z.string().nullable(),
});

const reclamosResponseSchema = z.object({
  success: z.boolean(),
  reclamos: z.array(reclamoRecienteSchema),
  total: z.number(),
});

export const checkDuplicateClaimTool = createTool({
  id: "check-duplicate-claim",
  description:
    "Verifica si ya existen reclamos recientes para el mismo sistema y área. " +
    "Llamar ANTES de registrar un reclamo para evitar duplicados. " +
    "Revisá los motivos devueltos y evaluá si alguno describe el mismo problema.",
  inputSchema: z.object({
    sistema: z
      .string()
      .describe("Nombre exacto del sistema afectado"),
    area: z
      .string()
      .optional()
      .describe("Nombre del área responsable (opcional, si se omite busca en todas las áreas del sistema)"),
    motivo: z
      .string()
      .describe("Motivo del reclamo que se quiere crear, para comparar con los existentes"),
    horas: z
      .number()
      .optional()
      .default(24)
      .describe("Ventana de tiempo en horas para buscar reclamos recientes (default: 24)"),
  }),
  outputSchema: z.object({
    encontrados: z.boolean().describe("true si hay reclamos recientes en ese sistema+área"),
    reclamos: z
      .array(reclamoRecienteSchema)
      .describe("Lista de reclamos recientes encontrados"),
    total: z.number().describe("Cantidad de reclamos encontrados"),
    mensaje: z.string().describe("Mensaje descriptivo del resultado"),
  }),
  execute: async (inputData, context) => {
    const span = context?.tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.GENERIC,
      name: "check-duplicate-claim.fetch",
      input: {
        sistema: inputData.sistema,
        ...(inputData.area && { area: inputData.area }),
        horas: inputData.horas,
      },
    });

    try {
      const params = new URLSearchParams({
        sistema: inputData.sistema,
        horas: String(inputData.horas),
      });
      if (inputData.area) params.set("area", inputData.area);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const fetchStart = Date.now();
      const response = await fetch(
        `${N8N_RECLAMOS_RECIENTES_URL}?${params}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      const fetchMs = Date.now() - fetchStart;

      if (!response.ok) {
        const body = await response.text();
        span?.error({
          error: new Error(`n8n respondió ${response.status}: ${body}`),
          endSpan: true,
          metadata: { fetchMs, status: response.status },
        });
        // En caso de error del endpoint, permitir continuar (no bloquear el reclamo)
        return {
          encontrados: false,
          reclamos: [],
          total: 0,
          mensaje: `No se pudo verificar duplicados (HTTP ${response.status}). Podés continuar con el registro.`,
        };
      }

      const raw = await response.json();
      const parsed = reclamosResponseSchema.safeParse(raw);

      if (!parsed.success) {
        console.error("[check-duplicate-claim] Respuesta inválida de n8n:", parsed.error.flatten());
        span?.error({
          error: new Error(`Respuesta inválida: ${parsed.error.message}`),
          endSpan: true,
          metadata: { fetchMs },
        });
        return {
          encontrados: false,
          reclamos: [],
          total: 0,
          mensaje: "La respuesta de n8n no tiene el formato esperado. Podés continuar con el registro.",
        };
      }

      const { reclamos } = parsed.data;
      const total = reclamos.length;
      const ubicacion = inputData.area
        ? `${inputData.sistema} / ${inputData.area}`
        : inputData.sistema;

      span?.end({
        output: { total, sistema: inputData.sistema, area: inputData.area },
        metadata: { fetchMs },
      });

      if (total === 0) {
        return {
          encontrados: false,
          reclamos: [],
          total: 0,
          mensaje: `No hay reclamos en ${ubicacion} en las últimas ${inputData.horas} horas.`,
        };
      }

      return {
        encontrados: true,
        reclamos,
        total,
        mensaje:
          `Se encontraron ${total} reclamo(s) reciente(s) en ${ubicacion}. ` +
          `Compará los motivos para determinar si el problema ya fue reportado.`,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? `Timeout: n8n no respondió en ${FETCH_TIMEOUT_MS / 1000}s`
            : error.message
          : "Error desconocido";
      span?.error({
        error: error instanceof Error ? error : new Error(message),
        endSpan: true,
      });
      // Error de red/timeout: no bloquear el flujo, permitir continuar
      return {
        encontrados: false,
        reclamos: [],
        total: 0,
        mensaje: `No se pudo verificar duplicados (${message}). Podés continuar con el registro.`,
      };
    }
  },
});
