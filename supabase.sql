-- ==============================================================
--  Stats volley — création de la base de données
--  À coller dans Supabase > SQL Editor > New query, puis « Run ».
-- ==============================================================

create table if not exists public.feuilles (
  id          uuid primary key,
  type        text not null check (type in ('passeurs','equipe')),
  date        date,
  adversaire  text,
  resume      text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.reglages (
  id    text primary key,
  data  jsonb not null default '{}'::jsonb
);

-- Sécurité : seules les personnes connectées (mot de passe d'équipe)
-- peuvent lire ou écrire. Sans connexion, rien n'est accessible.
alter table public.feuilles enable row level security;
alter table public.reglages enable row level security;

drop policy if exists "equipe feuilles" on public.feuilles;
create policy "equipe feuilles" on public.feuilles
  for all to authenticated using (true) with check (true);

drop policy if exists "equipe reglages" on public.reglages;
create policy "equipe reglages" on public.reglages
  for all to authenticated using (true) with check (true);

create index if not exists feuilles_date_idx on public.feuilles (date desc, updated_at desc);
