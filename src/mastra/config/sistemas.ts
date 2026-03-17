/**
 * Catálogo de sistemas reales del negocio.
 * Datos extraídos del workflow n8n (Definiciones1).
 */

export interface Sistema {
  nombre: string;
  categoria:
    | "Ventas/Comercial"
    | "Comunicacion"
    | "Interno"
    | "Infraestructura"
    | "Logistica"
    | "Administracion"
    | "Sistemas";
  descripcion: string;
  aliases?: string[];
}

export const sistemas: Record<string, Sistema> = {
  LUPA: {
    nombre: "Lupa",
    categoria: "Ventas/Comercial",
    descripcion:
      "Plataforma de catálogo y precios para vendedores y clientes",
    aliases: ["central de faltantes", "aleph"],
  },
  FACTURACION_AUTOMATICA: {
    nombre: "Facturacion Automatica",
    categoria: "Ventas/Comercial",
    descripcion:
      "Sistema de facturación automática de pedidos (Fact Auto)",
    aliases: ["fact auto", "facturación automática"],
  },
  PANEL_OPERACIONES_ESPECIAL: {
    nombre: "Panel Operaciones Especial",
    categoria: "Ventas/Comercial",
    descripcion:
      "Panel para gestión de operaciones especiales (Panel Op Especial)",
    aliases: ["panel op"],
  },
  REDI: {
    nombre: "Redi",
    categoria: "Ventas/Comercial",
    descripcion:
      "Sistema de redistribución de mercadería entre sucursales",
  },
  APP_GUARDADO: {
    nombre: "App Guardado",
    categoria: "Ventas/Comercial",
    descripcion: "App para guardar pedidos o presupuestos",
  },
  ENVIO_DE_EMAILS: {
    nombre: "Envio de Emails",
    categoria: "Comunicacion",
    descripcion: "Sistema de envío de emails automáticos a clientes",
  },
  IA_BOT_MARY: {
    nombre: "IA Bot Mary",
    categoria: "Comunicacion",
    descripcion:
      "Bot de WhatsApp para atención automatizada a clientes (Bota/Bot)",
    aliases: ["bot", "bota", "mary ia"],
  },
  VERSUS: {
    nombre: "Versus",
    categoria: "Interno",
    descripcion: "Sistema interno de gestión operativa",
  },
  QUANTIX: {
    nombre: "Quantix",
    categoria: "Interno",
    descripcion: "Sistema de gestión interna",
  },
  INTERNET: {
    nombre: "Internet",
    categoria: "Infraestructura",
    descripcion: "Conectividad a internet de la empresa",
  },
  CHATWOOT: {
    nombre: "Chatwoot",
    categoria: "Comunicacion",
    descripcion: "Plataforma de atención al cliente por chat",
  },
  APP_DEVOLUCIONES: {
    nombre: "App Devoluciones",
    categoria: "Logistica",
    descripcion: "App para gestión de devoluciones de mercadería",
  },
  APP_PICKING: {
    nombre: "App Picking",
    categoria: "Logistica",
    descripcion:
      "App de picking y preparación de pedidos en depósito",
  },
  FLEXXUS: {
    nombre: "Flexxus",
    categoria: "Administracion",
    descripcion: "Sistema administrativo y contable (ERP)",
  },
  CENTRAL_HABILITACIONES: {
    nombre: "Central Habilitaciones",
    categoria: "Ventas/Comercial",
    descripcion: "Sistema de habilitación y crédito de clientes",
  },
  NO_DEFINIDO: {
    nombre: "No definido",
    categoria: "Interno",
    descripcion:
      "Usar cuando el sistema afectado no está claro o no aplica ninguno específico",
  },
};

export function getSistemaByNombre(nombre: string): Sistema | undefined {
  return Object.values(sistemas).find(
    (s) => s.nombre.toLowerCase() === nombre.toLowerCase()
  );
}

export function getAllSistemas(): Sistema[] {
  return Object.values(sistemas);
}

export function getNombresSistemas(): string[] {
  return Object.values(sistemas).map((s) => s.nombre);
}

export function getSistemasByCategoria(
  categoria: Sistema["categoria"]
): Sistema[] {
  return Object.values(sistemas).filter((s) => s.categoria === categoria);
}
