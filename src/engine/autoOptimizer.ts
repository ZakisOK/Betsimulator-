/**
 * Auto-Optimization Engine
 *
 * Iteratively discovers, deep-backtests, and mutates Baccarat strategies
 * until the win_rate target is reached or max iterations exhausted.
 *
 * Strategy: Selective betting — only place bets when recent history shows
 * a favourable run, dramatically reducing hand count but lifting win%.
 */

import type { Strategy, Rule, BetSide, SimulationConfig, BacktestResults } from '../types'
import { runSimulation } from './simulator'
import { sendAgentRequest } from '../agent/mathAgent'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface IterationLogEntry {
  iteration: number
  phase: string
  label: string
  winRate: number
  netPnl: number
  shoes: number
}

export interface IterationState {
  iteration: number
  phase: 'scan' | 'deep' | 'mutate' | 'ai_guide' | 'done'
  bestWinRate: number
  bestStrategy: Strategy | null
  bestResults: BacktestResults | null
  log: IterationLogEntry[]
  done: boolean
  aborted: boolean
}

export interface AutoOptimizerConfig {
  baseUnit: number
  bankroll: number
  targetWinRate: number       // e.g. 0.50
  maxIterations: number       // e.g. 10
  fastShoes: number           // shoes for fast scan (e.g. 100)
  deepShoes: number           // shoes for deep test (e.g. 1000)
  onUpdate: (state: IterationState) => void
  signal: AbortSignal
}

// ────────────────────────────────────────────────────────────
// ID helper
// ────────────────────────────────────────────────────────────

let _c = 0
function uid() { return `ao_${++_c}_${Math.random().toString(36).slice(2,6)}` }

// ────────────────────────────────────────────────────────────
// SimulationConfig factory
// ────────────────────────────────────────────────────────────

function mkCfg(bankroll: number, shoes: number): SimulationConfig {
  return {
    num_shoes: shoes,
    hands_per_shoe: 80,
    deck_count: 8,
    commission_rate: 0.05,
    shuffle_type: 'imperfect',
    cut_card_position: 14,
    tie_handling: 'push',
    starting_bankroll: bankroll,
    random_seed: 42,
  }
}

// ────────────────────────────────────────────────────────────
// Strategy template builders
// ────────────────────────────────────────────────────────────

/**
 * Builds a selective-betting strategy:
 * - Only bet after `minWinStreak` consecutive wins on `side`
 * - Skip `skipAfterLosses` hands after a losing streak
 * - Reset progression after a win
 * - Stop-loss and take-profit guards
 */
function buildSelective(
  side: BetSide,
  minWinStreak: number,
  skipAfterLosses: number,
  stopLoss: number,
  takeProfit: number,
  baseUnit: number,
  bankroll: number,
): Strategy {
  const rules: Rule[] = [
    // Bet on the hot side
    {
      id: uid(), priority: 1, enabled: true,
      label: `Bet ${side} (base)`,
      trigger: { type: 'hand_count', hand_min: 1 },
      action: { type: 'place_bet', side, unit_size: 1 },
      modifiers: { shoe_reset: 'reset' },
    },
    // Only enter after N consecutive wins (selective entry)
    {
      id: uid(), priority: 2, enabled: true,
      label: `Enter after ${minWinStreak} ${side} wins`,
      trigger: { type: 'streak', side, direction: 'consecutive_wins', min_length: minWinStreak },
      action: { type: 'place_bet', side, unit_size: 1 },
      modifiers: { shoe_reset: 'reset' },
    },
    // Skip hands after losing streak
    {
      id: uid(), priority: 3, enabled: true,
      label: `Skip ${skipAfterLosses > 1 ? skipAfterLosses : 1} after loss streak`,
      trigger: { type: 'streak', side: 'Any', direction: 'consecutive_losses', min_length: skipAfterLosses },
      action: { type: 'skip_hand', skip_count: 2 },
      modifiers: { shoe_reset: 'carry' },
    },
    // Reset after any win
    {
      id: uid(), priority: 4, enabled: true,
      label: 'Reset after win',
      trigger: { type: 'streak', side: 'Any', direction: 'consecutive_wins', min_length: 1 },
      action: { type: 'reset_progression', reset_to: 1 },
      modifiers: { shoe_reset: 'carry' },
    },
    // Stop-loss
    {
      id: uid(), priority: 9, enabled: true,
      label: `Stop loss $${stopLoss}`,
      trigger: { type: 'financial_state', condition: 'session_loss', threshold: -stopLoss },
      action: { type: 'stop_loss', threshold: -stopLoss },
      modifiers: {},
    },
    // Take-profit
    {
      id: uid(), priority: 8, enabled: true,
      label: `Take profit $${takeProfit}`,
      trigger: { type: 'financial_state', condition: 'session_profit', threshold: takeProfit },
      action: { type: 'take_profit', threshold: takeProfit },
      modifiers: {},
    },
  ]

  const label = `${side}·win${minWinStreak}·skip${skipAfterLosses}·SL${stopLoss}/TP${takeProfit}`
  return {
    id: uid(), name: label, version: '1.0',
    base_unit: baseUnit, bankroll,
    rules,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// ────────────────────────────────────────────────────────────
// Candidate space (Phase 1 — wide scan)
// ────────────────────────────────────────────────────────────

function buildInitialCandidates(baseUnit: number, bankroll: number): Strategy[] {
  const sides: BetSide[]  = ['Banker', 'Player']
  const streaks            = [1, 2, 3]
  const skips              = [1, 2, 3, 4]
  const stopLosses         = [150, 250, 400, 600]
  const takeProfits        = [200, 350, 600, 1000]

  const out: Strategy[] = []
  for (const side of sides)
    for (const streak of streaks)
      for (const skip of skips)
        for (const sl of stopLosses)
          for (const tp of takeProfits)
            out.push(buildSelective(side, streak, skip, sl, tp, baseUnit, bankroll))

  return out
}

// ────────────────────────────────────────────────────────────
// Mutation (Phase 3)
// ────────────────────────────────────────────────────────────

interface MutationParams {
  side?: BetSide
  minWinStreak?: number
  skipAfterLosses?: number
  stopLoss?: number
  takeProfit?: number
}

/** Extract numerical param from a rule label */
function extractParam(rules: Rule[], labelPart: string): number | undefined {
  for (const r of rules) {
    const m = r.label.match(new RegExp(`${labelPart}\\s*[\\$]?([\\d.]+)`))
    if (m) return parseFloat(m[1])
  }
  return undefined
}

function decodeStrategy(s: Strategy): MutationParams {
  const labels = s.rules.map(r => r.label).join(' ')
  const sideM = labels.match(/Bet (Banker|Player)/)
  return {
    side:             sideM ? sideM[1] as BetSide : 'Banker',
    minWinStreak:     extractParam(s.rules, 'Enter after') ?? 2,
    skipAfterLosses:  extractParam(s.rules, 'Skip') ?? 2,
    stopLoss:         extractParam(s.rules, 'Stop loss \\$') ?? 300,
    takeProfit:       extractParam(s.rules, 'Take profit \\$') ?? 500,
  }
}

function mutate(base: Strategy, baseUnit: number, bankroll: number): Strategy[] {
  const p = decodeStrategy(base)
  const mutations: MutationParams[] = []

  const sides: BetSide[] = ['Banker', 'Player']
  for (const side of sides) {
    for (const dStreak of [-1, 0, 1]) {
      for (const dSkip of [-1, 0, 1]) {
        for (const dSL of [-100, 0, 100]) {
          for (const dTP of [-150, 0, 150]) {
            const streak = Math.max(1, (p.minWinStreak ?? 2) + dStreak)
            const skip   = Math.max(1, (p.skipAfterLosses ?? 2) + dSkip)
            const sl     = Math.max(50, (p.stopLoss ?? 300) + dSL)
            const tp     = Math.max(100, (p.takeProfit ?? 500) + dTP)
            mutations.push({ side, minWinStreak: streak, skipAfterLosses: skip, stopLoss: sl, takeProfit: tp })
          }
        }
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>()
  return mutations
    .filter(m => {
      const k = `${m.side}|${m.minWinStreak}|${m.skipAfterLosses}|${m.stopLoss}|${m.takeProfit}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map(m => buildSelective(m.side!, m.minWinStreak!, m.skipAfterLosses!, m.stopLoss!, m.takeProfit!, baseUnit, bankroll))
}

// ────────────────────────────────────────────────────────────
// Claude AI guidance (Phase 4 — every 3rd iteration)
// ────────────────────────────────────────────────────────────

async function getAIGuidance(
  best: Strategy,
  results: BacktestResults
): Promise<MutationParams | null> {
  try {
    const msg = await sendAgentRequest(
      `Win rate is currently ${(results.metrics.win_rate * 100).toFixed(2)}%. ` +
      `I need to reach 50%+ win rate. My current best strategy uses selective betting — only entering after win streaks. ` +
      `Analyze the strategy and metrics. Suggest specific changes to: ` +
      `(1) minWinStreak (currently extracting from rules), ` +
      `(2) skipAfterLosses (how many hands to skip after a loss run), ` +
      `(3) stop_loss threshold, (4) take_profit threshold, (5) bet side. ` +
      `Reply ONLY with a JSON object like: {"side":"Banker","minWinStreak":3,"skipAfterLosses":3,"stopLoss":200,"takeProfit":400}`,
      best,
      results,
      [],
    )
    const text = msg.content
    const jsonMatch = text.match(/\{[^}]+\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as MutationParams
    }
  } catch {
    // ignore
  }
  return null
}

// ────────────────────────────────────────────────────────────
// Main loop
// ────────────────────────────────────────────────────────────

export async function runAutoOptimizer(cfg: AutoOptimizerConfig): Promise<IterationState> {
  const state: IterationState = {
    iteration: 0,
    phase: 'scan',
    bestWinRate: 0,
    bestStrategy: null,
    bestResults: null,
    log: [],
    done: false,
    aborted: false,
  }

  const update = (patch: Partial<IterationState>) => {
    Object.assign(state, patch)
    cfg.onUpdate({ ...state, log: [...state.log] })
  }

  const fastCfg = mkCfg(cfg.bankroll, cfg.fastShoes)
  const deepCfg = mkCfg(cfg.bankroll, cfg.deepShoes)

  let pool: Strategy[] = []
  let iteration = 0

  // ── Phase 1: Wide scan ────────────────────────────────────
  update({ phase: 'scan' })
  const initialCandidates = buildInitialCandidates(cfg.baseUnit, cfg.bankroll)
  const scanResults: { strategy: Strategy; winRate: number; results: BacktestResults }[] = []

  for (let i = 0; i < initialCandidates.length; i++) {
    if (cfg.signal.aborted) { update({ aborted: true }); return state }
    try {
      const r = await runSimulation(initialCandidates[i], fastCfg, () => {})
      scanResults.push({ strategy: initialCandidates[i], winRate: r.metrics.win_rate, results: r })
      state.log.push({ iteration: 0, phase: 'scan', label: initialCandidates[i].name, winRate: r.metrics.win_rate, netPnl: r.metrics.net_pnl, shoes: cfg.fastShoes })
    } catch { /* skip */ }
    if (i % 10 === 0) {
      update({ phase: 'scan' })
      await new Promise(r => setTimeout(r, 0))
    }
  }

  // Sort by win rate, take top 10
  scanResults.sort((a, b) => b.winRate - a.winRate)
  pool = scanResults.slice(0, 10).map(r => r.strategy)

  // ── Iteration loop ────────────────────────────────────────
  while (iteration < cfg.maxIterations) {
    if (cfg.signal.aborted) { update({ aborted: true }); return state }
    iteration++

    // Phase 2: Deep backtest on pool
    update({ iteration, phase: 'deep' })
    let deepBest: { strategy: Strategy; results: BacktestResults; winRate: number } | null = null

    for (const s of pool) {
      if (cfg.signal.aborted) { update({ aborted: true }); return state }
      try {
        const r = await runSimulation(s, deepCfg, () => {})
        const wr = r.metrics.win_rate
        state.log.push({ iteration, phase: 'deep', label: s.name, winRate: wr, netPnl: r.metrics.net_pnl, shoes: cfg.deepShoes })
        if (!deepBest || wr > deepBest.winRate) deepBest = { strategy: s, results: r, winRate: wr }
        if (wr > state.bestWinRate) {
          update({ bestWinRate: wr, bestStrategy: s, bestResults: r })
        }
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 0))
    }

    update({ iteration, phase: 'deep' })

    // Check target
    if (state.bestWinRate >= cfg.targetWinRate) {
      update({ done: true, phase: 'done' })
      return state
    }

    if (!deepBest) break

    // Phase 4 (every 3rd iteration): AI guidance
    if (iteration % 3 === 0) {
      update({ phase: 'ai_guide' })
      const aiParams = await getAIGuidance(deepBest.strategy, deepBest.results)
      if (aiParams) {
        const aiStrategy = buildSelective(
          aiParams.side ?? 'Banker',
          aiParams.minWinStreak ?? 2,
          aiParams.skipAfterLosses ?? 2,
          aiParams.stopLoss ?? 300,
          aiParams.takeProfit ?? 500,
          cfg.baseUnit,
          cfg.bankroll,
        )
        pool = [aiStrategy, ...mutate(deepBest.strategy, cfg.baseUnit, cfg.bankroll).slice(0, 9)]
      } else {
        pool = mutate(deepBest.strategy, cfg.baseUnit, cfg.bankroll).slice(0, 10)
      }
    } else {
      // Phase 3: Mutate around best
      update({ phase: 'mutate' })
      const mutations = mutate(deepBest.strategy, cfg.baseUnit, cfg.bankroll)
      // Fast-filter mutations
      const mutResults: { strategy: Strategy; winRate: number }[] = []
      for (let i = 0; i < Math.min(50, mutations.length); i++) {
        if (cfg.signal.aborted) { update({ aborted: true }); return state }
        try {
          const r = await runSimulation(mutations[i], fastCfg, () => {})
          mutResults.push({ strategy: mutations[i], winRate: r.metrics.win_rate })
          state.log.push({ iteration, phase: 'mutate', label: mutations[i].name, winRate: r.metrics.win_rate, netPnl: r.metrics.net_pnl, shoes: cfg.fastShoes })
        } catch { /* skip */ }
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 0))
      }
      mutResults.sort((a, b) => b.winRate - a.winRate)
      pool = mutResults.slice(0, 10).map(r => r.strategy)
      update({ phase: 'mutate' })
    }
  }

  update({ done: true, phase: 'done' })
  return state
}
