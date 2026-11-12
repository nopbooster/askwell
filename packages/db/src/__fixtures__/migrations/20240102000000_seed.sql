insert into public.notes (owner_id, body, embedding) values
  ('user_a', 'a1', '[1,0,0]'),
  ('user_a', 'a2', '[0,1,0]'),
  ('user_b', 'b1', '[0,0,1]');
create table public.secrets (id serial primary key, v text);
alter table public.secrets enable row level security;
revoke all on public.secrets from anon;
insert into public.secrets (v) values ('s');
