import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { captureServer } = vi.hoisted(() => ({ captureServer: vi.fn() }));
vi.mock("../posthog/server", () => ({ captureServer }));

import {
  firstChatProperties,
  generationProperties,
  messageBlockedProperties,
  trackFirstChat,
  trackGeneration,
  trackMessageBlocked,
  visitorDistinctId,
  type GenerationTrace,
} from "./telemetry";

beforeEach(() => captureServer.mockReset().mockResolvedValue(undefined));

const trace: GenerationTrace = {
  traceId: "t1",
  projectId: "p1",
  conversationId: "c1",
  usage: { inputTokens: 2000, outputTokens: 100 },
  latencyMs: 1234.6,
  errorName: null,
  chunks: 5,
  historyMessages: 6,
};

describe("visitorDistinctId", () => {
  it("uses the widget's visitor ID", () => {
    expect(visitorDistinctId("v_abc")).toBe("v_abc");
  });
  it("falls back to a fresh random ID for a missing, empty, too long or non-string value", () => {
    for (const raw of [undefined, "", "x".repeat(500), 42, { a: 1 }]) {
      expect(visitorDistinctId(raw)).toMatch(/^anon_[0-9a-f-]{36}$/);
    }
    expect(visitorDistinctId(undefined)).not.toBe(visitorDistinctId(undefined));
  });
});

describe("messageBlockedProperties", () => {
  it("has the reason, the public key when valid, and is personless", () => {
    expect(messageBlockedProperties("rate_limit", "pk_x")).toEqual({
      reason: "rate_limit",
      public_key: "pk_x",
      $process_person_profile: false,
    });
    expect(messageBlockedProperties("prompt_injection", null)).toEqual({
      reason: "prompt_injection",
      $process_person_profile: false,
    });
  });
});

describe("generationProperties", () => {
  it("maps a reply to PostHog's $ai_generation properties, in seconds, with prices and cost", () => {
    expect(generationProperties(trace)).toEqual({
      $ai_trace_id: "t1",
      $ai_session_id: "c1",
      $ai_span_name: "widget_chat_reply",
      $ai_provider: "anthropic",
      $ai_model: "claude-haiku-5-5",
      $ai_latency: 1.235,
      $ai_is_error: false,
      $ai_input_tokens: 2000,
      $ai_output_tokens: 100,
      $ai_input_token_price: 0.1 / 1_000_000,
      $ai_output_token_price: 0.5 / 1_000_000,
      cost_usd: 2000 * (0.1 / 1_000_000) + 100 * (0.5 / 1_000_000),
      project_id: "p1",
      conversation_id: "c1",
      retrieved_chunks: 5,
      history_messages: 6,
      $process_person_profile: false,
    });
  });
  it("uses the long-prompt prices above 100K input tokens", () => {
    const props = generationProperties({ ...trace, usage: { inputTokens: 100_001, outputTokens: 10 } });
    expect(props.$ai_input_token_price).toBe(0.5 / 1_000_000);
    expect(props.$ai_output_token_price).toBe(2.5 / 1_000_000);
  });
  it("marks a failed call as an error, without tokens or cost", () => {
    const props = generationProperties({ ...trace, usage: null, errorName: "APIConnectionError", conversationId: null });
    expect(props).toMatchObject({ $ai_is_error: true, $ai_error: "APIConnectionError", $ai_session_id: null });
    expect(props).not.toHaveProperty("$ai_input_tokens");
    expect(props).not.toHaveProperty("cost_usd");
  });
  it("never carries message content", () => {
    const props = generationProperties(trace);
    expect(props).not.toHaveProperty("$ai_input");
    expect(props).not.toHaveProperty("$ai_output_choices");
  });
});

describe("track*", () => {
  it("send the events through the server helper", async () => {
    await trackMessageBlocked("v1", "rate_limit", "pk_x");
    await trackFirstChat("user_1", "p1", "c1");
    await trackGeneration("v1", trace);
    expect(captureServer.mock.calls.map(([event, id]) => [event, id])).toEqual([
      ["message_blocked", "v1"],
      ["first_chat", "user_1"],
      ["$ai_generation", "v1"],
    ]);
    expect(captureServer.mock.calls[1]?.[2]).toEqual(firstChatProperties("p1", "c1"));
  });
});
