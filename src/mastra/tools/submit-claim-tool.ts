/**
 * Tool para registrar un reclamo confirmado.
 * Hace INSERT directo en PostgreSQL (schema: reclamos).
 * Los datos de contexto (canal, creado_por_ref, adjunto_url) se obtienen
 * del RequestContext, no del LLM.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getPool } from "../services/database";

const INSERT_RECLAMO_SQL = `
WITH inserted AS (
  INSERT INTO reclamos (
    canal_id, creado_por_nombre, creado_por_ref,
    tipo, area_id, sistema_id, prioridad,
    cliente_codigo, motivo, descripcion,
    adjunto_url, estado_id
  )
  VALUES (
    (SELECT id FROM canales  WHERE nombre = $1),
    $2, $3, $4,
    (SELECT id FROM areas    WHERE nombre = $5),
    (SELECT id FROM sistemas WHERE nombre = $6),
    $7, $8, $9, $10, $11,
    (SELECT id FROM estados  WHERE nombre = 'Abierto')
  )
  RETURNING id, codigo
),
evento AS (
  INSERT INTO reclamos_eventos (reclamo_id, tipo, estado_id, autor_nombre, contenido)
  SELECT
    inserted.id,
    'cambio_estado',
    (SELECT id FROM estados WHERE nombre = 'Abierto'),
    'Sistema',
    'Reclamo creado'
  FROM inserted
  RETURNING id
)
SELECT inserted.id AS reclamo_id, inserted.codigo AS reclamo_codigo
FROM inserted;
`;

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

    // --- Validaciones ---
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
      return {
        success: false,
        mensaje: `Validación fallida: ${errores.join(", ")}`,
        errores,
      };
    }

    // --- INSERT en PostgreSQL ---
    try {
      const pool = getPool();

      const params = [
        canal,                                    // $1
        inputData.nombre,                         // $2
        creado_por_ref,                           // $3
        inputData.tipo_reclamo,                   // $4
        inputData.area,                           // $5
        inputData.sistema,                        // $6
        inputData.prioridad,                      // $7
        inputData.n_cliente || null,              // $8
        inputData.motivo,                         // $9
        inputData.descripcion,                    // $10
        adjunto_url,                              // $11
      ];

      const result = await pool.query(INSERT_RECLAMO_SQL, params);

      const row = result.rows?.[0];
      if (!row?.reclamo_codigo) {
        return {
          success: false,
          mensaje:
            "El INSERT se ejecutó pero no se obtuvo el código del reclamo",
          errores: ["No se recibió reclamo_codigo del RETURNING"],
        };
      }

      return {
        success: true,
        reclamo_codigo: row.reclamo_codigo,
        mensaje: `Reclamo ${row.reclamo_codigo} registrado exitosamente`,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      return {
        success: false,
        mensaje: `Error al insertar reclamo en la base de datos: ${message}`,
        errores: [message],
      };
    }
  },
});
