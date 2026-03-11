/**
 * Agente principal de reclamos — "Sofía".
 * Usa Dynamic Instructions con RequestContext para inyectar
 * userName y attachmentUrl por request.
 * Memory con thread/resource para conversación multi-turno.
 */

import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { buildSystemPrompt } from "../prompts/system-prompt-builder";
import { submitClaimTool } from "../tools/submit-claim-tool";
import { checkDuplicateClaimTool } from "../tools/check-duplicate-claim-tool";
import { parseClaimTemplateTool } from "../tools/parse-claim-template-tool";

export const reclamosAgent = new Agent({
  id: "reclamos-agent",
  name: "Agente de Reclamos - Sofía",
  description:
    "Agente conversacional para recolección y registro de reclamos. Personalidad Sofía, español rioplatense.",

  // Dynamic instructions: se construyen por request usando RequestContext
  instructions: async ({ requestContext }) => {
    const userName =
      (requestContext?.get("userName") as string) ?? "Usuario";
    const attachmentUrl =
      (requestContext?.get("attachmentUrl") as string) ?? null;
    return buildSystemPrompt(userName, attachmentUrl);
  },

  model:
    process.env.OPENROUTER_MODEL ||
    "openrouter/google/gemini-2.5-flash",

  tools: { parseClaimTemplateTool, checkDuplicateClaimTool, submitClaimTool },

  memory: new Memory({
    options: {
      lastMessages: 12, // Equivalente al contextWindowLength: 12 de n8n
    },
  }),
});
