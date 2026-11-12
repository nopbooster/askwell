export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export type PlanLimits = {
  /** Max projects per account. */
  projects: number;
  /** Max accepted chat messages per month, per project. */
  messagesPerMonth: number;
  /** Max knowledge sources per project (files + pasted text, incl. uploading). */
  knowledgeSources: number;
  /** Which widget fields the plan may customize. */
  customize: {
    color: boolean;
    position: boolean;
    label: boolean;
    animation: boolean;
    headerText: boolean;
    /** True when the plan may hide the "Powered by" badge. */
    hideBadge: boolean;
  };
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    projects: 1,
    messagesPerMonth: 100,
    knowledgeSources: 3,
    customize: {
      color: false,
      position: false,
      label: false,
      animation: false,
      headerText: false,
      hideBadge: false,
    },
  },
  pro: {
    projects: 5,
    messagesPerMonth: 2000,
    knowledgeSources: 25,
    customize: {
      color: true,
      position: true,
      label: true,
      animation: true,
      headerText: true,
      hideBadge: true,
    },
  },
};

export const PRO_PRICE = { amountUsd: 19, interval: "month" } as const;
