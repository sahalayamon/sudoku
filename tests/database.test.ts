import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordToPayload, type SyncGamePayload } from "@/lib/sync/mapping";
import { makeRecord, samplePuzzle } from "./helpers";

/**
 * Runs the real migration against an in-process Postgres (PGlite) with a stand-in for
 * Supabase's `auth` schema, then exercises the security and validation rules.
 */

const MIGRATION = readFileSync(join(__dirname, "..", "supabase", "migrations", "0001_init.sql"), "utf8");

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

let db: PGlite;

async function as(user: string | null, role: "authenticated" | "anon" | "postgres" = "authenticated") {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false);`);
  if (role !== "postgres") await db.exec(`set role ${role};`);
}

async function sync(payload: Partial<SyncGamePayload> & Pick<SyncGamePayload, "id">, base = makeRecord()) {
  const full = { ...recordToPayload(base, "device-test"), ...payload };
  return db.query("select public.sync_game($1::jsonb) as result", [JSON.stringify(full)]);
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public, auth to anon, authenticated;
  `);
  await db.exec(MIGRATION);
  await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
  // Re-apply the migration's own revokes (the blanket grant above stands in for Supabase's default privileges).
  await db.exec(`
    revoke insert, update on public.games, public.game_sessions, public.statistics, public.puzzles, public.puzzle_solutions, public.daily_puzzles from anon, authenticated;
    revoke all on public.puzzle_solutions from anon, authenticated;
    grant execute on function public.sync_game(jsonb) to authenticated;
  `);
  await db.exec(`insert into auth.users (id, email) values ('${ALICE}', 'a@example.com'), ('${BOB}', 'b@example.com');`);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("schema", () => {
  it("creates a profile row when an auth user appears", async () => {
    await as(null, "postgres");
    const r = await db.query<{ id: string }>("select id from public.users order by id");
    expect(r.rows.map((x) => x.id)).toEqual([ALICE, BOB]);
  });

  it("accepts the current achievements as foreign keys", async () => {
    await as(null, "postgres");
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.achievement_definitions");
    expect(r.rows[0]!.n).toBe(12);
  });
});

describe("validation helpers", () => {
  it("recognises valid givens and solutions", async () => {
    await as(null, "postgres");
    const p = samplePuzzle();
    const ok = await db.query<{ a: boolean; b: boolean; c: boolean; d: boolean }>(
      `select public.sudoku_givens_valid($1) as a,
              public.sudoku_is_valid_solution($1, $2) as b,
              public.sudoku_is_valid_solution($1, $3) as c,
              public.sudoku_givens_valid($4) as d`,
      [p.givens, p.solution, "9".repeat(81), "11" + "0".repeat(79)],
    );
    expect(ok.rows[0]).toEqual({ a: true, b: true, c: false, d: false });
  });

  it("rejects a solution that breaks a given", async () => {
    await as(null, "postgres");
    const p = samplePuzzle();
    const givenIndex = p.givens.search(/[1-9]/);
    const swapped = p.solution.split("");
    const other = p.solution.indexOf(p.solution[givenIndex] === "1" ? "2" : "1");
    [swapped[givenIndex], swapped[other]] = [swapped[other]!, swapped[givenIndex]!];
    const r = await db.query<{ ok: boolean }>("select public.sudoku_is_valid_solution($1, $2) as ok", [p.givens, swapped.join("")]);
    expect(r.rows[0]!.ok).toBe(false);
  });
});

describe("sync_game", () => {
  it("requires a signed-in user", async () => {
    await as(null, "authenticated");
    await expect(sync({ id: uuid(1) })).rejects.toThrow(/not_authenticated/);
  });

  it("stores an in-progress game with its session, and a completed game without one", async () => {
    await as(ALICE);
    const p = samplePuzzle();
    await sync(
      { id: uuid(10), status: "in_progress", board: p.givens, completed_at: null },
      makeRecord({ status: "in_progress", completedAt: null }),
    );
    await as(null, "postgres");
    let games = await db.query<{ status: string }>("select status from public.games where id = $1", [uuid(10)]);
    expect(games.rows[0]!.status).toBe("in_progress");
    const sessions = await db.query("select 1 from public.game_sessions where game_id = $1", [uuid(10)]);
    expect(sessions.rows).toHaveLength(1);

    await as(ALICE);
    await sync({ id: uuid(10), status: "completed", board: p.solution, updated_at: new Date(Date.now() - 1000).toISOString() });
    await as(null, "postgres");
    games = await db.query("select status from public.games where id = $1", [uuid(10)]);
    expect(games.rows[0]!.status).toBe("completed");
    expect((await db.query("select 1 from public.game_sessions where game_id = $1", [uuid(10)])).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.puzzle_solutions")).rows.length).toBeGreaterThan(0);
  });

  it("rejects a completed game whose grid is not a valid solution", async () => {
    await as(ALICE);
    const p = samplePuzzle();
    const empty = p.givens.indexOf("0"); // a cell the player fills in, so givens stay intact
    const wrong = p.solution[empty] === "1" ? "2" : "1";
    const broken = p.solution.slice(0, empty) + wrong + p.solution.slice(empty + 1);
    await expect(sync({ id: uuid(11), status: "completed", board: broken })).rejects.toThrow(/invalid_solution/);
    // And a board that overwrites a given is rejected as a different kind of invalid.
    const g = p.givens.search(/[1-9]/);
    const tampered = p.solution.slice(0, g) + (p.solution[g] === "1" ? "2" : "1") + p.solution.slice(g + 1);
    await expect(sync({ id: uuid(11), status: "completed", board: tampered })).rejects.toThrow(/invalid_board/);
  });

  it("rejects implausibly fast solves", async () => {
    await as(ALICE);
    await expect(sync({ id: uuid(12), status: "completed", elapsed_ms: 400 })).rejects.toThrow(/implausible_time/);
  });

  it("rejects puzzles with duplicate givens", async () => {
    await as(ALICE);
    await expect(
      sync({ id: uuid(13), givens: "11" + "0".repeat(79), board: "11" + "0".repeat(79), status: "in_progress" }),
    ).rejects.toThrow(/invalid_puzzle/);
  });

  it("a finished game is never replaced by an older in-progress copy", async () => {
    await as(ALICE);
    const p = samplePuzzle();
    await sync({ id: uuid(14), status: "completed", board: p.solution });
    const res = await sync({
      id: uuid(14),
      status: "in_progress",
      board: p.givens,
      completed_at: null,
      updated_at: new Date().toISOString(),
    });
    expect((res.rows[0] as { result: { kept?: string } }).result.kept).toBe("server");
    await as(null, "postgres");
    const g = await db.query<{ status: string }>("select status from public.games where id = $1", [uuid(14)]);
    expect(g.rows[0]!.status).toBe("completed");
  });

  it("does not let one user overwrite another user's game", async () => {
    await as(BOB);
    await expect(sync({ id: uuid(14), status: "completed" })).rejects.toThrow(/forbidden/);
  });

  it("enforces the server's Daily puzzle once one exists for the date", async () => {
    await as(null, "postgres");
    const p = samplePuzzle();
    const other = "0" + p.givens.slice(1);
    const insertedPuzzle = await db.query<{ id: string }>(
      "insert into public.puzzles (givens, difficulty, score, clues) values ($1, 'easy', 10, 40) returning id",
      [other.replace(/^0/, p.givens[0] === "0" ? "0" : "0")],
    );
    await db.query("insert into public.daily_puzzles (puzzle_date, puzzle_id, difficulty) values ('2026-01-01', $1, 'easy')", [
      insertedPuzzle.rows[0]!.id,
    ]);
    await as(ALICE);
    await expect(
      sync({ id: uuid(15), mode: "daily", daily_date: "2026-01-01", status: "in_progress", board: p.givens, completed_at: null }),
    ).rejects.toThrow(/daily_mismatch/);
    // A date the server has no puzzle for yet is accepted (offline play, cron not run).
    await expect(
      sync({ id: uuid(16), mode: "daily", daily_date: "2026-01-02", status: "in_progress", board: p.givens, completed_at: null }),
    ).resolves.toBeTruthy();
  });
});

describe("statistics and streaks", () => {
  it("derives totals and a consecutive daily streak on the server", async () => {
    await as(null, "postgres");
    const today = (await db.query<{ d: string }>("select current_date::text as d")).rows[0]!.d;
    const day = async (offset: number) =>
      (await db.query<{ d: string }>("select ($1::date + $2::int)::text as d", [today, offset])).rows[0]!.d;
    const p = samplePuzzle();

    await as(BOB);
    for (const [n, offset] of [
      [30, 0],
      [31, -1],
      [32, -2],
      [33, -4],
    ] as const) {
      await sync({
        id: uuid(n),
        mode: "daily",
        daily_date: await day(offset),
        status: "completed",
        board: p.solution,
        elapsed_ms: 200_000,
      });
    }
    await as(null, "postgres");
    const s = await db.query<{ games_completed: number; current_streak: number; best_streak: number; best_time_ms: number }>(
      "select games_completed, current_streak, best_streak, best_time_ms from public.statistics where user_id = $1",
      [BOB],
    );
    expect(s.rows[0]).toMatchObject({ games_completed: 4, current_streak: 3, best_streak: 3, best_time_ms: 200_000 });
  });
});

describe("row level security", () => {
  it("lets users read only their own games, statistics and sessions", async () => {
    await as(ALICE);
    const alice = await db.query<{ user_id: string }>("select distinct user_id from public.games");
    expect(alice.rows.map((r) => r.user_id)).toEqual([ALICE]);
    await as(BOB);
    const bob = await db.query<{ user_id: string }>("select distinct user_id from public.games");
    expect(bob.rows.map((r) => r.user_id)).toEqual([BOB]);
    const stats = await db.query("select user_id from public.statistics");
    expect(stats.rows).toHaveLength(1);
  });

  it("blocks direct writes to games, statistics and puzzles", async () => {
    await as(ALICE);
    await expect(
      db.query(
        "insert into public.games (id, user_id, puzzle_id, status, difficulty, started_at, updated_at) select $1, $2, id, 'completed', 'easy', now(), now() from public.puzzles limit 1",
        [uuid(90), ALICE],
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(db.query("update public.games set elapsed_ms = 1")).rejects.toThrow(/permission denied/i);
    await expect(db.query("update public.statistics set best_streak = 999")).rejects.toThrow(/permission denied/i);
    await expect(
      db.query("insert into public.puzzles (givens, difficulty, clues) values ($1, 'easy', 30)", ["0".repeat(81)]),
    ).rejects.toThrow(/permission denied/i);
  });

  it("never exposes solutions", async () => {
    await as(ALICE);
    await expect(db.query("select * from public.puzzle_solutions")).rejects.toThrow(/permission denied/i);
    await as(null, "anon");
    await expect(db.query("select * from public.puzzle_solutions")).rejects.toThrow(/permission denied/i);
  });

  it("lets a user manage only their own settings and achievements", async () => {
    await as(ALICE);
    await db.query('insert into public.user_settings (user_id, settings) values ($1, \'{"theme":"dark"}\')', [ALICE]);
    await db.query("insert into public.achievements (user_id, achievement_id) values ($1, 'first_solve')", [ALICE]);
    await expect(db.query("insert into public.achievements (user_id, achievement_id) values ($1, 'first_solve')", [BOB])).rejects.toThrow(
      /row-level security/i,
    );
    await expect(db.query("insert into public.achievements (user_id, achievement_id) values ($1, 'made_up')", [ALICE])).rejects.toThrow();
    await as(BOB);
    expect((await db.query("select * from public.user_settings")).rows).toHaveLength(0);
    expect((await db.query("select * from public.achievements")).rows).toHaveLength(0);
  });

  it("does not release future Daily puzzles", async () => {
    await as(null, "postgres");
    const p = samplePuzzle();
    const pz = await db.query<{ id: string }>("select id from public.puzzles where givens = $1", [p.givens]);
    await db.query("insert into public.daily_puzzles (puzzle_date, puzzle_id, difficulty) values (current_date + 30, $1, 'easy')", [
      pz.rows[0]!.id,
    ]);
    await as(ALICE);
    const rows = await db.query<{ puzzle_date: string }>(
      "select puzzle_date::text from public.daily_puzzles where puzzle_date > current_date + 2",
    );
    expect(rows.rows).toHaveLength(0);
  });
});
