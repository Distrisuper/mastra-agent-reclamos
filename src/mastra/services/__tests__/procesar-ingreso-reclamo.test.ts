import { describe, it, expect, vi } from "vitest";
import { procesarIngresoReclamo } from "../procesar-ingreso-reclamo";
import type { IngestReclamoPayload } from "../../api/schemas/ingest-reclamos-schema";

const basePayload: IngestReclamoPayload = {
  message: "Hola, tengo un problema",
  conversationId: "conv-1",
  messageId: "msg-1",
  source: "slack",
  reporter: { id: "U001", name: "Juan" },
};

function makeMockAgent(overrides: {
  text?: string;
  steps?: Array<{
    toolCalls?: Array<{ toolName: string; args?: Record<string, unknown> }>;
    toolResults?: Array<{ toolName: string; result: Record<string, unknown> }>;
  }>;
  shouldThrow?: boolean;
}) {
  return {
    generate: vi.fn().mockImplementation(async () => {
      if (overrides.shouldThrow) {
        throw new Error("Agent exploded");
      }
      return {
        text: overrides.text ?? "Respuesta del agente",
        steps: overrides.steps ?? [],
      };
    }),
  } as any;
}

describe("procesarIngresoReclamo", () => {
  it("returns 'conversing' when no tool calls", async () => {
    const agent = makeMockAgent({ text: "Contame más" });
    const result = await procesarIngresoReclamo(agent, basePayload);

    expect(result.success).toBe(true);
    expect(result.outcome).toBe("conversing");
    expect(result.replyText).toBe("Contame más");
    expect(result.claimCode).toBeNull();
  });

  it("returns 'submitted' when submitClaimTool succeeds", async () => {
    const agent = makeMockAgent({
      text: "Reclamo registrado",
      steps: [
        {
          toolCalls: [
            {
              type: "tool-call",
              payload: {
                toolCallId: "tc-1",
                toolName: "submitClaimTool",
                args: { nombre: "Juan", motivo: "test" },
              },
            },
          ],
          toolResults: [
            {
              type: "tool-result",
              payload: {
                toolCallId: "tc-1",
                toolName: "submitClaimTool",
                result: { success: true, reclamo_codigo: "REC-2026-00001" },
              },
            },
          ],
        },
      ],
    });

    const result = await procesarIngresoReclamo(agent, basePayload);

    expect(result.success).toBe(true);
    expect(result.outcome).toBe("submitted");
    expect(result.claimCode).toBe("REC-2026-00001");
  });

  it("returns 'error' when agent throws", async () => {
    const agent = makeMockAgent({ shouldThrow: true });
    const result = await procesarIngresoReclamo(agent, basePayload);

    expect(result.success).toBe(false);
    expect(result.outcome).toBe("error");
    expect(result.errors).toContain("Agent exploded");
  });
});
