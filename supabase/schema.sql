-- ============================================================================
--  Mathematics Simulator - future Supabase data layer (schema.sql)
-- ============================================================================
--
--  Generated for Mathematics Simulator — future Supabase integration.
--  Landing currently runs without any backend.
--
--  WHAT THIS FILE IS
--    A future-ready schema for the platform around Mathematics Simulator
--    (an open-source math exploration environment with 9 workspaces and a
--    single no-eval engine: lexer -> parser -> AST -> evaluator). It models
--    user profiles, saved projects, experiments, notebooks, curated
--    examples, workspace metadata and tags. The landing page is a single
--    route built on local mock data (src/data/workspaces.ts etc.); later
--    that data source can be swapped to Supabase, and this schema is the
--    contract it would read from.
--
--  WHAT THIS FILE IS NOT
--    - NOT applied anywhere yet: no Supabase project consumes this file.
--    - NOT connected to the landing page at runtime in any way.
--
--  SECURITY - Row Level Security (RLS)
--    RLS is INTENTIONALLY NOT ENABLED yet: there is no exposed API, no
--    anon/authenticated role access, and no real data. Before ANY
--    production use you MUST:
--      1. Enable RLS on every table (statements are prepared, commented
--         out, in the "FUTURE: Row Level Security" block at the end of
--         this file).
--      2. Write policies for every table: owner-only writes on
--         profiles / projects / experiments / notebooks, public reads only
--         where visibility = 'public', curator roles for examples and
--         workspace_metadata, sensible read rules for tags and the join
--         tables.
--      3. Re-test with the anon and authenticated roles.
--    Until all of that is done, this file is a design artifact only.
--
--  HOW TO RUN
--    Supabase SQL editor, `supabase db reset`, or psql: run top-to-bottom.
--    Idempotent-friendly by design, so re-imports do not explode:
--      - tables:    create table if not exists
--      - indexes:   create index if not exists
--      - enums:     DO blocks that swallow duplicate_object
--      - triggers:  drop trigger if exists + create (PostgreSQL has no
--                   "create trigger if not exists")
--      - comments:  comment on ... simply overwrites
--
--  CONVENTIONS
--    - uuid primary keys, default gen_random_uuid() (pgcrypto; core in PG 13+)
--    - created_at / updated_at timestamptz not null default now()
--    - text for human fields, jsonb for configuration, snake_case names
--    - every foreign key states its ON DELETE behaviour explicitly
--    - assumed PostgreSQL 13+ (Supabase ships 15+)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Extensions and pg_catalog sanity
-- ---------------------------------------------------------------------------

-- pgcrypto provides gen_random_uuid() (on PostgreSQL 13+ the function is
-- core; the extension keeps this file compatible with older instances and
-- matches the standard Supabase template).
create extension if not exists "pgcrypto";

-- Sanity: walk pg_catalog to confirm gen_random_uuid() is resolvable
-- (pg_catalog on PG 13+, or wherever pgcrypto was installed). Fails fast
-- with a readable message instead of a cascade of "function does not
-- exist" errors deep in the DDL. Read-only, safe to re-run.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('pg_catalog', 'public', 'extensions')
      and p.proname = 'gen_random_uuid'
  ) then
    raise exception 'gen_random_uuid() not found: install pgcrypto or use PostgreSQL 13+';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1) Enum types
-- ---------------------------------------------------------------------------
-- The DO blocks make re-imports idempotent: if the type already exists
-- (duplicate_object) we skip instead of erroring. NOTE: if an existing type
-- was created with different labels, this file does NOT migrate it.

do $$
begin
  create type public.visibility_type as enum ('public', 'private', 'unlisted');
exception
  when duplicate_object then null; -- already exists - idempotent re-import
end
$$;

do $$
begin
  create type public.workspace_type as enum (
    'calculator',   -- Calculator
    'fractal_lab',  -- Fractal Lab
    'bloch_sphere', -- Bloch Sphere
    'four_d',       -- 4D ('4d' is not a valid identifier, so 'four_d')
    'topology',     -- Topology
    'dynamics',     -- Dynamics
    'inspector',    -- Inspector
    'notebook',     -- Notebook
    'docs'          -- Docs
  );
exception
  when duplicate_object then null; -- already exists - idempotent re-import
end
$$;

do $$
begin
  create type public.experiment_status as enum ('draft', 'running', 'completed', 'failed');
exception
  when duplicate_object then null; -- already exists - idempotent re-import
end
$$;

-- ---------------------------------------------------------------------------
-- 2) auth.users shim (Supabase compatibility)
-- ---------------------------------------------------------------------------
-- profiles.id references auth.users, the user table managed by Supabase
-- Auth. On Supabase both statements below are no-ops (the schema and the
-- table already exist, so `if not exists` short-circuits). On a bare
-- PostgreSQL instance they create a minimal stand-in so that this file
-- still runs top-to-bottom for local review. Nothing in the landing page
-- ever reads this shim.

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

-- ---------------------------------------------------------------------------
-- 3) Tables
-- ---------------------------------------------------------------------------

-- 3.1 profiles ---------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid        primary key references auth.users (id) on delete cascade,
  username     text        not null,
  display_name text        not null,
  avatar_url   text,
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_key unique (username),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,32}$'),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 500)
);

comment on table public.profiles is
  'Public user profile, one row per authenticated user. Extends the Supabase Auth identity with platform-facing fields.';
comment on column public.profiles.id is
  'Links to Supabase auth: references auth.users(id) (Supabase convention). Deleting the auth user cascades here.';
comment on column public.profiles.username is
  'Unique handle: 3-32 characters, lowercase letters, numbers and underscores only.';
comment on column public.profiles.display_name is 'Human display name shown on the platform.';
comment on column public.profiles.avatar_url is 'Optional avatar image URL.';
comment on column public.profiles.bio is 'Optional short biography, hard limit of 500 characters.';
comment on column public.profiles.updated_at is 'Auto-touched by the set_updated_at() trigger on every update.';

-- 3.2 workspace_metadata -----------------------------------------------------
create table if not exists public.workspace_metadata (
  id          uuid           primary key default gen_random_uuid(),
  workspace   workspace_type not null,
  name        text           not null,
  description text           not null,
  icon        text,
  route       text,
  enabled     boolean        not null default true,
  sort_order  integer        not null default 0,
  created_at  timestamptz    not null default now(),
  updated_at  timestamptz    not null default now(),
  constraint workspace_metadata_workspace_key unique (workspace),
  constraint workspace_metadata_sort_order_key unique (sort_order)
);

comment on table public.workspace_metadata is
  'Catalog of the nine Mathematics Simulator workspaces. Mirrors the local data used by the landing page (src/data/workspaces.ts); the landing can later swap that source for this table.';
comment on column public.workspace_metadata.workspace is
  'Which of the 9 workspaces this row describes. Unique: exactly one row per workspace.';
comment on column public.workspace_metadata.name is 'Human-readable workspace name.';
comment on column public.workspace_metadata.description is 'Short descriptor used in navigation and cards.';
comment on column public.workspace_metadata.icon is 'Icon identifier as a kebab-case string, e.g. ''fractal''.';
comment on column public.workspace_metadata.route is 'Route on the live app, e.g. ''/fractal-lab''.';
comment on column public.workspace_metadata.enabled is 'Whether the workspace shows up in navigation.';
comment on column public.workspace_metadata.sort_order is
  'Deterministic ordering position (1..9). Unique so no two workspaces can tie.';
comment on column public.workspace_metadata.updated_at is 'Auto-touched by the set_updated_at() trigger on every update.';

-- 3.3 projects ---------------------------------------------------------------
create table if not exists public.projects (
  id             uuid            primary key default gen_random_uuid(),
  user_id        uuid            not null references public.profiles (id) on delete cascade,
  title          text            not null,
  slug           text            not null,
  description    text,
  visibility     visibility_type not null default 'private',
  thumbnail_url  text,
  workspace_type workspace_type,
  created_at     timestamptz     not null default now(),
  updated_at     timestamptz     not null default now(),
  constraint projects_user_slug_key unique (user_id, slug),
  constraint projects_title_length check (char_length(title) between 1 and 200),
  constraint projects_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists projects_user_id_idx    on public.projects (user_id);
create index if not exists projects_created_at_idx on public.projects (created_at);
create index if not exists projects_visibility_idx on public.projects (visibility);

comment on table public.projects is
  'Saved user project: a named bundle of work inside one workspace (or several). Owned by one profile; deleting the profile cascades.';
comment on column public.projects.user_id is 'Owning profile (public.profiles.id). ON DELETE CASCADE.';
comment on column public.projects.title is 'Project title, non-empty and at most 200 characters.';
comment on column public.projects.slug is
  'URL slug, unique per owner: lowercase alphanumeric groups joined by single hyphens (same convention as the app routes).';
comment on column public.projects.visibility is
  'public: listed to everyone. unlisted: reachable by direct link. private: owner only (default).';
comment on column public.projects.thumbnail_url is 'Optional preview image URL.';
comment on column public.projects.workspace_type is 'Optional primary workspace of the project (null means mixed / not workspace-bound).';
comment on column public.projects.updated_at is 'Auto-touched by the set_updated_at() trigger on every update.';

-- 3.4 experiments ------------------------------------------------------------
create table if not exists public.experiments (
  id            uuid              primary key default gen_random_uuid(),
  project_id    uuid              not null references public.projects (id) on delete cascade,
  title         text              not null,
  description   text,
  workspace     workspace_type    not null,
  configuration jsonb             not null default '{}'::jsonb,
  status        experiment_status not null default 'draft',
  created_at    timestamptz       not null default now(),
  updated_at    timestamptz       not null default now()
);

create index if not exists experiments_project_id_idx on public.experiments (project_id);

comment on table public.experiments is
  'One saved experiment inside a project: a single workspace plus its configuration. Deleting the project cascades.';
comment on column public.experiments.project_id is 'Parent project (public.projects.id). ON DELETE CASCADE.';
comment on column public.experiments.workspace is 'Workspace the experiment runs in (decides which engine UI loads it).';
comment on column public.experiments.configuration is
  'Workspace-specific parameters (expressions, dynamical systems, iteration counts, camera settings). Stored as data only: the engine evaluates expressions through its own lexer/parser/AST, never eval.';
comment on column public.experiments.status is
  'Lifecycle of the experiment: draft (default) / running / completed / failed. Reserved for future batch execution.';
comment on column public.experiments.updated_at is 'Auto-touched by the set_updated_at() trigger on every update.';

-- 3.5 notebooks --------------------------------------------------------------
create table if not exists public.notebooks (
  id          uuid            primary key default gen_random_uuid(),
  user_id     uuid            not null references public.profiles (id) on delete cascade,
  title       text            not null,
  description text,
  content     jsonb           not null default '[]'::jsonb,
  visibility  visibility_type not null default 'private',
  created_at  timestamptz     not null default now(),
  updated_at  timestamptz     not null default now()
);

create index if not exists notebooks_user_id_idx on public.notebooks (user_id);

comment on table public.notebooks is
  'Reproducible mathematical notebook owned by a profile: ordered cells of source, results and prose.';
comment on column public.notebooks.user_id is 'Owning profile (public.profiles.id). ON DELETE CASCADE.';
comment on column public.notebooks.content is
  'Ordered array of notebook cells for reproducible experiments. Kept structured (not a blob) so runs can be replayed cell by cell.';
comment on column public.notebooks.updated_at is 'Auto-touched by the set_updated_at() trigger on every update.';

-- 3.6 examples ---------------------------------------------------------------
create table if not exists public.examples (
  id            uuid           primary key default gen_random_uuid(),
  title         text           not null,
  slug          text           not null,
  description   text,
  workspace     workspace_type not null,
  configuration jsonb          not null default '{}'::jsonb,
  featured      boolean        not null default false,
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now(),
  constraint examples_slug_key unique (slug)
);

create index if not exists examples_workspace_idx on public.examples (workspace);
create index if not exists examples_featured_idx on public.examples (featured) where featured;

comment on table public.examples is
  'Curator-managed gallery content: ready-made experiments with no owner (anyone can open them, only curators write them).';
comment on column public.examples.slug is 'Stable URL slug, globally unique (seeded via seed.sql).';
comment on column public.examples.configuration is 'Same shape as experiments.configuration, but curated and stable.';
comment on column public.examples.featured is 'Featured examples are highlighted in the gallery. Covered by a partial index.';
comment on column public.examples.updated_at is 'Auto-touched by the set_updated_at() trigger on every update.';

-- 3.7 tags -------------------------------------------------------------------
create table if not exists public.tags (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  slug       text        not null,
  created_at timestamptz not null default now(),
  constraint tags_name_key unique (name),
  constraint tags_slug_key unique (slug)
);

comment on table public.tags is
  'Shared vocabulary of topical tags applied to projects, experiments and notebooks through the join tables.';
comment on column public.tags.slug is 'Stable URL-safe identifier for the tag.';

-- 3.8 join tables ------------------------------------------------------------
create table if not exists public.experiment_tags (
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  tag_id        uuid not null references public.tags (id) on delete cascade,
  constraint experiment_tags_pk primary key (experiment_id, tag_id)
);

comment on table public.experiment_tags is
  'Join table experiments <-> tags. Rows disappear with either side (cascade from both).';

create table if not exists public.project_tags (
  project_id uuid not null references public.projects (id) on delete cascade,
  tag_id     uuid not null references public.tags (id) on delete cascade,
  constraint project_tags_pk primary key (project_id, tag_id)
);

comment on table public.project_tags is
  'Join table projects <-> tags. Rows disappear with either side (cascade from both).';

create table if not exists public.notebook_tags (
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  constraint notebook_tags_pk primary key (notebook_id, tag_id)
);

comment on table public.notebook_tags is
  'Join table notebooks <-> tags. Rows disappear with either side (cascade from both).';

-- ---------------------------------------------------------------------------
-- 4) updated_at auto-touch
-- ---------------------------------------------------------------------------
-- One shared trigger function bumps updated_at on every UPDATE. It is
-- attached to every table that HAS an updated_at column:
-- profiles, workspace_metadata, projects, experiments, notebooks, examples.
-- tags and the three join tables have no updated_at column, so they are
-- deliberately skipped.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- PostgreSQL has no "create trigger if not exists", so the idempotent
-- pattern is drop-if-exists + create.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists workspace_metadata_set_updated_at on public.workspace_metadata;
create trigger workspace_metadata_set_updated_at
  before update on public.workspace_metadata
  for each row execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists experiments_set_updated_at on public.experiments;
create trigger experiments_set_updated_at
  before update on public.experiments
  for each row execute function public.set_updated_at();

drop trigger if exists notebooks_set_updated_at on public.notebooks;
create trigger notebooks_set_updated_at
  before update on public.notebooks
  for each row execute function public.set_updated_at();

drop trigger if exists examples_set_updated_at on public.examples;
create trigger examples_set_updated_at
  before update on public.examples
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5) FUTURE: Row Level Security
-- ---------------------------------------------------------------------------
-- EVERYTHING IN THIS SECTION IS INTENTIONALLY COMMENTED OUT so that this
-- file executes cleanly end-to-end. RLS is deliberately not enabled yet
-- (see the header): the landing runs on local data and nothing is exposed.
--
-- TODO(owner): before going live you MUST uncomment the statements below
-- AND write the matching policies:
--   - profiles / projects / experiments / notebooks:
--       owner-only write (auth.uid() = user_id, or via the project chain),
--       public read only where visibility = 'public'.
--   - examples / workspace_metadata: read for everyone, writes limited to
--       a curator role / service role.
--   - tags and the join tables: public read, curator/service writes.
--
-- User-owned tables:
-- alter table public.profiles    enable row level security;
-- alter table public.projects    enable row level security;
-- alter table public.experiments enable row level security;
-- alter table public.notebooks   enable row level security;
--
-- Recommended for the platform/curator tables as well:
-- alter table public.workspace_metadata enable row level security;
-- alter table public.examples          enable row level security;
-- alter table public.tags              enable row level security;
-- alter table public.experiment_tags   enable row level security;
-- alter table public.project_tags      enable row level security;
-- alter table public.notebook_tags     enable row level security;
--
-- Verification once enabled:
-- select c.relname, c.relrowsecurity
-- from pg_catalog.pg_class c
-- join pg_catalog.pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r';
-- ============================================================================
--  End of schema.sql
-- ============================================================================
