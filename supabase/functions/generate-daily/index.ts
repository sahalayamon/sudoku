// Registers the next few days' Daily puzzles on the server.
//
// The puzzle for a date is deterministic (same engine, same seed as the app), so this job
// simply makes it authoritative: once a row exists in `daily_puzzles`, `sync_game` rejects
// any Daily result whose puzzle differs from it.
//
// Run `npm run edge:sync` first so `_shared/sudoku` exists, then:
//   supabase functions deploy generate-daily --no-verify-jwt
// and schedule it (see README): authenticated with the service role key in the
// Authorization header.
import { createClient } from "npm:@supabase/supabase-js@2";
import { dailyDifficulty, dailySeed } from "../_shared/sudoku/daily.ts";
import { generatePuzzle } from "../_shared/sudoku/generator.ts";

const DAYS_AHEAD = 3;

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response("Server is not configured", { status: 500 });
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const today = new Date().toISOString().slice(0, 10);
  const created: string[] = [];

  for (let offset = 0; offset <= DAYS_AHEAD; offset++) {
    const date = addDays(today, offset);
    const existing = await supabase.from("daily_puzzles").select("puzzle_date").eq("puzzle_date", date).maybeSingle();
    if (existing.error) return new Response(existing.error.message, { status: 500 });
    if (existing.data) continue;

    const difficulty = dailyDifficulty(date);
    const puzzle = generatePuzzle({ difficulty, seed: dailySeed(date) });

    const inserted = await supabase
      .from("puzzles")
      .upsert(
        {
          givens: puzzle.givens,
          difficulty,
          score: puzzle.score,
          clues: puzzle.clues,
          seed: puzzle.seed,
          generator_version: puzzle.generatorVersion,
        },
        { onConflict: "givens" },
      )
      .select("id")
      .single();
    if (inserted.error) return new Response(inserted.error.message, { status: 500 });

    const puzzleId = inserted.data.id as string;
    const solution = await supabase
      .from("puzzle_solutions")
      .upsert({ puzzle_id: puzzleId, solution: puzzle.solution }, { onConflict: "puzzle_id" });
    if (solution.error) return new Response(solution.error.message, { status: 500 });

    const daily = await supabase.from("daily_puzzles").insert({ puzzle_date: date, puzzle_id: puzzleId, difficulty });
    if (daily.error) return new Response(daily.error.message, { status: 500 });
    created.push(date);
  }

  return Response.json({ ok: true, created });
});
