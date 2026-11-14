import { after, NextResponse } from "next/server";
import {
  AddKnowledgeTextParamsSchema,
  AddKnowledgeTextRequestSchema,
  ListKnowledgeParamsSchema,
  type AddKnowledgeTextResponse,
  type ListKnowledgeResponse,
} from "@askwell/shared";
import { getOwnerPlan } from "../../../../../lib/accounts";
import { apiError, internalError, readJson } from "../../../../../lib/api/http";
import { limitMessage, processTextSource, reserveKnowledgeSource, toKnowledgeSource } from "../../../../../lib/knowledge";
import { getOwnedProject } from "../../../../../lib/projects";
import { knowledgeAdded } from "../../../../../lib/analytics";
import { trackServer } from "../../../../../lib/analytics/server";
import { createOwnerClient } from "../../../../../lib/supabase/owner";
import { createServiceClient } from "../../../../../lib/supabase/service";

type Context = { params: Promise<{ id: string }> };

/** GET /api/projects/:id/knowledge: the project's sources, newest first. Owner client, so RLS scopes them. */
export async function GET(_request: Request, { params }: Context) {
  const parsedParams = ListKnowledgeParamsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError(400, "validation_failed", "Invalid project id.");
  const { id } = parsedParams.data;

  try {
    if (!(await getOwnedProject(id))) return apiError(404, "not_found", "Project not found.");
    const { data, error } = await (await createOwnerClient())
      .from("knowledge_sources")
      .select("id, title, type, status, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false });
    if (error) return internalError("GET /api/projects/:id/knowledge", error);
    const body: ListKnowledgeResponse = { sources: data.map(toKnowledgeSource) };
    return NextResponse.json(body);
  } catch (error) {
    return internalError("GET /api/projects/:id/knowledge", error);
  }
}

/**
 * POST /api/projects/:id/knowledge: paste text. Reserves the source (plan limit in Postgres), answers
 * 201 right away, then chunks and embeds in the background with `after()`.
 */
export async function POST(request: Request, { params }: Context) {
  const parsedParams = AddKnowledgeTextParamsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError(400, "validation_failed", "Invalid project id.");
  const parsedBody = AddKnowledgeTextRequestSchema.safeParse(await readJson(request));
  if (!parsedBody.success) {
    return apiError(400, "validation_failed", "A title (1 to 200 characters) and some text are required.");
  }
  const { id } = parsedParams.data;
  const { title, text } = parsedBody.data;

  try {
    const project = await getOwnedProject(id);
    if (!project) return apiError(404, "not_found", "Project not found.");
    const planState = await getOwnerPlan();
    if (planState.status !== "ok") return internalError("POST /api/projects/:id/knowledge", "plan unavailable");
    const { plan } = planState;

    // Service client only after the ownership check and the server-side plan read.
    const reserved = await reserveKnowledgeSource({
      db: createServiceClient(),
      projectId: id,
      plan,
      title,
      type: "text",
      storageKey: null,
    });
    if (reserved.status === "limit_reached") return apiError(403, "plan_limit_reached", limitMessage(plan));

    const sourceId = reserved.source.id;
    after(() => processTextSource({ projectId: id, sourceId, text }));
    trackServer("knowledge_added", project.owner_id, knowledgeAdded({ projectId: id, sourceId, type: "text" }));
    const body: AddKnowledgeTextResponse = { source: toKnowledgeSource(reserved.source) };
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    return internalError("POST /api/projects/:id/knowledge", error);
  }
}
