export const KNOWLEDGE_SOURCE_TYPES = ["text", "pdf", "md", "txt"] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_SOURCE_STATUSES = ["uploading", "processing", "ready", "failed"] as const;
export type KnowledgeSourceStatus = (typeof KNOWLEDGE_SOURCE_STATUSES)[number];

export const MESSAGE_ROLES = ["visitor", "bot"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const WIDGET_POSITIONS = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
] as const;
export type WidgetPosition = (typeof WIDGET_POSITIONS)[number];

export const WIDGET_ANIMATIONS = ["fade", "slide", "scale"] as const;
export type WidgetAnimation = (typeof WIDGET_ANIMATIONS)[number];
