-- create_project: creates a project safely. It checks the plan's project limit under a row lock,
-- generates the public key and creates the default widget config, all in one transaction.
-- Only `service_role` may execute it (project.md §7, §9 "Database API"). The route checks the
-- owner's session first and passes the limit from PLAN_LIMITS[plan].projects (packages/shared).
--
-- Errors (SQLSTATE P0001 unless noted; map by MESSAGE in the route):
--   account_not_found   (P0002)  the owner has no accounts row
--   plan_limit_reached  (P0001)  the owner already has p_max_projects or more projects
--   invalid_argument    (22023)  p_max_projects is null or negative

-- Supabase already ships pgcrypto in `extensions`; this makes it explicit.
create extension if not exists pgcrypto with schema extensions;

create function public.create_project(p_owner_id text, p_name text, p_max_projects int)
returns public.projects
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project public.projects;
  v_key text;
  v_attempt int := 0;
begin
  if p_max_projects is null or p_max_projects < 0 then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;

  -- Serialize concurrent calls for this owner: the second one waits here, then sees the first's row.
  perform 1
  from public.accounts a
  where a.clerk_user_id = p_owner_id
  for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  if (select count(*) from public.projects p where p.owner_id = p_owner_id) >= p_max_projects then
    raise exception 'plan_limit_reached' using errcode = 'P0001';
  end if;

  -- 'pk_' + 24 URL-safe chars (18 random bytes = exactly 24 base64 chars, no padding).
  -- Matches PUBLIC_KEY_REGEX in packages/shared. Retry on the (very rare) unique collision.
  loop
    v_attempt := v_attempt + 1;
    v_key := 'pk_' || translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
    begin
      insert into public.projects (owner_id, name, public_key)
      values (p_owner_id, p_name, v_key)
      returning * into v_project;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  -- Column defaults equal DEFAULT_WIDGET_CONFIG.
  insert into public.widget_configs (project_id) values (v_project.id);

  return v_project;
end;
$$;

revoke execute on function public.create_project(text, text, int) from public, anon, authenticated;
grant execute on function public.create_project(text, text, int) to service_role;
