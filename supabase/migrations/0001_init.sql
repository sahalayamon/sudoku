-- =============================================================================
-- Sudoku: initial schema
--
-- Design goals
--   * Puzzle definition, game session, statistics and preferences live in separate
--     tables so each can evolve and scale on its own.
--   * Clients can only READ their own private rows. Every game write goes through
--     `sync_game`, which re-validates the data on the server (valid givens, valid
--     completed grid, plausible time, daily puzzle matches the server's copy).
--   * Solutions are never readable by clients.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- Types
-- ----------------------------------------------------------------------------
create type public.difficulty  as enum ('beginner', 'easy', 'medium', 'hard', 'expert');
create type public.game_mode   as enum ('standard', 'daily');
create type public.game_status as enum ('in_progress', 'completed', 'failed', 'abandoned');

-- ----------------------------------------------------------------------------
-- users: public profile, 1:1 with auth.users
-- ----------------------------------------------------------------------------
create table public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- puzzles: the definition of a puzzle (shared, no per-user data)
-- ----------------------------------------------------------------------------
create table public.puzzles (
  id                uuid primary key default gen_random_uuid(),
  givens            char(81) not null unique check (givens ~ '^[0-9]{81}$'),
  difficulty        public.difficulty not null,
  score             integer  not null default 0 check (score between 0 and 1000),
  clues             smallint not null check (clues between 17 and 81),
  seed              text check (seed is null or char_length(seed) <= 64),
  generator_version smallint not null default 1,
  created_at        timestamptz not null default now()
);

-- Solutions are kept apart so no policy can ever expose them to a client.
create table public.puzzle_solutions (
  puzzle_id uuid primary key references public.puzzles (id) on delete cascade,
  solution  char(81) not null check (solution ~ '^[1-9]{81}$')
);

-- One globally consistent puzzle per calendar day.
create table public.daily_puzzles (
  puzzle_date date primary key,
  puzzle_id   uuid not null references public.puzzles (id),
  difficulty  public.difficulty not null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- games: one row per play of a puzzle (the outcome)
-- ----------------------------------------------------------------------------
create table public.games (
  id            uuid primary key,                      -- generated on the device, so offline play can sync later
  user_id       uuid not null references auth.users (id) on delete cascade,
  puzzle_id     uuid not null references public.puzzles (id),
  mode          public.game_mode not null default 'standard',
  daily_date    date,
  status        public.game_status not null default 'in_progress',
  difficulty    public.difficulty not null,
  elapsed_ms    integer  not null default 0 check (elapsed_ms between 0 and 86400000),
  mistakes      smallint not null default 0 check (mistakes >= 0),
  mistake_limit smallint not null default 0 check (mistake_limit >= 0),
  hints_used    smallint not null default 0 check (hints_used >= 0),
  moves         integer  not null default 0 check (moves >= 0),
  started_at    timestamptz not null,
  completed_at  timestamptz,
  updated_at    timestamptz not null,                  -- device clock: used to resolve conflicts
  received_at   timestamptz not null default now(),    -- server clock: used as the incremental pull cursor
  device_id     text check (device_id is null or char_length(device_id) <= 64),
  constraint daily_has_date check (mode <> 'daily' or daily_date is not null),
  constraint completed_has_time check (status <> 'completed' or completed_at is not null)
);

create index games_user_received_idx on public.games (user_id, received_at);
create index games_user_daily_idx    on public.games (user_id, daily_date) where mode = 'daily' and status = 'completed';
create index games_puzzle_idx        on public.games (puzzle_id);

-- ----------------------------------------------------------------------------
-- game_sessions: the mutable board of a game still in progress
-- ----------------------------------------------------------------------------
create table public.game_sessions (
  game_id    uuid primary key references public.games (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  board      char(81) not null check (board ~ '^[0-9]{81}$'),
  notes      jsonb not null default '[]'::jsonb,
  paused     boolean not null default false,
  updated_at timestamptz not null
);

-- ----------------------------------------------------------------------------
-- statistics: denormalised, maintained by the server from `games`
-- ----------------------------------------------------------------------------
create table public.statistics (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  games_played    integer not null default 0,
  games_completed integer not null default 0,
  games_failed    integer not null default 0,
  games_abandoned integer not null default 0,
  best_time_ms    integer,
  avg_time_ms     integer,
  avg_mistakes    numeric(6, 2),
  current_streak  integer not null default 0,
  best_streak     integer not null default 0,
  by_difficulty   jsonb   not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- achievements
-- ----------------------------------------------------------------------------
create table public.achievement_definitions (
  id          text primary key,
  title       text not null,
  description text not null
);

insert into public.achievement_definitions (id, title, description) values
  ('first_solve',   'First Solve',     'Complete your first puzzle.'),
  ('ten_games',     '10 Games',        'Complete ten puzzles.'),
  ('fifty_games',   '50 Games',        'Complete fifty puzzles.'),
  ('hundred_games', '100 Games',       'Complete one hundred puzzles.'),
  ('streak_7',      '7 Day Streak',    'Solve the Daily seven days in a row.'),
  ('streak_30',     '30 Day Streak',   'Solve the Daily thirty days in a row.'),
  ('expert_solver', 'Expert Solver',   'Solve an Expert puzzle.'),
  ('perfect_game',  'Perfect Game',    'Solve a Medium or harder puzzle with no mistakes and no hints.'),
  ('under_five',    'Under 5 Minutes', 'Solve a Medium or harder puzzle in under five minutes, without hints.'),
  ('no_mistakes',   'No Mistakes',     'Solve ten puzzles without a single mistake.'),
  ('full_range',    'Full Range',      'Solve a puzzle at every difficulty.'),
  ('daily_ten',     'Daily Regular',   'Solve ten Daily puzzles.');

create table public.achievements (
  user_id        uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievement_definitions (id),
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ----------------------------------------------------------------------------
-- user_settings: preferences, last write wins
-- ----------------------------------------------------------------------------
create table public.user_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 8192),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Validation helpers
-- =============================================================================

-- No digit repeats in any row, column or box among the givens.
create or replace function public.sudoku_givens_valid(p_givens text)
returns boolean language plpgsql immutable as $$
declare
  i int; d int; mask int;
  rows int[] := array_fill(0, array[9]);
  cols int[] := array_fill(0, array[9]);
  boxes int[] := array_fill(0, array[9]);
  r int; c int; b int;
begin
  if p_givens is null or p_givens !~ '^[0-9]{81}$' then return false; end if;
  for i in 0..80 loop
    d := substr(p_givens, i + 1, 1)::int;
    continue when d = 0;
    r := i / 9; c := i % 9; b := (r / 3) * 3 + c / 3;
    mask := 1 << (d - 1);
    if (rows[r + 1] & mask) <> 0 or (cols[c + 1] & mask) <> 0 or (boxes[b + 1] & mask) <> 0 then
      return false;
    end if;
    rows[r + 1] := rows[r + 1] | mask;
    cols[c + 1] := cols[c + 1] | mask;
    boxes[b + 1] := boxes[b + 1] | mask;
  end loop;
  return true;
end $$;

-- A board never contradicts the givens it was built from.
create or replace function public.sudoku_board_matches_givens(p_givens text, p_board text)
returns boolean language plpgsql immutable as $$
declare i int; g text;
begin
  if p_givens !~ '^[0-9]{81}$' or p_board !~ '^[0-9]{81}$' then return false; end if;
  for i in 1..81 loop
    g := substr(p_givens, i, 1);
    if g <> '0' and g <> substr(p_board, i, 1) then return false; end if;
  end loop;
  return true;
end $$;

-- A complete grid that keeps every given and breaks no rule. Because a valid puzzle has
-- exactly one solution, this is equivalent to "matches the solution" without storing it.
create or replace function public.sudoku_is_valid_solution(p_givens text, p_solution text)
returns boolean language plpgsql immutable as $$
declare
  i int; d int; mask int;
  rows int[] := array_fill(0, array[9]);
  cols int[] := array_fill(0, array[9]);
  boxes int[] := array_fill(0, array[9]);
  r int; c int; b int;
begin
  if p_givens !~ '^[0-9]{81}$' or p_solution !~ '^[1-9]{81}$' then return false; end if;
  for i in 0..80 loop
    d := substr(p_solution, i + 1, 1)::int;
    if substr(p_givens, i + 1, 1) <> '0' and substr(p_givens, i + 1, 1) <> substr(p_solution, i + 1, 1) then
      return false;
    end if;
    r := i / 9; c := i % 9; b := (r / 3) * 3 + c / 3;
    mask := 1 << (d - 1);
    if (rows[r + 1] & mask) <> 0 or (cols[c + 1] & mask) <> 0 or (boxes[b + 1] & mask) <> 0 then
      return false;
    end if;
    rows[r + 1] := rows[r + 1] | mask;
    cols[c + 1] := cols[c + 1] | mask;
    boxes[b + 1] := boxes[b + 1] | mask;
  end loop;
  return true;
end $$;

create or replace function public.game_status_rank(s public.game_status)
returns int language sql immutable as $$
  select case s when 'in_progress' then 0 when 'abandoned' then 1 when 'failed' then 2 else 3 end
$$;

-- =============================================================================
-- Statistics (server-side, derived from games)
-- =============================================================================
create or replace function public.refresh_statistics(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_played int; v_completed int; v_failed int; v_abandoned int;
  v_best int; v_avg int; v_avg_mistakes numeric;
  v_best_streak int; v_current_streak int;
  v_by_difficulty jsonb;
begin
  select
    count(*) filter (where g.status <> 'in_progress' or g.moves > 0),
    count(*) filter (where g.status = 'completed'),
    count(*) filter (where g.status = 'failed'),
    count(*) filter (where g.status = 'abandoned'),
    min(g.elapsed_ms) filter (where g.status = 'completed' and g.hints_used = 0),
    round(avg(g.elapsed_ms) filter (where g.status = 'completed')),
    round(avg(g.mistakes) filter (where g.status = 'completed'), 2)
  into v_played, v_completed, v_failed, v_abandoned, v_best, v_avg, v_avg_mistakes
  from public.games g
  where g.user_id = p_user;

  -- Daily streaks: consecutive calendar days with a solved Daily (gaps-and-islands).
  with days as (
    select distinct g.daily_date as d
    from public.games g
    where g.user_id = p_user and g.mode = 'daily' and g.status = 'completed' and g.daily_date is not null
  ),
  islands as (
    select d, d - (row_number() over (order by d))::int as grp from days
  ),
  runs as (
    select count(*)::int as len, max(d) as last_day from islands group by grp
  )
  select coalesce(max(len), 0), coalesce(max(len) filter (where last_day >= current_date - 1), 0)
  into v_best_streak, v_current_streak
  from runs;

  select coalesce(jsonb_object_agg(t.difficulty, t.stats), '{}'::jsonb)
  into v_by_difficulty
  from (
    select g.difficulty::text as difficulty,
           jsonb_build_object(
             'played',    count(*) filter (where g.status <> 'in_progress' or g.moves > 0),
             'completed', count(*) filter (where g.status = 'completed'),
             'best_time_ms', min(g.elapsed_ms) filter (where g.status = 'completed' and g.hints_used = 0),
             'avg_time_ms',  round(avg(g.elapsed_ms) filter (where g.status = 'completed'))
           ) as stats
    from public.games g
    where g.user_id = p_user
    group by g.difficulty
  ) t;

  insert into public.statistics as s (
    user_id, games_played, games_completed, games_failed, games_abandoned,
    best_time_ms, avg_time_ms, avg_mistakes, current_streak, best_streak, by_difficulty, updated_at
  ) values (
    p_user, coalesce(v_played, 0), coalesce(v_completed, 0), coalesce(v_failed, 0), coalesce(v_abandoned, 0),
    v_best, v_avg, v_avg_mistakes, v_current_streak, v_best_streak, v_by_difficulty, now()
  )
  on conflict (user_id) do update set
    games_played = excluded.games_played,
    games_completed = excluded.games_completed,
    games_failed = excluded.games_failed,
    games_abandoned = excluded.games_abandoned,
    best_time_ms = excluded.best_time_ms,
    avg_time_ms = excluded.avg_time_ms,
    avg_mistakes = excluded.avg_mistakes,
    current_streak = excluded.current_streak,
    best_streak = excluded.best_streak,
    by_difficulty = excluded.by_difficulty,
    updated_at = now();
end $$;

-- =============================================================================
-- sync_game: the single, validated write path for games
-- =============================================================================
create or replace function public.sync_game(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  v_givens text;
  v_board text;
  v_status public.game_status;
  v_mode public.game_mode;
  v_difficulty public.difficulty;
  v_daily date;
  v_elapsed integer;
  v_mistakes integer;
  v_limit integer;
  v_hints integer;
  v_moves integer;
  v_started timestamptz;
  v_completed timestamptz;
  v_updated timestamptz;
  v_clues integer;
  v_puzzle uuid;
  v_existing public.games%rowtype;
  v_notes jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_id         := (p ->> 'id')::uuid;
  v_givens     := p ->> 'givens';
  v_board      := p ->> 'board';
  v_status     := (p ->> 'status')::public.game_status;
  v_mode       := (p ->> 'mode')::public.game_mode;
  v_difficulty := (p ->> 'difficulty')::public.difficulty;
  v_daily      := nullif(p ->> 'daily_date', '')::date;
  v_elapsed    := least(greatest(coalesce((p ->> 'elapsed_ms')::integer, 0), 0), 86400000);
  v_mistakes   := least(greatest(coalesce((p ->> 'mistakes')::integer, 0), 0), 999);
  v_limit      := least(greatest(coalesce((p ->> 'mistake_limit')::integer, 0), 0), 99);
  v_hints      := least(greatest(coalesce((p ->> 'hints_used')::integer, 0), 0), 999);
  v_moves      := least(greatest(coalesce((p ->> 'moves')::integer, 0), 0), 999999);
  v_started    := (p ->> 'started_at')::timestamptz;
  v_completed  := nullif(p ->> 'completed_at', '')::timestamptz;
  v_updated    := (p ->> 'updated_at')::timestamptz;

  -- Device clocks can be wrong. Never accept timestamps from the future.
  if v_updated   > now() then v_updated   := now(); end if;
  if v_started   > now() then v_started   := now(); end if;
  if v_completed > now() then v_completed := now(); end if;
  if v_status = 'completed' and v_completed is null then v_completed := v_updated; end if;

  if not public.sudoku_givens_valid(v_givens) then
    raise exception 'invalid_puzzle' using errcode = '22023';
  end if;
  if not public.sudoku_board_matches_givens(v_givens, v_board) then
    raise exception 'invalid_board' using errcode = '22023';
  end if;
  if v_mode = 'daily' and v_daily is null then
    raise exception 'invalid_daily' using errcode = '22023';
  end if;

  v_clues := length(replace(v_givens, '0', ''));
  if v_clues < 17 then
    raise exception 'invalid_puzzle' using errcode = '22023';
  end if;

  -- A Daily must be the server's puzzle for that date whenever the server has one.
  if v_mode = 'daily' then
    perform 1 from public.daily_puzzles where puzzle_date = v_daily;
    if found then
      perform 1
      from public.daily_puzzles dp join public.puzzles pz on pz.id = dp.puzzle_id
      where dp.puzzle_date = v_daily and pz.givens = v_givens;
      if not found then
        raise exception 'daily_mismatch' using errcode = '22023';
      end if;
    end if;
  end if;

  -- Puzzle definitions are shared; first writer wins (the daily cron writes them first).
  insert into public.puzzles (givens, difficulty, score, clues, seed)
  values (
    v_givens, v_difficulty,
    least(greatest(coalesce((p ->> 'score')::integer, 0), 0), 1000),
    v_clues,
    left(coalesce(p ->> 'seed', ''), 64)
  )
  on conflict (givens) do nothing;
  select id into v_puzzle from public.puzzles where givens = v_givens;

  if v_status = 'completed' then
    if not public.sudoku_is_valid_solution(v_givens, v_board) then
      raise exception 'invalid_solution' using errcode = '22023';
    end if;
    -- Nobody fills in an average puzzle faster than a quarter of a second per empty cell.
    if v_elapsed < (81 - v_clues) * 250 then
      raise exception 'implausible_time' using errcode = '22023';
    end if;
    insert into public.puzzle_solutions (puzzle_id, solution) values (v_puzzle, v_board) on conflict do nothing;
  end if;

  select * into v_existing from public.games where id = v_id for update;
  if found then
    if v_existing.user_id <> uid then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    -- A finished game is never replaced by an unfinished one; equal states keep the newer edit.
    if public.game_status_rank(v_existing.status) > public.game_status_rank(v_status) then
      return jsonb_build_object('ok', true, 'kept', 'server');
    end if;
    if public.game_status_rank(v_existing.status) = public.game_status_rank(v_status)
       and v_existing.updated_at >= v_updated then
      return jsonb_build_object('ok', true, 'kept', 'server');
    end if;
  end if;

  insert into public.games (
    id, user_id, puzzle_id, mode, daily_date, status, difficulty, elapsed_ms, mistakes,
    mistake_limit, hints_used, moves, started_at, completed_at, updated_at, device_id
  ) values (
    v_id, uid, v_puzzle, v_mode, v_daily, v_status, v_difficulty, v_elapsed, v_mistakes,
    v_limit, v_hints, v_moves, v_started, v_completed, v_updated, left(p ->> 'device_id', 64)
  )
  on conflict (id) do update set
    status       = excluded.status,
    elapsed_ms   = excluded.elapsed_ms,
    mistakes     = excluded.mistakes,
    hints_used   = excluded.hints_used,
    moves        = excluded.moves,
    completed_at = excluded.completed_at,
    updated_at   = excluded.updated_at,
    device_id    = excluded.device_id,
    received_at  = now()
  where public.games.user_id = uid;

  if v_status = 'in_progress' then
    v_notes := coalesce(p -> 'notes', '[]'::jsonb);
    if jsonb_typeof(v_notes) <> 'array' or jsonb_array_length(v_notes) not in (0, 81) then
      v_notes := '[]'::jsonb;
    end if;
    insert into public.game_sessions (game_id, user_id, board, notes, paused, updated_at)
    values (v_id, uid, v_board, v_notes, coalesce((p ->> 'paused')::boolean, false), v_updated)
    on conflict (game_id) do update set
      board = excluded.board, notes = excluded.notes, paused = excluded.paused, updated_at = excluded.updated_at;
  else
    delete from public.game_sessions where game_id = v_id;
  end if;

  perform public.refresh_statistics(uid);
  return jsonb_build_object('ok', true);
end $$;

-- =============================================================================
-- Row level security
-- =============================================================================
alter table public.users                   enable row level security;
alter table public.puzzles                 enable row level security;
alter table public.puzzle_solutions        enable row level security;  -- no policies: unreachable from clients
alter table public.daily_puzzles           enable row level security;
alter table public.games                   enable row level security;
alter table public.game_sessions           enable row level security;
alter table public.statistics              enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.achievements            enable row level security;
alter table public.user_settings           enable row level security;

create policy "users: read own"   on public.users for select using (id = auth.uid());
create policy "users: update own" on public.users for update using (id = auth.uid()) with check (id = auth.uid());

-- Puzzle definitions hold no personal data; they are readable so games can be joined to them.
create policy "puzzles: readable" on public.puzzles for select using (true);

-- Today's Daily (and tomorrow's, for timezones ahead of UTC) only; never the future.
create policy "daily_puzzles: released only" on public.daily_puzzles for select
  using (puzzle_date <= ((now() at time zone 'utc')::date + 1));

-- Games and sessions: read and delete your own. Inserts/updates happen only through sync_game().
create policy "games: read own"    on public.games for select using (user_id = auth.uid());
create policy "games: delete own"  on public.games for delete using (user_id = auth.uid());
create policy "sessions: read own" on public.game_sessions for select using (user_id = auth.uid());
create policy "sessions: delete own" on public.game_sessions for delete using (user_id = auth.uid());

create policy "statistics: read own" on public.statistics for select using (user_id = auth.uid());

create policy "achievement_definitions: readable" on public.achievement_definitions for select using (true);
create policy "achievements: read own"   on public.achievements for select using (user_id = auth.uid());
create policy "achievements: insert own" on public.achievements for insert with check (user_id = auth.uid());

create policy "settings: read own"   on public.user_settings for select using (user_id = auth.uid());
create policy "settings: insert own" on public.user_settings for insert with check (user_id = auth.uid());
create policy "settings: update own" on public.user_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Writes by clients are limited to what the policies above allow.
revoke insert, update on public.games, public.game_sessions, public.statistics, public.puzzles, public.puzzle_solutions, public.daily_puzzles from anon, authenticated;
revoke all on public.puzzle_solutions from anon, authenticated;

-- Only signed-in users may call the write path.
revoke execute on function public.sync_game(jsonb)         from public, anon;
revoke execute on function public.refresh_statistics(uuid) from public, anon, authenticated;
grant  execute on function public.sync_game(jsonb)         to authenticated;
