/**
 * Tool para parsear y validar una plantilla de reclamo.
 * 
 * ENFOQUE FLEXIBLE: Infier automáticamente lo que pueda, solo pide lo que realmente falta.
 * - Normaliza tipo_reclamo (case-insensitive)
 * - n_cliente = null automáticamente para Internos
 * - Inferir sistema con fuzzy match
 * - Área se infiere si no está
 * - Descripción: solo advierte si falta algo, no rechaza
 */

import { createTool } from "@mastra/core/tools";
import { SpanType } from "@mastra/core/observability";
import { z } from "zod";

import { getAllAreas } from "../config/areas";
import { getAllSistemas } from "../config/sistemas";
import { getAllPrioridades } from "../config/prioridades";

const AREAS_VALIDAS = getAllAreas().map((a) => a.nombre);
const SISTEMAS_VALIDOS = getAllSistemas().map((s) => s.nombre);
const PRIORIDADES_VALIDAS = getAllPrioridades().map((p) => p.nivel);

export const parseClaimTemplateTool = createTool({
  id: "parse-claim-template",
  description:
    "Parsea y valida una plantilla de reclamo completa. Infier automáticamente lo que pueda " +
    "(tipo_reclamo, area, prioridad) y solo reporta errores si faltan campos críticos. " +
    "Llamar cuando el usuario envíe una plantilla estructurada.",
  inputSchema: z.object({
    plantilla_texto: z
      .string()
      .describe("Texto completo de la plantilla enviada por el usuario"),
  }),
  outputSchema: z.object({
    valida: z.boolean().describe("true si la plantilla es válida o puede ser inferida"),
    datos: z
      .object({
        tipo_reclamo: z.enum(["Interno", "Externo"]),
        n_cliente: z.string().nullable(),
        sistema: z.string(),
        area: z.string(),
        prioridad: z.enum(["Urgente", "Alta", "Normal"]),
        motivo: z.string(),
        descripcion: z.string(),
      })
      .optional()
      .describe("Datos parseados e inferidos"),
    errores: z
      .array(z.string())
      .describe("Lista de errores críticos (solo lo que no se puede inferir)"),
    advertencias: z
      .array(z.string())
      .optional()
      .describe("Advertencias sobre datos que el agente debería verificar"),
    mensaje: z.string().describe("Mensaje descriptivo del resultado"),
  }),
  execute: async (inputData, context) => {
    const span = context?.tracingContext?.currentSpan?.createChildSpan({
      type: SpanType.GENERIC,
      name: "parse-claim-template.parse",
      input: {
        plantilla_texto: inputData.plantilla_texto.substring(0, 200),
      },
    });

    const errores: string[] = [];
    const advertencias: string[] = [];
    const datos: Record<string, unknown> = {};

    try {
      const textoLimpio = inputData.plantilla_texto.trim();
      const parsed = parseTextoEstructurado(textoLimpio);

      if (!parsed || Object.keys(parsed).length === 0) {
        span?.end({
          output: { valida: false, errores: ["No se pudo parsear la plantilla"] },
          metadata: { errorCount: 1 },
        });
        return {
          valida: false,
          errores: ["No se pudo parsear la plantilla. Asegurate de usar el formato texto estructurado."],
          mensaje: "No se pudo interpretar la plantilla. Verificá que esté en formato texto estructurado.",
        };
      }

      // 1. Inferir tipo_reclamo (case-insensitive, default a Interno)
      const tipoRaw = String(parsed.tipo_reclamo || parsed.tipo || "").toLowerCase().trim();
      if (tipoRaw.includes("externo")) {
        datos.tipo_reclamo = "Externo";
      } else {
        datos.tipo_reclamo = "Interno"; // Default a Interno si no está claro o dice "interno"
      }

      // 2. n_cliente: automático para Internos, obligatorio solo para Externos
      const nClienteRaw = parsed.n_cliente as string | undefined | null;
      const clienteRaw = parsed.cliente as string | undefined | null;
      
      if (datos.tipo_reclamo === "Interno") {
        datos.n_cliente = null; // Automático para internos
      } else {
        // Para Externos, intentar obtener n_cliente
        const nCliente = nClienteRaw || clienteRaw;
        if (!nCliente || !String(nCliente).trim()) {
          errores.push("Falta el número de cliente (es obligatorio para reclamos Externos)");
        } else {
          datos.n_cliente = String(nCliente).trim();
        }
      }

      // 3. Inferir sistema con fuzzy match (case-insensitive)
      const sistemaRaw = String(parsed.sistema || "").trim();
      const sistemaInput = sistemaRaw.toLowerCase();
      
      if (!sistemaRaw) {
        errores.push("Falta el sistema (ej: Flexxus, Facturación Automática, Lupa, etc.)");
      } else {
        const sistemaEncontrado = SISTEMAS_VALIDOS.find(
          s => s.toLowerCase() === sistemaInput || 
               s.toLowerCase().includes(sistemaInput) || 
               sistemaInput.includes(s.toLowerCase())
        );
        
        if (sistemaEncontrado) {
          datos.sistema = sistemaEncontrado;
        } else {
          datos.sistema = sistemaRaw; // Guardar igual, el agente puede corregir
          advertencias.push(`El sistema "${sistemaRaw}" no está en la lista oficial. Verificá que sea correcto.`);
        }
      }

      // 4. Área: inferir automáticamente si no está
      const areaRaw = parsed.area as string | undefined;
      if (areaRaw) {
        const areaInput = String(areaRaw).toLowerCase().trim();
        const areaEncontrada = AREAS_VALIDAS.find(
          a => a.toLowerCase() === areaInput || a.toLowerCase().includes(areaInput)
        );
        datos.area = areaEncontrada || String(areaRaw);
      } else {
        // Inferir área basada en el sistema
        datos.area = inferirAreaDesdeSistema(datos.sistema as string);
      }

      // 5. Motivo (obligatorio, mínimo 3 palabras para ser flexibles)
      const motivoRaw = parsed.motivo as string | undefined;
      if (!motivoRaw || !String(motivoRaw).trim()) {
        errores.push("Falta el motivo (resumen corto del problema)");
      } else {
        datos.motivo = String(motivoRaw).trim();
        const palabras = (datos.motivo as string).split(/\s+/);
        if (palabras.length < 3) {
          advertencias.push("El motivo es muy corto. Intentá ser más específico.");
        }
      }

      // 6. Descripción (obligatoria, pero flexible en validación)
      const descripcionRaw = parsed.descripcion as string | undefined;
      if (!descripcionRaw || !String(descripcionRaw).trim()) {
        errores.push("Falta la descripción (contanos más del problema)");
      } else {
        datos.descripcion = String(descripcionRaw).trim();
        
        // Validar descripción sólida pero solo advertir si falta algo
        const validezDescripcion = validarDescripcionSolida(datos.descripcion as string);
        if (!validezDescripcion.esSolida) {
          // Solo agregar advertencia, no error (el agente puede preguntar)
          advertencias.push(`La descripción podría ser más completa. Faltan: ${validezDescripcion.faltantes.join(", ")}`);
        }
      }

      // 7. Prioridad: default a Normal, el agente puede cambiar
      const prioridadRaw = parsed.prioridad as string | undefined;
      if (prioridadRaw) {
        const prioridadInput = String(prioridadRaw).toLowerCase().trim();
        const prioridadEncontrada = PRIORIDADES_VALIDAS.find(
          p => p.toLowerCase() === prioridadInput || p.toLowerCase().includes(prioridadInput)
        );
        datos.prioridad = prioridadEncontrada || "Normal";
      } else {
        datos.prioridad = "Normal";
      }

      // Si hay errores críticos, retornar inválido
      if (errores.length > 0) {
        span?.end({
          output: { valida: false, errores },
          metadata: { errorCount: errores.length },
        });
        return {
          valida: false,
          errores,
          mensaje: `Plantilla incompleta: ${errores.length} dato(s) crítico(s) faltante(s).`,
        };
      }

      // Plantilla válida (con o sin advertencias)
      const datosValidados = {
        tipo_reclamo: datos.tipo_reclamo as "Interno" | "Externo",
        n_cliente: datos.n_cliente as string | null,
        sistema: datos.sistema as string,
        area: datos.area as string,
        prioridad: datos.prioridad as "Urgente" | "Alta" | "Normal",
        motivo: datos.motivo as string,
        descripcion: datos.descripcion as string,
      };

      let mensaje = "Plantilla válida. ";
      if (advertencias.length > 0) {
        mensaje += `Revisá: ${advertencias.join(". ")}`;
      } else {
        mensaje += "Todos los campos fueron verificados correctamente.";
      }

      span?.end({
        output: { valida: true, datos: datosValidados, advertencias },
        metadata: { errorCount: 0, advertenciasCount: advertencias.length },
      });

      return {
        valida: true,
        datos: datosValidados,
        errores: [],
        advertencias: advertencias.length > 0 ? advertencias : undefined,
        mensaje,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      span?.error({
        error: error instanceof Error ? error : new Error(message),
        endSpan: true,
      });
      return {
        valida: false,
        errores: [message],
        mensaje: `Error al procesar la plantilla: ${message}`,
      };
    }
  },
});

/**
 * Parsea texto estructurado en formato de plantilla.
 * Ejemplo:
 * 📋 PLANTILLA DE RECLAMO
 * Tipo: Externo
 * Cliente N°: 45032
 * Sistema: Facturación Automática
 * ...
 */
function parseTextoEstructurado(texto: string): Record<string, unknown> {
  const resultado: Record<string, unknown> = {};

  // Mapeo de aliases de campos (más flexible)
  const campoMap: Record<string, string> = {
    tipo: "tipo_reclamo",
    "tipo reclamo": "tipo_reclamo",
    "tipo_reclamo": "tipo_reclamo",
    cliente: "n_cliente",
    "cliente n°": "n_cliente",
    "cliente numero": "n_cliente",
    "n cliente": "n_cliente",
    n_cliente: "n_cliente",
    sistema: "sistema",
    area: "area",
    área: "area",
    motivo: "motivo",
    descripcion: "descripcion",
    descripción: "descripcion",
    prioridad: "prioridad",
  };

  const lineas = texto.split("\n");
  for (const linea of lineas) {
    // Buscar patrón "Campo: Valor" o "Campo - Valor"
    const match = linea.match(/^[\s]*([📋\-•*]*)\s*([^:]+):\s*(.+)$/);
    if (match) {
      const campoRaw = match[2].trim().toLowerCase();
      const valor = match[3].trim();

      // Normalizar nombre del campo
      const campoNormalizado = campoMap[campoRaw] || campoRaw;

      // Ignorar líneas que no son campos (títulos, etc.)
      if (campoRaw.includes("plantilla") || campoRaw.includes("resumen")) {
        continue;
      }

      resultado[campoNormalizado] = valor;
    }
  }

  return resultado;
}

/**
 * Infier el área responsable basada en el sistema.
 */
function inferirAreaDesdeSistema(sistema: string): string {
  const sistemaLower = sistema.toLowerCase();
  
  // Sistemas de Administración
  if (sistemaLower.includes("flexxus")) return "Administracion";
  
  // Sistemas de Ventas/Comercial
  if (sistemaLower.includes("lupa") || 
      sistemaLower.includes("factur") || 
      sistemaLower.includes("redi") ||
      sistemaLower.includes("guardado") ||
      sistemaLower.includes("habilitaciones")) return "Tv/comercial";
  
  // Sistemas de Comunicación
  if (sistemaLower.includes("email") || 
      sistemaLower.includes("mary") || 
      sistemaLower.includes("chatwoot")) return "Sistemas";
  
  // Sistemas de Logística
  if (sistemaLower.includes("devolucion") || sistemaLower.includes("picking")) return "Deposito";
  
  // Default: Sistemas (la mayoría de los sistemas son de esa área)
  return "Sistemas";
}

/**
 * Valida que una descripción sea sólida.
 * Debe responder: qué pasó, alcance, y desde cuándo.
 * 
 * ENFOQUE FLEXIBLE: Patrones más relajados para detectar los elementos.
 */
function validarDescripcionSolida(descripcion: string): {
  esSolida: boolean;
  faltantes: string[];
} {
  const texto = descripcion.toLowerCase();
  const faltantes: string[] = [];

  // Detectar "qué" (descripción del problema) - patrones flexibles
  const quePatterns = [
    /error/,
    /falla/,
    /no (anda|funciona|puede|carga|inicia|conecta|responde|toma|importa|anda)/,
    /no se/,
    /problema/,
    /tira/,
    /issue/,
    /fallo/,
    /falló/,
    /traba/,
    /cuelga/,
    /lento/,
    /no va/,
    /falló/,
    /cayó/,
    /caido/,
    /caído/,
  ];
  const tieneQue = quePatterns.some((p) => p.test(texto));
  if (!tieneQue) {
    faltantes.push("qué pasó");
  }

  // Detectar alcance (todos, solo, afecta, etc.) - patrones flexibles
  const alcancePatterns = [
    /(solo|sólo) (a |ese |este |un |mi |nuestro|tu |su )/,
    /a (todos|varios|algunos|muchos|todos|nadie)/,
    /afecta/,
    /general/,
    /parcial/,
    /masivo/,
    /todos/,
    /nadie/,
    /algunos/,
    /varios/,
    /solo yo/,
    /solo un/,
    /solo ese/,
    /solo mi/,
  ];
  const tieneAlcance = alcancePatterns.some((p) => p.test(texto));
  if (!tieneAlcance) {
    faltantes.push("alcance (si es puntual o general)");
  }

  // Detectar tiempo (desde cuándo) - patrones muy flexibles
  const tiempoPatterns = [
    /desde/,  // "desde ayer", "desde las 9", "desde hoy"
    /hace/,   // "hace 2 horas", "hace un rato"
    /esta mañana|esta tarde|esta noche/,
    /hoy|ayer|anteayer/,
    /(\d+)(am|pm|hs|h)/,  // "9am", "14hs", "3h"
    /(\d+):\d+/,  // "9:00", "14:30"
    /ahora/,
    /recien/,
    /recién/,
    /comenzó/,
    /empezó/,
    /inició/,
  ];
  const tieneTiempo = tiempoPatterns.some((p) => p.test(texto));
  if (!tieneTiempo) {
    faltantes.push("desde cuándo");
  }

  return {
    esSolida: faltantes.length === 0,
    faltantes,
  };
}
