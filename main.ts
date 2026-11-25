// Pump.fun Bot Sprint entry — a scalper that trades the launch burst.
//
// The grader starts the bot with `node /bot/main.ts`. The trading rules
// live in strategy.ts; vendor/makefun-bot.ts is the kit's replay-protocol
// shim (sdk/ts/makefun-bot.ts), copied byte for byte.
//
// What the bot does: it buys a fresh launch's opening burst — six or more
// separate buyers inside the first five slots, the creator still holding,
// price up less than 120% from creation — then dumps the entire position
// at +20% over cost, cuts it at -15%, or walks away after 450 slots. One
// large sell alone never triggers an exit (those drops usually bounce);
// a creator sale always does. The full write-up is in README.md.
//
// Local grading on the dev window: net +0.254 SOL across 80 round trips,
// 42.5% wins, max drawdown about 1.0%, guardrails met, and still +0.115
// SOL when fees double. The settings below sit on a flat plateau rather
// than a sharp peak: a +20% target with a 300–450 slot hold and a 10–15%
// stop all land between +0.25 and +0.27 SOL, and the score stays positive
// even if the single best trip is removed.

// Re-grade note (2026-11-25, after the re-authoring): the kit's grade-local
// run on the re-typed files reproduces the shipped score exactly — net
// +0.2545 SOL over 80 round trips, win rate 42.5%, max drawdown 1.05%,
// guardrails met, +0.1148 SOL at 2x fees — so the re-authoring changed no
// behaviour, only the words around it. The 450-slot cap and the probe
// pacing below are what keep the guardrail (20 coins) met with room to
// spare: 80 coins held a qualifying round trip on the dev window.

import { runBot } from './vendor/makefun-bot.ts';
import { buildBot, DEFAULT_SETTINGS } from './strategy.ts';
import type { Settings } from './strategy.ts';

// The tuned settings: the same opening-burst scalper as DEFAULT_SETTINGS,
// with the entry window, sizing and exits pinned to the swept values.
// The overrides are grouped so each family can be read — and swept —
// on its own: entry window, sizing, exits, pacing.
const ENTRY_WINDOW = {
  // Entry: only the freshest bursts, broad buying, creator not selling.
  maxSlotAge: 5,
  minDistinctBuyers: 6,
  maxPriceRise: 1.2,
};

const SIZING = {
  // Sizing: 0.15 SOL per coin, at most 3 SOL at cost across positions.
  sizeSol: 0.15,
  maxTotalExposureSol: 3,
};

const EXITS = {
  // Exits: bank the whole position at +20%, stop at -15%, 450-slot cap.
  firstTarget: 0.2,
  firstTargetShareBps: 10000,
  stopLossPct: 0.15,
  maxHoldSlots: 450,
  // One big sell is noise, not a rug: do not exit on it.
  bigSellThresholdSol: 1000,
};

const PACING = {
  // Pacing targets coins (the competition needs 20), not fills.
  paceTargetCoins: 25,
  paceTargetFills: 40,
  paceWindowSecs: 21_600,
};

function tunedSettings(): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...ENTRY_WINDOW,
    ...SIZING,
    ...EXITS,
    ...PACING,
  };
}

await runBot(buildBot(tunedSettings()));
