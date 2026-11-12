-- Phase 3 database changes: the `knowledge` Storage bucket and the knowledge / chat functions
-- (docs/project.md §6.4, §6.6, §7, §9). No table changes.
--
-- Every function is SECURITY INVOKER with `search_path = ''`, fully qualified names, and EXECUTE
-- for `service_role` only. The route checks the owner/visitor first, then calls the function; limits
-- are passed in from PLAN_LIMITS (packages/shared).
--
-- Errors (map by MESSAGE in the route):
--   plan_limit_reached (P0001)  reserve_knowledge_source: the project already has p_max_sources sources
--   not_found          (P0002)  project missing, or the conversation isn't this project's
--   invalid_argument   (22023)  a bad limit, count, status or key

-- ---------------------------------------------------------------------------
-- 1. Storage bucket. Private. No storage.objects policies for anon/authenticated (RLS on
--    storage.objects denies them by default): only the server (service role) touches it, and the
--    browser uploads through one-time signed URLs. Size and types mirror MAX_KNOWLEDGE_FILE_BYTES
--    and KNOWLEDGE_FILE_MIME_TYPES in packages/shared (a test keeps them equal).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge',
  'knowledge',
  false,
  10485760,
  array['application/pdf', 'text/markdown', 'text/x-markdown', 'text/plain']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. reserve_knowledge_source
--    Locks the project row, reclaims this project's `uploading` sources older than 2 hours, counts
--    the rest (all statuses, uploading included), refuses at the limit, then inserts the source
--    (`uploading` for files, `processing` for pasted text).
--    Returns ONE row: the new source's columns plus `reclaimed_keys` (storage keys of the reclaimed
--    sources; the route removes those files from Storage). If it raises plan_limit_reached, the
--    reclaim rolls back too (rows stay, so the next call reclaims them again).
-- ---------------------------------------------------------------------------

create function public.reserve_knowledge_source(
  p_project_id uuid,
  p_title text,
  p_type text,
  p_storage_key text,
  p_status text,
  p_max_sources int
)
returns table (
  id uuid,
  project_id uuid,
  title text,
  type text,
  storage_key text,
  status text,
  created_at timestamptz,
  reclaimed_keys text[]
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.knowledge_sources;
  v_reclaimed text[];
begin
  if p_max_sources is null or p_max_sources < 0 then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('uploading', 'processing') then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;
  if p_status = 'uploading' and p_storage_key is null then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;

  -- Serialize concurrent reservations for this project.
  perform 1 from public.projects p where p.id = p_project_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  with stale as (
    delete from public.knowledge_sources s
    where s.project_id = p_project_id
      and s.status = 'uploading'
      and s.created_at < now() - interval '2 hours'
    returning s.storage_key
  )
  select coalesce(array_agg(stale.storage_key) filter (where stale.storage_key is not null), '{}')
  into v_reclaimed
  from stale;

  if (select count(*) from public.knowledge_sources s where s.project_id = p_project_id) >= p_max_sources then
    raise exception 'plan_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.knowledge_sources (project_id, title, type, storage_key, status)
  values (p_project_id, p_title, p_type, p_storage_key, p_status)
  returning * into v_source;

  return query
  select v_source.id, v_source.project_id, v_source.title, v_source.type,
         v_source.storage_key, v_source.status, v_source.created_at, v_reclaimed;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. claim_knowledge_source
--    One statement: `uploading` -> `processing`. Returns the row, or no row when it was already
--    claimed, missing, or belongs to another project.
-- ---------------------------------------------------------------------------

create function public.claim_knowledge_source(p_source_id uuid, p_project_id uuid)
returns setof public.knowledge_sources
language sql
security invoker
set search_path = ''
as $$
  update public.knowledge_sources s
  set status = 'processing'
  where s.id = p_source_id
    and s.project_id = p_project_id
    and s.status = 'uploading'
  returning s.*
$$;

-- ---------------------------------------------------------------------------
-- 4. match_chunks
--    Top-k chunks by cosine similarity, only from `ready` sources of this project.
--    Similarity = 1 - cosine distance. The HNSW index is searched before the project filter is
--    applied, so iterative scan (set_config below) keeps going until enough rows of this project are found
--    (without it a small project could get fewer than k results, or none).
-- ---------------------------------------------------------------------------

create function public.match_chunks(
  p_project_id uuid,
  p_embedding extensions.vector(1536),
  p_match_count int
)
returns table (chunk_id uuid, source_id uuid, content text, similarity double precision)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Set at runtime, not in the function's SET clause: Supabase's migration role is refused
  -- (42501) when a function SET names this extension GUC. Transaction-local, so it doesn't leak.
  perform set_config('hnsw.iterative_scan', 'strict_order', true);

  if p_match_count is null or p_match_count < 1 or p_match_count > 100 then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;

  return query
  select c.id,
         c.source_id,
         c.content,
         1 - (c.embedding operator(extensions.<=>) p_embedding)
  from public.knowledge_chunks c
  where c.project_id = p_project_id
    and exists (
      select 1
      from public.knowledge_sources s
      where s.id = c.source_id and s.project_id = c.project_id and s.status = 'ready'
    )
  order by c.embedding operator(extensions.<=>) p_embedding
  limit p_match_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. consume_message
--    Under the project row lock: start a new month (UTC) if `period_start` is before it, then count
--    the message if `messages_used < p_limit`. Concurrent calls queue on the lock, so the limit is
--    never exceeded. A refused call still keeps the month reset.
-- ---------------------------------------------------------------------------

create function public.consume_message(p_project_id uuid, p_limit int)
returns table (allowed boolean, messages_used int)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_project public.projects;
begin
  if p_limit is null or p_limit < 0 then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;

  select * into v_project from public.projects p where p.id = p_project_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_project.period_start < v_month then
    v_project.messages_used := 0;
    v_project.period_start := v_month;
  end if;

  if v_project.messages_used < p_limit then
    v_project.messages_used := v_project.messages_used + 1;
    allowed := true;
  else
    allowed := false;
  end if;

  update public.projects p
  set messages_used = v_project.messages_used, period_start = v_project.period_start
  where p.id = p_project_id;

  messages_used := v_project.messages_used;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. save_chat_turn
--    Creates the conversation when p_conversation_id is null; otherwise it must belong to the
--    project (else not_found). Inserts the visitor message, then the bot message with a strictly
--    later created_at. Returns the conversation id.
-- ---------------------------------------------------------------------------

create function public.save_chat_turn(
  p_project_id uuid,
  p_conversation_id uuid,
  p_visitor_id text,
  p_visitor_message text,
  p_bot_reply text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conversation_id uuid := p_conversation_id;
  v_at timestamptz;
begin
  if v_conversation_id is null then
    perform 1 from public.projects p where p.id = p_project_id;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    insert into public.conversations (project_id, visitor_id)
    values (p_project_id, p_visitor_id)
    returning id into v_conversation_id;
  else
    perform 1
    from public.conversations c
    where c.id = v_conversation_id and c.project_id = p_project_id;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  v_at := clock_timestamp();
  insert into public.messages (conversation_id, role, body, created_at)
  values (v_conversation_id, 'visitor', p_visitor_message, v_at);
  insert into public.messages (conversation_id, role, body, created_at)
  values (v_conversation_id, 'bot', p_bot_reply, greatest(clock_timestamp(), v_at + interval '1 microsecond'));

  return v_conversation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: service_role only.
-- ---------------------------------------------------------------------------

revoke execute on function public.reserve_knowledge_source(uuid, text, text, text, text, int) from public, anon, authenticated;
revoke execute on function public.claim_knowledge_source(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.match_chunks(uuid, extensions.vector, int) from public, anon, authenticated;
revoke execute on function public.consume_message(uuid, int) from public, anon, authenticated;
revoke execute on function public.save_chat_turn(uuid, uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.reserve_knowledge_source(uuid, text, text, text, text, int) to service_role;
grant execute on function public.claim_knowledge_source(uuid, uuid) to service_role;
grant execute on function public.match_chunks(uuid, extensions.vector, int) to service_role;
grant execute on function public.consume_message(uuid, int) to service_role;
grant execute on function public.save_chat_turn(uuid, uuid, text, text, text) to service_role;
