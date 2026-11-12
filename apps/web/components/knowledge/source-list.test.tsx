import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { KnowledgeSource } from "@askwell/shared";
import { SourceList } from "./source-list";

const base: KnowledgeSource = { id: "22222222-2222-4222-8222-222222222222", title: "FAQ", type: "pdf", status: "ready", createdAt: "2026-11-12T10:00:00+00:00" };
const render = (s: KnowledgeSource[]) => renderToStaticMarkup(<SourceList sources={s} onRemoved={() => undefined} />);

describe("SourceList", () => {
  it("shows title, type, date and a status badge", () => {
    const html = render([base]);
    expect(html).toContain("FAQ");
    expect(html).toContain("PDF");
    expect(html).toContain("Nov 12, 2026");
    expect(html).toContain("Ready");
  });
  it("shows uploading as Processing", () => {
    expect(render([{ ...base, status: "uploading" }])).toContain("Processing");
  });
  it("shows a short reason for a failed source, with a delete button", () => {
    const html = render([{ ...base, status: "failed" }]);
    expect(html).toContain("Failed");
    expect(html).toContain("couldn&#x27;t read text from this file");
    expect(html).toContain("Delete");
  });
  it("renders a title as text, never HTML", () => {
    const html = render([{ ...base, title: '<img src=x onerror="alert(1)">' }]);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
