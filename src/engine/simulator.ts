/**
 * Baccarat Strategy Simulation Engine
 *
 * Evaluates strategy rules against simulated shoes and produces
 * statistically valid performance metrics.
 */

import type {
  Action,
  BacktestResults,
  BetSide,
  HandResult,
  Rule,
  ShoeResult,
  SimulationConfig,
  Strategy,
  Trigger,
} from "../types";
import { type DealtHand, dealHand, generateShoe, mulberry32 } from "./baccarat";
import { calculateMetrics } from "./metrics";

// ────────────────────────────────────────────────────────────
// Simulation State
// ────────────────────────────────────────────────────────────

interface ProgressionState {
  level: number;
  fibonacci: [number, number];
  labouchere: number[];
  oscars: { profit: number; base: number };
  sequenceStep: number; // for 1-3-2-6
}

interface SimState {
  bankroll: number;
  session_pnl: number;
  current_unit: number;
  base_unit: number;
  locked_side: BetSide | null;
  lock_remaining: number;
  consecutive_wins: Record<BetSide, number>;
  consecutive_losses: Record<BetSide, number>;
  last_outcomes: ("B" | "P" | "T")[];
  hand_number: number;
  skip_remaining: number;
  stopped: boolean;
  progression: ProgressionState;
  commission_rate: number;
}

function initState(strategy: Strategy, config: SimulationConfig): SimState {
  return {
    bankroll: config.starting_bankroll,
    session_pnl: 0,
    current_unit: strategy.base_unit,
    base_unit: strategy.base_unit,
    locked_side: null,
    lock_remaining: 0,
    consecutive_wins: { Banker: 0, Player: 0, Tie: 0 },
    consecutive_losses: { Banker: 0, Player: 0, Tie: 0 },
    last_outcomes: [],
    hand_number: 0,
    skip_remaining: 0,
    stopped: false,
    progression: {
      level: 0,
      fibonacci: [1, 1],
      labouchere: [1, 2, 3, 4, 5],
      oscars: { profit: 0, base: 1 },
      sequenceStep: 0,
    },
    commission_rate: config.commission_rate,
  };
}

// ────────────────────────────────────────────────────────────
// Trigger Evaluation
// ────────────────────────────────────────────────────────────

function evaluateTrigger(trigger: Trigger, state: SimState): boolean {
  switch (trigger.type) {
    case "streak": {
      const side = trigger.side === "Any" ? undefined : (trigger.side as BetSide);
      const minLen = trigger.min_length ?? 1;
      if (trigger.direction === "consecutive_wins") {
        if (side) return state.consecutive_wins[side] >= minLen;
        return Math.max(...Object.values(state.consecutive_wins)) >= minLen;
      } else if (trigger.direction === "consecutive_losses") {
        if (side) return state.consecutive_losses[side] >= minLen;
        return Math.max(...Object.values(state.consecutive_losses)) >= minLen;
      } else if (trigger.direction === "alternating") {
        // Check for alternating pattern in recent outcomes
        const needed = minLen * 2;
        if (state.last_outcomes.length < needed) return false;
        const recent = state.last_outcomes.slice(-needed);
        for (let i = 1; i < recent.length; i++) {
          if (recent[i] === recent[i - 1]) return false;
        }
        return true;
      }
      return false;
    }

    case "pattern": {
      const pattern = trigger.pattern ?? "";
      const parts = pattern.toUpperCase().split("-").filter(Boolean);
      if (parts.length === 0) return false;
      const lookback = trigger.lookback ?? parts.length;
      if (state.last_outcomes.length < parts.length) return false;
      const recent = state.last_outcomes.slice(-Math.min(lookback, state.last_outcomes.length));
      // Check if the pattern appears at the end
      if (recent.length < parts.length) return false;
      const tail = recent.slice(-parts.length);
      return parts.every((p, i) => p[0] === tail[i]);
    }

    case "financial_state": {
      const threshold = trigger.threshold ?? 0;
      switch (trigger.condition) {
        case "session_loss":
          return state.session_pnl <= threshold;
        case "session_profit":
          return state.session_pnl >= threshold;
        case "bankroll_below":
          return state.bankroll <= threshold;
        case "bankroll_above":
          return state.bankroll >= threshold;
        default:
          return false;
      }
    }

    case "hand_count": {
      const min = trigger.hand_min ?? 0;
      const max = trigger.hand_max ?? Infinity;
      return state.hand_number >= min && state.hand_number <= max;
    }

    case "composite": {
      const subs = trigger.sub_triggers ?? [];
      if (trigger.operator === "OR") {
        return subs.some((t) => evaluateTrigger(t, state));
      }
      return subs.every((t) => evaluateTrigger(t, state));
    }

    default:
      return false;
  }
}

// ────────────────────────────────────────────────────────────
// Progression Bet Sizing
// ────────────────────────────────────────────────────────────

function getProgressionBet(action: Action, state: SimState): number {
  const base = state.base_unit;
  switch (action.method) {
    case "flat":
      return base * (action.unit_size ?? 1);

    case "multiply":
      return state.current_unit * (action.value ?? 1);

    case "add":
      return state.current_unit + base * (action.value ?? 1);

    case "martingale": {
      // Double after each loss; reset after win handled by reset_progression
      const level = state.progression.level;
      return base * 2 ** level;
    }

    case "fibonacci": {
      const [a] = state.progression.fibonacci;
      return base * a;
    }

    case "dalembert":
      return base * Math.max(1, state.progression.level + 1);

    case "1326": {
      const seq = [1, 3, 2, 6];
      return base * seq[state.progression.sequenceStep % 4];
    }

    case "oscars_grind": {
      const { base: ob } = state.progression.oscars;
      // Oscar's: stay same after loss, increase by 1 after win, cap at target
      return base * Math.max(1, ob);
    }

    case "labouchere": {
      const seq = state.progression.labouchere;
      if (seq.length === 0) return base;
      if (seq.length === 1) return base * seq[0];
      return base * (seq[0] + seq[seq.length - 1]);
    }

    default:
      return base * (action.unit_size ?? 1);
  }
}

function updateProgressionOnWin(state: SimState, action: Action): void {
  switch (action.method) {
    case "martingale":
      state.progression.level = 0;
      break;
    case "fibonacci": {
      // Move back two steps on win
      const prev = state.progression.fibonacci[1];
      const cur = state.progression.fibonacci[0];
      const newPrev = cur - prev;
      state.progression.fibonacci = [Math.max(1, newPrev), Math.max(1, cur - newPrev)];
      break;
    }
    case "dalembert":
      state.progression.level = Math.max(0, state.progression.level - 1);
      break;
    case "1326":
      state.progression.sequenceStep++;
      break;
    case "oscars_grind": {
      const gain = state.base_unit;
      state.progression.oscars.profit += gain;
      if (state.progression.oscars.profit >= state.base_unit * 4) {
        state.progression.oscars = { profit: 0, base: 1 };
      } else {
        state.progression.oscars.base++;
      }
      break;
    }
    case "labouchere": {
      const seq = state.progression.labouchere;
      if (seq.length >= 2) {
        state.progression.labouchere = seq.slice(1, -1);
      } else {
        state.progression.labouchere = [1, 2, 3, 4, 5];
      }
      break;
    }
  }
}

function updateProgressionOnLoss(state: SimState, action: Action): void {
  switch (action.method) {
    case "martingale":
      state.progression.level++;
      break;
    case "fibonacci": {
      const [a, b] = state.progression.fibonacci;
      state.progression.fibonacci = [a + b, a];
      break;
    }
    case "dalembert":
      state.progression.level++;
      break;
    case "1326":
      state.progression.sequenceStep = 0;
      break;
    case "oscars_grind":
      // Bet stays the same on loss
      break;
    case "labouchere": {
      const bet = getProgressionBet(action, state);
      state.progression.labouchere.push(Math.round(bet / state.base_unit));
      break;
    }
  }
}

// ────────────────────────────────────────────────────────────
// Apply Action
// ────────────────────────────────────────────────────────────

interface BetDecision {
  side: BetSide | null;
  amount: number;
  skip: boolean;
  stop: boolean;
  matchedAction?: Action;
}

function applyAction(action: Action, rule: Rule, state: SimState): BetDecision {
  const mod = rule.modifiers;

  switch (action.type) {
    case "place_bet": {
      const side = state.locked_side ?? action.side ?? "Banker";
      let amount = state.current_unit * (action.unit_size ?? 1);
      if (mod.max_bet && amount > mod.max_bet) amount = mod.max_bet;
      if (mod.bankroll_guard) {
        const minBankroll = state.bankroll * mod.bankroll_guard;
        if (state.bankroll - amount < minBankroll) {
          amount = Math.max(0, state.bankroll - minBankroll);
        }
      }
      if (amount <= 0) return { side: null, amount: 0, skip: true, stop: false };
      return { side, amount, skip: false, stop: false };
    }

    case "adjust_unit": {
      const newUnit = getProgressionBet(action, state);
      state.current_unit = newUnit;
      // After adjusting, also place a bet at the new unit
      const side = state.locked_side ?? "Banker";
      let amount = state.current_unit;
      if (mod.max_bet && amount > mod.max_bet) amount = mod.max_bet;
      return { side, amount, skip: false, stop: false };
    }

    case "skip_hand":
      state.skip_remaining = action.skip_count ?? 1;
      return { side: null, amount: 0, skip: true, stop: false };

    case "reset_progression":
      state.current_unit = state.base_unit;
      state.progression.level = 0;
      state.progression.fibonacci = [1, 1];
      state.progression.sequenceStep = 0;
      return { side: null, amount: 0, skip: true, stop: false };

    case "lock_side":
      state.locked_side = action.side ?? "Banker";
      state.lock_remaining = action.lock_duration ?? 5;
      return { side: null, amount: 0, skip: true, stop: false };

    case "stop_loss":
      if (state.session_pnl <= (action.threshold ?? -Infinity)) {
        return { side: null, amount: 0, skip: false, stop: true };
      }
      return { side: null, amount: 0, skip: true, stop: false };

    case "take_profit":
      if (state.session_pnl >= (action.threshold ?? Infinity)) {
        return { side: null, amount: 0, skip: false, stop: true };
      }
      return { side: null, amount: 0, skip: true, stop: false };

    default:
      return { side: null, amount: 0, skip: true, stop: false };
  }
}

// ────────────────────────────────────────────────────────────
// Evaluate Strategy for One Hand
// ────────────────────────────────────────────────────────────

function evaluateStrategy(state: SimState, rules: Rule[]): BetDecision {
  const activeRules = rules.filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);

  for (const rule of activeRules) {
    if (evaluateTrigger(rule.trigger, state)) {
      const decision = applyAction(rule.action, rule, state);
      decision.matchedAction = rule.action;
      if (decision.stop) return decision;
      if (!decision.skip || rule.action.type !== "place_bet") {
        return decision;
      }
    }
  }

  // No matching rule — skip hand
  return { side: null, amount: 0, skip: true, stop: false };
}

// ────────────────────────────────────────────────────────────
// Compute Hand P&L
// ────────────────────────────────────────────────────────────

function computePnL(
  decision: BetDecision,
  outcome: "Banker" | "Player" | "Tie",
  commissionRate: number,
  tieHandling: "push" | "lose"
): number {
  if (!decision.side || decision.amount <= 0) return 0;

  const { side, amount } = decision;

  if (side === outcome) {
    // Win
    const commission = side === "Banker" ? commissionRate : 0;
    if (side === "Tie") {
      return amount * 8; // Tie pays 8:1
    }
    return amount * (1 - commission);
  }

  if (outcome === "Tie") {
    if (tieHandling === "push") return 0; // push (no win/loss)
    return -amount; // treated as loss
  }

  return -amount; // Loss
}

// ────────────────────────────────────────────────────────────
// Update State After Hand
// ────────────────────────────────────────────────────────────

function updateState(
  state: SimState,
  outcome: "Banker" | "Player" | "Tie",
  decision: BetDecision,
  pnl: number,
  _config: SimulationConfig
): void {
  // Track consecutive streaks for all sides
  const sides: BetSide[] = ["Banker", "Player", "Tie"];
  for (const side of sides) {
    if (outcome === side) {
      state.consecutive_wins[side]++;
      state.consecutive_losses[side] = 0;
    } else {
      state.consecutive_wins[side] = 0;
      state.consecutive_losses[side]++;
    }
  }

  // Update recent outcome history (keep last 50)
  const outCode = outcome === "Banker" ? "B" : outcome === "Player" ? "P" : "T";
  state.last_outcomes.push(outCode);
  if (state.last_outcomes.length > 50) state.last_outcomes.shift();

  // Update bankroll
  state.bankroll += pnl;
  state.session_pnl += pnl;

  // Update progression after win/loss
  if (decision.side && decision.amount > 0 && decision.matchedAction) {
    const won = pnl > 0;
    const lost = pnl < 0;
    if (won) {
      updateProgressionOnWin(state, decision.matchedAction);
    } else if (lost) {
      updateProgressionOnLoss(state, decision.matchedAction);
    }
  }

  // Lock management
  if (state.lock_remaining > 0) {
    state.lock_remaining--;
    if (state.lock_remaining === 0) state.locked_side = null;
  }

  // Skip management
  if (state.skip_remaining > 0) state.skip_remaining--;

  state.hand_number++;
}

// ────────────────────────────────────────────────────────────
// Simulate One Shoe
// ────────────────────────────────────────────────────────────

function simulateShoe(
  shoeNum: number,
  strategy: Strategy,
  config: SimulationConfig,
  state: SimState,
  rng: () => number
): ShoeResult {
  const shoe = generateShoe(config.deck_count, rng);
  // Burn first card
  shoe.shift();

  const cutPoint = shoe.length - config.cut_card_position;
  const hands: HandResult[] = [];
  const sequence: ("B" | "P" | "T")[] = [];
  const startingBankroll = state.bankroll;

  // Reset shoe-level state if configured
  for (const rule of strategy.rules) {
    if (rule.modifiers.shoe_reset === "reset") {
      state.current_unit = state.base_unit;
      state.progression.level = 0;
      state.progression.fibonacci = [1, 1];
      state.progression.sequenceStep = 0;
    }
  }

  state.session_pnl = 0;
  state.hand_number = 0;
  state.consecutive_wins = { Banker: 0, Player: 0, Tie: 0 };
  state.consecutive_losses = { Banker: 0, Player: 0, Tie: 0 };

  while (shoe.length > cutPoint && !state.stopped) {
    // Evaluate strategy
    let decision: BetDecision;
    if (state.skip_remaining > 0) {
      decision = { side: null, amount: 0, skip: true, stop: false };
      state.skip_remaining--;
    } else {
      decision = evaluateStrategy(state, strategy.rules);
    }

    if (decision.stop) {
      state.stopped = true;
      break;
    }

    // Deal hand
    let dealt: DealtHand;
    try {
      dealt = dealHand(shoe);
    } catch {
      break;
    }

    const outcome = dealt.outcome;
    const pnl = computePnL(decision, outcome, config.commission_rate, config.tie_handling);

    const outCode = outcome === "Banker" ? "B" : outcome === "Player" ? "P" : "T";
    sequence.push(outCode);

    hands.push({
      hand_number: state.hand_number,
      outcome,
      player_value: dealt.playerValue,
      banker_value: dealt.bankerValue,
      bet_side: decision.side ?? undefined,
      bet_amount: decision.amount,
      pnl,
      bankroll: state.bankroll + pnl,
      skipped: decision.skip || !decision.side,
      is_natural: dealt.isNatural,
    });

    updateState(state, outcome, decision, pnl, config);

    if (state.bankroll <= 0) {
      state.stopped = true;
      break;
    }
  }

  const netPnl = state.bankroll - startingBankroll;

  return {
    shoe_number: shoeNum,
    sequence,
    hands,
    net_pnl: netPnl,
    starting_bankroll: startingBankroll,
    ending_bankroll: state.bankroll,
    hands_played: hands.length,
  };
}

// ────────────────────────────────────────────────────────────
// Main Simulation Runner
// ────────────────────────────────────────────────────────────

export async function runSimulation(
  strategy: Strategy,
  config: SimulationConfig,
  onProgress: (pct: number) => void
): Promise<BacktestResults> {
  const seed = config.random_seed ?? Math.floor(Math.random() * 0x7fffffff);
  const rng = mulberry32(seed);

  const state = initState(strategy, config);
  const shoes: ShoeResult[] = [];

  const BATCH = 100; // yield to UI every N shoes
  const startTime = performance.now();

  for (let i = 0; i < config.num_shoes; i++) {
    if (state.stopped) break;

    const shoeResult = simulateShoe(i + 1, strategy, config, state, rng);
    shoes.push(shoeResult);

    // Reset session stop flag between shoes (stop_loss is per-session, not permanent)
    state.stopped = false;
    state.session_pnl = 0;

    if (i % BATCH === 0) {
      onProgress(Math.round((i / config.num_shoes) * 100));
      // Yield to event loop
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress(100);

  const metrics = calculateMetrics(shoes, config);

  return {
    strategy_id: strategy.id,
    strategy_name: strategy.name,
    config,
    shoes,
    metrics,
    completed_at: new Date().toISOString(),
    duration_ms: performance.now() - startTime,
  };
}
