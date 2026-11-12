import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorSchema, DEFAULT_WIDGET_CONFIG, WidgetConfigResponseSchema } from "@askwell/shared";

vi.mock("server-only", () => ({}));

let impl: (key: string) => Promise<unknown> = async () => null;
const getWidgetConfigByKey = vi.fn((key: string) => impl(key));
vi.mock("../../../../lib/widget/config", () => ({ getWidgetConfigByKey: (key: string) => getWidgetConfigByKey(key) }));

import { GET, OPTIONS } from "./route";

const KEY = "pk_abcdefghijklmnop";
const call = (query: string) => GET(new Request(`http://localhost/api/widget/config${query}`));

beforeEach(() => {
  getWidgetConfigByKey.mockClear();
  impl = async () => null;
});

describe("GET /api/widget/config", () => {
  it("200: returns only the six config fields, with CORS and revalidation on every load", async () => {
    impl = async () => ({ ...DEFAULT_WIDGET_CONFIG, buttonColor: "#112233" });
    const res = await call(`?key=${KEY}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    const body = await res.json();
    expect(WidgetConfigResponseSchema.safeParse(body).success).toBe(true);
    expect(Object.keys(body).sort()).toEqual(
      ["animation", "buttonColor", "headerText", "label", "position", "showBadge"].sort(),
    );
    expect(getWidgetConfigByKey).toHaveBeenCalledWith(KEY);
  });

  it("404: unknown key, shared error shape, CORS, no-store", async () => {
    impl = async () => null;
    const res = await call(`?key=${KEY}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
  });

  it("400: malformed or missing key, without touching the database", async () => {
    for (const q of ["?key=bad", "", "?key="]) {
      const res = await call(q);
      expect(res.status).toBe(400);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(ApiErrorSchema.parse(await res.json()).error.code).toBe("validation_failed");
    }
    expect(getWidgetConfigByKey).not.toHaveBeenCalled();
  });

  it("500: a failed read gives a generic internal error", async () => {
    impl = () => new Promise((_, reject) => reject(new Error("secret db detail")));
    const res = await call(`?key=${KEY}`);
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("secret db detail");
  });
});

describe("OPTIONS /api/widget/config", () => {
  it("answers the preflight with CORS headers", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS");
  });
});
