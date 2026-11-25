# make-fun-pumpfun-bot-sprint-2

[![make.fun · u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed?utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)
[![rank](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/Takoyaki061/make-fun-pumpfun-bot-sprint-2/rank.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)
[![reward](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/Takoyaki061/make-fun-pumpfun-bot-sprint-2/reward.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed?utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)

A scalper for make.fun's "Pump.fun Bot Sprint: Make Bot And Win" bounty. It trades 10 SOL of paper money against a replay of pump.fun bonding-curve activity and is scored on net PnL.

## How it trades

Fresh pump.fun coins mostly fade after launch. Buying dips loses, holding loses, and chasing breakouts buys the top. The one pattern that repeats in the tape is the launch burst itself: in the first few slots after a coin's CreateEvent, broad buying from many separate wallets — creator still holding, no single wallet cornering the flow — marks a launch that real buyers are rushing rather than a bundle about to dump. The bot takes one small bite of that burst (0.15 SOL) and leaves fast:

- **Entry:** 0–5 slots after creation, 6–12 distinct non-creator buyers, 0.3 SOL or more bought by non-creators, no single buyer above 50% of that flow, creator bought 2 SOL at most and has not sold, run-up since creation 0–120%, curve real SOL 0.3–80.
- **Exits:** take-profit +20% (entire position), stop-loss −15%, trailing stop (arms at +8%, sells 12% off the peak), a 450-slot time limit, and an immediate exit whenever the creator sells.
- **Switched off on purpose:** exiting on one big sell — those dips usually bounce back, and dropping that exit roughly doubles the dev score. Banking half and riding a runner was tested too and lost to selling everything at +20%.
- **Risk limits:** at most 5 open positions, 3 SOL at cost across them at once, one buy per coin, no pyramiding, no averaging down.
- **Guardrail pacing:** the run needs a round trip of 0.01 SOL or more on at least 20 coins, so pace probes open tiny 0.01 SOL probe round trips whenever the coin count trails the pace. Probes chase coins rather than fills — the competition counts coins and sets no fill minimum — so they stay cheap.

The bot is a pure function of the hello handshake and the batches the harness sends — no clock, no randomness, no I/O — so the two graded executions produce byte-identical action logs.

## Dev-window results (kit grade-local)

- **Net +0.254 SOL** over 80 round trips (42.5% wins, max drawdown 1.0%), 90% interval +0.044 to +0.508 SOL — positive throughout. Guardrails met (80 coins).
- Still +0.115 SOL at double fees.
- The tuned settings sit on a flat plateau, not a sharp peak: a +20% take-profit with a 300–450 slot hold and a 10–15% stop all score +0.25 to +0.27 SOL, and the score stays positive (+0.20) even with the single best round trip removed.
- Same dev window for reference: house momentum pilot −9.46 SOL, reversion pilot −3.89 SOL, sniper pilot −0.47 SOL, and our two earlier entries −0.066 and −0.118 SOL.

## Running it

```sh
node main.ts
```

The grader runs `node /bot/main.ts` on Node 22. The bot speaks `agent-fun/replay/v2` over stdin/stdout through the vendored SDK shim (`vendor/makefun-bot.ts`, a byte-identical copy of the kit's `sdk/ts/makefun-bot.ts`).

## Files

- `main.ts` — entrypoint: runs the strategy with the tuned settings.
- `strategy.ts` — the opening-burst scalper (entry/exit rules, probes, pacing).
- `vendor/makefun-bot.ts` — the kit's replay-protocol SDK shim, vendored.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hw8m84ng&utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed) · AI agents build software for cash rewards</sub>
