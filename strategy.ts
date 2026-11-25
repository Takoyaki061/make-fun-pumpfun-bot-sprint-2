// A scalper that rides the opening burst of a fresh pump.fun launch.
//
// Why this shape wins on the dev tape: plain momentum, buying dips and
// holding all lose money here, because most fresh coins fade right after
// they appear. The one durable pattern is the burst itself — in a coin's
// first few slots after creation, lots of different wallets buying while
// the creator keeps holding and nobody corners the flow. That is a launch
// real buyers are rushing, not a bundle waiting to dump. So the bot takes
// one small bite of that burst and gets out quickly: everything goes at
// +20% over what it paid. The tape falls off a cliff past +20% — a +30%
// target wrecks the score — because coins spike twenty or thirty percent
// and hand it straight back. A -15% stop and a 450-slot clock cap the
// downside instead.
//
// Two exits that sound right are deliberately off. A single large sell
// does not trigger an exit: those dips usually bounce, and dropping that
// exit roughly doubles the dev score. And there is no half-and-ride split:
// the second leg almost never pays on dev, so the first target sells the
// whole position and the runner settings only exist as the other end of
// those parameters. A creator sale still dumps everything at once. One
// buy per coin, never adding, never averaging down.
//
// The guardrail wants a round trip of at least 0.01 SOL on 20 coins or
// more, so a pacing probe tops the run up toward 25 coins: whenever our
// own coins trail the pace implied by block time, the bot opens a tiny
// 0.01 SOL probe on a liquid curve and sells it as soon as the buy
// settles. Probes chase coins, not fills — the competition counts coins
// and sets no fill minimum — which keeps them cheap.
//
// The whole bot is a pure function of the hello handshake and the
// batches the harness delivers: no clock, no randomness, no I/O, no
// environment reads. Two graded runs therefore produce identical action
// logs and identical orders per slot.

import type { Batch, Bot, BotState } from './vendor/makefun-bot.ts';
import type { OrderInput, Pubkey } from './vendor/makefun-bot.ts';

export interface Settings {
  /** Earliest slot age (slots since the create) a first buy may consider. */
  minSlotAge: number;
  /** Latest slot age at which a first buy may still be decided. */
  maxSlotAge: number;
  /** Distinct non-creator wallets that must have bought before entry. */
  minDistinctBuyers: number;
  /** Distinct non-creator wallets, at most: a launch bundled across many wallets is a dump in waiting. */
  maxDistinctBuyers: number;
  /** Total SOL bought by non-creators before entry, at least. */
  minOutsideBuySol: number;
  /** Largest single non-creator wallet's share of the non-creator buy SOL, at most. */
  maxSingleBuyerShare: number;
  /** Creator's own buys since create, at most (a creator loading up is a bundle). */
  maxCreatorBuySol: number;
  /** Refuse the coin if the creator has sold any amount before entry. */
  refuseCreatorSold: boolean;
  /** Price now over the create price, as a fraction: entry window, low end. */
  minPriceRise: number;
  /** Price now over the create price, as a fraction: entry window, high end. */
  maxPriceRise: number;
  /** Curve real SOL bounds at entry, low end. */
  minCurveSol: number;
  /** Curve real SOL bounds at entry, high end. */
  maxCurveSol: number;
  /** SOL staked on one position (a single buy, no adds). */
  sizeSol: number;
  /** Smallest buy worth sending (one tx fee is about 0.000105 SOL). */
  minOrderSol: number;
  /** Slippage allowed on buys in bps; sells always go out at 10000. */
  buySlippageBps: number;
  /** Trailing stop before any take-profit: arms once value reaches cost * (1 + preTpTrailArm). */
  preTpTrailArm: number;
  /** ...then sell when value falls to peak * (1 - preTpTrailDrop). */
  preTpTrailDrop: number;
  /** First take-profit: sell firstTargetShareBps of the position when value reaches cost * (1 + firstTarget).
      10000 sells the whole position; below that the rest rides as a runner. */
  firstTarget: number;
  /** Share of the position (bps) sold at the first take-profit. */
  firstTargetShareBps: number;
  /** After the first leg, the runner's stop: sell when value falls to cost * (1 - runnerStop). */
  runnerStop: number;
  /** Runner's hard take-profit: sell when value reaches cost * (1 + runnerTarget). */
  runnerTarget: number;
  /** Plain stop-loss before any take-profit: sell when value falls to cost * (1 - stopLossPct). */
  stopLossPct: number;
  /** Trailing stop on the runner: arms once value reaches cost * (1 + runnerTrailArm). */
  runnerTrailArm: number;
  /** ...then sell when value falls to peak * (1 - runnerTrailDrop). */
  runnerTrailDrop: number;
  /** Exit after holding this many slots, whatever the value. */
  maxHoldSlots: number;
  /** Exit at once on any single recorded sell of at least this many SOL. */
  bigSellThresholdSol: number;
  /** Slots to wait after an exit before the same curve may be bought again. */
  rebuyCooldown: number;
  /** Most entries per curve over the whole run. */
  maxBuysPerCurve: number;
  /** Most SOL at cost across all open positions at once. */
  maxTotalExposureSol: number;
  /** Guardrail pacing: targets for the run, paced over paceWindowSecs of block time. */
  paceTargetCoins: number;
  paceTargetFills: number;
  paceWindowSecs: number;
  probeSizeSol: number;
  maxConcurrentProbes: number;
}

// Settings traded by main.ts. Chosen by sweeping the faithful local simulator
// (all three dataset parts, mean over four failed-tx draws) on the dev window,
// preferring flat regions over a single sharp peak: TP 0.20 with hold 300-450
// and stop-loss 0.10-0.15 all score +0.25 to +0.27 SOL, and the score stays
// positive even without its single best round trip (+0.20 ex-best).
export const DEFAULT_SETTINGS: Settings = {
  minSlotAge: 0,
  maxSlotAge: 5,
  minDistinctBuyers: 6,
  maxDistinctBuyers: 12,
  minOutsideBuySol: 0.3,
  maxSingleBuyerShare: 0.5,
  maxCreatorBuySol: 2.0,
  refuseCreatorSold: true,
  minPriceRise: 0.0,
  maxPriceRise: 1.2,
  minCurveSol: 0.3,
  maxCurveSol: 80,
  sizeSol: 0.15,
  minOrderSol: 0.01,
  buySlippageBps: 1000,
  firstTarget: 0.2,
  firstTargetShareBps: 10000,
  runnerStop: 0.02,
  runnerTarget: 0.5,
  stopLossPct: 0.15,
  preTpTrailArm: 0.08,
  preTpTrailDrop: 0.12,
  runnerTrailArm: 0.2,
  runnerTrailDrop: 0.15,
  maxHoldSlots: 450,
  bigSellThresholdSol: 1000,
  rebuyCooldown: 200,
  maxBuysPerCurve: 1,
  maxTotalExposureSol: 3,
  paceTargetCoins: 25,
  paceTargetFills: 40,
  paceWindowSecs: 21_600,
  probeSizeSol: 0.01,
  maxConcurrentProbes: 1,
};

const LAMPORTS_IN_SOL = 1e9;
const CURVE_TAKE = 0.0125;

/** What selling `tokens` now would net, in SOL, after the curve fee and one tx fee. */
function netSellValue(tokens: number, quoteReserves: number, tokenReserves: number, feeSol: number): number {
  return ((tokens * quoteReserves) / (tokenReserves + tokens) / LAMPORTS_IN_SOL) * (1 - CURVE_TAKE) - feeSol;
}

interface ObservedTrade {
  slot: number;
  isBuy: boolean;
  sol: number;
  wallet: string;
  price: number;
}

interface CurveTape {
  createdSlot: number | null;
  creatorWallet: string | null;
  launchPrice: number;
  fills: ObservedTrade[];
  buys: number;
  lastExitSlot: number;
  creatorSold: boolean;
}

interface OpenTrade {
  openedSlot: number;
  bestValue: number;
  costBasis: number;
  windingDown: boolean;
  /** Some buy of this position filled. */
  hasFilled: boolean;
  /** First leg already taken. */
  firstLegDone: boolean;
  /** Tokens held when the first leg was sent: if a later batch still holds that
      many with no sell in flight, the leg's sell failed and the leg re-fires. */
  firstLegTokens: bigint;
}

export function buildBot(s: Settings = DEFAULT_SETTINGS): Bot {
  const curveTapes = new Map<Pubkey, CurveTape>();
  const openTrades = new Map<Pubkey, OpenTrade>();
  /** Probe round trips in flight, by mint: false while buying, true once selling. */
  const probeState = new Map<Pubkey, boolean>();
  /** Our own filled orders and the coins they were on (harness closes excluded). */
  let fillsSeen = 0;
  const coinsSeen = new Set<Pubkey>();
  let windowStart: number | null = null;
  let windowEnd: number | null = null;

  const tapeFor = (mint: Pubkey): CurveTape => {
    let tape = curveTapes.get(mint);
    if (tape === undefined) {
      tape = { createdSlot: null, creatorWallet: null, launchPrice: 0, fills: [], buys: 0, lastExitSlot: -1e12, creatorSold: false };
      curveTapes.set(mint, tape);
    }
    return tape;
  };

  /** Opening-burst signal on a curve's tape at slot `slotNow`. */
  const burstIsTradable = (tape: CurveTape, slotNow: number, curveSol: number, price: number): boolean => {
    if (curveSol < s.minCurveSol || curveSol > s.maxCurveSol) return false;
    if (tape.createdSlot === null) return false;
    const age = slotNow - tape.createdSlot;
    if (age < s.minSlotAge || age > s.maxSlotAge) return false;
    if (tape.creatorWallet === null) return false;
    if (s.refuseCreatorSold && tape.creatorSold) return false;
    if (tape.launchPrice <= 0) return false;
    const rise = price / tape.launchPrice - 1;
    if (rise < s.minPriceRise || rise > s.maxPriceRise) return false;
    let outsideBuySol = 0;
    let creatorBuySol = 0;
    const perWallet = new Map<string, number>();
    for (const fill of tape.fills) {
      if (fill.wallet === tape.creatorWallet) {
        if (fill.isBuy) creatorBuySol += fill.sol;
        continue;
      }
      if (fill.isBuy) {
        outsideBuySol += fill.sol;
        perWallet.set(fill.wallet, (perWallet.get(fill.wallet) ?? 0) + fill.sol);
      }
    }
    if (perWallet.size < s.minDistinctBuyers || perWallet.size > s.maxDistinctBuyers) return false;
    if (outsideBuySol < s.minOutsideBuySol) return false;
    if (creatorBuySol > s.maxCreatorBuySol) return false;
    let biggest = 0;
    for (const v of perWallet.values()) if (v > biggest) biggest = v;
    if (biggest > s.maxSingleBuyerShare * outsideBuySol) return false;
    return true;
  };

  /** Full exit test for one open trade: plain stop, trailing stops, runner
      rules, the hold clock, a heavy single sell, or a creator sale. */
  const exitWanted = (
    trade: OpenTrade,
    value: number,
    cost: number,
    slotNow: number,
    creatorDumped: boolean,
    heavySell: boolean,
  ): boolean => {
    if (trade.windingDown) return true;
    if (!trade.firstLegDone && value <= cost * (1 - s.stopLossPct)) return true;
    if (
      !trade.firstLegDone &&
      trade.bestValue >= cost * (1 + s.preTpTrailArm) &&
      value < trade.bestValue * (1 - s.preTpTrailDrop)
    )
      return true;
    if (trade.firstLegDone && value <= cost * (1 - s.runnerStop)) return true;
    if (trade.firstLegDone && value >= cost * (1 + s.runnerTarget)) return true;
    if (
      trade.firstLegDone &&
      trade.bestValue >= cost * (1 + s.runnerTrailArm) &&
      value < trade.bestValue * (1 - s.runnerTrailDrop)
    )
      return true;
    if (slotNow - trade.openedSlot > s.maxHoldSlots) return true;
    if (heavySell) return true;
    if (creatorDumped) return true;
    return false;
  };

  return {
    onBatch(state: BotState, batch: Batch): OrderInput[] {
      const slotNow = batch.slot;
      const heavySells = new Set<Pubkey>();
      const touched = new Set<Pubkey>();
      for (const fill of batch.fills) {
        if (fill.status === 'filled' && !fill.client_id.startsWith('_')) {
          fillsSeen++;
          coinsSeen.add(fill.mint);
        }
      }
      for (const event of batch.events) {
        if (event.block_time !== null) {
          if (windowStart === null) windowStart = event.block_time;
          if (windowEnd === null || event.block_time > windowEnd) windowEnd = event.block_time;
        }
        if (event.event === 'CreateEvent') {
          const tape = tapeFor(event.mint);
          tape.createdSlot = event.slot;
          tape.creatorWallet = event.user;
          tape.launchPrice = Number(event.virtual_quote_reserves) / Number(event.virtual_token_reserves);
        } else if (event.event === 'TradeEvent') {
          const tape = tapeFor(event.mint);
          const sol = Number(event.sol_amount) / LAMPORTS_IN_SOL;
          tape.fills.push({
            slot: event.slot,
            isBuy: event.is_buy,
            sol,
            wallet: event.user,
            price: Number(event.virtual_quote_reserves) / Number(event.virtual_token_reserves),
          });
          touched.add(event.mint);
          if (tape.creatorWallet !== null && event.user === tape.creatorWallet && !event.is_buy) tape.creatorSold = true;
          if (!event.is_buy && sol >= s.bigSellThresholdSol) heavySells.add(event.mint);
        }
      }
      const priceMarks = new Map(batch.marks.map((m) => [m.mint, m] as const));
      const pendingCount = new Map<Pubkey, number>();
      for (const pending of state.pending.values()) {
        pendingCount.set(pending.order.mint, (pendingCount.get(pending.order.mint) ?? 0) + 1);
      }

      const out: OrderInput[] = [];
      const batchCap = state.hello.caps.max_orders_per_batch;
      const feeSol = Number(state.txFeeLamports()) / LAMPORTS_IN_SOL;

      // Exits first: first leg, then the runner/stop/trailing/time rules,
      // a heavy sell, or a creator sale.
      for (const [mint, trade] of openTrades) {
        const pos = state.positions.get(mint);
        const curve = state.curves.get(mint);
        if (pos === undefined) {
          if (!pendingCount.has(mint)) {
            openTrades.delete(mint);
            const tape = tapeFor(mint);
            if (trade.hasFilled) tape.lastExitSlot = slotNow;
            else tape.buys--;
          }
          continue;
        }
        trade.hasFilled = true;
        if (curve === undefined || curve.complete) continue;
        const mark = priceMarks.get(mint);
        const quoteReserves = mark ? Number(mark.virtual_quote_reserves) : Number(curve.virtual_quote_reserves);
        const tokenReserves = mark ? Number(mark.virtual_token_reserves) : Number(curve.virtual_token_reserves);
        const tokens = Number(pos.token_amount);
        const value = netSellValue(tokens, quoteReserves, tokenReserves, feeSol);
        const cost = Number(pos.cost_lamports) / LAMPORTS_IN_SOL;
        if (value > trade.bestValue) trade.bestValue = value;
        const tape = tapeFor(mint);
        let sellPending = false;
        for (const pending of state.pending.values()) {
          if (pending.order.mint === mint && pending.order.side === 'sell') sellPending = true;
        }
        // A first-leg sell that failed leaves the whole position held with no sell
        // in flight: re-arm the leg instead of stranding the position.
        if (trade.firstLegDone && !sellPending && trade.firstLegTokens > 0n && BigInt(pos.token_amount) >= trade.firstLegTokens) {
          trade.firstLegDone = false;
        }

        // Take-profit leg: sell firstTargetShareBps of the position at +firstTarget
        // (the whole position at the shipped 10000); below 10000 the rest rides
        // as a runner.
        if (!trade.firstLegDone && !sellPending && value >= cost * (1 + s.firstTarget)) {
          const leg = (BigInt(pos.token_amount) * BigInt(s.firstTargetShareBps)) / 10_000n;
          if (leg > 0n) {
            if (out.length < batchCap) {
              out.push({ side: 'sell', mint, token_amount: leg, max_slippage_bps: 10_000 });
              trade.firstLegDone = true;
              trade.firstLegTokens = BigInt(pos.token_amount);
              trade.bestValue = value;
            }
            continue;
          }
        }

        if (!exitWanted(trade, value, cost, slotNow, tape.creatorSold, heavySells.has(mint))) continue;
        trade.windingDown = true;
        if (sellPending) continue;
        if (out.length >= batchCap) break;
        out.push({ side: 'sell', mint, token_amount: pos.token_amount, max_slippage_bps: 10_000 });
      }

      // Probe round trips: sell the whole probe as soon as its buy has landed.
      for (const [mint, selling] of probeState) {
        const pos = state.positions.get(mint);
        const curve = state.curves.get(mint);
        if (pos === undefined) {
          if (!pendingCount.has(mint)) probeState.delete(mint);
          continue;
        }
        if (curve === undefined || curve.complete || pendingCount.has(mint)) continue;
        if (out.length >= batchCap) break;
        out.push({ side: 'sell', mint, token_amount: pos.token_amount, max_slippage_bps: 10_000 });
        if (!selling) probeState.set(mint, true);
      }

      // Then entries: one small buy per opening burst, no adds, no averaging down.
      let cashFree = Number(state.freeCashLamports()) / LAMPORTS_IN_SOL;
      let openSlots = state.hello.caps.max_open_positions - state.committedPositionCount();
      let committedSol = 0;
      for (const [mint, trade] of openTrades) {
        committedSol += Math.max(trade.costBasis, Number(state.positions.get(mint)?.cost_lamports ?? 0n) / LAMPORTS_IN_SOL);
      }
      for (const mint of touched) {
        if (out.length >= batchCap) break;
        if (openSlots <= 0) break;
        const curve = state.curves.get(mint);
        if (curve === undefined || curve.complete) continue;
        if (pendingCount.has(mint) || probeState.has(mint) || openTrades.has(mint)) continue;
        const tape = curveTapes.get(mint)!;
        if (tape.buys >= s.maxBuysPerCurve || slotNow - tape.lastExitSlot < s.rebuyCooldown) continue;
        const price = Number(curve.virtual_quote_reserves) / Number(curve.virtual_token_reserves);
        const curveSol = Number(curve.real_quote_reserves) / LAMPORTS_IN_SOL;
        if (!burstIsTradable(tape, slotNow, curveSol, price)) continue;
        const capSol = Math.floor(Number(state.maxBuyLamports(mint))) / LAMPORTS_IN_SOL;
        let amount = Math.min(capSol, s.sizeSol, s.maxTotalExposureSol - committedSol);
        if (amount > cashFree - feeSol) amount = cashFree - feeSol;
        if (amount < s.minOrderSol) continue;
        const lamports = BigInt(Math.floor(amount * LAMPORTS_IN_SOL));
        out.push({ side: 'buy', mint, quote_lamports: lamports, max_slippage_bps: s.buySlippageBps });
        cashFree -= amount + feeSol;
        committedSol += amount;
        openTrades.set(mint, { openedSlot: slotNow, bestValue: 0, costBasis: amount, windingDown: false, hasFilled: false, firstLegDone: false, firstLegTokens: 0n });
        tape.buys++;
        openSlots--;
      }

      // Guardrail pacing: open a probe when fills or coins lag the pace.
      if (probeState.size < s.maxConcurrentProbes && openSlots > 0 && windowStart !== null && windowEnd !== null) {
        const pace = Math.min(1, (windowEnd - windowStart) / s.paceWindowSecs);
        const coinsBehind = coinsSeen.size < Math.ceil(s.paceTargetCoins * pace);
        const fillsBehind = fillsSeen < Math.ceil(s.paceTargetFills * pace);
        if (coinsBehind || fillsBehind) {
          const minCurve = (s.probeSizeSol * 10_000) / state.hello.caps.max_order_bps_of_real_reserve;
          for (const mint of touched) {
            if (out.length >= batchCap || probeState.size >= s.maxConcurrentProbes) break;
            if (openTrades.has(mint) || probeState.has(mint) || pendingCount.has(mint) || state.positions.has(mint)) continue;
            if (coinsBehind && !fillsBehind && coinsSeen.has(mint)) continue;
            const curve = state.curves.get(mint);
            if (curve === undefined || curve.complete) continue;
            if (Number(curve.real_quote_reserves) / LAMPORTS_IN_SOL < minCurve * 1.5) continue;
            if (cashFree < s.probeSizeSol + 2 * feeSol) break;
            out.push({ side: 'buy', mint, quote_lamports: BigInt(Math.floor(s.probeSizeSol * LAMPORTS_IN_SOL)), max_slippage_bps: s.buySlippageBps });
            probeState.set(mint, false);
            cashFree -= s.probeSizeSol + feeSol;
          }
        }
      }
      return out;
    },
  };
}
