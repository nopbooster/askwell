create table public.notes (
  id serial primary key,
  owner_id text not null,
  body text not null,
  embedding vector(3)
);
alter table public.notes enable row level security;
create policy notes_owner_select on public.notes for select to authenticated
  using (owner_id = (select auth.jwt() ->> 'sub'));
