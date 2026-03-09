import { z } from "zod";

export const reporterSchema = z.object({
  id: z.string().min(1, "reporter.id is required"),
  name: z.string().min(1, "reporter.name is required"),
});

export const ingestReclamoSchema = z.object({
  message: z.string().min(1, "message is required"),
  conversationId: z.string().min(1, "conversationId is required"),
  messageId: z.string().min(1, "messageId is required"),
  timestamp: z.string().min(1).optional(),
  source: z.string().min(1).default("external"),
  reporter: reporterSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ingestReclamoResponseSchema = z.object({
  success: z.boolean(),
  replyText: z.string(),
  outcome: z.enum(["conversing", "submitted", "error"]),
  conversation: z.object({
    conversationId: z.string(),
    messageId: z.string(),
    threadId: z.string(),
    resourceId: z.string(),
  }),
  source: z.object({
    name: z.string(),
    timestamp: z.string(),
  }),
  claimCode: z.string().nullable(),
  claimData: z.record(z.string(), z.unknown()).nullable(),
  errors: z.array(z.string()).optional(),
});

export type IngestReclamoPayload = z.infer<typeof ingestReclamoSchema>;
export type IngestReclamoResponse = z.infer<
  typeof ingestReclamoResponseSchema
>;
