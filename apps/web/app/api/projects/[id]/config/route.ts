import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  applyPlan,
  UpdateConfigParamsSchema,
  UpdateConfigRequestSchema,
  type UpdateConfigResponse,
} from "@askwell/shared";
import { getOwnerPlan } from "../../../../../lib/accounts";
import { apiError, internalError, readJson } from "../../../../../lib/api/http";
import { getOwnedProject } from "../../../../../lib/projects";
import { disallowedConfigFields, toWidgetConfigColumns } from "../../../../../lib/projects/config";
import { createServiceClient } from "../../../../../lib/supabase/service";
import { mapWidgetConfigRow } from "../../../../../lib/widget/config";

type Context = { params: Promise<{ id: string }> };

const CONFIG_COLUMNS = "button_color, position, label, animation, header_text, show_badge";

/**
 * PATCH /api/projects/:id/config: save the widget look (project.md §6.8, Pro only).
 * Order: Clerk session (401) → input (400) → ownership through the owner client (404) → plan read on
 * the server from `accounts` (RLS) → plan check against PLAN_LIMITS (402, nothing written) → service-
 * client write, only after all of the above. Nothing in the request can set or claim a plan.
 */
export async function PATCH(request: Request, { params }: Context) {
  const { userId } = await auth();
  if (!userId) return apiError(401, "unauthorized", "Sign in to use this API.");

  const parsedParams = UpdateConfigParamsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError(400, "validation_failed", "Invalid project id.");
  const parsedBody = UpdateConfigRequestSchema.safeParse(await readJson(request));
  if (!parsedBody.success) return apiError(400, "validation_failed", "Invalid widget settings.");
  const { id } = parsedParams.data;
  const update = parsedBody.data;

  try {
    if (!(await getOwnedProject(id))) return apiError(404, "not_found", "Project not found.");

    const planState = await getOwnerPlan();
    if (planState.status !== "ok") return internalError("PATCH /api/projects/:id/config", "plan unavailable");
    const { plan } = planState;
    if (disallowedConfigFields(update, plan).length > 0) {
      return apiError(402, "payment_required", "Customizing the widget is a Pro feature. Upgrade to Pro to save changes.");
    }

    // Service client only after the ownership check and the server-side plan check. Upsert, so a
    // project without a row (create_project always makes one) still saves; unsent fields keep
    // their stored value, or the column default.
    const { data, error } = await createServiceClient()
      .from("widget_configs")
      .upsert({ project_id: id, ...toWidgetConfigColumns(update) }, { onConflict: "project_id" })
      .select(CONFIG_COLUMNS)
      .single();
    if (error) return internalError("PATCH /api/projects/:id/config", error);

    const body: UpdateConfigResponse = { config: applyPlan(mapWidgetConfigRow(data), plan) };
    return NextResponse.json(body);
  } catch (error) {
    return internalError("PATCH /api/projects/:id/config", error);
  }
}
