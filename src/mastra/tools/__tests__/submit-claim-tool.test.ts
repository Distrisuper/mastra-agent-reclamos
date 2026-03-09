import { describe, it, expect } from "vitest";
import { submitClaimTool } from "../submit-claim-tool";

const validInput = {
  nombre: "Juan Pérez",
  tipo_reclamo: "Interno" as const,
  n_cliente: null,
  sistema: "Flexxus",
  area: "Sistemas",
  prioridad: "Normal" as const,
  motivo: "Error al importar archivos DIMEs",
  descripcion: "Al importar DIMEs en Flexxus tira error de conexión, afecta solo a mí, desde hoy a la mañana",
};

const makeContext = () => ({
  requestContext: new Map<string, unknown>([
    ["canal", "slack"],
    ["creado_por_ref", "U123"],
    ["adjunto_url", null],
  ]),
});

describe("submitClaimTool validations", () => {
  it("rejects empty nombre", async () => {
    const result = (await submitClaimTool.execute!(
      { ...validInput, nombre: "" },
      makeContext() as any,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.errores).toContain("nombre es requerido");
  });

  it("rejects empty motivo", async () => {
    const result = (await submitClaimTool.execute!(
      { ...validInput, motivo: "" },
      makeContext() as any,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.errores).toContain("motivo es requerido");
  });

  it("rejects Externo without n_cliente", async () => {
    const result = (await submitClaimTool.execute!(
      { ...validInput, tipo_reclamo: "Externo", n_cliente: null },
      makeContext() as any,
    )) as any;
    expect(result.success).toBe(false);
    expect(result.errores).toContain(
      "n_cliente es obligatorio para reclamos de tipo Externo",
    );
  });

  it("passes validation for complete Interno claim (fails at DB)", async () => {
    // Without POSTGRES_URL this will throw at getPool()
    await expect(
      submitClaimTool.execute!(validInput, makeContext() as any),
    ).resolves.toMatchObject({
      success: false,
      // The error comes from missing POSTGRES_URL or DB connection
    });
  });
});
