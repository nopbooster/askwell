import { NextResponse } from "next/server";
import {
  DeleteProjectParamsSchema,
  UpdateProjectParamsSchema,
  UpdateProjectRequestSchema,
  type DeleteProjectResponse,
  type UpdateProjectResponse,
} from "@askwell/shared";
import { getOwnerPlan } from "../../../../lib/accounts";
import { createOwnerClient } from "../../../../lib/supabase/owner";
import { getOwnedProject, toProject } from "../../../../lib/projects";
import { removeProjectFiles } from "../../../../lib/knowledge";
import { createServiceClient } from "../../../../lib/supabase/service";
import { apiError, internalError, readJson } from "../../../../lib/api/http";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/projects/:id: rename. Owner client: RLS allows only `name`, only on the owner's rows. */
export async function PATCH(request: Request, { params }: Context) {
  const parsedParams = UpdateProjectParamsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError(400, "validation_failed", "Invalid project id.");
  const parsedBody = UpdateProjectRequestSchema.safeParse(await readJson(request));
  if (!parsedBody.success) return apiError(400, "validation_failed", "A project name (1 to 100 characters) is required.");

  try {
    const { data, error } = await (await createOwnerClient())
      .from("projects")
      .update({ name: parsedBody.data.name })
      .eq("id", parsedParams.data.id)
      .select("*")
      .maybeSingle();
    if (error) return internalError("PATCH /api/projects/:id", error);
    if (!data) return apiError(404, "not_found", "Project not found.");
    const planState = await getOwnerPlan();
    if (planState.status !== "ok") return internalError("PATCH /api/projects/:id", "plan unavailable");
    const body: UpdateProjectResponse = { project: toProject(data, planState.plan) };
    return NextResponse.json(body);
  } catch (error) {
    return internalError("PATCH /api/projects/:id", error);
  }
}

/**
 * DELETE /api/projects/:id. Owner client: RLS only lets the owner delete their own row.
 * First removes the project's files from Storage (service client, only after the ownership check).
 * If that fails the project stays, so the owner can retry and no file is orphaned.
 */
export async function DELETE(_request: Request, { params }: Context) {
  const parsedParams = DeleteProjectParamsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError(400, "validation_failed", "Invalid project id.");

  try {
    if (!(await getOwnedProject(parsedParams.data.id))) return apiError(404, "not_found", "Project not found.");
    await removeProjectFiles(createServiceClient(), parsedParams.data.id);
    const { data, error } = await (await createOwnerClient())
      .from("projects")
      .delete()
      .eq("id", parsedParams.data.id)
      .select("id")
      .maybeSingle();
    if (error) return internalError("DELETE /api/projects/:id", error);
    if (!data) return apiError(404, "not_found", "Project not found.");
    const body: DeleteProjectResponse = { ok: true };
    return NextResponse.json(body);
  } catch (error) {
    return internalError("DELETE /api/projects/:id", error);
  }
}
