import { NextResponse } from "next/server";
import {
  ChatRequestSchema,
  MAX_MESSAGE_CHARS,
  PLAN_LIMITS,
  PublicKeySchema,
  RETRIEVAL_TOP_K,
  type ApiError,
  type ChatResponse,
} from "@askwell/shared";
import { chatComplete, embedTexts } from "../../../../lib/ai";
import { detectPromptInjection, protectWidgetRequest } from "../../../../lib/arcjet";
import {
  consumeMessage,
  conversationBelongsToProject,
  findProjectByKey,
  loadHistory,
  matchChunks,
  saveChatTurn,
} from "../../../../lib/chat/data";
import { buildSystemPrompt, DONT_KNOW_REPLY, MODEL_ERROR_MESSAGE } from "../../../../lib/chat/prompt";

// Public route: any origin may call it, no credentials (project.md §9 CORS).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function json(body: ApiError | ChatResponse, status: number) {
  return NextResponse.json(body, { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } });
}

function errorResponse(status: number, code: ApiError["error"]["code"], message: string) {
  return json({ error: { code, message } }, status);
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" },
  });
}

/** Logs only the failing step and the error name/message; never the visitor's text. */
function logFailure(step: string, error: unknown) {
  console.error(`[widget/chat] ${step} failed`, error instanceof Error ? error.message : "");
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = undefined;
  }
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  // 1. Protect, before any database or AI work. A malformed key shares one bucket.
  const keyCheck = PublicKeySchema.safeParse(body.key);
  const limit = await protectWidgetRequest(request, {
    route: "chat",
    publicKey: keyCheck.success ? keyCheck.data : "invalid",
  });
  if (limit.status === "rate_limited") {
    // Phase 4: PostHog message_blocked event
    return errorResponse(429, "rate_limited", "Too many messages. Try again in a minute.");
  }
  if (typeof body.message === "string" && body.message.length <= MAX_MESSAGE_CHARS * 4) {
    const injection = await detectPromptInjection(request, body.message);
    if (injection.status === "injection") {
      // Phase 4: PostHog message_blocked event
      return errorResponse(400, "message_blocked", "That message can't be sent. Try rephrasing your question.");
    }
  }

  // 2. Validate. The project is resolved by public key only.
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "validation_failed", "Invalid request.");
  const { key, visitorId, conversationId, message } = parsed.data;

  let project;
  try {
    project = await findProjectByKey(key);
    if (!project) return errorResponse(404, "not_found", "Unknown key.");
    if (conversationId && !(await conversationBelongsToProject(conversationId, project.id))) {
      return errorResponse(404, "not_found", "Conversation not found.");
    }
  } catch (error) {
    logFailure("lookup", error);
    return errorResponse(500, "internal", "Something went wrong.");
  }

  // 3. Count, with the plan read on the server.
  try {
    const allowed = await consumeMessage(project.id, PLAN_LIMITS[project.plan].messagesPerMonth);
    if (!allowed) {
      return errorResponse(429, "quota_exceeded", "This chat has reached its monthly message limit.");
    }
  } catch (error) {
    logFailure("count", error);
    return errorResponse(500, "internal", "Something went wrong.");
  }

  // 4-5. Retrieve and answer. From here a failure still uses the message (no refund).
  let reply: string;
  try {
    const [embedding] = await embedTexts([message]);
    const chunks = embedding ? await matchChunks(project.id, embedding, RETRIEVAL_TOP_K) : [];
    if (chunks.length === 0) {
      reply = DONT_KNOW_REPLY;
    } else {
      const history = conversationId ? await loadHistory(conversationId) : [];
      const result = await chatComplete({
        system: buildSystemPrompt(chunks),
        messages: [...history, { role: "user", content: message }],
      });
      // Phase 4: PostHog AI trace (result.usage, project.id, conversationId)
      reply = result.text.trim() || DONT_KNOW_REPLY;
    }
  } catch (error) {
    logFailure("answer", error);
    return errorResponse(502, "internal", MODEL_ERROR_MESSAGE);
  }

  // 6. Save.
  try {
    const savedId = await saveChatTurn({
      projectId: project.id,
      conversationId: conversationId ?? null,
      visitorId,
      message,
      reply,
    });
    return json({ conversationId: savedId, reply }, 200);
  } catch (error) {
    logFailure("save", error);
    return errorResponse(500, "internal", "Something went wrong.");
  }
}
