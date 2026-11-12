import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  CreateProjectRequestSchema,
  PLAN_LIMITS,
  type CreateProjectResponse,
  type ListProjectsResponse,
} from "@askwell/shared";
import { ensureAccount, getOwnerPlan } from "../../../lib/accounts";
import { createOwnerClient } from "../../../lib/supabase/owner";
import { createServiceClient } from "../../../lib/supabase/service";
import { toProject } from "../../../lib/projects";
import { apiError, internalError, readJson } from "../../../lib/projects/http";

/**
 * GET /api/projects: the owner's projects, newest first. Owner client, so RLS scopes the rows.
 * Ensures the accounts row first (idempotent), so a brand-new owner gets `free` and an empty list
 * instead of an error when they call the API before opening the dashboard.
 */
export async function GET() {
  try {
    await ensureAccount();
    const planState = await getOwnerPlan();
    if (planState.status !== "ok") return internalError("GET /api/projects", "plan unavailable");
    const { data, error } = await (await createOwnerClient())
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return internalError("GET /api/projects", error);
    const body: ListProjectsResponse = {
      projects: data.map((row) => toProject(row, planState.plan)),
      plan: planState.plan,
    };
    return NextResponse.json(body);
  } catch (error) {
    return internalError("GET /api/projects", error);
  }
}

/** POST /api/projects: create a project. The plan limit is checked in Postgres, with the plan read here. */
export async function POST(request: Request) {
  const parsed = CreateProjectRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "validation_failed", "A project name (1 to 100 characters) is required.");

  try {
    const { userId } = await auth();
    if (!userId) return apiError(401, "unauthorized", "Sign in to use this API.");
    await ensureAccount();
    // The plan comes from the database. Nothing in the request body can set it.
    const planState = await getOwnerPlan();
    if (planState.status !== "ok") return internalError("POST /api/projects", "plan unavailable");
    const { plan } = planState;

    // Service client only after auth and the plan read. The function locks, counts and inserts.
    const { data, error } = await createServiceClient().rpc("create_project", {
      p_owner_id: userId,
      p_name: parsed.data.name,
      p_max_projects: PLAN_LIMITS[plan].projects,
    });
    if (error) {
      if (error.message === "plan_limit_reached") {
        return apiError(
          403,
          "plan_limit_reached",
          plan === "free"
            ? "The Free plan includes 1 project. Upgrade to Pro to create more."
            : "You reached your project limit.",
        );
      }
      return internalError("POST /api/projects", error);
    }
    const body: CreateProjectResponse = { project: toProject(data, plan) };
    return NextResponse.json(body, { status: 201 });
  } catch (error) {
    return internalError("POST /api/projects", error);
  }
}
