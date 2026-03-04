/**
 * Strategy Discovery Engine
 *
 * Systematically explores combinations of betting rules (side, streak length,
 * progression, stop-loss, take-profit) and ranks them by backtested performance.
 */

import type { Strategy, Rule, SimulationConfig, BacktestResults, BetSide, ProgressionMethod } from '../types'
import { runSimulation } from './simulator'

// ────────────────────────────────────────────────────────────
// Candidate space
// ────────────────────────────────────────────────────────────

const BET_SIDES:    BetSide[]           = ['Banker', 'Player']
const STREAK_LENS:  number[]            = [1, 2, 3, 4]
const PROGRESSIONS: ProgressionMethod[] = ['flat', 'martingale', 'fibonacci', 'dalembert', '1326']
const STOP_LOSSES:  number[]            = [200, 300, 500, 750]   // $ amounts
const TAKE_PROFITS: number[]            = [200, 400, 600, 1000]  // $ amounts

export interface DiscoveryCandidate {
  id: string
  label: string
  strategy: Strategy
  results?: BacktestResults
  score: number              // composite rank score
}

export interface DiscoveryConfig {
  baseUnit: number
  bankroll: number
  numShoes: number           // shoes per backtest (keep low for speed)
  targetMetric: 'profit_factor' | 'sharpe_ratio' | 'net_pnl' | 'roi'
  onProgress: (done: number, total: number, best: DiscoveryCandidate | null) => void
  signal: AbortSignal
}

// ────────────────────────────────────────────────────────────
// Candidate builder
// ────────────────────────────────────────────────────────────

let _idCounter = 0
function uid() { return `disc_${++_idCounter}_${Math.random().toString(36).slice(2,6)}` }

function buildCandidates(baseUnit: number, bankroll: number): DiscoveryCandidate[] {
  const candidates: DiscoveryCandidate[] = []

  for (const side of BET_SIDES) {
    for (const streakLen of STREAK_LENS) {
      for (const prog of PROGRESSIONS) {
        for (const sl of STOP_LOSSES) {
          for (const tp of TAKE_PROFITS) {
            const rules: Rule[] = [
              // Base bet rule
              {
                id: uid(), priority: 1, enabled: true,
                label: `Bet ${side}`,
                trigger: { type: 'hand_count', hand_min: 1 },
                action:  { type: 'place_bet', side, unit_size: 1 },
                modifiers: { shoe_reset: 'reset' },
              },
            ]

            // Progression rule (only add if not flat, and streak > 1 or any)
            if (prog !== 'flat') {
              rules.push({
                id: uid(), priority: 2, enabled: true,
                label: `${prog} after ${streakLen} losses`,
                trigger: {
                  type: 'streak', side: 'Any',
                  direction: 'consecutive_losses',
                  min_length: streakLen,
                },
                action: { type: 'adjust_unit', method: prog, value: 2 },
                modifiers: { max_bet: bankroll * 0.1 },
              })
              // Reset after win
              rules.push({
                id: uid(), priority: 3, enabled: true,
                label: 'Reset after win',
                trigger: { type: 'streak', side: 'Any', direction: 'consecutive_wins', min_length: 1 },
                action:  { type: 'reset_progression', reset_to: 1 },
                modifiers: { shoe_reset: 'carry' },
              })
            }

            // Stop loss
            rules.push({
              id: uid(), priority: 9, enabled: true,
              label: `Stop loss $${sl}`,
              trigger: { type: 'financial_state', condition: 'session_loss', threshold: -sl },
              action:  { type: 'stop_loss', threshold: -sl },
              modifiers: {},
            })

            // Take profit
            rules.push({
              id: uid(), priority: 8, enabled: true,
              label: `Take profit $${tp}`,
              trigger: { type: 'financial_state', condition: 'session_profit', threshold: tp },
              action:  { type: 'take_profit', threshold: tp },
              modifiers: {},
            })

            const label = `${side} · ${prog !== 'flat' ? `${prog}@${streakLen}L` : 'flat'} · SL$${sl}/TP$${tp}`
            candidates.push({
              id: uid(),
              label,
              score: 0,
              strategy: {
                id: uid(),
                name: label,
                version: '1.0',
                base_unit: baseUnit,
                bankroll,
                rules,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            })
          }
        }
      }
    }
  }

  return candidates
}

// ────────────────────────────────────────────────────────────
// Scoring
// ────────────────────────────────────────────────────────────

function score(r: BacktestResults, metric: DiscoveryConfig['targetMetric']): number {
  const m = r.metrics
  switch (metric) {
    case 'profit_factor': return m.profit_factor
    case 'sharpe_ratio':  return m.sharpe_ratio
    case 'net_pnl':       return m.net_pnl
    case 'roi':           return m.roi
    default:              return m.profit_factor
  }
}

// ────────────────────────────────────────────────────────────
// Main discovery run
// ────────────────────────────────────────────────────────────

export async function runDiscovery(cfg: DiscoveryConfig): Promise<DiscoveryCandidate[]> {
  const candidates = buildCandidates(cfg.baseUnit, cfg.bankroll)

  // Use a small shoe count to keep things fast; caller can do a deep dive on winners
  const simCfg: SimulationConfig = {
    num_shoes: cfg.numShoes,
    hands_per_shoe: 80,
    deck_count: 8,
    commission_rate: 0.05,
    shuffle_type: 'imperfect',
    cut_card_position: 14,
    tie_handling: 'push',
    starting_bankroll: cfg.bankroll,
    random_seed: 42,
  }

  const results: DiscoveryCandidate[] = []
  let best: DiscoveryCandidate | null = null

  for (let i = 0; i < candidates.length; i++) {
    if (cfg.signal.aborted) break

    const c = candidates[i]
    try {
      const r = await runSimulation(c.strategy, simCfg, () => {})
      c.results = r
      c.score   = score(r, cfg.targetMetric)
      results.push(c)
      if (!best || c.score > best.score) best = c
    } catch {
      // skip failed candidates
    }

    cfg.onProgress(i + 1, candidates.length, best)

    // Yield to keep UI responsive
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 0))
  }

  return results
    .filter(c => c.results && isFinite(c.score))
    .sort((a, b) => b.score - a.score)
}
