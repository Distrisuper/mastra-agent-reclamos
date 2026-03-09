import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../system-prompt-builder";
import { getAllAreas } from "../../config/areas";
import { getAllSistemas } from "../../config/sistemas";
import { getAllPrioridades } from "../../config/prioridades";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt("TestUser", null);

  it("includes all areas", () => {
    for (const area of getAllAreas()) {
      expect(prompt).toContain(area.nombre);
    }
  });

  it("includes all sistemas", () => {
    for (const sistema of getAllSistemas()) {
      expect(prompt).toContain(sistema.nombre);
    }
  });

  it("includes 3 priority levels", () => {
    for (const p of getAllPrioridades()) {
      expect(prompt).toContain(p.nivel);
    }
  });

  it("injects userName", () => {
    expect(prompt).toContain("TestUser");
  });

  it("injects attachmentUrl when present", () => {
    const withAttachment = buildSystemPrompt("User", "https://example.com/file.png");
    expect(withAttachment).toContain("https://example.com/file.png");
  });

  it("does not contain attachment marker when null", () => {
    expect(prompt).not.toContain("ADJUNTO YA DETECTADO");
  });
});
