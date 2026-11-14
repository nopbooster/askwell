import { PLAN_LIMITS, type Plan, type PlanLimits, type UpdateConfigRequest } from "@askwell/shared";
import type { WidgetConfigRow } from "../widget/config";

type ConfigField = keyof UpdateConfigRequest;

/** Which `PLAN_LIMITS[plan].customize` permission each widget field needs. */
const FIELD_PERMISSION: Record<ConfigField, keyof PlanLimits["customize"]> = {
  buttonColor: "color",
  position: "position",
  label: "label",
  animation: "animation",
  headerText: "headerText",
  showBadge: "hideBadge",
};

/**
 * The fields in `update` that `plan` may not change, per `PLAN_LIMITS` (the only source of plan rules).
 * Free may change none of them, so any Free save is refused. The plan must come from the server.
 */
export function disallowedConfigFields(update: UpdateConfigRequest, plan: Plan): ConfigField[] {
  const allowed = PLAN_LIMITS[plan].customize;
  return (Object.keys(update) as ConfigField[]).filter(
    (field) => update[field] !== undefined && !allowed[FIELD_PERMISSION[field]],
  );
}

/** Shared camelCase update → `widget_configs` columns. Only the fields that were sent. */
export function toWidgetConfigColumns(update: UpdateConfigRequest): Partial<WidgetConfigRow> {
  const columns: Partial<WidgetConfigRow> = {};
  if (update.buttonColor !== undefined) columns.button_color = update.buttonColor;
  if (update.position !== undefined) columns.position = update.position;
  if (update.label !== undefined) columns.label = update.label;
  if (update.animation !== undefined) columns.animation = update.animation;
  if (update.headerText !== undefined) columns.header_text = update.headerText;
  if (update.showBadge !== undefined) columns.show_badge = update.showBadge;
  return columns;
}
