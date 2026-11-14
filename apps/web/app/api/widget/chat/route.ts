import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
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
  isFirstConversation,
  loadHistory,
  matchChunks,
  saveChatTurn,
} from "../../../../lib/chat/data";
import { buildSystemPrompt, DONT_KNOW_REPLY, MODEL_ERROR_MESSAGE } from "../../../../lib/chat/prompt";
import {
  trackFirstChat,
  trackGeneration,
  trackMessageBlocked,
  visitorDistinctId,
  type GenerationTrace,
} from "../../../../lib/chat/telemetry";

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

/**
 * Runs analytics after the response is sent (Next.js `after`; on Vercel the function stays alive
 * until it settles, so events are flushed). Never delays or changes the reply, and never throws.
 */
function track(task: () => Promise<unknown>) {
  try {
    after(async () => {
      try {
        await task();
      } catch (error) {
        logFailure("analytics", error);
      }
    });
  } catch (error) {
    logFailure("analytics", error);
  }
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
  const visitor = visitorDistinctId(body.visitorId);
  const blockedKey = keyCheck.success ? keyCheck.data : null;
  if (limit.status === "rate_limited") {
    track(() => trackMessageBlocked(visitor, "rate_limit", blockedKey));
    return errorResponse(429, "rate_limited", "Too many messages. Try again in a minute.");
  }
  if (typeof body.message === "string" && body.message.length <= MAX_MESSAGE_CHARS * 4) {
    const injection = await detectPromptInjection(request, body.message);
    if (injection.status === "injection") {
      track(() => trackMessageBlocked(visitor, "prompt_injection", blockedKey));
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
  // 7 (prepared here, sent after the response). One trace per model call; no call, no trace.
  let generation: Omit<GenerationTrace, "conversationId"> | null = null;
  const sendGeneration = (savedConversationId: string | null) => {
    const trace = generation;
    if (trace) track(() => trackGeneration(visitorId, { ...trace, conversationId: savedConversationId }));
  };

  let reply: string;
  try {
    const [embedding] = await embedTexts([message]);
    const chunks = embedding ? await matchChunks(project.id, embedding, RETRIEVAL_TOP_K) : [];
    if (chunks.length === 0) {
      reply = DONT_KNOW_REPLY;
    } else {
      const history = conversationId ? await loadHistory(conversationId) : [];
      const base = { traceId: randomUUID(), projectId: project.id, chunks: chunks.length, historyMessages: history.length };
      const started = performance.now();
      try {
        const result = await chatComplete({
          system: buildSystemPrompt(chunks),
          messages: [...history, { role: "user", content: message }],
        });
        generation = { ...base, usage: result.usage, latencyMs: performance.now() - started, errorName: null };
        reply = result.text.trim() || DONT_KNOW_REPLY;
      } catch (error) {
        const errorName = error instanceof Error ? error.constructor.name || error.name : "Error";
        generation = { ...base, usage: null, latencyMs: performance.now() - started, errorName };
        throw error;
      }
    }
  } catch (error) {
    logFailure("answer", error);
    sendGeneration(conversationId ?? null);
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
    sendGeneration(savedId);
    if (!conversationId) {
      // A new conversation: `first_chat` when it is the project's first (exactly one is).
      const ownerId = project.ownerId;
      const projectId = project.id;
      track(async () => {
        if (await isFirstConversation(projectId, savedId)) await trackFirstChat(ownerId, projectId, savedId);
      });
    }
    return json({ conversationId: savedId, reply }, 200);
  } catch (error) {
    logFailure("save", error);
    sendGeneration(conversationId ?? null);
    return errorResponse(500, "internal", "Something went wrong.");
  }
}
