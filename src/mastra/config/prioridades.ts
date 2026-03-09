/**
 * Niveles de prioridad para reclamos.
 * 3 niveles reales del negocio (extraídos del workflow n8n).
 */

export type PrioridadNivel = "Urgente" | "Alta" | "Normal";

export interface Prioridad {
  nivel: PrioridadNivel;
  descripcion: string;
  palabrasClave: string[];
}

export const prioridades: Record<PrioridadNivel, Prioridad> = {
  Urgente: {
    nivel: "Urgente",
    descripcion:
      "El sistema o servicio está completamente caído y nadie puede operar",
    palabrasClave: [
      "caído",
      "caido",
      "no entra nadie",
      "todos sin acceso",
      "sistema caido",
      "no funciona nadie",
      "bot caido",
      "caido el bot",
      "sin internet",
      "no hay internet",
      "no podemos operar",
    ],
  },
  Alta: {
    nivel: "Alta",
    descripcion:
      "El problema afecta la operación de una persona o cliente pero hay workaround posible",
    palabrasClave: [
      "no puedo",
      "error",
      "falla",
      "no carga",
      "cliente molesto",
      "cliente enojado",
      "no funciona",
      "no me deja",
    ],
  },
  Normal: {
    nivel: "Normal",
    descripcion:
      "Problema puntual, consulta o falla intermitente sin impacto operativo inmediato",
    palabrasClave: [],
  },
};

export function getAllPrioridades(): Prioridad[] {
  return Object.values(prioridades);
}
