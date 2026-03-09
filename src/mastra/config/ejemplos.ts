/**
 * Ejemplos de clasificación de reclamos por área.
 * Datos extraídos del nodo Definiciones1 de n8n.
 */

export interface EjemploReclamo {
  area: string;
  tipo: "Interno" | "Externo";
  sistema: string;
  n_cliente?: string;
  motivo: string;
  descripcion: string;
  razonArea: string;
}

export const ejemplosReclamos: EjemploReclamo[] = [
  {
    area: "Sistemas",
    tipo: "Interno",
    sistema: "Flexxus",
    motivo: "Error al importar a DIMEs",
    descripcion:
      "Error al importar a DIMEs: violation of FOREIGN KEY constraint",
    razonArea: "Error técnico en un sistema",
  },
  {
    area: "Sistemas",
    tipo: "Externo",
    sistema: "Lupa",
    n_cliente: "04682",
    motivo: "Error de precios en kit",
    descripcion:
      "El kit 94212MI@94213MI - precio no coincide con la suma de los componentes",
    razonArea: "Error en cómo el sistema muestra precios",
  },
  {
    area: "Administracion",
    tipo: "Interno",
    sistema: "Flexxus",
    motivo: "Error en imputar pago",
    descripcion:
      "Se hicieron 2 recibos al cliente con las mismas facturas por error",
    razonArea: "Error en imputación de pagos",
  },
  {
    area: "Deposito",
    tipo: "Externo",
    sistema: "App Picking",
    n_cliente: "10831",
    motivo: "No llegó el pedido PWF",
    descripcion: "El cliente dice que PWF nunca le llegaron",
    razonArea: "Pedido no llegó al cliente",
  },
  {
    area: "Compras",
    tipo: "Externo",
    sistema: "Lupa",
    n_cliente: "03426",
    motivo: "Amortiguadores nuevos defectuosos",
    descripcion:
      "Los amortiguadores nuevos no sirven, tienen diferencia de 5cm en el vástago",
    razonArea: "Defecto del artículo del proveedor",
  },
];
