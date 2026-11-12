import { NextResponse } from "next/server";
import { DeleteKnowledgeParamsSchema, type DeleteKnowledgeResponse } from "@askwell/shared";
import { apiError, internalError } from "../../../../lib/api/http";
import { removeKnowledgeFiles } from "../../../../lib/knowledge";
import { createOwnerClient } from "../../../../lib/supabase/owner";
import { createServiceClient } from "../../../../lib/supabase/service";

type Context = { params: Promise<{ id: string }> };

/**
 * DELETE /api/knowledge/:id: deletes the source's file and the source (its chunks cascade).
 * The source is loaded through the owner client, so RLS hides other owners' sources (404).
 * Owners have no delete grant on this table, so the delete itself uses the service client,
 * only after that ownership read.
 */
export async function DELETE(_request: Request, { params }: Context) {
  const parsedParams = DeleteKnowledgeParamsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError(400, "validation_failed", "Invalid source id.");
  const { id } = parsedParams.data;

  try {
    const { data: source, error } = await (await createOwnerClient())
      .from("knowledge_sources")
      .select("id, project_id, storage_key")
      .eq("id", id)
      .maybeSingle();
    if (error) return internalError("DELETE /api/knowledge/:id", error);
    if (!source) return apiError(404, "not_found", "Source not found.");

    const db = createServiceClient();
    // File first: if it fails the source stays, so the owner can retry and no file is orphaned.
    if (source.storage_key) await removeKnowledgeFiles(db, [source.storage_key]);
    const { error: deleteError } = await db
      .from("knowledge_sources")
      .delete()
      .eq("id", source.id)
      .eq("project_id", source.project_id);
    if (deleteError) return internalError("DELETE /api/knowledge/:id", deleteError);
    const body: DeleteKnowledgeResponse = { ok: true };
    return NextResponse.json(body);
  } catch (error) {
    return internalError("DELETE /api/knowledge/:id", error);
  }
}
