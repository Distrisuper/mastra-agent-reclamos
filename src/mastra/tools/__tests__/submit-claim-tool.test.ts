import { describe, it, expect, vi, afterEach } from "vitest";
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("passes validation and submits to n8n webhook", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        reclamo_codigo: "REC-TEST-001",
        mensaje: "Guardado",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = (await submitClaimTool.execute!(
      validInput,
      makeContext() as any,
    )) as { success: boolean; reclamo_codigo?: string };

    expect(result.success).toBe(true);
    expect(result.reclamo_codigo).toBe("REC-TEST-001");
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
  });
});
