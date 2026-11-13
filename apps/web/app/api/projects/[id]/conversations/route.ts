import { NextResponse } from "next/server";
import { ListConversationsParamsSchema, type ListConversationsParams, type ListConversationsResponse } from "@askwell/shared";
import { apiError, internalError } from "../../../../../lib/api/http";
import { listProjectConversations } from "../../../../../lib/conversations";
import { getOwnedProject } from "../../../../../lib/projects";

type Context = { params: Promise<ListConversationsParams> };

/**
 * GET /api/projects/:id/conversations: the newest 50 conversations, newest first, each with a preview
 * of the first visitor message and its message count. Owner client only, so RLS scopes every read.
 */
export async function GET(_request: Request, { params }: Context) {
  const parsed = ListConversationsParamsSchema.safeParse(await params);
  if (!parsed.success) return apiError(400, "validation_failed", "Invalid project id.");
  const { id } = parsed.data;

  try {
    if (!(await getOwnedProject(id))) return apiError(404, "not_found", "Project not found.");
    const body: ListConversationsResponse = { conversations: await listProjectConversations(id) };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return internalError("GET /api/projects/:id/conversations", error);
  }
}
