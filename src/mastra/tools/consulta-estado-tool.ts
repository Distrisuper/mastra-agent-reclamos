/**
 * Tool para consultar estado de un reclamo por ID.
 * Versión mockeada para MVP.
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export type EstadoReclamo =
  | "ABIERTO"
  | "EN_PROGRESO"
  | "EN_REVISION"
  | "RESUELTO"
  | "CERRADO"
  | "CANCELADO";

const inputSchema = z.object({
  reclamoId: z.string().min(1),
});

const outputSchema = z.object({
  encontrado: z.boolean(),
  reclamoId: z.string().optional(),
  titulo: z.string().optional(),
  estado: z.string().optional(),
  prioridad: z.enum(["CRITICA", "ALTA", "MEDIA", "BAJA"]).optional(),
  sistemaId: z.string().optional(),
  areaId: z.string().optional(),
  encargado: z.string().optional(),
  fechaCreacion: z.string().optional(),
  fechaActualizacion: z.string().optional(),
  descripcion: z.string().optional(),
  historial: z
    .array(
      z.object({
        estado: z.string(),
        fecha: z.string(),
        nota: z.string().optional(),
      })
    )
    .optional(),
  mensaje: z.string(),
  timestamp: z.string(),
});

type InputType = z.infer<typeof inputSchema>;
type OutputType = z.infer<typeof outputSchema>;

const mockReclamos: Record<string, any> = {
  "REC-2024-001": {
    reclamoId: "REC-2024-001",
    titulo: "Error en el sistema de inventarios no deja cargar productos",
    estado: "EN_PROGRESO",
    prioridad: "ALTA",
    sistemaId: "ERP_INVENTARIOS",
    areaId: "DESARROLLO",
    encargado: "Ana Martínez",
    fechaCreacion: "2024-03-01T10:30:00Z",
    fechaActualizacion: "2024-03-02T14:20:00Z",
    descripcion:
      "El módulo de inventarios del ERP presenta un error al intentar cargar nuevos productos. El sistema muestra un mensaje de error 500.",
    historial: [
      { estado: "ABIERTO", fecha: "2024-03-01T10:30:00Z", nota: "Reclamo creado" },
      {
        estado: "EN_PROGRESO",
        fecha: "2024-03-02T14:20:00Z",
        nota: "Asignado a Ana Martínez para investigación",
      },
    ],
  },
  "REC-2024-015": {
    reclamoId: "REC-2024-015",
    titulo: "El módulo de inventarios falla al registrar entradas",
    estado: "RESUELTO",
    prioridad: "ALTA",
    sistemaId: "ERP_INVENTARIOS",
    areaId: "DESARROLLO",
    encargado: "Luis Fernández",
    fechaCreacion: "2024-03-03T14:20:00Z",
    fechaActualizacion: "2024-03-05T09:00:00Z",
    descripcion:
      "Al registrar entradas de mercadería, el sistema no guarda los movimientos.",
    historial: [
      { estado: "ABIERTO", fecha: "2024-03-03T14:20:00Z", nota: "Reclamo creado" },
      {
        estado: "EN_PROGRESO",
        fecha: "2024-03-03T16:00:00Z",
        nota: "Investigando causa raíz",
      },
      {
        estado: "RESUELTO",
        fecha: "2024-03-05T09:00:00Z",
        nota: "Corregido bug en validación de stock",
      },
    ],
  },
  "REC-2024-042": {
    reclamoId: "REC-2024-042",
    titulo: "La API REST no responde desde hace 10 minutos",
    estado: "RESUELTO",
    prioridad: "CRITICA",
    sistemaId: "API_REST",
    areaId: "INFRAESTRUCTURA",
    encargado: "Roberto Silva",
    fechaCreacion: "2024-03-05T16:45:00Z",
    fechaActualizacion: "2024-03-05T17:30:00Z",
    descripcion:
      "La API REST principal dejó de responder. Todos los endpoints retornan error 503.",
    historial: [
      { estado: "ABIERTO", fecha: "2024-03-05T16:45:00Z", nota: "Reportado como crítico" },
      {
        estado: "EN_PROGRESO",
        fecha: "2024-03-05T16:50:00Z",
        nota: "Reiniciando servicio",
      },
      {
        estado: "RESUELTO",
        fecha: "2024-03-05T17:30:00Z",
        nota: "Servicio restaurado, fue problema de memoria",
      },
    ],
  },
  "REC-2024-056": {
    reclamoId: "REC-2024-056",
    titulo: "Error crítico en producción - sistema caído",
    estado: "ABIERTO",
    prioridad: "CRITICA",
    sistemaId: "ERP_CORE",
    areaId: "INFRAESTRUCTURA",
    encargado: "Patricia Morales",
    fechaCreacion: "2024-03-06T08:00:00Z",
    fechaActualizacion: "2024-03-06T08:00:00Z",
    descripcion:
      "El ERP principal está caído. Los usuarios no pueden acceder al sistema.",
    historial: [
      { estado: "ABIERTO", fecha: "2024-03-06T08:00:00Z", nota: "Reclamo creado, investigando" },
    ],
  },
};

export const consultaEstadoTool = createTool({
  id: "consultar-estado-reclamo",
  description:
    "Consulta el estado actual de un reclamo técnico usando su ID. Retorna información completa incluyendo estado, prioridad, responsable, fechas e historial de cambios.",

  inputSchema,
  outputSchema,

  execute: async (inputData) => {
    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 100 + Math.random() * 200)
      );

      const reclamo = mockReclamos[inputData.reclamoId.toUpperCase()];

      if (!reclamo) {
        return {
          encontrado: false,
          mensaje: `No se encontró el reclamo con ID: ${inputData.reclamoId}`,
          timestamp: new Date().toISOString(),
        } as OutputType;
      }

      const resultado: OutputType = {
        encontrado: true,
        reclamoId: reclamo.reclamoId,
        titulo: reclamo.titulo,
        estado: reclamo.estado,
        prioridad: reclamo.prioridad,
        sistemaId: reclamo.sistemaId,
        areaId: reclamo.areaId,
        encargado: reclamo.encargado,
        fechaCreacion: reclamo.fechaCreacion,
        fechaActualizacion: reclamo.fechaActualizacion,
        descripcion: reclamo.descripcion,
        historial: reclamo.historial,
        mensaje: `Reclamo ${inputData.reclamoId} encontrado. Estado actual: ${reclamo.estado}`,
        timestamp: new Date().toISOString(),
      };

      return resultado;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido al consultar estado";

      return {
        encontrado: false,
        mensaje: `Error al consultar estado del reclamo: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      } as OutputType;
    }
  },
});

// Funciones auxiliares para uso directo (no como tools del agente)
export async function actualizarEstado(input: {
  reclamoId: string;
  estado: EstadoReclamo;
  nota?: string;
}): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const reclamo = mockReclamos[input.reclamoId.toUpperCase()];
  if (!reclamo) {
    return false;
  }

  reclamo.estado = input.estado;
  reclamo.fechaActualizacion = new Date().toISOString();
  reclamo.historial.push({
    estado: input.estado,
    fecha: new Date().toISOString(),
    nota: input.nota || "Estado actualizado",
  });

  return true;
}

export async function obtenerTodos(): Promise<Record<string, any>> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { ...mockReclamos };
}

export const estadoDescripciones: Record<EstadoReclamo, string> = {
  ABIERTO: "Reclamo abierto, pendiente de asignación",
  EN_PROGRESO: "Reclamo en progreso, siendo trabajado",
  EN_REVISION: "Reclamo en revisión, validando solución",
  RESUELTO: "Reclamo resuelto, esperando confirmación",
  CERRADO: "Reclamo cerrado y confirmado",
  CANCELADO: "Reclamo cancelado, no requiere acción",
};

export const estadoColores: Record<EstadoReclamo, string> = {
  ABIERTO: "#3B82F6",
  EN_PROGRESO: "#F59E0B",
  EN_REVISION: "#8B5CF6",
  RESUELTO: "#10B981",
  CERRADO: "#6B7280",
  CANCELADO: "#EF4444",
};
