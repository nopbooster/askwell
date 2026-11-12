import { PLAN_LIMITS, PRO_PRICE } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { getPricingPlans } from "./pricing";

describe("getPricingPlans", () => {
  const [free, pro] = getPricingPlans();

  it("returns Free then Pro", () => {
    expect(getPricingPlans().map((p) => p.plan)).toEqual(["free", "pro"]);
  });

  it("takes the Pro price from PRO_PRICE", () => {
    expect(pro?.price).toBe(`$${PRO_PRICE.amountUsd}`);
    expect(pro?.priceNote).toBe(`per ${PRO_PRICE.interval}`);
  });

  it("takes every limit from PLAN_LIMITS", () => {
    expect(free?.features.join("|")).toContain(`${PLAN_LIMITS.free.messagesPerMonth} messages`);
    expect(free?.features.join("|")).toContain(`${PLAN_LIMITS.free.knowledgeSources} knowledge sources`);
    expect(pro?.features.join("|")).toContain("2,000 messages");
    expect(pro?.features.join("|")).toContain(`${PLAN_LIMITS.pro.projects} projects`);
  });

  it("uses singular for one project and shows the badge on Free only", () => {
    expect(free?.features[0]).toBe("1 project");
    expect(free?.features.at(-1)).toContain("shown");
    expect(pro?.features.at(-1)).toContain("No");
  });

  it("highlights only Pro", () => {
    expect([free?.highlighted, pro?.highlighted]).toEqual([false, true]);
  });
});
