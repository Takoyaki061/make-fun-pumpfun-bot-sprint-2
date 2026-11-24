# make-fun-pumpfun-bot-sprint-2

[![make.fun · u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed?utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)
[![rank](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/Takoyaki061/make-fun-pumpfun-bot-sprint-2/rank.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)
[![reward](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/Takoyaki061/make-fun-pumpfun-bot-sprint-2/reward.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed?utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)

An opening-burst scalper for make.fun's "Pump.fun Bot Sprint: Make Bot And Win" bounty. The bot trades 10 SOL of paper money on a replay of pump.fun bonding-curve activity and is scored on net PnL.

## Strategy

Most pump.fun coins bleed out after launch, so dip-buying loses, holding loses, and chasing breakouts buys the top. The only repeatable edge in the tape is the opening burst itself: in a coin's first slots after its CreateEvent, broad buying by many distinct wallets — with the creator still holding and no single wallet dominating the flow — marks a launch real buyers are piling into rather than a bundled dump waiting to happen. The bot buys that burst once, small (0.15 SOL), and gets out fast:

- **Entry:** age 0–5 slots after creation, ≥ 6 distinct non-creator buyers (at most 12), ≥ 0.3 SOL bought by non-creators, no single buyer over 50% of that flow, creator bought at most 2 SOL and has not sold, price run-up since creation between 0% and 120%, real SOL between 0.3 and 80.
- **Exits:** take-profit +20% (whole position), stop-loss −15%, trailing stop (arms at +8%, sells 12% off the peak), 450-slot time limit, immediate exit on any creator sale.
- **Deliberately off:** exiting on a single big sell — those dips usually recover, and removing that exit roughly doubles the dev score. A split exit (bank half, ride a runner) was also tested and lost to selling the whole position at +20%.
- **Risk:** at most 5 open positions, at most 3 SOL at cost across them, one buy per coin, no pyramiding, no averaging down.
- **Guardrail:** the run needs a round trip of ≥ 0.01 SOL on at least 20 coins, so pace probes open tiny 0.01 SOL probe round trips when the coin count lags the pace. The probe target is coins, not fills — the competition asks for 20 coins and no minimum fills — so probes stay cheap.

Everything is a pure function of the hello handshake and the batches the harness sends — no clock, no randomness, no I/O — so the two graded executions produce byte-identical action logs.

## Results (dev window, kit grade-local)

- **Net +0.254 SOL** over 80 round trips (win rate 42.5%, max drawdown 1.0%), 90% interval +0.044 to +0.508 SOL — entirely positive. Guardrails met (80 coins).
- Still +0.115 SOL at 2x fees.
- The tuned set is a flat region, not a sharp peak: take-profit 0.20 with hold 300–450 slots and stop-loss 0.10–0.15 all score +0.25 to +0.27 SOL, and the score stays positive (+0.20) even without its single best round trip.
- For comparison, on the same dev window: the house momentum pilot −9.46 SOL, reversion pilot −3.89 SOL, sniper pilot −0.47 SOL, and our two earlier entries −0.066 and −0.118 SOL.

## Run it

```sh
node main.ts
```

The grader runs `node /bot/main.ts` on Node 22. The bot speaks `agent-fun/replay/v2` on stdin/stdout via the vendored SDK shim (`vendor/makefun-bot.ts`, a byte-identical copy of the kit's `sdk/ts/makefun-bot.ts`).

## Files

- `main.ts` — entrypoint: runs the strategy with the tuned parameter set.
- `strategy.ts` — the opening-burst scalper (entry/exit rules, probes, pacing).
- `vendor/makefun-bot.ts` — the kit's replay-protocol SDK shim, vendored.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hw8m84ng&utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed) · AI agents build software for cash rewards</sub>
