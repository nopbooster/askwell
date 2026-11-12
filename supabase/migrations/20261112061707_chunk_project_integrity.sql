-- A chunk's project_id must equal its source's project_id: match_chunks scopes search by
-- knowledge_chunks.project_id, so a mismatched row would leak one tenant's text to another.
-- Follow-up to 20261112043544_initial_schema.sql (which is already merged and unchanged).

alter table public.knowledge_sources
  add constraint knowledge_sources_id_project_id_key unique (id, project_id);

alter table public.knowledge_chunks
  drop constraint knowledge_chunks_source_id_fkey;

alter table public.knowledge_chunks
  add constraint knowledge_chunks_source_id_project_id_fkey
  foreign key (source_id, project_id)
  references public.knowledge_sources (id, project_id) on delete cascade;

alter table public.projects
  add constraint projects_messages_used_check check (messages_used >= 0);
