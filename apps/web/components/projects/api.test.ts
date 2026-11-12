import { afterEach, describe, expect, it, vi } from "vitest";
import { callApi, readApiError } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("readApiError", () => {
  it("reads the shared error shape", async () => {
    const res = Response.json({ error: { code: "plan_limit_reached", message: "Upgrade" } }, { status: 403 });
    await expect(readApiError(res)).resolves.toEqual({ code: "plan_limit_reached", message: "Upgrade" });
  });
  it("falls back to a generic message for anything else", async () => {
    await expect(readApiError(new Response("<html>oops</html>", { status: 502 }))).resolves.toMatchObject({ code: "internal" });
    await expect(readApiError(Response.json({ nope: 1 }, { status: 500 }))).resolves.toMatchObject({ code: "internal" });
  });
});

describe("callApi", () => {
  it("returns the parsed body on success and sends JSON", async () => {
    const fetchMock = vi.fn(async () => Response.json({ project: { id: "1" } }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callApi("POST", "/api/projects", { name: "x" })).resolves.toEqual({ ok: true, status: 201, data: { project: { id: "1" } } });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
  });
  it("returns the API error on a failed response", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: { code: "not_found", message: "Project not found." } }, { status: 404 }));
    await expect(callApi("DELETE", "/api/projects/1")).resolves.toEqual({ ok: false, status: 404, code: "not_found", message: "Project not found." });
  });
  it("turns a network failure into a friendly error", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("failed to fetch");
    });
    await expect(callApi("DELETE", "/api/projects/1")).resolves.toMatchObject({ ok: false, status: 0, code: "network" });
  });
});
