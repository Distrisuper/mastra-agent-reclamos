import { describe, it, expect } from "vitest";
import { ingestReclamoSchema } from "../ingest-reclamos-schema";

const validPayload = {
  message: "Hola, tengo un problema con Flexxus",
  conversationId: "conv-123",
  messageId: "msg-456",
  reporter: {
    id: "U001",
    name: "Juan",
  },
};

describe("ingestReclamoSchema", () => {
  it("accepts a valid payload", () => {
    const result = ingestReclamoSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("defaults source to 'external'", () => {
    const result = ingestReclamoSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("external");
    }
  });

  it("rejects payload without message", () => {
    const { message, ...noMessage } = validPayload;
    const result = ingestReclamoSchema.safeParse(noMessage);
    expect(result.success).toBe(false);
  });

  it("rejects payload without reporter.id", () => {
    const result = ingestReclamoSchema.safeParse({
      ...validPayload,
      reporter: { name: "Juan" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty reporter.id", () => {
    const result = ingestReclamoSchema.safeParse({
      ...validPayload,
      reporter: { id: "", name: "Juan" },
    });
    expect(result.success).toBe(false);
  });
});
