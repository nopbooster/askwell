import { PLAN_LIMITS, PRO_PRICE, type Plan } from "@askwell/shared";

export type PricingPlan = {
  plan: Plan;
  name: string;
  /** "$0" or "$19" */
  price: string;
  /** "forever" or "per month" */
  priceNote: string;
  features: string[];
  highlighted: boolean;
};

const nf = new Intl.NumberFormat("en-US");

function plural(n: number, one: string, many: string): string {
  return `${nf.format(n)} ${n === 1 ? one : many}`;
}

function featuresFor(plan: Plan): string[] {
  const limits = PLAN_LIMITS[plan];
  const { customize } = limits;
  return [
    plural(limits.projects, "project", "projects"),
    `${nf.format(limits.messagesPerMonth)} messages per month, per project`,
    `${plural(limits.knowledgeSources, "knowledge source", "knowledge sources")} per project`,
    customize.color && customize.position && customize.label && customize.animation && customize.headerText
      ? "Custom button color, position, label, animation and header"
      : "Default widget look",
    customize.hideBadge ? "No “Powered by” badge" : "“Powered by” badge shown",
  ];
}

/** Pricing cards, built only from the shared plan limits and price. */
export function getPricingPlans(): PricingPlan[] {
  return [
    {
      plan: "free",
      name: "Free",
      price: "$0",
      priceNote: "forever",
      features: featuresFor("free"),
      highlighted: false,
    },
    {
      plan: "pro",
      name: "Pro",
      price: `$${PRO_PRICE.amountUsd}`,
      priceNote: `per ${PRO_PRICE.interval}`,
      features: featuresFor("pro"),
      highlighted: true,
    },
  ];
}
