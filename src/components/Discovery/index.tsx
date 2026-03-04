/**
 * Strategy Discovery Panel
 *
 * Runs the discovery engine to find winning backtested patterns
 * and lets the user load the best one into the Strategy Builder.
 */

import React, { useState, useRef, useCallback } from 'react'
import { Zap, X, Trophy, TrendingUp, ChevronRight, Loader2, Square, Info } from 'lucide-react'
import { runDiscovery, DiscoveryCandidate, DiscoveryConfig } from '../../engine/discoveryEngine'
import { useStore } from '../../store/useStore'

const fmt = (n: number, dec = 2) => n.toFixed(dec)
const fmtMoney = (n: number) => (n >= 0 ? '+' : '') + '$' + Math.abs(n).toFixed(0)

const METRIC_LABELS: Record<string, string> = {
  profit_factor: 'Profit Factor',
  sharpe_ratio:  'Sharpe Ratio',
  net_pnl:       'Net P&L',
  roi:           'ROI %',
}

interface Props { onClose: () => void }

export const DiscoveryPanel: React.FC<Props> = ({ onClose }) => {
  const { currentStrategy, loadStrategy } = useStore()

  const [running,    setRunning]   = useState(false)
  const [done,       setDone]      = useState(0)
  const [total,      setTotal]     = useState(0)
  const [best,       setBest]      = useState<DiscoveryCandidate | null>(null)
  const [results,    setResults]   = useState<DiscoveryCandidate[]>([])
  const [metric,     setMetric]    = useState<DiscoveryConfig['targetMetric']>('profit_factor')
  const [shoes,      setShoes]     = useState(200)
  const [phase,      setPhase]     = useState<'idle' | 'running' | 'done'>('idle')

  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async () => {
    abortRef.current = new AbortController()
    setRunning(true)
    setPhase('running')
    setDone(0); setTotal(0); setBest(null); setResults([])

    const allResults = await runDiscovery({
      baseUnit:    currentStrategy.base_unit,
      bankroll:    currentStrategy.bankroll,
      numShoes:    shoes,
      targetMetric: metric,
      signal:      abortRef.current.signal,
      onProgress:  (d, t, b) => {
        setDone(d)
        setTotal(t)
        if (b) setBest(b)
      },
    })

    setResults(allResults.slice(0, 20))
    setRunning(false)
    setPhase('done')
  }, [currentStrategy.base_unit, currentStrategy.bankroll, shoes, metric])

  const stop = () => {
    abortRef.current?.abort()
    setRunning(false)
    setPhase(results.length > 0 ? 'done' : 'idle')
  }

  const loadResult = (c: DiscoveryCandidate) => {
    loadStrategy(c.strategy)
    onClose()
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const metricVal = (c: DiscoveryCandidate) => {
    const m = c.results?.metrics
    if (!m) return '—'
    switch (metric) {
      case 'profit_factor': return fmt(m.profit_factor)
      case 'sharpe_ratio':  return fmt(m.sharpe_ratio)
      case 'net_pnl':       return fmtMoney(m.net_pnl)
      case 'roi':           return fmt(m.roi * 100) + '%'
    }
  }

  const medalColor = (i: number) =>
    i === 0 ? 'rgba(251,191,36,0.9)' :
    i === 1 ? 'rgba(156,163,175,0.9)' :
    i === 2 ? 'rgba(180,120,60,0.9)' : 'rgba(255,255,255,0.3)'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="glass-elevated w-full max-w-xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <Zap size={16} style={{ color: 'rgba(251,191,36,0.9)' }}/>
            <h3 className="font-bold text-white/90 text-sm">Strategy Discovery</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono"
              style={{ background: 'rgba(251,191,36,0.12)', color: 'rgba(251,191,36,0.8)', border: '1px solid rgba(251,191,36,0.2)' }}>
              AUTO-SEARCH
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors"><X size={16}/></button>
        </div>

        {/* Config */}
        {phase === 'idle' && (
          <div className="px-5 py-4 space-y-4 flex-1 overflow-y-auto">
            <div className="p-3 rounded-xl text-xs text-white/50"
              style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
              <div className="flex gap-2 items-start">
                <Info size={12} className="shrink-0 mt-0.5" style={{ color: 'rgba(251,191,36,0.6)' }}/>
                Tries every combination of bet side, streak length, progression system, stop-loss, and take-profit.
                Runs a fast backtest on each and ranks by your chosen metric. Load any winner into the Strategy Builder.
              </div>
            </div>

            <div>
              <div className="section-label mb-1.5">Rank by</div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(METRIC_LABELS) as DiscoveryConfig['targetMetric'][]).map(m => (
                  <button key={m} onClick={() => setMetric(m)}
                    className="px-3 py-2 rounded-lg text-xs text-left transition-all"
                    style={{
                      background: metric === m ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${metric === m ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`,
                      color: metric === m ? 'rgba(165,180,252,0.95)' : 'rgba(255,255,255,0.45)',
                    }}>
                    {METRIC_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="section-label mb-1.5">Shoes per test <span className="text-white/30">(more = slower but more accurate)</span></div>
              <div className="flex gap-2">
                {[50, 200, 500].map(n => (
                  <button key={n} onClick={() => setShoes(n)}
                    className="px-3 py-1.5 rounded-lg text-xs transition-all"
                    style={{
                      background: shoes === n ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${shoes === n ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`,
                      color: shoes === n ? 'rgba(165,180,252,0.95)' : 'rgba(255,255,255,0.45)',
                    }}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-white/25">
                ~{(2 * 4 * 5 * 4 * 4)} combinations × {shoes} shoes each
              </div>
            </div>
          </div>
        )}

        {/* Running */}
        {phase === 'running' && (
          <div className="px-5 py-4 flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-blue-400">
                <Loader2 size={12} className="animate-spin"/>Searching…
              </span>
              <span className="font-mono text-white/60">{done} / {total}</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#f59e0b)' }}/>
            </div>
            {best && (
              <div className="p-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Trophy size={11} style={{ color: 'rgba(251,191,36,0.8)' }}/>
                  <span className="text-[10px] font-mono font-bold" style={{ color: 'rgba(251,191,36,0.7)' }}>CURRENT BEST</span>
                </div>
                <div className="text-xs text-white/70 truncate">{best.label}</div>
                <div className="text-[11px] font-mono mt-1" style={{ color: 'rgba(251,191,36,0.9)' }}>
                  {METRIC_LABELS[metric]}: {metricVal(best)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {phase === 'done' && results.length > 0 && (
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="section-label mb-2">Top {results.length} strategies — click to load</div>
            <div className="space-y-1.5">
              {results.map((c, i) => (
                <button key={c.id} onClick={() => loadResult(c)}
                  className="w-full text-left p-3 rounded-xl transition-all group"
                  style={{
                    background: i === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold w-4 shrink-0" style={{ color: medalColor(i) }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white/75 truncate group-hover:text-white transition-colors">{c.label}</div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-[10px] font-mono" style={{ color: 'rgba(74,222,128,0.8)' }}>
                          {METRIC_LABELS[metric]}: {metricVal(c)}
                        </span>
                        {c.results && <>
                          <span className="text-[10px] font-mono text-white/35">
                            WR {(c.results.metrics.win_rate * 100).toFixed(1)}%
                          </span>
                          <span className="text-[10px] font-mono text-white/35">
                            DD {(c.results.metrics.max_drawdown * 100).toFixed(1)}%
                          </span>
                        </>}
                      </div>
                    </div>
                    <ChevronRight size={12} className="shrink-0 text-white/20 group-hover:text-white/50 transition-colors"/>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <div className="px-5 py-4 shrink-0 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {phase === 'idle' && (
            <button onClick={start} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm">
              <Zap size={13}/>Start Discovery
            </button>
          )}
          {phase === 'running' && (
            <button onClick={stop}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl transition-all"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgba(248,113,113,0.9)' }}>
              <Square size={12} fill="currentColor"/>Stop
            </button>
          )}
          {phase === 'done' && (
            <>
              <button onClick={() => { setPhase('idle'); setResults([]) }}
                className="btn-glass flex-1 py-2.5 text-sm">New Search</button>
              {best && (
                <button onClick={() => loadResult(best!)}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm">
                  <TrendingUp size={13}/>Load Best
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
