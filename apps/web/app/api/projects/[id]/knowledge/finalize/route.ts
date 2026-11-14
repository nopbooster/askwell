import { after, NextResponse } from "next/server";
import {
  FinalizeKnowledgeParamsSchema,
  FinalizeKnowledgeRequestSchema,
  MAX_KNOWLEDGE_FILE_BYTES,
  type ApiErrorCode,
  type FinalizeKnowledgeResponse,
  type KnowledgeSourceType,
} from "@askwell/shared";
import { apiError, internalError, readJson } from "../../../../../../lib/api/http";
import {
  isPdf,
  KNOWLEDGE_BUCKET,
  processFileSource,
  removeKnowledgeFiles,
  toKnowledgeSource,
} from "../../../../../../lib/knowledge";
import { getOwnedProject } from "../../../../../../lib/projects";
import { knowledgeAdded } from "../../../../../../lib/analytics";
import { trackServer } from "../../../../../../lib/analytics/server";
import { createOwnerClient } from "../../../../../../lib/supabase/owner";
import { createServiceClient } from "../../../../../../lib/supabase/service";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/knowledge/finalize: claims the uploaded source once (`uploading` →
 * `processing`), checks the real size and the PDF bytes, then extracts and embeds in the background.
 * A refused file is deleted from Storage and its source is removed.
 */
export async function POST(request: Request, { params }: Context) {
  const parsedParams = FinalizeKnowledgeParamsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError(400, "validation_failed", "Invalid project id.");
  const parsedBody = FinalizeKnowledgeRequestSchema.safeParse(await readJson(request));
  if (!parsedBody.success) return apiError(400, "validation_failed", "A source id is required.");
  const { id: projectId } = parsedParams.data;
  const { sourceId } = parsedBody.data;

  try {
    const project = await getOwnedProject(projectId);
    if (!project) return apiError(404, "not_found", "Project not found.");

    // Service client only after the ownership check. The claim is one statement, so it succeeds once.
    const db = createServiceClient();
    const { data: claimed, error: claimError } = await db.rpc("claim_knowledge_source", {
      p_source_id: sourceId,
      p_project_id: projectId,
    });
    if (claimError) return internalError("POST /api/projects/:id/knowledge/finalize", claimError);
    const source = claimed?.[0];
    if (!source) {
      // Nothing claimed: it doesn't exist in this project (404), or it was already claimed (409).
      const { data: existing, error } = await (await createOwnerClient())
        .from("knowledge_sources")
        .select("id")
        .eq("id", sourceId)
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) return internalError("POST /api/projects/:id/knowledge/finalize", error);
      return existing
        ? apiError(409, "conflict", "This upload was already finalized.")
        : apiError(404, "not_found", "Upload not found.");
    }

    const storageKey = source.storage_key;
    const type = source.type as KnowledgeSourceType;
    if (!storageKey || type === "text") {
      return internalError("POST /api/projects/:id/knowledge/finalize", "claimed source has no file");
    }

    /** Refuses the upload: deletes the file and the source, then answers 400. */
    const reject = async (code: ApiErrorCode, message: string) => {
      try {
        await removeKnowledgeFiles(db, [storageKey]);
      } catch (error) {
        console.error("[knowledge] could not delete a refused file", error);
      }
      const { error } = await db.from("knowledge_sources").delete().eq("id", sourceId).eq("project_id", projectId);
      if (error) console.error("[knowledge] could not delete a refused source", error.message);
      return apiError(400, code, message);
    };

    const { data: blob, error: downloadError } = await db.storage.from(KNOWLEDGE_BUCKET).download(storageKey);
    if (downloadError || !blob) {
      return reject("validation_failed", "The file was not uploaded. Try again.");
    }
    if (blob.size > MAX_KNOWLEDGE_FILE_BYTES) return reject("file_too_large", "Files can be up to 10 MB.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (type === "pdf" && !isPdf(bytes)) return reject("unsupported_file_type", "This file is not a real PDF.");

    after(() => processFileSource({ projectId, sourceId, type, bytes }));
    // Counted here, once the file passed the real checks; `upload-url` only reserves a slot.
    trackServer("knowledge_added", project.owner_id, knowledgeAdded({ projectId, sourceId, type }));
    const body: FinalizeKnowledgeResponse = { source: toKnowledgeSource(source) };
    return NextResponse.json(body);
  } catch (error) {
    return internalError("POST /api/projects/:id/knowledge/finalize", error);
  }
}
