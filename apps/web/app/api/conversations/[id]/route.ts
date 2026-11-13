import { NextResponse } from "next/server";
import { GetConversationParamsSchema, type GetConversationResponse } from "@askwell/shared";
import { apiError, internalError } from "../../../../lib/api/http";
import { getConversationThread } from "../../../../lib/conversations";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/conversations/:id: one conversation and its messages, oldest first. Owner client only, so
 * RLS decides: another owner's conversation is a 404, the same as a missing one.
 */
export async function GET(_request: Request, { params }: Context) {
  const parsed = GetConversationParamsSchema.safeParse(await params);
  if (!parsed.success) return apiError(400, "validation_failed", "Invalid conversation id.");

  try {
    const thread = await getConversationThread(parsed.data.id);
    if (!thread) return apiError(404, "not_found", "Conversation not found.");
    const body: GetConversationResponse = thread;
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return internalError("GET /api/conversations/:id", error);
  }
}
