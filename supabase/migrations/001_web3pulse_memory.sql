create extension if not exists pgcrypto;

create table if not exists public.web3pulse_candidates (
  id text primary key,
  title text not null,
  normalized_title text not null,
  url text not null,
  source text not null,
  category text,
  published_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists web3pulse_candidates_published_idx
  on public.web3pulse_candidates (published_at desc);
create index if not exists web3pulse_candidates_normalized_title_idx
  on public.web3pulse_candidates (normalized_title);

create table if not exists public.web3pulse_content_history (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  normalized_headline text not null,
  category text,
  candidate_ids text[] not null default '{}',
  source_urls text[] not null default '{}',
  content jsonb not null,
  status text not null default 'generated' check (status in ('generated','approved','scheduled','published','rejected')),
  generated_at timestamptz not null default now(),
  published_at timestamptz,
  content_fingerprint text not null,
  llm_provider text,
  llm_model text
);

create unique index if not exists web3pulse_content_fingerprint_idx
  on public.web3pulse_content_history (content_fingerprint);
create index if not exists web3pulse_content_generated_idx
  on public.web3pulse_content_history (generated_at desc);
create index if not exists web3pulse_content_candidate_ids_idx
  on public.web3pulse_content_history using gin (candidate_ids);

alter table public.web3pulse_candidates enable row level security;
alter table public.web3pulse_content_history enable row level security;

-- Generation/history writes are performed server-side with the Supabase secret key.
-- No anonymous database access is granted by this migration.
