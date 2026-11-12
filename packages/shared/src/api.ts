import { z } from "zod";
import {
  KNOWLEDGE_FILE_EXTENSIONS,
  MAX_KNOWLEDGE_FILE_BYTES,
  MAX_KNOWLEDGE_TEXT_CHARS,
  MAX_KNOWLEDGE_TITLE_CHARS,
  MAX_MESSAGE_CHARS,
  MAX_PROJECT_NAME_CHARS,
  MAX_VISITOR_ID_CHARS,
  MAX_WIDGET_HEADER_CHARS,
  MAX_WIDGET_LABEL_CHARS,
  PUBLIC_KEY_REGEX,
} from "./constants";
import {
  KNOWLEDGE_SOURCE_STATUSES,
  KNOWLEDGE_SOURCE_TYPES,
  MESSAGE_ROLES,
  WIDGET_ANIMATIONS,
  WIDGET_POSITIONS,
} from "./enums";
import { PLANS } from "./plans";

// ---------- Shared building blocks ----------

export const UuidSchema = z.uuid();
export const PublicKeySchema = z.string().regex(PUBLIC_KEY_REGEX, "Invalid public key");
const TimestampSchema = z.string(); // ISO 8601 string as returned by Postgres/JSON
const ProjectNameSchema = z.string().trim().min(1).max(MAX_PROJECT_NAME_CHARS);
const KnowledgeTitleSchema = z.string().trim().min(1).max(MAX_KNOWLEDGE_TITLE_CHARS);
const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #rrggbb color");

export const OkResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponseSchema>;

/** `:id` route param. */
export const IdParamsSchema = z.object({ id: UuidSchema });
export type IdParams = z.infer<typeof IdParamsSchema>;

// ---------- Errors ----------

export const API_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "validation_failed",
  "plan_limit_reached",
  "payment_required",
  "rate_limited",
  "quota_exceeded",
  "conflict",
  "unsupported_file_type",
  "file_too_large",
  "message_blocked",
  "internal",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export const ApiErrorSchema = z.object({
  error: z.object({ code: ApiErrorCodeSchema, message: z.string() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------- Widget config ----------

export const WidgetConfigSchema = z.object({
  buttonColor: HexColorSchema,
  position: z.enum(WIDGET_POSITIONS),
  label: z.string().trim().min(1).max(MAX_WIDGET_LABEL_CHARS),
  animation: z.enum(WIDGET_ANIMATIONS),
  headerText: z.string().trim().min(1).max(MAX_WIDGET_HEADER_CHARS),
  showBadge: z.boolean(),
});

// ---------- Public: GET /api/widget/config ----------

export const WidgetConfigQuerySchema = z.object({ key: PublicKeySchema });
export type WidgetConfigQuery = z.infer<typeof WidgetConfigQuerySchema>;
export const WidgetConfigResponseSchema = WidgetConfigSchema;
export type WidgetConfigResponse = z.infer<typeof WidgetConfigResponseSchema>;

// ---------- Public: POST /api/widget/chat ----------

export const ChatRequestSchema = z.object({
  key: PublicKeySchema,
  visitorId: z.string().min(1).max(MAX_VISITOR_ID_CHARS),
  conversationId: UuidSchema.optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export const ChatResponseSchema = z.object({
  conversationId: UuidSchema,
  reply: z.string(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ---------- Owner: projects ----------

export const ProjectSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  publicKey: PublicKeySchema,
  messagesUsed: z.number().int().nonnegative(),
  messagesLimit: z.number().int().nonnegative(),
  periodStart: TimestampSchema,
  createdAt: TimestampSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

// GET /api/projects
export const ListProjectsResponseSchema = z.object({
  projects: z.array(ProjectSchema),
  plan: z.enum(PLANS),
});
export type ListProjectsResponse = z.infer<typeof ListProjectsResponseSchema>;

// POST /api/projects
export const CreateProjectRequestSchema = z.object({ name: ProjectNameSchema });
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export const CreateProjectResponseSchema = z.object({ project: ProjectSchema });
export type CreateProjectResponse = z.infer<typeof CreateProjectResponseSchema>;

// PATCH /api/projects/:id (rename)
export const UpdateProjectParamsSchema = IdParamsSchema;
export type UpdateProjectParams = IdParams;
export const UpdateProjectRequestSchema = z.object({ name: ProjectNameSchema });
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;
export const UpdateProjectResponseSchema = z.object({ project: ProjectSchema });
export type UpdateProjectResponse = z.infer<typeof UpdateProjectResponseSchema>;

// DELETE /api/projects/:id
export const DeleteProjectParamsSchema = IdParamsSchema;
export type DeleteProjectParams = IdParams;
export const DeleteProjectResponseSchema = OkResponseSchema;
export type DeleteProjectResponse = OkResponse;

// ---------- Owner: knowledge ----------

export const KnowledgeSourceSchema = z.object({
  id: UuidSchema,
  title: z.string(),
  type: z.enum(KNOWLEDGE_SOURCE_TYPES),
  status: z.enum(KNOWLEDGE_SOURCE_STATUSES),
  createdAt: TimestampSchema,
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

// GET /api/projects/:id/knowledge (list sources; `uploading` is shown as processing by the UI)
export const ListKnowledgeParamsSchema = IdParamsSchema;
export type ListKnowledgeParams = IdParams;
export const ListKnowledgeResponseSchema = z.object({
  sources: z.array(KnowledgeSourceSchema),
});
export type ListKnowledgeResponse = z.infer<typeof ListKnowledgeResponseSchema>;

// POST /api/projects/:id/knowledge (paste text)
export const AddKnowledgeTextParamsSchema = IdParamsSchema;
export type AddKnowledgeTextParams = IdParams;
export const AddKnowledgeTextRequestSchema = z.object({
  title: KnowledgeTitleSchema,
  text: z.string().trim().min(1).max(MAX_KNOWLEDGE_TEXT_CHARS),
});
export type AddKnowledgeTextRequest = z.infer<typeof AddKnowledgeTextRequestSchema>;
export const AddKnowledgeTextResponseSchema = z.object({ source: KnowledgeSourceSchema });
export type AddKnowledgeTextResponse = z.infer<typeof AddKnowledgeTextResponseSchema>;

// POST /api/projects/:id/knowledge/upload-url
export const UploadUrlParamsSchema = IdParamsSchema;
export type UploadUrlParams = IdParams;
export const UploadUrlRequestSchema = z.object({
  title: KnowledgeTitleSchema,
  fileName: z
    .string()
    .min(1)
    .max(255)
    .refine(
      (name) => KNOWLEDGE_FILE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)),
      "Unsupported file type",
    ),
  sizeBytes: z.number().int().positive().max(MAX_KNOWLEDGE_FILE_BYTES),
});
export type UploadUrlRequest = z.infer<typeof UploadUrlRequestSchema>;
export const UploadUrlResponseSchema = z.object({
  source: KnowledgeSourceSchema,
  uploadUrl: z.url(),
});
export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;

// POST /api/projects/:id/knowledge/finalize
export const FinalizeKnowledgeParamsSchema = IdParamsSchema;
export type FinalizeKnowledgeParams = IdParams;
export const FinalizeKnowledgeRequestSchema = z.object({ sourceId: UuidSchema });
export type FinalizeKnowledgeRequest = z.infer<typeof FinalizeKnowledgeRequestSchema>;
export const FinalizeKnowledgeResponseSchema = z.object({ source: KnowledgeSourceSchema });
export type FinalizeKnowledgeResponse = z.infer<typeof FinalizeKnowledgeResponseSchema>;

// DELETE /api/knowledge/:id
export const DeleteKnowledgeParamsSchema = IdParamsSchema;
export type DeleteKnowledgeParams = IdParams;
export const DeleteKnowledgeResponseSchema = OkResponseSchema;
export type DeleteKnowledgeResponse = OkResponse;

// ---------- Owner: conversations ----------

export const ConversationSummarySchema = z.object({
  id: UuidSchema,
  visitorId: z.string(),
  firstMessagePreview: z.string(),
  messageCount: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const ChatMessageSchema = z.object({
  id: UuidSchema,
  role: z.enum(MESSAGE_ROLES),
  body: z.string(),
  createdAt: TimestampSchema,
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// GET /api/projects/:id/conversations (newest first)
export const ListConversationsParamsSchema = IdParamsSchema;
export type ListConversationsParams = IdParams;
export const ListConversationsResponseSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
});
export type ListConversationsResponse = z.infer<typeof ListConversationsResponseSchema>;

// GET /api/conversations/:id
export const GetConversationParamsSchema = IdParamsSchema;
export type GetConversationParams = IdParams;
export const GetConversationResponseSchema = z.object({
  conversation: ConversationSummarySchema,
  messages: z.array(ChatMessageSchema),
});
export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;

// ---------- Owner: PATCH /api/projects/:id/config ----------

export const UpdateConfigParamsSchema = IdParamsSchema;
export type UpdateConfigParams = IdParams;
export const UpdateConfigRequestSchema = WidgetConfigSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  "Send at least one field",
);
export type UpdateConfigRequest = z.infer<typeof UpdateConfigRequestSchema>;
export const UpdateConfigResponseSchema = z.object({ config: WidgetConfigSchema });
export type UpdateConfigResponse = z.infer<typeof UpdateConfigResponseSchema>;

// ---------- System: GET /api/posthog-config (no input) ----------

export const PosthogConfigResponseSchema = z.object({
  key: z.string(),
  host: z.url(),
});
export type PosthogConfigResponse = z.infer<typeof PosthogConfigResponseSchema>;

// ---------- System: POST /api/clerk/webhook (response only; input is Clerk's payload) ----------

export const ClerkWebhookResponseSchema = z.object({ received: z.literal(true) });
export type ClerkWebhookResponse = z.infer<typeof ClerkWebhookResponseSchema>;
