/**
 * Auto-Optimizer Panel
 *
 * UI for the iterative win-rate optimization agent.
 * Runs in a modal: Config → Running (live log) → Done (winner + load button).
 */

import React, { useState, useRef, useCallback } from 'react'
import { Bot, X, Play, Square, TrendingUp, CheckCircle, ChevronRight, Loader2, Zap, Trophy, AlertTriangle } from 'lucide-react'
import { runAutoOptimizer, IterationState, IterationLogEntry } from '../../engine/autoOptimizer'
import { useStore } from '../../store/useStore'

interface Props { onClose: () => void }

const PHASE_LABELS: Record<string, string> = {
  scan:     'Wide Scan',
  deep:     'Deep Backtest',
  mutate:   'Mutating',
  ai_guide: 'AI Guidance',
  done:     'Complete',
}
const PHASE_COLORS: Record<string, string> = {
  scan:     'rgba(99,102,241,0.8)',
  deep:     'rgba(59,130,246,0.8)',
  mutate:   'rgba(245,158,11,0.8)',
  ai_guide: 'rgba(167,139,250,0.9)',
  done:     'rgba(74,222,128,0.9)',
}

function WinRateGauge({ value, target }: { value: number; target: number }) {
  const pct   = Math.min(100, (value / target) * 100)
  const color = value >= target ? 'rgba(74,222,128,0.9)' : value >= target * 0.9 ? 'rgba(245,158,11,0.9)' : 'rgba(99,102,241,0.8)'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-mono">
        <span style={{ color }} className="font-bold">{(value * 100).toFixed(2)}%</span>
        <span className="text-white/30">target {(target * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, rgba(99,102,241,0.8), ${color})` }}/>
      </div>
      {value >= target && (
        <div className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(74,222,128,0.9)' }}>
          <CheckCircle size={11}/>Target reached!
        </div>
      )}
    </div>
  )
}

function LogRow({ entry, i }: { entry: IterationLogEntry; i: number }) {
  const color = entry.winRate >= 0.50 ? 'rgba(74,222,128,0.8)'
    : entry.winRate >= 0.45 ? 'rgba(245,158,11,0.7)'
    : 'rgba(255,255,255,0.35)'
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono py-0.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: i < 3 ? 1 : 0.7 }}>
      <span className="w-4 text-white/20 shrink-0 text-right">{entry.iteration}</span>
      <span className="w-14 shrink-0" style={{ color: PHASE_COLORS[entry.phase] ?? 'white' }}>
        {PHASE_LABELS[entry.phase] ?? entry.phase}
      </span>
      <span className="flex-1 truncate text-white/40">{entry.label}</span>
      <span className="w-12 text-right shrink-0 font-bold" style={{ color }}>{(entry.winRate * 100).toFixed(2)}%</span>
    </div>
  )
}

export const AutoOptimizerPanel: React.FC<Props> = ({ onClose }) => {
  const { currentStrategy, loadStrategy } = useStore()

  const [phase,         setPhase]     = useState<'config' | 'running' | 'done'>('config')
  const [state,         setState]     = useState<IterationState | null>(null)
  const [targetWinRate, setTarget]    = useState(0.50)
  const [maxIter,       setMaxIter]   = useState(6)
  const [fastShoes,     setFastShoes] = useState(100)
  const [deepShoes,     setDeepShoes] = useState(500)

  const abortRef  = useRef<AbortController | null>(null)
  const logRef    = useRef<HTMLDivElement>(null)

  const handleUpdate = useCallback((s: IterationState) => {
    setState({ ...s })
    // Auto-scroll log
    requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    })
  }, [])

  const start = useCallback(async () => {
    abortRef.current = new AbortController()
    setPhase('running')

    await runAutoOptimizer({
      baseUnit:     currentStrategy.base_unit,
      bankroll:     currentStrategy.bankroll,
      targetWinRate,
      maxIterations: maxIter,
      fastShoes,
      deepShoes,
      onUpdate:     handleUpdate,
      signal:       abortRef.current.signal,
    })

    setPhase('done')
  }, [currentStrategy.base_unit, currentStrategy.bankroll, targetWinRate, maxIter, fastShoes, deepShoes, handleUpdate])

  const stop = () => {
    abortRef.current?.abort()
    setPhase('done')
  }

  const loadBest = () => {
    if (state?.bestStrategy) {
      loadStrategy(state.bestStrategy)
      onClose()
    }
  }

  const recentLog = state ? [...state.log].reverse().slice(0, 80) : []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
      <div className="glass-elevated w-full max-w-xl flex flex-col"
        style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <Bot size={16} style={{ color: 'rgba(167,139,250,0.9)' }}/>
            <h3 className="font-bold text-white/90 text-sm">Auto-Optimizer</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono"
              style={{ background: 'rgba(167,139,250,0.12)', color: 'rgba(167,139,250,0.8)', border: '1px solid rgba(167,139,250,0.2)' }}>
              AGENT
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors"><X size={16}/></button>
        </div>

        {/* ── Config ── */}
        {phase === 'config' && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <div className="p-3 rounded-xl text-xs space-y-1.5"
              style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
              <div className="flex items-start gap-2">
                <Bot size={12} className="shrink-0 mt-0.5" style={{ color: 'rgba(167,139,250,0.7)' }}/>
                <span className="text-white/50">
                  Runs a <strong className="text-white/70">wide scan</strong> across selective-betting templates, then iteratively <strong className="text-white/70">mutates + deep-backtests</strong> around the best candidate. Uses Claude AI every 3rd iteration to guide parameter choices.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl text-xs"
              style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="flex gap-2 items-start">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" style={{ color: 'rgba(245,158,11,0.7)' }}/>
                <span className="text-white/40">
                  Win rate is maximised via <em>selective betting</em> — skipping hands after losing runs. This reduces hand count but raises win% on played hands. True house-edge elimination is mathematically impossible.
                </span>
              </div>
            </div>

            <div>
              <div className="section-label mb-2">Target Win Rate</div>
              <div className="flex items-center gap-3">
                <input type="range" min={0.46} max={0.56} step={0.01} value={targetWinRate}
                  onChange={e => setTarget(+e.target.value)}
                  className="flex-1 accent-violet-500"/>
                <span className="font-mono text-sm text-violet-300 w-12 text-right">{(targetWinRate*100).toFixed(0)}%</span>
              </div>
              <div className="text-[10px] text-white/25 mt-1">Higher targets require more iterations and may not be reachable</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="section-label mb-2">Max Iterations</div>
                <div className="flex gap-1.5">
                  {[3, 6, 10].map(n => (
                    <button key={n} onClick={() => setMaxIter(n)}
                      className="flex-1 py-1.5 rounded-lg text-xs transition-all"
                      style={{
                        background: maxIter === n ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${maxIter === n ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.07)'}`,
                        color: maxIter === n ? 'rgba(196,181,253,0.95)' : 'rgba(255,255,255,0.4)',
                      }}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-label mb-2">Deep Shoes</div>
                <div className="flex gap-1.5">
                  {[200, 500, 1000].map(n => (
                    <button key={n} onClick={() => setDeepShoes(n)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] transition-all"
                      style={{
                        background: deepShoes === n ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${deepShoes === n ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.07)'}`,
                        color: deepShoes === n ? 'rgba(196,181,253,0.95)' : 'rgba(255,255,255,0.4)',
                      }}>{n >= 1000 ? '1K' : n}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Running ── */}
        {phase === 'running' && state && (
          <div className="flex-1 overflow-hidden flex flex-col px-5 py-4 gap-4">
            {/* Status row */}
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" style={{ color: PHASE_COLORS[state.phase] }}/>
                <span className="text-sm font-bold" style={{ color: PHASE_COLORS[state.phase] }}>
                  {PHASE_LABELS[state.phase]}
                </span>
                <span className="text-[10px] font-mono text-white/30">iter {state.iteration}/{maxIter}</span>
              </div>
              <div className="text-[10px] font-mono text-white/30">{state.log.length} tested</div>
            </div>

            {/* Win rate gauge */}
            <div className="glass-metric p-3 shrink-0">
              <div className="section-label mb-2">Best Win Rate</div>
              <WinRateGauge value={state.bestWinRate} target={targetWinRate}/>
              {state.bestStrategy && (
                <div className="text-[10px] text-white/30 mt-1.5 truncate">{state.bestStrategy.name}</div>
              )}
            </div>

            {/* Live log */}
            <div ref={logRef} className="flex-1 overflow-y-auto min-h-0">
              <div className="section-label mb-1">Live Log</div>
              {recentLog.map((e, i) => <LogRow key={i} entry={e} i={i}/>)}
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {phase === 'done' && state && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Winner card */}
            {state.bestStrategy ? (
              <div className="p-4 rounded-xl space-y-3"
                style={{ background: state.bestWinRate >= targetWinRate ? 'rgba(74,222,128,0.07)' : 'rgba(245,158,11,0.07)',
                         border: `1px solid ${state.bestWinRate >= targetWinRate ? 'rgba(74,222,128,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                <div className="flex items-center gap-2">
                  <Trophy size={14} style={{ color: state.bestWinRate >= targetWinRate ? 'rgba(74,222,128,0.9)' : 'rgba(245,158,11,0.8)' }}/>
                  <span className="font-bold text-sm text-white/90">
                    {state.bestWinRate >= targetWinRate ? 'Target Reached!' : 'Best Found'}
                  </span>
                </div>
                <WinRateGauge value={state.bestWinRate} target={targetWinRate}/>
                <div className="text-[10px] text-white/40 truncate">{state.bestStrategy.name}</div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="glass-metric p-2">
                    <div className="text-white/30 mb-0.5">Net P&L</div>
                    <div className={state.bestResults && state.bestResults.metrics.net_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {state.bestResults ? `${state.bestResults.metrics.net_pnl >= 0 ? '+' : ''}$${state.bestResults.metrics.net_pnl.toFixed(0)}` : '—'}
                    </div>
                  </div>
                  <div className="glass-metric p-2">
                    <div className="text-white/30 mb-0.5">Iterations</div>
                    <div className="text-white/70">{state.iteration} / {maxIter}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-white/30 text-sm">No valid strategy found</div>
            )}

            {/* Log summary */}
            <div>
              <div className="section-label mb-1.5">Run Log ({state.log.length} tested)</div>
              <div className="max-h-48 overflow-y-auto">
                {[...state.log].reverse().slice(0, 50).map((e, i) => <LogRow key={i} entry={e} i={i}/>)}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {phase === 'config' && (
            <button onClick={start}
              className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm">
              <Play size={13} fill="currentColor"/>Start Optimizer
            </button>
          )}
          {phase === 'running' && (
            <button onClick={stop}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgba(248,113,113,0.9)' }}>
              <Square size={12} fill="currentColor"/>Stop
            </button>
          )}
          {phase === 'done' && (
            <>
              <button onClick={() => { setPhase('config'); setState(null) }}
                className="btn-glass flex-1 py-2.5 text-sm">New Run</button>
              {state?.bestStrategy && (
                <button onClick={loadBest}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm">
                  <TrendingUp size={13}/>Load Best Strategy
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
