import type { KnowledgeSourceType, Plan } from "@askwell/shared";

/**
 * Product events (project.md §6.11) and the only properties each may carry.
 * IDs, plan and source type only: never message text, file content, titles or names (§9).
 * `upgraded` (Phase 5 webhook), `first_chat` and `message_blocked` are added by later tasks.
 */
export type ProductEvents = {
  signed_up: Record<string, never>;
  project_created: { project_id: string; plan: Plan };
  knowledge_added: { project_id: string; source_id: string; source_type: KnowledgeSourceType };
  snippet_copied: { project_id: string };
};

export type ProductEvent = keyof ProductEvents;

export function signedUp(): ProductEvents["signed_up"] {
  return {};
}

export function projectCreated(input: { projectId: string; plan: Plan }): ProductEvents["project_created"] {
  return { project_id: input.projectId, plan: input.plan };
}

export function knowledgeAdded(input: {
  projectId: string;
  sourceId: string;
  type: KnowledgeSourceType;
}): ProductEvents["knowledge_added"] {
  return { project_id: input.projectId, source_id: input.sourceId, source_type: input.type };
}

export function snippetCopied(input: { projectId: string }): ProductEvents["snippet_copied"] {
  return { project_id: input.projectId };
}
