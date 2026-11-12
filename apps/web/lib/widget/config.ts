import "server-only";
import { applyPlan, DEFAULT_WIDGET_CONFIG, type Plan, type WidgetConfig } from "@askwell/shared";
import { createServiceClient } from "../supabase/service";

/** The `widget_configs` columns this module reads. */
export type WidgetConfigRow = {
  button_color: string;
  position: string;
  label: string;
  animation: string;
  header_text: string;
  show_badge: boolean;
};

/** snake_case row → shared camelCase `WidgetConfig`. The only place the columns are mapped. */
export function mapWidgetConfigRow(row: WidgetConfigRow): WidgetConfig {
  return {
    buttonColor: row.button_color,
    position: row.position as WidgetConfig["position"],
    label: row.label,
    animation: row.animation as WidgetConfig["animation"],
    headerText: row.header_text,
    showBadge: row.show_badge,
  };
}

/**
 * Public widget look for a project, by its public key. Returns `null` when no project has the key.
 *
 * There is no owner session on this path, so it uses the service client. The key only identifies
 * the project: nothing but the plan-applied config leaves this function (no ids, no plan name).
 * The plan is read here on the server and applied with `applyPlan` (Free: defaults + badge).
 * Throws when the database read fails.
 */
export async function getWidgetConfigByKey(publicKey: string): Promise<WidgetConfig | null> {
  const { data, error } = await createServiceClient()
    .from("projects")
    .select("widget_configs(button_color, position, label, animation, header_text, show_badge), accounts(plan)")
    .eq("public_key", publicKey)
    .maybeSingle();
  if (error) throw new Error(`getWidgetConfigByKey: read failed (${error.message})`);
  if (!data) return null;

  const plan: Plan = data.accounts?.plan === "pro" ? "pro" : "free";
  const stored = data.widget_configs ? mapWidgetConfigRow(data.widget_configs) : DEFAULT_WIDGET_CONFIG;
  return applyPlan(stored, plan);
}
