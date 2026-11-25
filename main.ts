// Pump.fun Bot Sprint entry: an opening-burst scalper.
//
// The grader runs `node /bot/main.ts`; the strategy lives in strategy.ts and
// the SDK shim is the kit's sdk/ts/makefun-bot.ts, vendored in vendor/.
//
// The bot buys the opening burst of a fresh launch — at least 6 distinct
// buyers in the first 5 slots, creator still holding, run-up under +120% —
// then sells the whole position at +20% over cost, cuts at -15%, or exits
// after 450 slots. A single big sell does NOT exit (those dips usually
// recover); a creator sale does. Full write-up in README.md.
//
// Tuned on the dev window with the kit's local grader: net +0.254 SOL over
// 80 round trips (win rate 42.5%, max drawdown 1.0%), guardrails met, still
// +0.115 SOL at 2x fees. The tuned set below is a flat region, not a sharp
// peak: TP 0.20 with hold 300-450 and stop-loss 0.10-0.15 all score +0.25 to
// +0.27 SOL, and the score stays positive even without its single best trip.

// Re-grade note (2026-11-25, after the re-authoring): the kit's grade-local
// on the re-typed files reproduces the shipped score exactly — net +0.2545
// SOL over 80 round trips, win rate 42.5%, max drawdown 1.05%, guardrails
// met, +0.1148 SOL at 2x fees — so the re-authoring changed no behaviour,
// only the words around it. The 450-slot cap and the probe pacing below are
// what keep the guardrail (20 coins) met with room to spare: 80 coins held
// a qualifying round trip on the dev window.

import { runBot } from './vendor/makefun-bot.ts';
import { createStrategy, DEFAULT_PARAMS } from './strategy.ts';
import type { Params } from './strategy.ts';

// The tuned parameter set: same opening-burst scalper as DEFAULT_PARAMS,
// with the entry window, sizing and exits pinned to the swept values.
const TUNED: Params = {
  ...DEFAULT_PARAMS,
  // Entry: freshest bursts only, broad buying, creator not selling.
  maxAge: 5,
  minBuyers: 6,
  maxRunup: 1.2,
  // Sizing: 0.15 SOL per coin, at most 3 SOL at cost across positions.
  stakeSol: 0.15,
  maxExposureSol: 3,
  // Exits: bank the whole position at +20%, stop at -15%, 450-slot cap.
  tp1: 0.2,
  tp1PartBps: 10000,
  stopLoss: 0.15,
  maxHold: 450,
  // A single big sell is noise, not a rug: do not exit on it.
  bigSellSol: 1000,
  // Guardrail pacing targets coins (the competition needs 20), not fills.
  targetCoins: 25,
  targetFills: 40,
  paceSecs: 21_600,
};

await runBot(createStrategy(TUNED));
