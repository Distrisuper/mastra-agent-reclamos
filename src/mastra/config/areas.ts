/**
 * Configuración de áreas responsables del negocio.
 * Datos reales extraídos del workflow n8n (Definiciones1).
 */

export interface Area {
  id: string;
  nombre: string;
  descripcion: string;
  criterioDerivacion: string;
  motivosFrecuentes: string[];
  slackChannel?: string;
}

export const areas: Record<string, Area> = {
  SISTEMAS: {
    id: "SISTEMAS",
    nombre: "Sistemas",
    descripcion:
      "Fallas en software, plataformas o herramientas tecnológicas de la empresa",
    criterioDerivacion:
      "Cuando el problema involucra un sistema, app o herramienta que no funciona correctamente o da error",
    motivosFrecuentes: [
      "Fact auto",
      "Lupa",
      "Bota",
      "Redi",
      "Dashboard",
      "Chatwoot",
      "Panel op especial",
      "Internet",
      "Flexxus",
    ],
  },
  ADMINISTRACION: {
    id: "ADMINISTRACION",
    nombre: "Administracion",
    descripcion:
      "Errores en facturación, pagos, notas de crédito, imputaciones y trámites administrativos",
    criterioDerivacion:
      "Cuando hay errores en facturas, notas de crédito, imputación de pagos o procesos administrativos",
    motivosFrecuentes: [
      "Error en fact. manual",
      "NC mal emitida",
      "Error de stock",
      "Error en imputar pago",
      "Comunicación",
    ],
  },
  TV_COMERCIAL: {
    id: "TV_COMERCIAL",
    nombre: "Tv/comercial",
    descripcion:
      "Problemas con vendedores, pedidos mal pasados, errores de cuenta o sucursal, comunicación comercial",
    criterioDerivacion:
      "Cuando el problema involucra al vendedor, la gestión del pedido o la relación comercial con el cliente",
    motivosFrecuentes: [
      "Comunicación",
      "Pedido mal pasado",
      "Error de sucursal",
      "Error de cuenta",
      "No se pasó pedido",
      "Pedido duplicado",
    ],
  },
  DEPOSITO: {
    id: "DEPOSITO",
    nombre: "Deposito",
    descripcion:
      "Errores en envíos, pedidos no llegados, artículos en mal estado, problemas de logística",
    criterioDerivacion:
      "Cuando el problema es físico: mercadería no enviada, mal estado, faltantes o errores en despacho",
    motivosFrecuentes: [
      "Error en enviar el pedido",
      "Error de comunicación",
      "No llegó el pedido",
      "Art en mal estado",
      "Art mal envasado",
    ],
  },
  COMPRAS: {
    id: "COMPRAS",
    nombre: "Compras",
    descripcion:
      "Problemas con artículos de proveedores: descripciones incorrectas, fotos erróneas, artículos en mal estado, re-etiquetado",
    criterioDerivacion:
      "Cuando el problema tiene origen en el proveedor o en cómo el artículo fue recibido/cargado al sistema",
    motivosFrecuentes: [
      "Error en descripciones",
      "Error en fotos",
      "Art mal envasado",
      "Art en mal estado",
      "Error en precios",
      "Falta de stock",
    ],
  },
  GERENCIA: {
    id: "GERENCIA",
    nombre: "Gerencia",
    descripcion:
      "Decisiones estratégicas, problemas de comunicación interna de alto nivel, escalamientos que no tienen otra área responsable",
    criterioDerivacion:
      "Solo cuando el reclamo no tiene un área específica responsable o involucra decisiones que superan las áreas operativas",
    motivosFrecuentes: ["Comunicación", "Otros"],
  },
  CONTABILIDAD: {
    id: "CONTABILIDAD",
    nombre: "Contabilidad",
    descripcion:
      "Problemas contables, asientos, conciliaciones, balances e informes financieros",
    criterioDerivacion:
      "Cuando el problema involucra registros contables, conciliaciones bancarias, balances o informes financieros",
    motivosFrecuentes: [
      "Error en asientos",
      "Conciliación bancaria",
      "Error en balance",
    ],
    slackChannel: "#conta",
  },
};

export function getAreaById(areaId: string): Area | undefined {
  return areas[areaId.toUpperCase()];
}

export function getAreaByNombre(nombre: string): Area | undefined {
  return Object.values(areas).find(
    (a) => a.nombre.toLowerCase() === nombre.toLowerCase()
  );
}

export function getAllAreas(): Area[] {
  return Object.values(areas);
}
