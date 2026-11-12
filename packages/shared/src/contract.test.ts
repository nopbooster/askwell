import { describe, expect, it } from "vitest";
import {
  AddKnowledgeTextRequestSchema,
  ApiErrorSchema,
  applyPlan,
  ChatRequestSchema,
  ChatResponseSchema,
  CreateProjectRequestSchema,
  DEFAULT_WIDGET_CONFIG,
  FinalizeKnowledgeRequestSchema,
  IdParamsSchema,
  MAX_KNOWLEDGE_FILE_BYTES,
  PLAN_LIMITS,
  PRO_PRICE,
  PUBLIC_KEY_REGEX,
  UpdateConfigRequestSchema,
  UpdateProjectRequestSchema,
  UploadUrlRequestSchema,
  WidgetConfigQuerySchema,
  WidgetConfigResponseSchema,
  type WidgetConfig,
} from "./index";

const KEY = "pk_abcdefghijklmnop1234";
const ID = "123e4567-e89b-42d3-a456-426614174000";

describe("PLAN_LIMITS (project.md §5)", () => {
  it("projects", () => {
    expect(PLAN_LIMITS.free.projects).toBe(1);
    expect(PLAN_LIMITS.pro.projects).toBe(5);
  });
  it("messages per month", () => {
    expect(PLAN_LIMITS.free.messagesPerMonth).toBe(100);
    expect(PLAN_LIMITS.pro.messagesPerMonth).toBe(2000);
  });
  it("knowledge sources", () => {
    expect(PLAN_LIMITS.free.knowledgeSources).toBe(3);
    expect(PLAN_LIMITS.pro.knowledgeSources).toBe(25);
  });
  it("customize permissions", () => {
    expect(Object.values(PLAN_LIMITS.free.customize).every((v) => v === false)).toBe(true);
    expect(Object.values(PLAN_LIMITS.pro.customize).every((v) => v === true)).toBe(true);
    expect(Object.keys(PLAN_LIMITS.pro.customize).sort()).toEqual(
      ["animation", "color", "headerText", "hideBadge", "label", "position"].sort(),
    );
  });
  it("PRO_PRICE is $19/month", () => {
    expect(PRO_PRICE).toEqual({ amountUsd: 19, interval: "month" });
  });
});

describe("applyPlan", () => {
  const stored: WidgetConfig = {
    buttonColor: "#ff0000",
    position: "top-left",
    label: "Help",
    animation: "scale",
    headerText: "Hi there",
    showBadge: false,
  };
  it("Free always gets defaults + badge", () => {
    const out = applyPlan(stored, "free");
    expect(out).toEqual(DEFAULT_WIDGET_CONFIG);
    expect(out.showBadge).toBe(true);
  });
  it("Pro keeps stored values", () => {
    expect(applyPlan(stored, "pro")).toEqual(stored);
  });
  it("does not mutate the input or the defaults", () => {
    applyPlan(stored, "free");
    expect(stored.buttonColor).toBe("#ff0000");
    expect(applyPlan(stored, "free")).not.toBe(DEFAULT_WIDGET_CONFIG);
  });
});

describe("public key", () => {
  it("matches pk_ + random", () => {
    expect(PUBLIC_KEY_REGEX.test(KEY)).toBe(true);
    expect(PUBLIC_KEY_REGEX.test("sk_abcdefghijklmnop1234")).toBe(false);
  });
});

describe("route schemas", () => {
  it("GET /api/widget/config", () => {
    expect(WidgetConfigQuerySchema.safeParse({ key: KEY }).success).toBe(true);
    expect(WidgetConfigQuerySchema.safeParse({ key: "bad" }).success).toBe(false);
    expect(WidgetConfigResponseSchema.safeParse(DEFAULT_WIDGET_CONFIG).success).toBe(true);
  });

  it("POST /api/widget/chat", () => {
    const ok = { key: KEY, visitorId: "v1", message: "hello" };
    expect(ChatRequestSchema.safeParse(ok).success).toBe(true);
    expect(ChatRequestSchema.safeParse({ ...ok, conversationId: ID }).success).toBe(true);
    expect(ChatRequestSchema.safeParse({ ...ok, message: "a".repeat(1001) }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ ...ok, message: "a".repeat(1000) }).success).toBe(true);
    expect(ChatRequestSchema.safeParse({ ...ok, key: "nope" }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ ...ok, conversationId: "not-a-uuid" }).success).toBe(false);
    expect(ChatResponseSchema.safeParse({ conversationId: ID, reply: "hi" }).success).toBe(true);
  });

  it("projects", () => {
    expect(CreateProjectRequestSchema.safeParse({ name: "My site" }).success).toBe(true);
    expect(CreateProjectRequestSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(UpdateProjectRequestSchema.safeParse({ name: "New" }).success).toBe(true);
    expect(UpdateProjectRequestSchema.safeParse({}).success).toBe(false);
    expect(IdParamsSchema.safeParse({ id: ID }).success).toBe(true);
    expect(IdParamsSchema.safeParse({ id: "123" }).success).toBe(false);
  });

  it("knowledge", () => {
    expect(AddKnowledgeTextRequestSchema.safeParse({ title: "FAQ", text: "Hello" }).success).toBe(true);
    expect(AddKnowledgeTextRequestSchema.safeParse({ title: "", text: "Hello" }).success).toBe(false);
    const up = { title: "Guide", fileName: "guide.PDF", sizeBytes: 1024 };
    expect(UploadUrlRequestSchema.safeParse(up).success).toBe(true);
    expect(UploadUrlRequestSchema.safeParse({ ...up, fileName: "x.exe" }).success).toBe(false);
    expect(
      UploadUrlRequestSchema.safeParse({ ...up, sizeBytes: MAX_KNOWLEDGE_FILE_BYTES + 1 }).success,
    ).toBe(false);
    expect(FinalizeKnowledgeRequestSchema.safeParse({ sourceId: ID }).success).toBe(true);
    expect(FinalizeKnowledgeRequestSchema.safeParse({ sourceId: "x" }).success).toBe(false);
  });

  it("PATCH /api/projects/:id/config", () => {
    expect(UpdateConfigRequestSchema.safeParse({ buttonColor: "#00ff00" }).success).toBe(true);
    expect(UpdateConfigRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateConfigRequestSchema.safeParse({ buttonColor: "green" }).success).toBe(false);
    expect(UpdateConfigRequestSchema.safeParse({ position: "middle" }).success).toBe(false);
    expect(UpdateConfigRequestSchema.safeParse({ animation: "spin" }).success).toBe(false);
  });

  it("error shape", () => {
    expect(
      ApiErrorSchema.safeParse({ error: { code: "payment_required", message: "Upgrade" } }).success,
    ).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { code: "teapot", message: "x" } }).success).toBe(false);
  });
});
