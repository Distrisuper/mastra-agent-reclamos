import { describe, it, expect } from "vitest";
import { parseClaimTemplateTool } from "../parse-claim-template-tool";

const makeContext = () => ({
  tracingContext: {
    currentSpan: {
      createChildSpan: () => ({
        end: () => {},
        error: () => {},
      }),
    },
  },
});

describe("parseClaimTemplateTool - Formato Texto Estructurado", () => {
  it("parsea plantilla en formato texto", async () => {
    const plantilla = `📋 PLANTILLA DE RECLAMO
Tipo: Interno
Sistema: Flexxus
Motivo: Error al importar DIMEs desde esta mañana
Descripción: Flexxus no importa DIMEs desde las 9am. Afecta solo a mi PC, los demás pueden importar normal.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.tipo_reclamo).toBe("Interno");
    expect(result.datos?.sistema).toBe("Flexxus");
    expect(result.datos?.n_cliente).toBe(null);
    expect(result.errores).toHaveLength(0);
  });

  it("parsea plantilla Externo con cliente", async () => {
    const plantilla = `📋 PLANTILLA DE RECLAMO
Tipo: Externo
Cliente N°: 45032
Sistema: Facturación Automática
Motivo: Error al facturar con Fact Auto desde ayer
Descripción: El cliente 45032 no puede facturar desde ayer. Le tira error de conexión. Afecta solo a ese cliente.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.tipo_reclamo).toBe("Externo");
    expect(result.datos?.n_cliente).toBe("45032");
    expect(result.errores).toHaveLength(0);
  });

  it("parsea plantilla con aliases de campos", async () => {
    const plantilla = `Tipo reclamo: Externo
Cliente: 45032
Sistema: Facturación Automática
Motivo: Error al facturar con Fact Auto desde ayer
Descripción: El cliente 45032 no puede facturar. Afecta solo a ese cliente. Desde ayer.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.n_cliente).toBe("45032");
  });

  it("normaliza tipo_reclamo case-insensitive", async () => {
    const plantilla = `Tipo: interNO
Sistema: Flexxus
Motivo: Error al importar DIMEs desde hoy
Descripción: Flexxus no importa DIMEs desde hoy. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.tipo_reclamo).toBe("Interno");
  });

  it("rechaza Externo sin n_cliente", async () => {
    const plantilla = `Tipo: Externo
Sistema: Facturación Automática
Motivo: Error al facturar con Fact Auto desde ayer
Descripción: El cliente no puede facturar desde ayer. Le tira error. Afecta a un cliente.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(false);
    expect(result.errores.some(e => e.includes("número de cliente"))).toBe(true);
  });

  it("inferir sistema con fuzzy match", async () => {
    const plantilla = `Tipo: interno
Sistema: facturacion
Motivo: Error al facturar desde hoy
Descripción: No factura desde hoy. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(["Facturación Automática", "Facturacion Automatica"]).toContain(result.datos?.sistema);
  });

  it("inferir area si no está presente", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Motivo: Error al importar DIMEs desde hoy
Descripción: Flexxus no importa DIMEs desde hoy. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.area).toBe("Administracion");
  });
});

describe("parseClaimTemplateTool - Validación de Descripción Sólida", () => {
  it("acepta descripción sólida (qué + alcance + cuándo)", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Motivo: Error al importar DIMEs desde esta mañana
Descripción: Flexxus no importa DIMEs desde las 9am. Afecta solo a mi PC, los demás pueden importar normal.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.errores).toHaveLength(0);
  });

  it("acepta descripción con advertencias si falta algo", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Motivo: Error al importar DIMEs
Descripción: Flexxus no importa DIMEs.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.advertencias).toBeDefined();
    expect(result.advertencias?.some(a => a.includes("Faltan") || a.includes("completa"))).toBe(true);
  });

  it("rechaza descripción vacía", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Motivo: Error al importar DIMEs`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(false);
    expect(result.errores.some(e => e.includes("descripción"))).toBe(true);
  });
});

describe("parseClaimTemplateTool - Validación de Motivo", () => {
  it("acepta motivo con 3+ palabras", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Motivo: Error al importar DIMEs
Descripción: Flexxus no importa DIMEs desde hoy. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
  });

  it("acepta motivo corto con advertencia", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Motivo: Error sistema
Descripción: El sistema falla desde hoy. Afecta a todos.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.advertencias).toBeDefined();
    expect(result.advertencias?.some(a => a.includes("corto"))).toBe(true);
  });

  it("rechaza motivo vacío", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Descripción: Flexxus no importa DIMEs desde hoy. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(false);
    expect(result.errores.some(e => e.includes("motivo"))).toBe(true);
  });
});

describe("parseClaimTemplateTool - Campos Obligatorios", () => {
  it("rechaza plantilla sin sistema", async () => {
    const plantilla = `Tipo: Interno
Motivo: Error al importar DIMEs desde esta mañana
Descripción: Flexxus no importa DIMEs desde las 9am. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(false);
    expect(result.errores.length).toBeGreaterThan(0);
  });

  it("rechaza plantilla sin descripcion", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Motivo: Error al importar DIMEs`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(false);
    expect(result.errores.some(e => e.includes("descripción"))).toBe(true);
  });

  it("rechaza plantilla vacía", async () => {
    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: "texto sin formato" },
      makeContext() as any,
    );

    expect(result.valida).toBe(false);
    expect(result.errores.some(e => e.includes("No se pudo parsear"))).toBe(true);
  });
});

describe("parseClaimTemplateTool - Prioridad", () => {
  it("acepta prioridad válida case-insensitive", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Prioridad: ALTA
Motivo: Error al importar DIMEs desde esta mañana
Descripción: Flexxus no importa DIMEs desde las 9am. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.prioridad).toBe("Alta");
  });

  it("asigna prioridad Normal por defecto", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Motivo: Error al importar DIMEs desde esta mañana
Descripción: Flexxus no importa DIMEs desde las 9am. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.prioridad).toBe("Normal");
  });
});

describe("parseClaimTemplateTool - Inferencia automática", () => {
  it("inferir área desde sistema (Flexxus -> Administracion)", async () => {
    const plantilla = `Tipo: Interno
Sistema: Flexxus
Motivo: Error al importar desde hoy
Descripción: Flexxus no importa desde hoy. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.area).toBe("Administracion");
  });

  it("inferir área desde sistema (Lupa -> Tv/comercial)", async () => {
    const plantilla = `Tipo: Interno
Sistema: Lupa
Motivo: Error en catálogo desde hoy
Descripción: Lupa no muestra catálogo desde hoy. Afecta a todos.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.area).toBe("Tv/comercial");
  });

  it("inferir tipo_reclamo a Interno por defecto", async () => {
    const plantilla = `Sistema: Flexxus
Motivo: Error al importar desde hoy
Descripción: Flexxus no importa desde hoy. Afecta solo a mi PC.`;

    const result = await parseClaimTemplateTool.execute!(
      { plantilla_texto: plantilla },
      makeContext() as any,
    );

    expect(result.valida).toBe(true);
    expect(result.datos?.tipo_reclamo).toBe("Interno");
    expect(result.datos?.n_cliente).toBe(null);
  });
});
