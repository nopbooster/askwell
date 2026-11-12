import type { Plan } from "./plans";
import type { WidgetAnimation, WidgetPosition } from "./enums";

export type WidgetConfig = {
  buttonColor: string;
  position: WidgetPosition;
  label: string;
  animation: WidgetAnimation;
  headerText: string;
  showBadge: boolean;
};

/** The Free look. Column defaults of `widget_configs` must match these values. */
export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  buttonColor: "#4f46e5",
  position: "bottom-right",
  label: "Ask us",
  animation: "fade",
  headerText: "Ask us anything",
  showBadge: true,
};

/** What the widget may show for a plan. Free: defaults + badge, whatever is stored. */
export function applyPlan(config: WidgetConfig, plan: Plan): WidgetConfig {
  if (plan === "pro") return { ...config };
  return { ...DEFAULT_WIDGET_CONFIG };
}
