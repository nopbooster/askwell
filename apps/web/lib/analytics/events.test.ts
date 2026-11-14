import { describe, expect, it } from "vitest";
import { knowledgeAdded, projectCreated, signedUp, snippetCopied } from "./events";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const SOURCE = "22222222-2222-4222-8222-222222222222";

describe("product event properties", () => {
  it("signed_up carries nothing (the person is the Clerk user ID)", () => {
    expect(signedUp()).toEqual({});
  });

  it("project_created: project id and plan only", () => {
    expect(projectCreated({ projectId: PROJECT, plan: "free" })).toEqual({ project_id: PROJECT, plan: "free" });
  });

  it("knowledge_added: project id, source id and type only", () => {
    expect(knowledgeAdded({ projectId: PROJECT, sourceId: SOURCE, type: "pdf" })).toEqual({
      project_id: PROJECT,
      source_id: SOURCE,
      source_type: "pdf",
    });
  });

  it("snippet_copied: project id only", () => {
    expect(snippetCopied({ projectId: PROJECT })).toEqual({ project_id: PROJECT });
  });

  it("drops anything extra a caller passes (no text, title or file content can leak)", () => {
    const sneaky = { projectId: PROJECT, sourceId: SOURCE, type: "text" as const, text: "secret visitor text", title: "Doc" };
    const props = knowledgeAdded(sneaky);
    expect(Object.keys(props).sort()).toEqual(["project_id", "source_id", "source_type"]);
    expect(JSON.stringify(props)).not.toMatch(/secret|Doc/);
  });
});
