-- Cache for machine translations of student-written text (forum posts), so each text is
-- sent to the translation server once per language. Keyed by a hash of the source text:
-- an edited post simply misses the cache. Server-only (service role): RLS on, no policies.
create table public.core_translations (
  hash text not null,      -- sha256 of the source text, hex
  language text not null check (language in ('te', 'hi')),
  text text not null,
  created_at timestamptz not null default now(),
  primary key (hash, language)
);
alter table public.core_translations enable row level security;
