import { NextResponse } from "next/server";
import { UploadUrlParamsSchema, UploadUrlRequestSchema, type UploadUrlResponse } from "@askwell/shared";
import { getOwnerPlan } from "../../../../../../lib/accounts";
import { apiError, internalError, readJson } from "../../../../../../lib/api/http";
import {
  KNOWLEDGE_BUCKET,
  knowledgeFileKind,
  limitMessage,
  reserveKnowledgeSource,
  toKnowledgeSource,
} from "../../../../../../lib/knowledge";
import { getOwnedProject } from "../../../../../../lib/projects";
import { createServiceClient } from "../../../../../../lib/supabase/service";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/knowledge/upload-url: reserves a file source (`uploading`, counts toward the
 * limit) and returns a one-time signed URL. The browser uploads straight to Storage; no file bytes
 * pass through this route.
 */
export async function POST(request: Request, { params }: Context) {
  const parsedParams = UploadUrlParamsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError(400, "validation_failed", "Invalid project id.");
  const parsedBody = UploadUrlRequestSchema.safeParse(await readJson(request));
  if (!parsedBody.success) {
    const paths = parsedBody.error.issues.map((i) => i.path[0]);
    if (paths.includes("fileName")) return apiError(400, "unsupported_file_type", "Upload a PDF, Markdown or TXT file.");
    if (parsedBody.error.issues.some((i) => i.path[0] === "sizeBytes" && i.code === "too_big")) {
      return apiError(400, "file_too_large", "Files can be up to 10 MB.");
    }
    return apiError(400, "validation_failed", "A title, a file name and the file size are required.");
  }
  const { id } = parsedParams.data;
  const { title, fileName } = parsedBody.data;
  const kind = knowledgeFileKind(fileName);
  if (!kind) return apiError(400, "unsupported_file_type", "Upload a PDF, Markdown or TXT file.");

  try {
    if (!(await getOwnedProject(id))) return apiError(404, "not_found", "Project not found.");
    const planState = await getOwnerPlan();
    if (planState.status !== "ok") return internalError("POST /api/projects/:id/knowledge/upload-url", "plan unavailable");
    const { plan } = planState;

    // The key is a fresh uuid, never the file name the browser sent.
    const storageKey = `${id}/${crypto.randomUUID()}${kind.ext}`;
    const db = createServiceClient();
    const reserved = await reserveKnowledgeSource({ db, projectId: id, plan, title, type: kind.type, storageKey });
    if (reserved.status === "limit_reached") return apiError(403, "plan_limit_reached", limitMessage(plan));

    const { data, error } = await db.storage.from(KNOWLEDGE_BUCKET).createSignedUploadUrl(storageKey);
    if (error || !data) {
      // Give the slot back, so a failed URL doesn't use up the plan limit.
      await db.from("knowledge_sources").delete().eq("id", reserved.source.id).eq("project_id", id);
      return internalError("POST /api/projects/:id/knowledge/upload-url", error ?? "no signed url");
    }
    const body: UploadUrlResponse = { source: toKnowledgeSource(reserved.source), uploadUrl: data.signedUrl };
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    return internalError("POST /api/projects/:id/knowledge/upload-url", error);
  }
}
